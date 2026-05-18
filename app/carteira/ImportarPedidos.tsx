"use client";

import { Fragment, useState, useTransition } from "react";
import { importarPedidos, type PedidoInput, type ItemPedidoInput } from "./actions";

type Etapa = "fechado" | "upload" | "processando" | "preview";

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

const PDFJS_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

type PdfJsLib = NonNullable<Window["pdfjsLib"]>;

async function carregarPdfjs(): Promise<PdfJsLib> {
  if (typeof window === "undefined") throw new Error("Sem window");
  const existing = window.pdfjsLib;
  if (existing) return existing;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS_CDN;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar pdfjs do CDN"));
    document.head.appendChild(s);
  });
  const lib: PdfJsLib | undefined = window.pdfjsLib;
  if (!lib) throw new Error("pdfjsLib não disponível");
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return lib;
}

/**
 * Extrai texto do PDF reconstruindo linhas REAIS pela coordenada Y de
 * cada item (transform[5]). Items com Y próximo (tolerância 3pt) ficam
 * na mesma linha, ordenados por X (transform[4]). Isso preserva a
 * estrutura visual do PDF e evita que campos lado-a-lado virem texto
 * misturado quando o pdfjs separa por padrão.
 */
async function extrairTextoDoPdf(file: File): Promise<string> {
  const pdfjs = await carregarPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  let textoCompleto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    // Agrupa items por coordenada Y com tolerância
    const linhas: Map<number, Array<{ str: string; x: number }>> = new Map();
    for (const item of tc.items) {
      const tr = item.transform;
      if (!tr || tr.length < 6) {
        // Fallback: sem transform, joga numa "linha 0"
        const arr = linhas.get(0) || [];
        arr.push({ str: item.str, x: 0 });
        linhas.set(0, arr);
        continue;
      }
      const y = Math.round(tr[5]);
      const x = tr[4];
      // Acha linha com Y próximo (tolerância de 3 pontos)
      let chaveY = y;
      for (const k of linhas.keys()) {
        if (Math.abs(k - y) < 3) {
          chaveY = k;
          break;
        }
      }
      const arr = linhas.get(chaveY) || [];
      arr.push({ str: item.str, x });
      linhas.set(chaveY, arr);
    }
    // Ordena linhas por Y descendente (PDF: Y cresce de baixo pra cima)
    const linhasOrdenadas = [...linhas.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, items] of linhasOrdenadas) {
      items.sort((a, b) => a.x - b.x);
      const linha = items
        .map((it) => it.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (linha) textoCompleto += linha + "\n";
    }
  }
  return textoCompleto;
}

/**
 * Extrai dados estruturados de um Pedido de Venda Confiance (RVOR252.GER):
 * - numero_pedido: do "PEDIDO.: 103.774"
 * - cliente: depois de "Cliente.......: <codigo> -"
 * - data_promessa: data mais comum nas linhas de item (Data Entr.)
 * - itens: linhas "90NNN SKU [DERIV] Descrição ... QTD,00 ..."
 *
 * Linhas duplicadas (mesmo SKU + derivação) são consolidadas somando qtd.
 */
