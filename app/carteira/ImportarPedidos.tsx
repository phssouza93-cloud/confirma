"use client";

import { Fragment, useState, useTransition } from "react";
import { importarPedidos, type PedidoInput } from "./actions";
import { formatarDerivacao } from "@/lib/derivacao";

type Etapa = "fechado" | "upload" | "processando" | "preview";

// Templates de pedidos sintéticos para simular extração de PDF
// Em produção, virá de um parser real de PDF (server-side)
const TEMPLATES: Omit<PedidoInput, "numero_pedido">[] = [
  {
    cliente: "BASE ADMINISTRATIVA DO COMPLEXO DE SAUDE",
    data_promessa: "2026-06-13",
    itens: [
      { sku_codigo: "ACE0003", derivacao: "001", quantidade: 2, descricao_original: "Acessório de Aquecimento de CO2" },
      { sku_codigo: "ACE0021", derivacao: "001", quantidade: 3, descricao_original: "Mangueira CM-100" },
      { sku_codigo: "ASP0001", derivacao: "001", quantidade: 1, descricao_original: "Escape de Fumaça CM-100" },
      { sku_codigo: "INS0002", derivacao: "006", quantidade: 1, descricao_original: "Insuflador CO2 CM-40L" },
      { sku_codigo: "MTR0005", derivacao: null, quantidade: 1, descricao_original: "Mangueira Termoplástica" },
    ],
  },
  {
    cliente: "HOSPITAL SIRIO LIBANES",
    data_promessa: "2026-06-20",
    itens: [
      { sku_codigo: "MNT0017", derivacao: "015", quantidade: 2, descricao_original: "Monitor Profissional Grau Médico - CM-CINEMED32F" },
      { sku_codigo: "CAM0003", derivacao: "010", quantidade: 1, descricao_original: "Microcâmera CM-SCAM3" },
      { sku_codigo: "FNT0001", derivacao: "001", quantidade: 2, descricao_original: "Fonte de Luz Led - CM-LED" },
    ],
  },
  {
    cliente: "HOSPITAL ALBERT EINSTEIN",
    data_promessa: "2026-06-27",
    itens: [
      { sku_codigo: "INS0002", derivacao: "004", quantidade: 1, descricao_original: "Insuflador CO2 CM-40L" },
      { sku_codigo: "LAP0017", derivacao: "001", quantidade: 1, descricao_original: "Endoscópio CM-OTC0051L Laparoscópio" },
      { sku_codigo: "HIS0008", derivacao: "001", quantidade: 1, descricao_original: "Endoscópio CM-OTC0033H Histeroscópio" },
    ],
  },
];

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

  function processarArquivos(files: File[]) {
    setFileNames(files.map((f) => f.name));
    setEtapa("processando");
    setTimeout(() => {
      const base = Date.now();
      const lista: PedidoInput[] = files.map((f, i) => {
        const tpl = TEMPLATES[i % TEMPLATES.length];
        return {
          numero_pedido: String(105955 + (base % 1000) + i),
          cliente: tpl.cliente,
          data_promessa: tpl.data_promessa,
          itens: tpl.itens,
        };
      });
      setPedidos(lista);
      setEtapa("preview");
    }, 1200);
  }

  function usarExemplo() {
    setFileNames([
      "Pedido 105955 - Base Adm Saude RJ.pdf",
      "Pedido 105956 - Hospital Sirio Libanes.pdf",
      "Pedido 105957 - Hospital Albert Einstein.pdf",
    ]);
    setEtapa("processando");
    setTimeout(() => {
      const base = Date.now();
      const lista: PedidoInput[] = TEMPLATES.map((tpl, i) => ({
        numero_pedido: String(105955 + (base % 1000) + i),
        cliente: tpl.cliente,
        data_promessa: tpl.data_promessa,
        itens: tpl.itens,
      }));
      setPedidos(lista);
      setEtapa("preview");
    }, 1200);
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
    return new Date(d).toLocaleDateString("pt-BR");
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
                <div className="mt-4 text-center">
                  <button
                    onClick={usarExemplo}
                    className="text-sm text-[#326A84] hover:underline"
                  >
                    Demo: importar 3 pedidos de exemplo
                  </button>
                </div>
                <div className="mt-4 bg-[#FFF7E6] border border-[#FFA300]/40 rounded-lg p-3 text-xs text-[#1F2C4E]">
                  <b>Aviso:</b> a extração de PDF nesta versão é simulada (gera
                  pedidos sintéticos a partir dos arquivos enviados). Em
                  produção, plugaremos um parser real do formato RVOR252.GER.
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
                {erro && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                    {erro}
                  </div>
                )}
              </div>
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-between">
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
      <div className="text-2xl font-black text-[#1F2C4E] mt-0.5">{valor}</div>
    </div>
  );
}
