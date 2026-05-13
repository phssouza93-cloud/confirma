"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { atualizarDataPrevista } from "./actions";

type OP = {
  id: string;
  op_numero: string;
  sku_codigo: string;
  derivacao: string | null;
  qtd_prevista: number;
  data_prevista: string | null;
  status: string;
};

type Props = {
  wip: OP[];
};

export function ListaWIP({ wip }: Props) {
  const searchParams = useSearchParams();
  const filtroQS = searchParams.get("filtro");
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<
    "todos" | "aguardando" | "atrasada" | "em_producao"
  >("todos");

  // Aplica filtro automaticamente quando vem da URL (ex.: /wip?filtro=aguardando)
  useEffect(() => {
    if (filtroQS === "aguardando") setFiltroStatus("aguardando");
    else if (filtroQS === "atrasada") setFiltroStatus("atrasada");
    else if (filtroQS === "em_producao") setFiltroStatus("em_producao");
  }, [filtroQS]);

  const filtradas = useMemo(() => {
    let arr = wip.slice();
    if (filtroStatus === "aguardando")
      arr = arr.filter((o) => o.status === "aguardando_data");
    else if (filtroStatus === "atrasada")
      arr = arr.filter((o) => o.status === "atrasada");
    else if (filtroStatus === "em_producao")
      arr = arr.filter((o) => o.status === "em_producao");
    const q = busca.trim().toLowerCase();
    if (q) {
      arr = arr.filter((o) =>
        `${o.op_numero} ${o.sku_codigo} ${o.derivacao || ""}`
          .toLowerCase()
          .includes(q)
      );
    }
    return arr;
  }, [wip, filtroStatus, busca]);

  function onChangeData(opNumero: string, valor: string) {
    const dataIso = valor || null;
    setEditando(opNumero);
    startTransition(async () => {
      await atualizarDataPrevista(opNumero, dataIso);
      setEditando(null);
    });
  }

  function statusBadge(status: string) {
    if (status === "atrasada") {
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
          Atrasada · repactuar
        </span>
      );
    }
    if (status === "em_producao") {
      return (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E6F9FC] text-[#1E9DBA]">
          Em produção
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        Aguardando data · PCP
      </span>
    );
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por OP, SKU ou derivação…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip ativo={filtroStatus === "todos"} cor="#1F2C4E" onClick={() => setFiltroStatus("todos")}>Todas</Chip>
          <Chip ativo={filtroStatus === "aguardando"} cor="amber" onClick={() => setFiltroStatus("aguardando")}>Aguardando data</Chip>
          <Chip ativo={filtroStatus === "em_producao"} cor="cyan" onClick={() => setFiltroStatus("em_producao")}>Em produção</Chip>
          <Chip ativo={filtroStatus === "atrasada"} cor="rose" onClick={() => setFiltroStatus("atrasada")}>Atrasadas</Chip>
        </div>
      </div>

      <div className="text-xs text-[#706F6F] mb-2 px-1">
        {filtradas.length} de {wip.length} {wip.length === 1 ? "OP" : "OPs"}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
            <tr>
              <th className="text-left py-3 px-4 font-semibold">OP</th>
              <th className="text-left py-3 px-4 font-semibold">SKU · derivação</th>
              <th className="text-right py-3 px-4 font-semibold">Qtd</th>
              <th className="text-left py-3 px-4 font-semibold">Data prevista</th>
              <th className="text-left py-3 px-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-[#706F6F]">
                  Nenhuma OP bate com os filtros atuais.
                </td>
              </tr>
            ) : (
              filtradas.map((o) => {
                const valor = o.data_prevista ? o.data_prevista.slice(0, 10) : "";
                const isEditando = editando === o.op_numero && pending;
                return (
                  <tr
                    key={o.id}
                    className={
                      o.status === "atrasada"
                        ? "bg-red-50/40"
                        : o.status === "aguardando_data"
                        ? "bg-amber-50/30"
                        : ""
                    }
                  >
                    <td className="py-2 px-4 font-mono text-xs">{o.op_numero}</td>
                    <td className="py-2 px-4 text-sm">
                      <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                        {o.sku_codigo}
                        {o.derivacao ? "·" + o.derivacao : ""}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-sm">{o.qtd_prevista}</td>
                    <td className="py-2 px-4">
                      <input
                        type="date"
                        defaultValue={valor}
                        onChange={(e) => onChangeData(o.op_numero, e.target.value)}
                        className={
                          "border rounded px-2 py-1 text-xs outline-none focus:border-[#326A84] focus:ring-2 focus:ring-[#64C3D1]/30 " +
                          (o.status === "atrasada"
                            ? "border-red-300 text-red-700 font-medium"
                            : o.status === "aguardando_data"
                            ? "border-amber-300 bg-amber-50/50"
                            : "border-slate-200")
                        }
                      />
                      {isEditando && (
                        <span className="ml-2 text-xs text-[#706F6F]">salvando...</span>
                      )}
                    </td>
                    <td className="py-2 px-4">{statusBadge(o.status)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Chip({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean;
  cor: "amber" | "cyan" | "rose" | string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const palette: Record<string, { on: string; off: string }> = {
    amber: {
      on: "bg-amber-500 text-white border-amber-500",
      off: "bg-white text-amber-700 border-amber-300 hover:border-amber-500",
    },
    cyan: {
      on: "bg-[#1E9DBA] text-white border-[#1E9DBA]",
      off: "bg-white text-[#1E9DBA] border-[#64C3D1]/40 hover:border-[#1E9DBA]",
    },
    rose: {
      on: "bg-rose-600 text-white border-rose-600",
      off: "bg-white text-rose-700 border-rose-300 hover:border-rose-500",
    },
  };
  const def =
    palette[cor] || {
      on: "bg-[#1F2C4E] text-white border-[#1F2C4E]",
      off: "bg-white text-[#1F2C4E] border-slate-200 hover:border-[#64C3D1]",
    };
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors border " +
        (ativo ? def.on : def.off)
      }
    >
      {children}
    </button>
  );
}
