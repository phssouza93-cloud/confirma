"use client";

import { Fragment, useState } from "react";

type LinhaCarteira = {
  id: string;
  numero_pedido: string;
  cliente: string;
  sku_codigo: string;
  derivacao: string | null;
  quantidade: number;
  data_promessa: string | null;
  status: string;
  sem_cadastro: boolean;
};

type Pedido = {
  numero: string;
  cliente: string;
  itens: LinhaCarteira[];
  totalUnidades: number;
  dataPromessa: string | null;
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
        semCadastro: 0,
        statusAgregado: l.status,
      };
    }
    mapa[l.numero_pedido].itens.push(l);
    mapa[l.numero_pedido].totalUnidades += l.quantidade;
    if (l.sem_cadastro) mapa[l.numero_pedido].semCadastro++;
    if (l.data_promessa) {
      if (
        !mapa[l.numero_pedido].dataPromessa ||
        new Date(l.data_promessa) > new Date(mapa[l.numero_pedido].dataPromessa!)
      ) {
        mapa[l.numero_pedido].dataPromessa = l.data_promessa;
      }
    }
    // status agregado: se varia, marca misto
    if (mapa[l.numero_pedido].statusAgregado !== l.status) {
      mapa[l.numero_pedido].statusAgregado = "misto";
    }
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
  const pedidos = agrupar(linhas);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  function toggle(numero: string) {
    const novo = new Set(expandido);
    if (novo.has(numero)) novo.delete(numero);
    else novo.add(numero);
    setExpandido(novo);
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
            <th className="text-left py-3 px-4 font-semibold">Promessa</th>
            <th className="text-left py-3 px-4 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pedidos.map((p) => {
            const aberto = expandido.has(p.numero);
            return (
              <Fragment key={p.numero}>
                <tr
                  className={
                    "hover:bg-slate-50 cursor-pointer " +
                    (aberto ? "bg-slate-50/70" : "")
                  }
                  onClick={() => toggle(p.numero)}
                >
                  <td className="py-3 px-3 text-slate-400">
                    {aberto ? "▼" : "▶"}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">
                    PED-{p.numero}
                  </td>
                  <td className="py-3 px-4 text-sm">{p.cliente}</td>
                  <td className="py-3 px-4 text-sm">
                    <b>{p.itens.length}</b> SKUs ·{" "}
                    <b>{p.totalUnidades}</b> unid.
                    {p.semCadastro > 0 && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                        ⚠ {p.semCadastro} sem cadastro
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {fmtData(p.dataPromessa)}
                  </td>
                  <td className="py-3 px-4">
                    {statusBadge(p.statusAgregado)}
                  </td>
                </tr>
                {aberto &&
                  p.itens.map((it: LinhaCarteira) => (
                    <tr key={it.id} className="bg-slate-50/40">
                      <td className="text-center text-xs text-slate-400">└</td>
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
                      <td colSpan={2} className="py-1.5 px-4 text-xs">
                        {fmtData(it.data_promessa)}
                      </td>
                      <td className="py-1.5 px-4">{statusBadge(it.status)}</td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
