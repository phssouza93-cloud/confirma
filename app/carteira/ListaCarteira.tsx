"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  atualizarPrevLiberacaoLinha,
  atualizarPrevLiberacaoPedido,
} from "./actions";

type LinhaCarteira = {
  id: string;
  numero_pedido: string;
  cliente: string;
  sku_codigo: string;
  derivacao: string | null;
  quantidade: number;
  data_promessa: string | null;
  prev_liberacao: string | null;
  status: string;
  sem_cadastro: boolean;
};

type Pedido = {
  numero: string;
  cliente: string;
  itens: LinhaCarteira[];
  totalUnidades: number;
  dataPromessa: string | null;
  prevLiberacaoAgg: string | null; // mais distante entre os itens
  semCadastro: number;
  statusAgregado: string;
};

type Props = {
  linhas: LinhaCarteira[];
};

function agrupar(linhas: LinhaCarteira[]): Pedido[] {
  const mapa: Record<string, Pedido> = {};
  linhas.forEach((l) => {
    if (!mapa[l.numero_pedido]) {
      mapa[l.numero_pedido] = {
        numero: l.numero_pedido,
        cliente: l.cliente,
        itens: [],
        totalUnidades: 0,
        dataPromessa: l.data_promessa,
        prevLiberacaoAgg: l.prev_liberacao,
        semCadastro: 0,
        statusAgregado: l.status,
      };
    }
    const p = mapa[l.numero_pedido];
    p.itens.push(l);
    p.totalUnidades += l.quantidade;
    if (l.sem_cadastro) p.semCadastro++;
    if (l.data_promessa) {
      if (
        !p.dataPromessa ||
        new Date(l.data_promessa) > new Date(p.dataPromessa)
      ) {
        p.dataPromessa = l.data_promessa;
      }
    }
    if (l.prev_liberacao) {
      if (
        !p.prevLiberacaoAgg ||
        new Date(l.prev_liberacao) > new Date(p.prevLiberacaoAgg)
      ) {
        p.prevLiberacaoAgg = l.prev_liberacao;
      }
    }
    if (p.statusAgregado !== l.status) p.statusAgregado = "misto";
  });
  return Object.values(mapa);
}

function statusBadge(s: string) {
  const cor: Record<string, string> = {
    em_producao: "bg-[#E6F9FC] text-[#1E9DBA]",
    aguardando_liberacao: "bg-amber-100 text-amber-800",
    liberado: "bg-emerald-100 text-emerald-800",
    misto: "bg-slate-100 text-slate-700",
  };
  const label: Record<string, string> = {
    em_producao: "Em produção",
    aguardando_liberacao: "Aguard. liberação",
    liberado: "Liberado",
    misto: "Em andamento",
  };
  return (
    <span
      className={
        "inline-block px-2 py-0.5 rounded-full text-xs font-semibold " +
        (cor[s] || "bg-slate-100 text-slate-700")
      }
    >
      {label[s] || s}
    </span>
  );
}

