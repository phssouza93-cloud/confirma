"use client";

import { useRouter } from "next/navigation";

export type LinhaFechada = {
  opp_id: string;
  numero_pedido: string;
  cliente: string;
  nome_oportunidade: string;
  valor: number;
  qtd_itens: number;
  qtd_unidades: number;
  prazo_entrega_data: string | null; // ISO date — liberação + 2 úteis + transporte
  owner: string;
};

function fmtMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export function TabelaFechadas({ linhas }: { linhas: LinhaFechada[] }) {
  const router = useRouter();

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
        <tr>
          <th className="text-left py-2 px-4 font-semibold">Pedido</th>
          <th className="text-left py-2 px-4 font-semibold">
            Cliente / Oportunidade
          </th>
          <th className="text-right py-2 px-4 font-semibold">Valor</th>
          <th className="text-right py-2 px-4 font-semibold">Itens</th>
          <th className="text-right py-2 px-4 font-semibold">
            Prazo de entrega acordado
          </th>
          <th className="text-left py-2 px-4 font-semibold">Owner</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {linhas.slice(0, 20).map((f) => (
          <tr
            key={f.opp_id}
            onClick={() => router.push(`/oportunidades/${f.opp_id}`)}
            className="hover:bg-[#E6F9FC] cursor-pointer transition-colors"
            title="Clique para abrir a oportunidade"
          >
            <td className="py-2 px-4 font-mono text-xs text-[#1F2C4E]">
              {f.numero_pedido}
            </td>
            <td className="py-2 px-4">
              <div className="font-semibold text-[#1F2C4E]">{f.cliente}</div>
              <div className="text-xs text-[#706F6F]">
                {f.nome_oportunidade}
              </div>
            </td>
            <td className="py-2 px-4 text-right font-bold text-emerald-700">
              {fmtMoney(f.valor || 0)}
            </td>
            <td className="py-2 px-4 text-right text-sm">
              <span className="text-[#1F2C4E] font-semibold">
                {f.qtd_itens}
              </span>
              <span className="text-xs text-[#706F6F] ml-1">
                ({f.qtd_unidades} un)
              </span>
            </td>
            <td className="py-2 px-4 text-right text-xs text-[#1F2C4E] font-semibold">
              {f.prazo_entrega_data
                ? new Date(f.prazo_entrega_data).toLocaleDateString("pt-BR")
                : "—"}
            </td>
            <td className="py-2 px-4 text-xs text-[#706F6F]">
              {f.owner || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
