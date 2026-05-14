"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { matchSKU, indexarAliases, type Alias, type SKUCadastro } from "@/lib/match";

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (data: { data: ArrayBuffer }) => {
        promise: Promise<{
          numPages: number;
          getPage: (n: number) => Promise<{
            getTextContent: () => Promise<{
              items: Array<{ str: string; transform?: number[] }>;
            }>;
          }>;
        }>;
      };
    };
  }
}

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

type ItemExtraido = {
  sku_codigo: string;
  derivacao: string;
  descricao: string;
  quantidade: number;
};

type DadosExtraidos = {
  cliente: string;
  nome: string;
  owner: string;
  valor: number;
  data_fechamento: string | null;
  regiao: string;
  itens: ItemExtraido[];
  textoBruto: string;
};

type PdfJsLib = NonNullable<Window["pdfjsLib"]>;

async function carregarPdfjs(): Promise<PdfJsLib> {
  if (typeof window === "undefined") throw new Error("Sem window");
  const existing = window.pdfjsLib;
  if (existing) return existing;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS_CDN;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar pdfjs-dist do CDN"));
    document.head.appendChild(s);
  });
  const lib: PdfJsLib | undefined = window.pdfjsLib;
  if (!lib) throw new Error("pdfjsLib não disponível");
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return lib;
}

async function extrairTextoDoPdf(file: File): Promise<string> {
  const pdfjs = await carregarPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    texto += tc.items.map((it) => it.str).join("\n") + "\n";
  }
  return texto;
}

function parseValorBR(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
}

