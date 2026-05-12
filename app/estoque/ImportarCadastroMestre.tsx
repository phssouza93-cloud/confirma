"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { importarCadastroMestre, type SKUCadastroInput } from "./actions";

type Etapa = "fechado" | "upload" | "processando" | "preview";

export function ImportarCadastroMestre({ qtdAtual }: { qtdAtual: number }) {
  const [etapa, setEtapa] = useState<Etapa>("fechado");
  const [fileName, setFileName] = useState<string>("");
  const [skus, setSkus] = useState<SKUCadastroInput[]>([]);
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
        // Lê TODAS as abas e concatena
        const lista: SKUCadastroInput[] = [];
        wb.SheetNames.forEach((nome) => {
          const sheet = wb.Sheets[nome];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: null,
          });
          rows.forEach((r) => {
            const codigo = (r["Produto"] ?? r["Código"] ?? r["Codigo"] ?? r["SKU"]) as
              | string
              | null;
            const descricao = (r["Descrição"] ?? r["Descricao"]) as string | null;
            if (!codigo || !descricao) return;
            const codigoStr = String(codigo).trim();
            const fam = codigoStr.substring(0, 3);

            // Lead time: aceita número ("30"), string com número ("30"), ou
            // textos tipo "sem prazo" / "sem prazo definido" / vazio → null
            const rawLT = (r["Leadtime"] ?? r["Lead time"] ?? r["Lead Time"] ??
              r["LeadTime"] ?? r["LEADTIME"] ?? null) as unknown;
            let leadTime: number | null = null;
            if (rawLT != null && rawLT !== "") {
              const s = String(rawLT).trim().toLowerCase();
              if (s.includes("sem prazo") || s === "n/a" || s === "-") {
                leadTime = null;
              } else {
                const n = Number(String(rawLT).replace(/[^\d.,-]/g, "").replace(",", "."));
                leadTime = Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
              }
            }

            lista.push({
              codigo: codigoStr,
              descricao: String(descricao).trim(),
              familia: fam,
              lead_time_dias: leadTime,
            });
          });
        });
        if (lista.length === 0) {
          setErro(
            "Não consegui identificar SKUs. Colunas esperadas: Produto, Descrição."
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
      const res = await importarCadastroMestre(skus);
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
        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-[#1F2C4E] font-medium uppercase tracking-wide text-xs transition"
      >
        Cadastro mestre
      </button>
    );
  }

  // famílias para o preview
  const familias: Record<string, number> = {};
  const contadorCodigo: Record<string, number> = {};
  skus.forEach((s) => {
    const f = s.familia || "—";
    familias[f] = (familias[f] || 0) + 1;
    contadorCodigo[s.codigo] = (contadorCodigo[s.codigo] || 0) + 1;
  });
  const duplicados = Object.entries(contadorCodigo).filter(([, n]) => n > 1);
  const totalDuplicatas = duplicados.reduce((s, [, n]) => s + (n - 1), 0);
  const codigosUnicos = Object.keys(contadorCodigo).length;

  return (
    <>
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-[#1F2C4E] font-medium uppercase tracking-wide text-xs transition"
      >
        Cadastro mestre
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
                    Importar cadastro mestre
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">
                    Define a descrição oficial de cada SKU. Não mexe no estoque.
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
                    Já há <b>{qtdAtual} SKUs</b> cadastrados. A importação{" "}
                    <b>atualiza</b> descrições e <b>adiciona</b> SKUs novos —
                    não apaga.
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
                    Arraste a planilha do cadastro
                  </div>
                  <div className="text-xs text-[#706F6F] mt-1">
                    Colunas esperadas: Produto, Descrição, Leadtime · lê todas as abas
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
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3 text-sm text-emerald-900">
                  <b>{skus.length}</b> linhas lidas · <b>{codigosUnicos}</b> SKUs únicos
                  em <b>{Object.keys(familias).length}</b> famílias
                </div>
                {totalDuplicatas > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-900">
                    <b>⚠ {totalDuplicatas} linha{totalDuplicatas > 1 ? "s" : ""} duplicada{totalDuplicatas > 1 ? "s" : ""}</b> na planilha
                    (código repetido). Vamos manter apenas a última ocorrência
                    de cada código. Códigos repetidos:{" "}
                    {duplicados
                      .slice(0, 8)
                      .map(([c, n]) => `${c} (×${n})`)
                      .join(", ")}
                    {duplicados.length > 8 ? ` e mais ${duplicados.length - 8}…` : ""}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {Object.entries(familias)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 12)
                    .map(([f, q]) => (
                      <div
                        key={f}
                        className="bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                      >
                        <div className="font-mono text-[#1F2C4E] font-bold">
                          {f}
                        </div>
                        <div className="text-[#706F6F]">{q} SKUs</div>
                      </div>
                    ))}
                </div>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-[#706F6F] sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold">
                          Código
                        </th>
                        <th className="text-left py-2 px-3 font-semibold">
                          Descrição
                        </th>
                        <th className="text-left py-2 px-3 font-semibold">
                          Família
                        </th>
                        <th className="text-right py-2 px-3 font-semibold">
                          Lead time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {skus.slice(0, 50).map((s) => (
                        <tr key={s.codigo}>
                          <td className="py-1 px-3 font-mono text-xs">
                            {s.codigo}
                          </td>
                          <td className="py-1 px-3 text-sm">{s.descricao}</td>
                          <td className="py-1 px-3 text-xs">{s.familia}</td>
                          <td className="py-1 px-3 text-right text-xs">
                            {s.lead_time_dias != null ? (
                              `${s.lead_time_dias}d`
                            ) : (
                              <span className="text-slate-400">sem prazo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {skus.length > 50 && (
                    <div className="px-3 py-2 text-xs text-[#706F6F] bg-slate-50">
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
                      : `Importar ${codigosUnicos} SKUs`}
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
