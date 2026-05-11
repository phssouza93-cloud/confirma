"use client";

import { useState, useTransition } from "react";
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
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);

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
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
          <tr>
            <th className="text-left py-3 px-4 font-semibold">OP</th>
            <th className="text-left py-3 px-4 font-semibold">
              SKU · derivação
            </th>
            <th className="text-right py-3 px-4 font-semibold">Qtd</th>
            <th className="text-left py-3 px-4 font-semibold">
              Data prevista
            </th>
            <th className="text-left py-3 px-4 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {wip.map((o) => {
            const valor = o.data_prevista
              ? o.data_prevista.slice(0, 10)
              : "";
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
                <td className="py-2 px-4 text-right text-sm">
                  {o.qtd_prevista}
                </td>
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
                    <span className="ml-2 text-xs text-[#706F6F]">
                      salvando...
                    </span>
                  )}
                </td>
                <td className="py-2 px-4">{statusBadge(o.status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