function extrairPedido(texto: string, nomeArquivo: string): PedidoInput | null {
  const t = texto.replace(/\s+/g, " ").trim();

  // --- Número do pedido
  const mPed = t.match(/PEDIDO\.?\s*:\s*([\d.]+)/i);
  const numero_pedido = mPed
    ? mPed[1].replace(/\./g, "")
    : nomeArquivo.replace(/\.pdf$/i, "");

  // --- Cliente: estratégia em 3 etapas (pdfjs separa os campos em pedaços)
  let cliente = "";
  // a) Linha bruta com "Cliente": <codigo> -<NOME>"
  const linhasBrutas = texto.split("\n").map((l) => l.trim());
  for (let i = 0; i < linhasBrutas.length; i++) {
    if (/^Cliente\.+\s*:/i.test(linhasBrutas[i])) {
      // Pega tudo após o ":" na mesma linha
      const m = linhasBrutas[i].match(
        /^Cliente\.+\s*:\s*(?:[\d.]+\s*-?\s*)?(.+)$/i
      );
      if (m && m[1].trim().length > 3) {
        cliente = m[1].trim().replace(/^-\s*/, "");
        break;
      }
      // Senão, procura nas próximas 6 linhas algo que pareça nome do cliente
      // (linha que começa com "-" ou só CAPS, mas NÃO é "Endereço/CNPJ/etc.")
      for (let j = i + 1; j < Math.min(i + 7, linhasBrutas.length); j++) {
        const l = linhasBrutas[j];
        if (!l) continue;
        // Para se chegou em outro campo do cabeçalho
        if (/^(Endereço|Bairro|Cidade|Estado|Fone|CPF|CNPJ|Insc|Pipedrive|Transportadora|Contato|Frete|Origem|Tipo|Vendedor|Nome|%)/i.test(l)) break;
        // Pula código do cliente (só números/pontos) e linhas vazias
        if (/^[\d.\s-]+$/.test(l)) continue;
        // Tira prefixo "-" do "-LIGA NORTE..."
        const limpo = l.replace(/^-\s*/, "").trim();
        if (limpo.length >= 4 && /^[A-ZÁÉÍÓÚÃÕÇÊÔÂ]/.test(limpo)) {
          cliente = limpo;
          break;
        }
      }
      if (cliente) break;
    }
  }
  // b) Fallback no texto flat: pega após "Cliente.:" até antes de "Endereço" ou "CNPJ"
  if (!cliente) {
    const mFlat = t.match(
      /Cliente\.+\s*:\s*(?:[\d.]+\s*-?\s*)?([A-ZÁÉÍÓÚÃÕÇÊÔÂ][A-ZÁÉÍÓÚÃÕÇÊÔÂ \-/&'.0-9]{5,80}?)(?:\s+Endereço|\s+CNPJ|\s+Bairro|\s+Cidade|\s+Fone|\s+\d{2}\.\d{3})/i
    );
    if (mFlat) cliente = mFlat[1].trim().replace(/^-\s*/, "");
  }
  // Fallback c: procura palavras-chave típicas de cliente hospitalar e
  // captura a sequência LONGA de CAPS ao redor (3+ palavras com 2+ letras).
  // O pdfjs costuma colocar o cliente em qualquer lugar do flat (reorganiza
  // colunas), então essa é a estratégia mais robusta.
  if (!cliente) {
    const palavrasCliente = [
      "HOSPITAL", "LIGA", "INSTITUTO", "INSTITUIÇÃO", "CLINICA", "CLÍNICA",
      "CENTRO", "BASE", "FUNDA", "MATERNIDADE", "UNIDADE", "COMPLEXO",
      "AMBULATÓRIO", "AMBULATORIO", "CASA", "SANTA", "SÃO", "ESCOLA",
      "POLICLÍNICA", "POLICLINICA", "PRONTO", "SECRETARIA", "PREFEITURA",
      "MUNICÍPIO", "MUNICIPIO", "ASSOCIAÇÃO", "ASSOCIACAO", "REDE",
    ];
    // Procura cada palavra e tenta capturar o nome completo
    // Aceita palavras de 1+ char no meio do nome (pra cobrir "CONTRA O CANCER")
    for (const pal of palavrasCliente) {
      const re = new RegExp(
        `\\b(${pal}[A-ZÁÉÍÓÚÃÕÇÊÔÂ]*(?:\\s+[A-ZÁÉÍÓÚÃÕÇÊÔÂ]+){2,10})\\b`
      );
      const m = t.match(re);
      if (m) {
        let candidato = m[1].trim();
        // Rejeita se contém palavras de outros campos
        if (/\b(?:MARCA|FABRICANTE|MODELO|REGISTRO|PROCED|ANVISA|CONFIANCE|MEDICAL)\b/i.test(candidato)) continue;
        // Remove sobras de "Estado", "Insc", "CNPJ", "Vendedor" etc. que
        // possam ter sido capturadas no final (pdfjs reorganiza colunas)
        candidato = candidato
          .replace(
            /\s+[A-Z]?(?:\s*Estado|\s*Insc|\s*CNPJ|\s*Vendedor|\s*Endere|\s*Bairro|\s*Cidade|\s*Fone|\s*Cep|\s*Compl|\s*Frete|\s*Contato).*$/i,
            ""
          )
          .replace(/\s+[A-Z]$/, "") // palavra de 1 char no final
          .trim();
        if (candidato.length < 4) continue;
        cliente = candidato;
        break;
      }
    }
  }

  // --- Data de entrega: data mais comum DEPOIS de SKUs (Data Entr. dos itens).
  // O pdfjs pode quebrar a data em pedaços ("11/0", "6/2026") ou colá-la
  // a outros números. Pra robustez, pega só datas que vêm em sequência
  // depois de um SKU (no padrão "SKU ... DATA QTD,00").
  const datasDosItens: string[] = [];
  const reDataItem =
    /\b[A-Z]{3}\d{4}\b[\s\S]{0,150}?(\d{1,2}\/\d{1,2}\/\d{4})\s+\d{1,3},00\b/g;
  let mDataIt: RegExpExecArray | null;
  while ((mDataIt = reDataItem.exec(t)) !== null) {
    datasDosItens.push(mDataIt[1]);
  }
  // Fallback: todas as datas (se a busca contextual falhar)
  const datasGenericas = [
    ...t.matchAll(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g),
  ].map((m) => m[1]);
  const datasParaFreq =
    datasDosItens.length > 0 ? datasDosItens : datasGenericas;
  const freq: Record<string, number> = {};
  datasParaFreq.forEach((d) => {
    freq[d] = (freq[d] || 0) + 1;
  });
  const ordenadas = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  let data_promessa: string | null = null;
  if (ordenadas.length > 0) {
    const escolhida = ordenadas[0][0];
    const partes = escolhida.split("/");
    const d = partes[0].padStart(2, "0");
    const m = partes[1].padStart(2, "0");
    const y = partes[2];
    data_promessa = `${y}-${m}-${d}`;
  }

  // --- Itens: extrai do texto flat normalizado.
  // O pdfjs reorganiza colunas verticalmente, então a ordem real é:
  //   SKU [DERIV] DESCRICAO VLR_UNITARIO DATA QTD,00 COD_TRANS VLR_BRUTO
  // Ex: "ACE0003 001 Acessório de Aquecimento de CO2 2.467,92 11/06/2026 1,00 90155 2.500,00"
  // Estratégia: pra cada SKU, captura derivação opcional + qtd via âncora na data.
  const itens: ItemPedidoInput[] = [];
  const reSku = /\b([A-Z]{3}\d{4})\b/g;
  let mSku: RegExpExecArray | null;
  while ((mSku = reSku.exec(t)) !== null) {
    const sku = mSku[1];
    // Olha 250 chars à frente
    const trecho = t.slice(mSku.index, mSku.index + 250);
    // Padrão: SKU [DERIV] desc... DATA QTD,00
    // A âncora DATA garante que QTD,00 é mesmo quantidade (não preço)
    const mDados = trecho.match(
      /^[A-Z]{3}\d{4}\b\s*(\d{3})?\s+(.+?)\s+\d{1,2}\/\d{1,2}\/\d{4}\s+(\d{1,3}),00\b/
    );
    if (!mDados) continue;
    const deriv = mDados[1] || null;
    let desc = mDados[2].trim();
    const qtd = parseInt(mDados[3]);
    if (qtd <= 0 || qtd > 999) continue;
    // Limpa preço unitário que ficou na descrição (ex: "...2.467,92")
    desc = desc.replace(/\s+[\d.]+,\d{2}\s*$/, "").trim();
    itens.push({
      sku_codigo: sku,
      derivacao: deriv,
      quantidade: qtd,
      descricao_original: desc.slice(0, 150),
    });
    // Avança o cursor pra DEPOIS do bloco que acabou de ser consumido.
    // Isso impede que falsos SKUs ([A-Z]{3}\d{4}) que estão DENTRO da
    // descrição (ex: "UPS3200" dentro de "Nobreak Power Sinus UPS3200
    // Laboratorial") sejam interpretados como itens novos no próximo
    // iter do exec.
    reSku.lastIndex = mSku.index + mDados[0].length;
  }

  // --- Consolida itens duplicados (mesmo SKU + derivação)
  const mapa: Record<string, ItemPedidoInput> = {};
  itens.forEach((it) => {
    const chave = `${it.sku_codigo}::${it.derivacao || ""}`;
    if (mapa[chave]) {
      mapa[chave].quantidade += it.quantidade;
    } else {
      mapa[chave] = { ...it };
    }
  });
  const itensConsolidados = Object.values(mapa);

  if (itensConsolidados.length === 0) return null;

  return {
    numero_pedido,
    cliente: cliente || "(sem cliente detectado)",
    data_promessa,
    itens: itensConsolidados,
  };
}

export function ImportarPedidos() {
  const [etapa, setEtapa] = useState<Etapa>("fechado");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [pedidos, setPedidos] = useState<PedidoInput[]>([]);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setEtapa("upload");
    setErro(null);
    setPedidos([]);
    setFileNames([]);
    setExpandido(null);
  }
  function fechar() {
    setEtapa("fechado");
    setErro(null);
    setPedidos([]);
    setFileNames([]);
    setExpandido(null);
  }

  async function processarArquivos(files: File[]) {
    setFileNames(files.map((f) => f.name));
    setEtapa("processando");
    setErro(null);
    try {
      const lista: PedidoInput[] = [];
      const falhas: string[] = [];
      for (const f of files) {
        try {
          const texto = await extrairTextoDoPdf(f);
          const pedido = extrairPedido(texto, f.name);
          if (pedido) {
            lista.push(pedido);
          } else {
            falhas.push(f.name);
          }
        } catch (e) {
          console.error("Falha ao ler PDF", f.name, e);
          falhas.push(f.name);
        }
      }
      if (lista.length === 0) {
        setErro(
          "Nenhum pedido foi extraído. Confira se os PDFs são de Pedido de Venda Confiance (formato RVOR252)."
        );
        setEtapa("upload");
        return;
      }
      if (falhas.length > 0) {
        setErro(
          `Atenção: ${falhas.length} PDF(s) não foram lidos: ${falhas.join(", ")}`
        );
      }
      setPedidos(lista);
      setEtapa("preview");
    } catch (e) {
      setErro(
        "Erro ao processar PDFs: " +
          (e instanceof Error ? e.message : String(e))
      );
      setEtapa("upload");
    }
  }

  function confirmar() {
    startTransition(async () => {
      const res = await importarPedidos(pedidos);
      if (!res.ok) {
        setErro(res.error || "Erro desconhecido");
        return;
      }
      fechar();
    });
  }

  function fmtMoney(d: string | null) {
    if (!d) return "—";
    // Parse manual pra evitar bug de timezone (Date interpreta ISO como UTC)
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return d;
  }

  if (etapa === "fechado") {
    return (
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm bg-[#1F2C4E] hover:bg-[#326A84] text-white rounded-lg font-medium uppercase tracking-wide text-xs transition"
      >
        + Novo pedido
      </button>
    );
  }

  const totalSKUs = pedidos.reduce((s, p) => s + p.itens.length, 0);
  const totalUnidades = pedidos.reduce(
    (s, p) => s + p.itens.reduce((a, i) => a + i.quantidade, 0),
    0
  );

  return (
    <>
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm bg-[#1F2C4E] hover:bg-[#326A84] text-white rounded-lg font-medium uppercase tracking-wide text-xs transition"
      >
        + Novo pedido
      </button>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) fechar();
        }}
      >
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          {etapa === "upload" && (
            <>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2C4E] uppercase tracking-wide">
                    Adicionar pedidos
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">
                    Suba um ou vários PDFs. Cada arquivo vira um pedido na carteira.
                  </p>
                </div>
                <button
                  onClick={fechar}
                  className="text-slate-400 hover:text-slate-700 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <label className="block border-2 border-dashed border-slate-300 hover:border-[#326A84] hover:bg-[#E6F9FC]/30 rounded-lg p-10 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const fs = e.target.files;
                      if (fs && fs.length > 0)
                        processarArquivos(Array.from(fs));
                    }}
                  />
                  <div className="text-4xl text-slate-400 mb-2">↑</div>
                  <div className="font-medium text-[#1F2C4E]">
                    Arraste os PDFs ou clique para selecionar
                  </div>
                  <div className="text-xs text-[#706F6F] mt-1">
                    Aceita múltiplos arquivos
                  </div>
                </label>
                <div className="mt-4 bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-lg p-3 text-xs text-[#1F2C4E]">
                  <b>Formato suportado:</b> Pedido de Venda Confiance (RVOR252.GER).
                  Extrai número do pedido, cliente, data de entrega e itens
                  (SKU, derivação, quantidade).
                </div>
                {erro && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                    {erro}
                  </div>
                )}
              </div>
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  onClick={fechar}
                  className="px-4 py-2 text-sm text-[#706F6F] hover:bg-slate-100 rounded"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
          {etapa === "processando" && (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin w-10 h-10 border-4 border-[#1F2C4E] border-t-transparent rounded-full"></div>
              <div className="mt-4 font-medium text-[#1F2C4E]">
                Lendo {fileNames.length}{" "}
                {fileNames.length === 1 ? "PDF" : "PDFs"}...
              </div>
              <div className="text-xs text-[#706F6F] mt-1">
                {fileNames.slice(0, 3).join(" · ")}
                {fileNames.length > 3 ? ` · +${fileNames.length - 3}` : ""}
              </div>
            </div>
          )}
          {etapa === "preview" && (
            <>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2C4E] uppercase tracking-wide">
                    Pedidos extraídos
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">
                    Clique numa linha para expandir os itens.
                  </p>
                </div>
                <button
                  onClick={fechar}
                  className="text-slate-400 hover:text-slate-700 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <CardInfo titulo="Pedidos" valor={pedidos.length} />
                  <CardInfo titulo="SKUs" valor={totalSKUs} />
                  <CardInfo titulo="Unidades" valor={totalUnidades} />
                </div>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
                      <tr>
                        <th className="w-8"></th>
                        <th className="text-left py-2 px-3 font-semibold">
                          Pedido
                        </th>
                        <th className="text-left py-2 px-3 font-semibold">
                          Cliente
                        </th>
                        <th className="text-left py-2 px-3 font-semibold">
                          Itens
                        </th>
                        <th className="text-left py-2 px-3 font-semibold">
                          Entrega
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pedidos.map((p, idx) => {
                        const aberto = expandido === idx;
                        const unidades = p.itens.reduce(
                          (s, i) => s + i.quantidade,
                          0
                        );
                        return (
                          <Fragment key={idx}>
                            <tr
                              className="hover:bg-slate-50 cursor-pointer"
                              onClick={() =>
                                setExpandido(aberto ? null : idx)
                              }
                            >
                              <td className="py-2 px-3 text-slate-400">
                                {aberto ? "▼" : "▶"}
                              </td>
                              <td className="py-2 px-3 font-mono text-xs">
                                PED-{p.numero_pedido}
                              </td>
                              <td className="py-2 px-3 text-sm">{p.cliente}</td>
                              <td className="py-2 px-3 text-xs">
                                <b>{p.itens.length}</b> SKUs ·{" "}
                                <b>{unidades}</b> unid.
                              </td>
                              <td className="py-2 px-3 text-xs">
                                {fmtMoney(p.data_promessa)}
                              </td>
                            </tr>
                            {aberto &&
                              p.itens.map((it, j) => (
                                <tr key={j} className="bg-slate-50/50">
                                  <td className="text-slate-400 text-center text-xs">
                                    └
                                  </td>
                                  <td colSpan={2} className="py-1 px-3">
                                    <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-200/60 rounded">
                                      {it.sku_codigo}
                                      {it.derivacao ? "·" + it.derivacao : ""}
                                    </span>
                                    <span className="ml-2 text-xs text-[#706F6F]">
                                      {it.descricao_original}
                                    </span>
                                  </td>
                                  <td colSpan={2} className="py-1 px-3 text-xs">
                                    {it.quantidade} unid.
                                  </td>
                                </tr>
                              ))}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                <button
                  onClick={() => setEtapa("upload")}
                  className="text-sm text-[#706F6F] hover:text-[#1F2C4E]"
                >
                  ← Voltar
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={fechar}
                    className="px-4 py-2 text-sm text-[#706F6F] hover:bg-slate-100 rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmar}
                    disabled={pending}
                    className="px-4 py-2 text-sm bg-[#1F2C4E] hover:bg-[#326A84] text-white rounded font-medium uppercase tracking-wide text-xs transition disabled:opacity-50"
                  >
                    {pending
                      ? "Salvando..."
                      : `Adicionar ${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"} à carteira`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function CardInfo({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold">
        {titulo}
      </div>
      <div className="text-2xl font-black mt-0.5 text-[#1F2C4E]">{valor}</div>
    </div>
  );
}
