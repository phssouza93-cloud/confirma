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
              items: Array<{ str: string }>;
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
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let valor = 0;
  const mValor = texto.match(/INVESTIMENTO[:\s]*R\$\s*([\d.]+,\d{2})/i);
  if (mValor) valor = parseValorBR(mValor[1]);

  let data_fechamento: string | null = null;
  const mData = texto.match(/(\w+-feira|[A-Za-zçÇ]+),?\s+([a-zA-Zç]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (mData) {
    data_fechamento = parseDataPT(`${mData[2]} ${mData[3]}, ${mData[4]}`);
  }

  let cliente = "";
  let owner = "";

  // Estratégia 1: cliente aparece na linha onde também tem "Supervisor/Diretor/
  // Comercial/Gerente/Representante" (cargo do owner Confiance ao lado).
  // Ex: "MOGAMI Supervisora Comercial São Paulo" → MOGAMI
  for (const l of linhas) {
    const m = l.match(
      /^([A-ZÁÉÍÓÚÃÕÇÂÊÔ&][A-ZÁÉÍÓÚÃÕÇÂÊÔ&\s\d\.\-]{1,40}?)\s+(Supervisor|Supervisora|Diretor|Diretora|Gerente|Comercial|Representante|Coordenador|Coordenadora|Vendedor|Vendedora|Consultor|Consultora)\b/
    );
    if (m && !/CONFIANCE|MEDICAL|PROPOSTA|PRODUTOS/i.test(m[1])) {
      cliente = m[1].trim();
      break;
    }
  }

  // Estratégia 2 (fallback): pegar de email não-confiance, derivar do domínio.
  // Ex: marcia@mogamibrasil.com → MOGAMI
  if (!cliente) {
    const mEmail = texto.match(/([\w\.-]+)@(?!confiancemedical)([a-zA-Z0-9-]+)\./);
    if (mEmail) {
      const dominio = mEmail[2].toUpperCase();
      // Remove sufixos comuns
      cliente = dominio.replace(/BRASIL$|BR$|MED$|MEDICAL$|HOSP$/i, "");
    }
  }

  // Estratégia 3 (fallback): linha tudo maiúscula após "PROPOSTA COMERCIAL"
  if (!cliente) {
    let idxProposta = -1;
    for (let i = 0; i < linhas.length; i++) {
      if (/PROPOSTA\s+COMERCIAL/i.test(linhas[i])) {
        idxProposta = i;
        break;
      }
    }
    if (idxProposta >= 0) {
      for (let i = idxProposta + 1; i < Math.min(idxProposta + 25, linhas.length); i++) {
        const l = linhas[i];
        if (
          /^[A-ZÁÉÍÓÚÃÕÇ\s\d\.\-&]{3,}$/.test(l) &&
          !/PRODUTOS|FORMA|TERMOS|PROPOSTA|CONFIANCE|MEDICAL|REGISTRO|MARCA|FABRICANTE/.test(l) &&
          l.length < 60
        ) {
          cliente = l;
          break;
        }
      }
    }
  }

  for (let i = 0; i < linhas.length; i++) {
    if (/@confiancemedical/i.test(linhas[i])) {
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const l = linhas[j];
        if (/^[A-ZÁÉÍÓÚÃÕÇ][a-záéíóúãõç]+(\s+[A-ZÁÉÍÓÚÃÕÇ][a-záéíóúãõç]+)+/.test(l)) {
          owner = l;
          break;
        }
      }
      if (owner) break;
    }
  }

  let regiao = "";
  const mRegiao = texto.match(/Comercial\s+(São Paulo|SP|RJ|Rio de Janeiro|Norte|Nordeste|Sul|Centro-Oeste|Sudeste|Minas Gerais|MG|CE|Bahia|BA)/i);
  if (mRegiao) {
    const map: Record<string, string> = {
      "são paulo": "SP",
      sp: "SP",
      rj: "RJ",
      "rio de janeiro": "RJ",
      mg: "MG",
      "minas gerais": "MG",
      ba: "BA",
      bahia: "BA",
      ce: "CE",
      norte: "Norte & Nordeste",
      nordeste: "Norte & Nordeste",
      sul: "Sul",
      sudeste: "Sudeste",
      "centro-oeste": "Centro-Oeste",
    };
    regiao = map[mRegiao[1].toLowerCase()] || mRegiao[1];
  }

  const itens: ItemExtraido[] = [];
  const textoFlat = linhas.join(" | ");
  // Captura "Quantidade | N | seg1 [| seg2]".
  // No PDF da Confiance, quando há SKU, ele fica isolado em seg1 e a
  // descrição vem em seg2. Quando não há SKU, a descrição já vem em seg1.
  const re = /Quantidade\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*(?:\|\s*([^|]+))?(?=\s*\||$)/g;
  // Primeiro: identifica todas as posições dos itens pra depois pegar
  // o "parágrafo descritivo" de cada um (texto entre item atual e próximo).
  type MatchPos = {
    qtd: number;
    seg1: string;
    seg2: string;
    inicio: number;
    fim: number;
  };
  const matches: MatchPos[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(textoFlat)) !== null) {
    matches.push({
      qtd: Number(m[1]) || 1,
      seg1: (m[2] || "").trim(),
      seg2: (m[3] || "").trim(),
      inicio: m.index,
      fim: m.index + m[0].length,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const prox = matches[i + 1];
    const paragrafoDescritivo = textoFlat.slice(
      cur.fim,
      prox ? prox.inicio : textoFlat.length
    );

    let sku_codigo = "";
    let derivacao = "";
    let descricao = "";

    const mSkuSolo = cur.seg1.match(/^([A-Z]{2,4}\d{3,5})(?:-(\d{2,3}))?$/);
    if (mSkuSolo) {
      sku_codigo = mSkuSolo[1];
      derivacao = mSkuSolo[2] || "";
      descricao = cur.seg2;
    } else {
      const mSkuInline = cur.seg1.match(/^([A-Z]{2,4}\d{3,5})(?:-(\d{2,3}))?\s+(.+)$/);
      if (mSkuInline) {
        sku_codigo = mSkuInline[1];
        derivacao = mSkuInline[2] || "";
        descricao = mSkuInline[3].trim();
      } else {
        descricao = cur.seg1;
      }
    }

    // Se ainda não tem SKU, procura no parágrafo descritivo por TODOS os
    // "(SKUNNNN-NNN)" presentes. Pode ter vários (produto principal +
    // acessórios). Priorização:
    //   1) SKU que existe no cadastro mestre (descarta códigos de acessórios
    //      que não foram cadastrados)
    //   2) SKU com derivação (ex: CAM0003-010) vence SKU sem derivação
    //      (ex: EDR0007), porque produto principal costuma ter derivação
    //   3) Primeiro encontrado como fallback
    if (!sku_codigo) {
      const todosMatches: Array<{ sku: string; deriv: string }> = [];
      const reParagrafo = /\(([A-Z]{2,4}\d{3,5})(?:-(\d{2,3}))?\)/g;
      let mP: RegExpExecArray | null;
      while ((mP = reParagrafo.exec(paragrafoDescritivo)) !== null) {
        todosMatches.push({ sku: mP[1], deriv: mP[2] || "" });
      }
      if (todosMatches.length > 0) {
        const skusValidos = new Set(skusCadastrados.map((s) => s.codigo));
        // Camada 1: SEMPRE prefere SKU com derivação (produto principal
        // Confiance quase sempre tem derivação; acessórios mencionados no
        // parágrafo costumam não ter).
        const comDeriv = todosMatches.filter((x) => x.deriv);
        const semDeriv = todosMatches.filter((x) => !x.deriv);
        // Camada 2: entre os com derivação, se algum estiver no cadastro,
        // prefere esse. Se nenhum, mantém qualquer com derivação.
        let candidatos = comDeriv.length > 0 ? comDeriv : semDeriv;
        const noCadastro = candidatos.filter((x) => skusValidos.has(x.sku));
        if (noCadastro.length > 0) candidatos = noCadastro;
        const escolhido = candidatos[0];
        sku_codigo = escolhido.sku;
        derivacao = escolhido.deriv;
      }
    }

    descricao = descricao.slice(0, 200).trim();
    if (!descricao && !sku_codigo) continue;
    itens.push({
      sku_codigo,
      derivacao,
      descricao,
      quantidade: cur.qtd,
    });
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
    textoBruto: texto,
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
                      <ul className="text-xs text-[#1F2C4E] space-y-1">
                        {dados.itens.map((it, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-mono text-slate-500 w-6 text-right">
                              {it.quantidade}x
                            </span>
                            {it.sku_codigo && (
                              <span className="font-mono text-slate-700">
                                {it.sku_codigo}
                                {it.derivacao ? "·" + it.derivacao : ""}
                              </span>
                            )}
                            <span className="flex-1 truncate">
                              {it.descricao}
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