function fmtData(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export function ListaCarteira({ linhas }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pedidos = agrupar(linhas);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  function toggle(numero: string) {
    const novo = new Set(expandido);
    if (novo.has(numero)) novo.delete(numero);
    else novo.add(numero);
    setExpandido(novo);
  }

  function salvarPedidoPrev(numero_pedido: string, valor: string) {
    startTransition(async () => {
      await atualizarPrevLiberacaoPedido(numero_pedido, valor || null);
      router.refresh();
    });
  }

  function salvarLinhaPrev(linha_id: string, valor: string) {
    startTransition(async () => {
      await atualizarPrevLiberacaoLinha(linha_id, valor || null);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
          <tr>
            <th className="w-8"></th>
            <th className="text-left py-3 px-4 font-semibold">Pedido</th>
            <th className="text-left py-3 px-4 font-semibold">Cliente</th>
            <th className="text-left py-3 px-4 font-semibold">Itens</th>
            <th className="text-left py-3 px-4 font-semibold">
              Prev. liberação
            </th>
            <th className="text-left py-3 px-4 font-semibold">Prazo limite</th>
            <th className="text-left py-3 px-4 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pedidos.map((p) => {
            const aberto = expandido.has(p.numero);
            const atrasado =
              p.prevLiberacaoAgg &&
              p.dataPromessa &&
              new Date(p.prevLiberacaoAgg) > new Date(p.dataPromessa);
            return (
              <Fragment key={p.numero}>
                <tr
                  className={
                    "hover:bg-slate-50 " + (aberto ? "bg-slate-50/70" : "")
                  }
                >
                  <td
                    className="py-3 px-3 text-slate-400 cursor-pointer"
                    onClick={() => toggle(p.numero)}
                  >
                    {aberto ? "▼" : "▶"}
                  </td>
                  <td
                    className="py-3 px-4 font-mono text-xs cursor-pointer"
                    onClick={() => toggle(p.numero)}
                  >
                    PED-{p.numero}
                  </td>
                  <td
                    className="py-3 px-4 text-sm cursor-pointer"
                    onClick={() => toggle(p.numero)}
                  >
                    {p.cliente}
                  </td>
                  <td
                    className="py-3 px-4 text-sm cursor-pointer"
                    onClick={() => toggle(p.numero)}
                  >
                    <b>{p.itens.length}</b> SKUs ·{" "}
                    <b>{p.totalUnidades}</b> unid.
                    {p.semCadastro > 0 && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                        ⚠ {p.semCadastro} sem cadastro
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <input
                      type="date"
                      defaultValue={p.prevLiberacaoAgg || ""}
                      onBlur={(e) =>
                        salvarPedidoPrev(p.numero, e.target.value)
                      }
                      onClick={(e) => e.stopPropagation()}
                      disabled={isPending}
                      className={
                        "bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#64C3D1] focus:bg-white " +
                        (atrasado ? "border-rose-300 text-rose-700" : "")
                      }
                      title={
                        atrasado
                          ? "⚠ Previsão de liberação ultrapassa o prazo limite"
                          : "Editável pelo PCP"
                      }
                    />
                  </td>
                  <td
                    className={
                      "py-3 px-4 text-xs cursor-pointer " +
                      (atrasado ? "text-rose-700 font-semibold" : "")
                    }
                    onClick={() => toggle(p.numero)}
                  >
                    {fmtData(p.dataPromessa)}
                  </td>
                  <td
                    className="py-3 px-4 cursor-pointer"
                    onClick={() => toggle(p.numero)}
                  >
                    {statusBadge(p.statusAgregado)}
                  </td>
                </tr>
                {aberto &&
                  p.itens.map((it: LinhaCarteira) => {
                    const linhaAtrasada =
                      it.prev_liberacao &&
                      it.data_promessa &&
                      new Date(it.prev_liberacao) >
                        new Date(it.data_promessa);
                    return (
                      <tr key={it.id} className="bg-slate-50/40">
                        <td className="text-center text-xs text-slate-400">
                          └
                        </td>
                        <td colSpan={2} className="py-1.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-200/70 rounded">
                              {it.sku_codigo}
                              {it.derivacao ? "·" + it.derivacao : ""}
                            </span>
                            {it.sem_cadastro && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                                ⚠ sem cadastro mestre
                              </span>
                            )}
                            <span className="text-sm">
                              {it.quantidade} unid.
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-4 text-xs">—</td>
                        <td className="py-1.5 px-4 text-xs">
                          <input
                            type="date"
                            defaultValue={it.prev_liberacao || ""}
                            onBlur={(e) =>
                              salvarLinhaPrev(it.id, e.target.value)
                            }
                            disabled={isPending}
                            className={
                              "bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#64C3D1] " +
                              (linhaAtrasada
                                ? "border-rose-300 text-rose-700"
                                : "")
                            }
                          />
                        </td>
                        <td
                          className={
                            "py-1.5 px-4 text-xs " +
                            (linhaAtrasada
                              ? "text-rose-700 font-semibold"
                              : "")
                          }
                        >
                          {fmtData(it.data_promessa)}
                        </td>
                        <td className="py-1.5 px-4">
                          {statusBadge(it.status)}
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
