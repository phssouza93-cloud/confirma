"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { importarOportunidades, type OppInput, type ItemOppInput } from "./actions";
import { formatarDerivacao } from "@/lib/derivacao";

type Etapa = "fechado" | "upload" | "processando" | "preview";

type Props = {
  qtdAtual: number;
};

function parseData(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export function ImportarOportunidades({ qtdAtual }: Props) {
  const [etapa, setEtapa] = useState<Etapa>("fechado");
  const [fileName, setFileName] = useState<string>("");
  const [opps, setOpps] = useState<OppInput[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setEtapa("upload");
    setErro(null);
    setOpps([]);
    setFileName("");
  }
  function fechar() {
    setEtapa("fechado");
    setErro(null);
    setOpps([]);
    setFileName("");
  }

  function processarArquivo(file: File) {
    setFileName(file.name);
    setEtapa("processando");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const nomeResumo =
          wb.SheetNames.find((n) => /resumo|oportunid/i.test(n)) ||
          wb.SheetNames[0];
        const nomeItens =
          wb.SheetNames.find((n) => /detalh|produt|item/i.test(n)) ||
          (wb.SheetNames.length > 1 ? wb.SheetNames[1] : null);
        const linhasResumo = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          wb.Sheets[nomeResumo],
          { defval: null }
        );
        const linhasItens = nomeItens
          ? XLSX.utils.sheet_to_json<Record<string, unknown>>(
              wb.Sheets[nomeItens],
              { defval: null }
            )
          : [];

        // Indexa itens por nome de oportunidade
        const mapaItens: Record<string, ItemOppInput[]> = {};
        linhasItens.forEach((r) => {
          const opp = (r["Oportunidade"] ?? r["Nome da Oportunidade"]) as
            | string
            | null;
          if (!opp) return;
          if (!mapaItens[opp]) mapaItens[opp] = [];
          mapaItens[opp].push({
            sku_codigo: String(
              r["SKU"] ?? r["Código"] ?? r["Codigo"] ?? ""
            ).trim(),
            derivacao: formatarDerivacao(
              r["Derivação"] ?? r["Derivacao"] ?? null
            ),
            descricao: String(
              r["Produto"] ?? r["Descrição"] ?? r["Descricao"] ?? ""
            ).trim(),
            quantidade: Number(r["Quantidade"] ?? 1),
            preco_unitario: Number(
              r["Preço Unitário (R$)"] ?? r["Preço Unitário"] ?? r["Preco Unitario"] ?? 0
            ),
          });
        });

        const lista: OppInput[] = linhasResumo
          .filter(
            (r) =>
              (r["Oportunidade"] || r["Cliente"]) &&
              r["Cliente"] !== "TOTAL"
          )
          .map((r) => {
            const nome = String(
              r["Oportunidade"] ?? r["Cliente"] ?? ""
            ).trim();
            return {
              cliente: String(r["Cliente"] ?? "").trim(),
              nome,
              fase: String(r["Fase"] ?? "POC (demonstração)").trim(),
              record_type: String(
                r["Record Type"] ?? r["Tipo"] ?? "Vendas Privadas"
              ).trim(),
              data_fechamento: parseData(r["Data de Fechamento"]),
              owner: String(
                r["Owner"] ?? r["Gestor Regional"] ?? ""
              ).trim(),
              regiao: String(r["Região"] ?? r["Regiao"] ?? "").trim(),
              itens: mapaItens[nome] || [],
            };
          });

        if (lista.length === 0) {
          setErro(
            "Não consegui identificar oportunidades. Colunas esperadas no resumo: Cliente, Oportunidade, Fase, Owner, Região, Data de Fechamento."
          );
          setEtapa("upload");
          return;
        }
        setOpps(lista);
        setEtapa("preview");
      } catch (err) {
        setErro(
          "Erro ao ler planilha: " +
            (err instanceof Error ? err.message : String(err))
        );
        setEtapa("upload");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function confirmar() {
    startTransition(async () => {
      const res = await importarOportunidades(opps);
      if (!res.ok) {
        setErro(res.error || "Erro desconhecido");
        return;
      }
      fechar();
    });
  }

  function fmtMoney(v: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(v);
  }

  if (etapa === "fechado") {
    return (
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-[#1F2C4E] font-medium uppercase tracking-wide text-xs transition"
      >
        Importar planilha
      </button>
    );
  }

  const total = opps.reduce(
    (s, o) =>
      s + o.itens.reduce((a, i) => a + i.quantidade * (i.preco_unitario || 0), 0),
    0
  );
  const porFase: Record<string, number> = {};
  opps.forEach((o) => {
    const v = o.itens.reduce(
      (s, i) => s + i.quantidade * (i.preco_unitario || 0),
      0
    );
    porFase[o.fase] = (porFase[o.fase] || 0) + v;
  });

  return (
    <>
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-[#1F2C4E] font-medium uppercase tracking-wide text-xs transition"
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
                    Importar pipeline
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">
                    Aceita o formato com abas Resumo + Detalhamento.
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
                    Já existem <b>{qtdAtual} oportunidades</b>. A importação{" "}
                    <b>substitui</b> o pipeline atual.
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
                    Colunas Resumo: Cliente · Oportunidade · Valor · Fase ·
                    Owner · Região
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
                    Pré-visualizar pipeline
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
                  <b>{opps.length}</b> oportunidades · <b>{fmtMoney(total)}</b>{" "}
                  em pipeline
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="text-xs uppercase text-[#706F6F] font-semibold mb-2">
                      Por fase
                    </div>
                    {Object.entries(porFase).map(([f, v]) => (
                      <div
                        key={f}
                        className="flex justify-between text-xs py-0.5"
                      >
                        <span>{f}</span>
                        <span className="font-medium">{fmtMoney(v)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="text-xs uppercase text-[#706F6F] font-semibold mb-2">
                      Total
                    </div>
                    <div className="text-2xl font-black text-[#1F2C4E]">
                      {fmtMoney(total)}
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-[#706F6F] sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-semibold">
                          Oportunidade
                        </th>
                        <th className="text-right py-2 px-3 font-semibold">
                          Itens
                        </th>
                        <th className="text-right py-2 px-3 font-semibold">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {opps.map((o, i) => {
                        const v = o.itens.reduce(
                          (s, it) =>
                            s + it.quantidade * (it.preco_unitario || 0),
                          0
                        );
                        return (
                          <tr key={i}>
                            <td className="py-1.5 px-3">
                              <div className="text-sm">{o.nome}</div>
                              <div className="text-xs text-[#706F6F]">
                                {o.cliente}
                              </div>
                            </td>
                            <td className="py-1.5 px-3 text-right text-xs">
                              {o.itens.length}
                            </td>
                            <td className="py-1.5 px-3 text-right text-sm font-medium">
                              {fmtMoney(v)}
                            </td>
                          </tr>
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
                      : `Importar ${opps.length} oportunidades`}
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
