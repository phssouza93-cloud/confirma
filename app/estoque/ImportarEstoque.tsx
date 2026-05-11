"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { importarSKUs, type SKUInput } from "./actions";

type Etapa = "fechado" | "upload" | "processando" | "preview";

type Props = {
  qtdAtual: number;
};

export function ImportarEstoque({ qtdAtual }: Props) {
  const [etapa, setEtapa] = useState<Etapa>("fechado");
  const [fileName, setFileName] = useState<string>("");
  const [skus, setSkus] = useState<SKUInput[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setEtapa("upload");
    setErro(null);
    setSkus([]);
    setFileName("");
  }
  function fechar() {
    setEtapa("fechado");
    setErro(null);
    setSkus([]);
    setFileName("");
  }

  function processarArquivo(file: File) {
    setFileName(file.name);
    setEtapa("processando");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
        });
        // Agrega por código
        const mapa: Record<string, SKUInput> = {};
        rows.forEach((r) => {
          const codigo = (r["Produto"] ??
            r["Codigo"] ??
            r["Código"] ??
            r["SKU"]) as string | null;
          if (!codigo) return;
          const codigoStr = String(codigo).trim();
          const desc =
            (r["Desc.Produto"] ?? r["Descrição"] ?? r["Descricao"] ?? "") as string;
          const familia = (r["Família"] ?? r["Familia"] ?? null) as string | null;
          const disp = Number(
            r["Disponível"] ?? r["Disponivel"] ?? r["Quantidade"] ?? 0
          );

          if (!mapa[codigoStr]) {
            mapa[codigoStr] = {
              codigo: codigoStr,
              descricao: String(desc).trim(),
              familia: familia ? String(familia).trim() : null,
              estoque: 0,
              lead_time_dias: 20,
            };
          }
          mapa[codigoStr].estoque += isNaN(disp) ? 0 : disp;
          if (!mapa[codigoStr].descricao && desc) {
            mapa[codigoStr].descricao = String(desc).trim();
          }
        });
        const lista = Object.values(mapa);
        if (lista.length === 0) {
          setErro(
            "Não consegui identificar SKUs. Colunas esperadas: Produto, Desc.Produto, Família, Disponível."
          );
          setEtapa("upload");
          return;
        }
        setSkus(lista);
        setEtapa("preview");
      } catch (err) {
        setErro(
          "Erro ao ler a planilha: " +
            (err instanceof Error ? err.message : String(err))
        );
        setEtapa("upload");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function confirmar() {
    startTransition(async () => {
      const res = await importarSKUs(skus);
      if (!res.ok) {
        setErro(res.error || "Erro desconhecido");
        return;
      }
      fechar();
    });
  }

  if (etapa === "fechado") {
    return (
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm bg-[#1F2C4E] hover:bg-[#326A84] text-white rounded-lg font-medium uppercase tracking-wide text-xs transition"
      >
        Importar planilha
      </button>
    );
  }

  return (
    <>
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm bg-[#1F2C4E] hover:bg-[#326A84] text-white rounded-lg font-medium uppercase tracking-wide text-xs transition"
      >
        Importar planilha
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
                    Importar Estoque
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">
                    Aceita .xlsx, .xls e .csv.
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
                {qtdAtual > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-900">
                    Já existem <b>{qtdAtual}</b> SKUs cadastrados. A importação{" "}
                    <b>atualiza</b> os existentes e <b>adiciona</b> os novos
                    (não apaga).
                  </div>
                )}
                <label className="block border-2 border-dashed border-slate-300 hover:border-[#326A84] hover:bg-[#E6F9FC]/30 rounded-lg p-10 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processarArquivo(f);
                    }}
                  />
                  <div className="text-4xl text-slate-400 mb-2">↑</div>
                  <div className="font-medium text-[#1F2C4E]">
                    Arraste a planilha ou clique para selecionar
                  </div>
                  <div className="text-xs text-[#706F6F] mt-1">
                    Colunas esperadas: Produto, Desc.Produto, Família, Disponível
                  </div>
                </label>
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
                Lendo planilha...
              </div>
              <div className="text-xs text-[#706F6F] mt-1">{fileName}</div>
            </div>
          )}
          {etapa === "preview" && (
            <>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2C4E] uppercase tracking-wide">
                    Pré-visualizar
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">{fileName}</p>
                </div>
                <button
                  onClick={fechar}
                  className="text-slate-400 hover:text-slate-700 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 text-sm text-emerald-900">
                  <b>{skus.length}</b> SKUs distintos identificados ·{" "}
                  <b>
                    {skus.reduce(
                      (s: number, x: SKUInput) => s + (x.estoque || 0),
                      0
                    )}
                  </b>{" "}
                  unidades totais
                </div>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-[#706F6F] sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">
                          Código
                        </th>
                        <th className="text-left py-2 px-3 font-medium">
                          Descrição
                        </th>
                        <th className="text-left py-2 px-3 font-medium">
                          Família
                        </th>
                        <th className="text-right py-2 px-3 font-medium">
                          Estoque
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {skus.slice(0, 50).map((s: SKUInput) => (
                        <tr key={s.codigo}>
                          <td className="py-1.5 px-3 font-mono text-xs">
                            {s.codigo}
                          </td>
                          <td className="py-1.5 px-3 text-sm">{s.descricao}</td>
                          <td className="py-1.5 px-3 text-xs">
                            {s.familia || "—"}
                          </td>
                          <td className="py-1.5 px-3 text-right text-sm">
                            {s.estoque}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {skus.length > 50 && (
                    <div className="px-3 py-2 text-xs text-[#706F6F] bg-slate-50 border-t">
                      mostrando 50 de {skus.length}
                    </div>
                  )}
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
                      : `Importar ${skus.length} SKUs`}
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