function parseDataPT(s: string): string | null {
  const meses: Record<string, number> = {
    janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4,
    maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
    outubro: 10, novembro: 11, dezembro: 12,
  };
  const m = s.toLowerCase().match(/(\w+)\s+(\d{1,2})\s*,\s*(\d{4})/);
  if (!m) return null;
  const mes = meses[m[1]];
  if (!mes) return null;
  return `${m[3]}-${String(mes).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function extrairCampos(texto: string, skusCadastrados: SKUCadastro[] = []): DadosExtraidos {
  const textoBruto = texto;

  // Normaliza pra trabalhar num único fluxo (colapsa espaços/quebras)
  const t = texto.replace(/\s+/g, " ").trim();

  function norm(s: string) {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  // -- 1) Cliente: estratégia em três etapas.
  //   a) Linha bruta que tem "CNPJ:" — pega o que vem antes.
  //   b) Linha bruta que tem texto + cargo na mesma linha:
  //      pega o que vem antes do cargo.
  //   c) Linha bruta com APENAS o cargo (sem texto antes):
  //      pega a LINHA ANTERIOR como cliente (caso de 2 quadros).
  //   Cargo aceita variantes: "Supervisor Regional", "Diretor Comercial",
  //   "Consultora de Pré Vendas", "Gerente Nacional", etc.
  let cliente = "";
  const linhasBrutas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Cargo: prefixo (Supervisor/Diretor/...) + opcional "de " + 1-4 palavras
  const cargoSufixo =
    "(?:Supervisor|Supervisora|Diretor|Diretora|Gerente|Coordenador|Coordenadora|Vendedor|Vendedora|Consultor|Consultora|Representante)" +
    "(?:\\s+de)?" +
    "(?:\\s+[A-ZÁÉÍÓÚÃÕÇÊÔÂ][\\wáéíóúãõçêôâ]*){1,4}";
  const reCargoCompleto = new RegExp("^(.+?)\\s+" + cargoSufixo + "$");
  const reCargoSozinho = new RegExp("^" + cargoSufixo + "$");

  // a) Procura CNPJ primeiro
  for (const l of linhasBrutas) {
    const m = l.match(
      /^([A-ZÁÉÍÓÚÃÕÇÊÔÂ][A-ZÁÉÍÓÚÃÕÇÊÔÂ0-9 .'\-&/]{2,80}?)\s*-?\s*CNPJ\s*:/
    );
    if (m) {
      cliente = m[1].trim().replace(/[\s\-]+$/, "");
      break;
    }
  }

  // b) Linha com texto + cargo na mesma linha
  if (!cliente) {
    for (const l of linhasBrutas) {
      const m = l.match(reCargoCompleto);
      if (m) {
        cliente = m[1].trim().replace(/\s*-\s*CNPJ.*$/, "").trim();
        break;
      }
    }
  }

  // c) Cargo isolado em uma linha — usa a linha anterior como cliente
  if (!cliente) {
    for (let i = 0; i < linhasBrutas.length; i++) {
      if (reCargoSozinho.test(linhasBrutas[i]) && i > 0) {
        for (let j = i - 1; j >= 0; j--) {
          const candidato = linhasBrutas[j];
          if (candidato.length < 3) continue;
          if (/^\d+$/.test(candidato)) continue;
          // Pula só linhas que SEJAM "Confiance" ou "Confiance Medical"
          // (header/rodapé), não linhas que CONTÊM "Medical" (ex.: "CR MEDICAL")
          if (/^Confiance(\s+Medical)?$/i.test(candidato)) continue;
          if (/confiancemedical/i.test(candidato)) continue;
          // Pula linhas tipo "REGISTRO: ..." / "PROCEDÊNCIA: ..."
          if (/^(REGISTRO|PROCED[ÊE]NCIA|MARCA|FABRICANTE|MODELO|ANVISA)\s*:/i.test(candidato)) continue;
          // Pula linhas que parecem "MARCA: Confiance Medical FABRICANTE: ..." compridas
          if (/MARCA:|FABRICANTE:|MODELO:|REGISTRO:|PROCED[ÊE]NCIA:/i.test(candidato)) continue;
          cliente = candidato.replace(/\s*-\s*CNPJ.*$/, "").trim();
          break;
        }
        if (cliente) break;
      }
    }
  }

  // -- 2) Owner: derivado do email @confiancemedical.com.br.
  //    user do email = primeira letra do nome + sobrenome (padrão Confiance).
  //    Estratégia em camadas:
  //      a) Match exato: pares "Nome Sobrenome" onde
  //         primeira_letra(Nome) + Sobrenome === userEmail
  //      b) Fallback: primeiro nome no texto cujo primeiro caractere bate
  //         com a primeira letra do userEmail (cobre casos onde o sobrenome
  //         do PDF não é o mesmo usado no email — ex.: nome de casada).
  let owner = "";
  const mEmail = t.match(/\b([a-zA-Z]+)@confiancemedical/);
  if (mEmail) {
    const userEmail = norm(mEmail[1]);
    const tokens: string[] = [];
    const reTok = /\b[A-ZÁÉÍÓÚÃÕÇÊÔÂ][a-záéíóúãõçêôâ]{2,}\b/g;
    let mt: RegExpExecArray | null;
    while ((mt = reTok.exec(t)) !== null) {
      tokens.push(mt[0]);
    }

    // a) Match exato: inicial + sobrenome
    for (let i = 0; i < tokens.length - 1; i++) {
      const candidato = norm(tokens[i][0]) + norm(tokens[i + 1]);
      if (candidato === userEmail) {
        owner = `${tokens[i]} ${tokens[i + 1]}`;
        break;
      }
    }

    // b) Fallback: procura nas LINHAS BRUTAS por uma linha curta que
    //    contenha SÓ um nome próprio "Nome Sobrenome" (até ~40 chars).
    //    Vantagem sobre tokens: linhas curtas isoladas costumam ser
    //    o nome do owner (em quadro próprio do PDF). Frases longas
    //    como "OBS: Estão excluídos..." NÃO formam linha curta.
    if (!owner) {
      const inicial = userEmail[0];
      const reLinhaNome =
        /^([A-ZÁÉÍÓÚÃÕÇÊÔÂ][a-záéíóúãõçêôâ]{2,})\s+([A-ZÁÉÍÓÚÃÕÇÊÔÂ][a-záéíóúãõçêôâ]{2,})$/;
      const tratamentos = new Set(["sr", "sra", "dr", "dra"]);
      const cargosBlacklist = new Set([
        "supervisor", "supervisora", "diretor", "diretora",
        "gerente", "coordenador", "coordenadora",
        "consultor", "consultora", "vendedor", "vendedora",
        "representante",
      ]);
      for (const l of linhasBrutas) {
        if (l.length > 40) continue;
        // Tenta "Nome Sobrenome" sozinho
        let m = l.match(reLinhaNome);
        // Ou "Sr./Sra./Dr. Nome Sobrenome" (e remove o prefixo)
        if (!m) {
          const semPrefixo = l.replace(/^(Sr\.|Sra\.|Dr\.|Dra\.)\s*/i, "");
          if (semPrefixo !== l) m = semPrefixo.match(reLinhaNome);
        }
        if (m) {
          const nome = m[1];
          const sobrenome = m[2];
          if (tratamentos.has(norm(nome))) continue;
          if (cargosBlacklist.has(norm(nome))) continue;
          if (cargosBlacklist.has(norm(sobrenome))) continue;
          if (norm(nome[0]) === inicial) {
            owner = `${nome} ${sobrenome}`;
            break;
          }
        }
      }
    }
  }

  // Fallback final: nome próximo ao email confiance no texto bruto
  if (!owner) {
    const linhas = texto
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    for (let i = 0; i < linhas.length; i++) {
      if (/@confiancemedical/i.test(linhas[i])) {
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const l = linhas[j].replace(/^(Sr\.|Sra\.|Dr\.|Dra\.)\s*/i, "");
          const m2 = l.match(
            /([A-ZÁÉÍÓÚÃÕÇÊÔÂ][a-záéíóúãõçêôâ]+(\s+[A-ZÁÉÍÓÚÃÕÇÊÔÂ][a-záéíóúãõçêôâ]+)+)/
          );
          if (m2) {
            const tks = m2[1].split(/\s+/);
            owner = tks.slice(-2).join(" ");
            break;
          }
        }
        if (owner) break;
      }
    }
  }

  // -- 3) Valor: detecta locação ou venda.
  //    Locação: 2+ "NN Meses" no texto.
  //      valor = min(durações) × max(mensais em range razoável)
  //    Venda: pega ÚLTIMO "Investimento R$ X,YY".
  //    Regex aceita "R$ R$" duplicado (erro tipográfico em algumas
  //    propostas como "Investimento R$ R$6.965,00").
  let valor = 0;
  const duracoes: number[] = [];
  const reDur = /\b(\d{2})\s+Meses\b/g;
  let md: RegExpExecArray | null;
  while ((md = reDur.exec(t)) !== null) {
    const d = parseInt(md[1]);
    if (d >= 6 && d <= 99) duracoes.push(d);
  }

  // Detecta locação: precisa de pelo menos 1 "NN Meses" E (uma marca
  // explícita de tabela de locação: "INVESTIMENTO MENSAL" ou "OPÇÃO" como
  // header da tabela). Isso evita falso positivo em PDFs de venda que
  // podem mencionar "60 dias" ou similar.
  const temMarcaTabelaLoc =
    /INVESTIMENTO\s+MENSAL/i.test(t) ||
    /\bOP[ÇC][ÃA]O\b/.test(t);
  const ehLocacao = duracoes.length >= 1 && temMarcaTabelaLoc;

  if (ehLocacao) {
    // Locação detectada — pode ter 1 ou mais opções
    const todosValores: number[] = [];
    const reVal = /R\$\s*([\d.]+,\d{2})/g;
    let mv: RegExpExecArray | null;
    while ((mv = reVal.exec(t)) !== null) {
      const v = parseValorBR(mv[1]);
      if (v >= 500 && v <= 1000000) todosValores.push(v);
    }
    if (todosValores.length > 0) {
      const menorDuracao = Math.min(...duracoes);
      const maiorMensal = Math.max(...todosValores);
      valor = menorDuracao * maiorMensal;
    }
  } else {
    // Venda — pega ÚLTIMO "Investimento (R$)+ X,YY"
    const todosInvest = [
      ...t.matchAll(/Investimento[:\s]*(?:R\$\s*)+([\d.]+,\d{2})/gi),
    ];
    if (todosInvest.length > 0) {
      valor = parseValorBR(todosInvest[todosInvest.length - 1][1]);
    }
  }

  // -- 4) Data: emissão BR + validade (dias corridos)
  let data_fechamento: string | null = null;
  const mesesPt: Record<string, number> = {
    janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4,
    maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
    outubro: 10, novembro: 11, dezembro: 12,
  };
  const mDataBr = t.match(/\b(\d{1,2})\s+de\s+([a-zçãé]+)\s+de\s+(\d{4})\b/i);
  if (mDataBr) {
    const dia = parseInt(mDataBr[1]);
    const mes = mesesPt[mDataBr[2].toLowerCase()];
    const ano = parseInt(mDataBr[3]);
    if (mes) {
      const mVal = t.match(/Validade\s+da\s+Proposta[:\s]+(\d+)\s+dias/i);
      const valDias = mVal ? parseInt(mVal[1]) : 0;
      const dt = new Date(ano, mes - 1, dia);
      dt.setDate(dt.getDate() + valDias);
      data_fechamento = dt.toISOString().slice(0, 10);
    }
  }

  // -- 5) Região: PCP preenche manual
  const regiao = "";

  // -- 6) Itens: quebra em blocos por "Quantidade N XXX0000".
  //    A descrição é puxada do CADASTRO MESTRE (skusCadastrados) usando
  //    o código do SKU — muito mais robusto do que tentar extrair do
  //    texto bagunçado do pdfjs, que separa título e quantidade em
  //    regiões distantes do PDF.
  const itens: ItemExtraido[] = [];
  const reInicio = /Quantidade\s+(\d+)\s+([A-Z]{2,4}\d{3,5})\s*(?:-\s*(\d{2,3}))?/g;
  let mb: RegExpExecArray | null;
  while ((mb = reInicio.exec(t)) !== null) {
    const quantidade = parseInt(mb[1]) || 1;
    const sku_codigo = mb[2];
    const derivacao = mb[3] || "";
    // Descrição vem do cadastro mestre (mais confiável que o texto do PDF)
    const skuCad = skusCadastrados.find((s) => s.codigo === sku_codigo);
    const descricao = skuCad ? skuCad.descricao : "";
    itens.push({ sku_codigo, derivacao, descricao, quantidade });
  }

  const nome = cliente ? `${cliente} - Proposta` : "Importada do PDF";

  return {
    cliente,
    nome,
    owner,
    valor,
    data_fechamento,
    regiao,
    itens,
    textoBruto,
  };
}

type Props = {
  skus: SKUCadastro[];
  aliases: Alias[];
};

export function ImportarPdfOportunidade({ skus, aliases }: Props) {
  const router = useRouter();
  const aliasMap = indexarAliases(aliases);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosExtraidos | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleArquivo(file: File) {
    setErro(null);
    setCarregando(true);
    setNomeArquivo(file.name);
    try {
      const texto = await extrairTextoDoPdf(file);
      const extraido = extrairCampos(texto, skus);

      // Sugere SKU pra itens que não vieram preenchidos do PDF.
      // Usa o mesmo motor de match do cálculo de prazo (alias > código > fuzzy).
      extraido.itens = extraido.itens.map((it) => {
        if (it.sku_codigo) return it; // já veio do PDF
        const m = matchSKU(
          { codigo: it.sku_codigo || null, descricao: it.descricao },
          skus,
          aliasMap
        );
        if (m.sku && (m.matched_by === "alias" || m.score >= 0.6)) {
          return {
            ...it,
            sku_codigo: m.sku.codigo,
            derivacao: m.derivacao_sugerida || it.derivacao || "",
          };
        }
        return it;
      });

      setDados(extraido);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Erro ao processar o PDF. Confira se o arquivo está OK."
      );
    } finally {
      setCarregando(false);
    }
  }

  function abrir() {
    setAberto(true);
    setDados(null);
    setErro(null);
    setNomeArquivo("");
  }

  function fechar() {
    setAberto(false);
    setDados(null);
    setErro(null);
  }

  function levarParaRevisar() {
    if (!dados) return;
    try {
      localStorage.setItem(
        "confirma:novaopp:preenchido",
        JSON.stringify(dados)
      );
    } catch {
      // ignora
    }
    setAberto(false);
    router.push("/oportunidades/nova");
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="bg-white border border-slate-200 hover:border-[#64C3D1] text-[#1F2C4E] font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"
        title="Importar oportunidade a partir de PDF"
      >
        📄 Importar PDF
      </button>

      {aberto && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
                  Importar oportunidade de PDF
                </h2>
                <p className="text-xs text-[#706F6F] mt-0.5">
                  Selecione a proposta comercial em PDF para extrair os campos.
                </p>
              </div>
              <button
                type="button"
                onClick={fechar}
                className="text-slate-400 hover:text-slate-700 text-xl px-2"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!dados && (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleArquivo(f);
                    }}
                  />
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-sm text-[#1F2C4E] mb-1 font-semibold">
                    {carregando ? "Lendo PDF…" : "Selecione o PDF da proposta"}
                  </p>
                  <p className="text-xs text-[#706F6F] mb-4">
                    Funciona melhor com propostas geradas pelo sistema
                    (Salesforce / Confiance).
                  </p>
                  <button
                    type="button"
                    disabled={carregando}
                    onClick={() => inputRef.current?.click()}
                    className="bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {carregando ? "Processando…" : "Escolher PDF"}
                  </button>
                </div>
              )}

              {erro && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2 text-sm">
                  {erro}
                </div>
              )}

              {dados && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
                    <div className="font-bold text-emerald-900 mb-1">
                      ✓ PDF processado
                    </div>
                    <div className="text-xs text-emerald-800">
                      Arquivo: <b>{nomeArquivo}</b>. Confira os campos
                      detectados abaixo. Você poderá editar tudo na próxima
                      tela antes de salvar.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <Campo label="Cliente" valor={dados.cliente || "não detectado"} />
                    <Campo label="Owner" valor={dados.owner || "não detectado"} />
                    <Campo
                      label="Valor"
                      valor={
                        dados.valor > 0
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(dados.valor)
                          : "não detectado"
                      }
                    />
                    <Campo
                      label="Data"
                      valor={dados.data_fechamento || "não detectada"}
                    />
                    <Campo label="Região" valor={dados.regiao || "não detectada"} />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold mb-2">
                      Itens detectados ({dados.itens.length})
                    </div>
                    {dados.itens.length === 0 ? (
                      <p className="text-xs text-rose-700">
                        Nenhum item foi detectado. Você precisará adicioná-los
                        manualmente.
                      </p>
                    ) : (
                      <ul className="text-xs text-[#1F2C4E] space-y-1.5">
                        {dados.itens.map((it, i) => (
                          <li
                            key={i}
                            className="flex items-baseline gap-2 py-1 border-b border-slate-200/60 last:border-b-0"
                          >
                            <span className="font-mono text-slate-500 w-8 text-right shrink-0">
                              {it.quantidade}x
                            </span>
                            {it.sku_codigo ? (
                              <span className="font-mono text-[11px] bg-slate-200/60 text-slate-700 px-1.5 py-0.5 rounded shrink-0">
                                {it.sku_codigo}
                                {it.derivacao ? "·" + it.derivacao : ""}
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0">
                                sem SKU
                              </span>
                            )}
                            <span className="flex-1 text-[#1F2C4E]">
                              {it.descricao || (
                                <span className="text-slate-400 italic">
                                  sem descrição
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <details className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                    <summary className="cursor-pointer text-[#706F6F] font-semibold">
                      🔍 Texto bruto extraído do PDF (para debug)
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] text-slate-600 max-h-64 overflow-auto bg-white border border-slate-200 rounded p-2">
                      {dados.textoBruto}
                    </pre>
                  </details>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setDados(null);
                        setNomeArquivo("");
                      }}
                      className="text-xs uppercase tracking-wider font-semibold text-[#706F6F] hover:text-[#1F2C4E] px-3 py-2 rounded-lg hover:bg-slate-100"
                    >
                      Trocar PDF
                    </button>
                    <button
                      type="button"
                      onClick={levarParaRevisar}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg"
                    >
                      Revisar e salvar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-[#706F6F] font-semibold">
        {label}
      </div>
      <div className="text-sm text-[#1F2C4E] mt-0.5 truncate" title={valor}>
        {valor}
      </div>
    </div>
  );
}
