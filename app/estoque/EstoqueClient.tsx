"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LeadTimeInput } from "./LeadTimeInput";

export type LinhaEstoque = {
  id: string;
  codigo: string;
  descricao: string;
  familia: string | null;
  estoque: number;
  lead_time_dias: number | null;
  eh_servico: boolean;
  derivacoes: { derivacao: string | null; qtd_disponivel: number }[];
};

function normalizar(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function EstoqueClient({ linhas }: { linhas: LinhaEstoque[] }) {
  const searchParams = useSearchParams();
  const filtroQS = searchParams.get("filtro");

  const [busca, setBusca] = useState("");
  const [ocultarServicos, setOcultarServicos] = useState(true);
  const [soSemLeadTime, setSoSemLeadTime] = useState(false);
  const [soComEstoque, setSoComEstoque] = useState(false);

  // Ativa filtro automaticamente quando vem da URL (ex.: /estoque?filtro=sem_lead_time)
  useEffect(() => {
    if (filtroQS === "sem_lead_time") {
      setSoSemLeadTime(true);
      setOcultarServicos(true);
    }
  }, [filtroQS]);

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    let arr = linhas.slice();
    if (ocultarServicos) arr = arr.filter((l) => !l.eh_servico);
    if (soSemLeadTime)
      arr = arr.filter((l) => !l.eh_servico && l.lead_time_dias == null);
    if (soComEstoque) arr = arr.filter((l) => (l.estoque || 0) > 0);
    if (q) {
      arr = arr.filter((l) => {
        const blob = normalizar(
          `${l.codigo} ${l.descricao} ${l.familia || ""}`
        );
        return blob.includes(q);
      });
    }
    return arr;
  }, [linhas, busca, ocultarServicos, soSemLeadTime, soComEstoque]);

  return (
    <>
      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, descrição ou família…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#1F2C4E]">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ocultarServicos}
              onChange={(e) => setOcultarServicos(e.target.checked)}
              className="rounded"
            />
            Ocultar serviços
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={soComEstoque}
              onChange={(e) => setSoComEstoque(e.target.checked)}
              className="rounded"
            />
            Só com estoque
          </label>
          <label
            className={
              "inline-flex items-center gap-1.5 cursor-pointer " +
              (soSemLeadTime
                ? "text-amber-700 font-semibold"
                : "")
            }
          >
            <input
              type="checkbox"
              checked={soSemLeadTime}
              onChange={(e) => setSoSemLeadTime(e.target.checked)}
              className="rounded"
            />
            Só sem lead time
          </label>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
            Cadastro mestre
          </h2>
          <div className="text-xs text-[#706F6F]">
            {filtradas.length} de {linhas.length}{" "}
            {linhas.length === 1 ? "SKU" : "SKUs"}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
              <tr>
                <th className="text-left py-3 px-4 font-semibold">Código</th>
                <th className="text-left py-3 px-4 font-semibold">Descrição</th>
                <th className="text-left py-3 px-4 font-semibold">Família</th>
                <th className="text-right py-3 px-4 font-semibold">Estoque</th>
                <th className="text-left py-3 px-4 font-semibold">
                  Derivações
                </th>
                <th className="text-right py-3 px-4 font-semibold">
                  Lead time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-[#706F6F]"
                  >
                    Nenhum SKU bate com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filtradas.map((s) => {
                  const derivs = (s.derivacoes || [])
                    .filter((d) => (d.qtd_disponivel || 0) > 0)
                    .sort((a, b) =>
                      (a.derivacao || "").localeCompare(b.derivacao || "")
                    );
                  const derivsComCodigo = derivs.filter(
                    (d) => d.derivacao && d.derivacao.trim() !== ""
                  );
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-mono text-xs text-[#1F2C4E]">
                        {s.codigo}
                        {s.eh_servico && (
                          <span className="ml-1 text-[10px] uppercase tracking-wider text-slate-500">
                            svc
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-sm">{s.descricao}</td>
                      <td className="py-2 px-4 text-xs text-[#706F6F]">
                        {s.familia || "—"}
                      </td>
                      <td className="py-2 px-4 text-right text-sm font-medium">
                        {s.estoque || 0}
                      </td>
                      <td className="py-2 px-4">
                        {derivsComCodigo.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {derivsComCodigo.map((d, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#E6F9FC] text-[#1E9DBA] rounded text-xs"
                              >
                                <span className="font-mono">{d.derivacao}</span>
                                <span className="font-semibold">
                                  {d.qtd_disponivel}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {s.eh_servico ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <LeadTimeInput
                            codigo={s.codigo}
                            valorInicial={s.lead_time_dias}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
