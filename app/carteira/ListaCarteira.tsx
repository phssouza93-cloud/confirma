"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  apagarPedido,
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
  oportunidade_origem_id: string | null;
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
  veioDeOportunidade: boolean; // se alguma linha tem oportunidade_origem_id
};

type Props = {
  linhas: LinhaCarteira[];
  podeEditar?: boolean;
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
        veioDeOportunidade: false,
      };
    }
    const p = mapa[l.numero_pedido];
    p.itens.push(l);
    p.totalUnidades += l.quantidade;
    if (l.oportunidade_origem_id) p.veioDeOportunidade = true;
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
  // Parse manual pra evitar bug de timezone (Date interpreta ISO como UTC)
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return d;
}

function normalizar(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function ListaCarteira({ linhas, podeEditar = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pedidosTodos = agrupar(linhas);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<
    "todos" | "em_producao" | "aguardando_liberacao" | "liberado" | "misto"
  >("todos");
  const [filtroOrigem, setFiltroOrigem] = useState<
    "todos" | "pdf" | "oportunidade"
  >("todos");
  const [filtroAtrasados, setFiltroAtrasados] = useState(false);

  const pedidos = useMemo(() => {
    let arr = pedidosTodos.slice();
    if (filtroStatus !== "todos") {
      arr = arr.filter((p) => p.statusAgregado === filtroStatus);
    }
    if (filtroOrigem === "pdf") {
      arr = arr.filter((p) => !p.veioDeOportunidade);
    } else if (filtroOrigem === "oportunidade") {
      arr = arr.filter((p) => p.veioDeOportunidade);
    }
    if (filtroAtrasados) {
      arr = arr.filter(
        (p) =>
          p.prevLiberacaoAgg &&
          p.dataPromessa &&
          new Date(p.prevLiberacaoAgg) > new Date(p.dataPromessa)
      );
    }
    const q = normalizar(busca.trim());
    if (q) {
      arr = arr.filter((p) => {
        const blob = normalizar(
          `${p.numero} ${p.cliente} ${p.itens
            .map((i) => `${i.sku_codigo} ${i.derivacao || ""}`)
            .join(" ")}`
        );
        return blob.includes(q);
      });
    }
    return arr;
  }, [pedidosTodos, busca, filtroStatus, filtroOrigem, filtroAtrasados]);

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

  function excluirPedido(numero_pedido: string, cliente: string) {
    const ok = window.confirm(
      `Tem certeza que deseja excluir o pedido PED-${numero_pedido} (${cliente})?\n\nEssa ação não pode ser desfeita.`
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await apagarPedido(numero_pedido);
      if (!res.ok) {
        window.alert(res.error || "Erro ao excluir pedido");
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por pedido, cliente, SKU ou derivação…"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
            />
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-[#1F2C4E] cursor-pointer">
            <input
              type="checkbox"
              checked={filtroAtrasados}
              onChange={(e) => setFiltroAtrasados(e.target.checked)}
              className="rounded"
            />
            Só atrasados
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip
            ativo={filtroStatus === "todos"}
            cor="navy"
            onClick={() => setFiltroStatus("todos")}
          >
            Todos status
          </Chip>
          <Chip
            ativo={filtroStatus === "em_producao"}
            cor="cyan"
            onClick={() => setFiltroStatus("em_producao")}
          >
            Em produção
          </Chip>
          <Chip
            ativo={filtroStatus === "aguardando_liberacao"}
            cor="amber"
            onClick={() => setFiltroStatus("aguardando_liberacao")}
          >
            Aguard. liberação
          </Chip>
          <Chip
            ativo={filtroStatus === "liberado"}
            cor="emerald"
            onClick={() => setFiltroStatus("liberado")}
          >
            Liberado
          </Chip>
          <span className="mx-1 border-l border-slate-200"></span>
          <Chip
            ativo={filtroOrigem === "todos"}
            cor="navy"
            onClick={() => setFiltroOrigem("todos")}
          >
            Todas origens
          </Chip>
          <Chip
            ativo={filtroOrigem === "pdf"}
            cor="cyan"
            onClick={() => setFiltroOrigem("pdf")}
          >
            PDF importado
          </Chip>
          <Chip
            ativo={filtroOrigem === "oportunidade"}
            cor="emerald"
            onClick={() => setFiltroOrigem("oportunidade")}
          >
            Oport. firmada
          </Chip>
        </div>
      </div>

      <div className="text-xs text-[#706F6F] mb-2 px-1">
        {pedidos.length} de {pedidosTodos.length}{" "}
        {pedidosTodos.length === 1 ? "pedido" : "pedidos"}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
      <table className="w-full text-sm min-w-[780px]">
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
            <th className="w-12"></th>
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
                    {podeEditar ? (
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
                    ) : (
                      <span
                        className={
                          "text-xs " +
                          (atrasado ? "text-rose-700 font-semibold" : "text-[#1F2C4E]")
                        }
                      >
                        {fmtData(p.prevLiberacaoAgg)}
                      </span>
                    )}
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
                  <td className="py-3 px-2 text-center">
                    {!podeEditar ? null : p.veioDeOportunidade ? (
                      <span
                        className="text-[10px] text-slate-400 cursor-help"
                        title="Pedido vindo de oportunidade firmada — reabra a oportunidade pra remover."
                      >
                        🔒
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          excluirPedido(p.numero, p.cliente);
                        }}
                        disabled={isPending}
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded px-2 py-1 text-xs font-semibold disabled:opacity-50"
                        title="Excluir pedido da carteira"
                      >
                        ✕
                      </button>
                    )}
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
                          {podeEditar ? (
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
                          ) : (
                            <span
                              className={
                                "text-xs " +
                                (linhaAtrasada
                                  ? "text-rose-700 font-semibold"
                                  : "text-[#1F2C4E]")
                              }
                            >
                              {fmtData(it.prev_liberacao)}
                            </span>
                          )}
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
                        <td className="py-1.5 px-2"></td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
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
  cor: "navy" | "amber" | "cyan" | "rose" | "emerald";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const palette: Record<string, { on: string; off: string }> = {
    navy: {
      on: "bg-[#1F2C4E] text-white border-[#1F2C4E]",
      off: "bg-white text-[#1F2C4E] border-slate-200 hover:border-[#64C3D1]",
    },
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
    emerald: {
      on: "bg-emerald-600 text-white border-emerald-600",
      off: "bg-white text-emerald-700 border-emerald-300 hover:border-emerald-500",
    },
  };
  const def = palette[cor] || palette.navy;
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
