import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { obterFiltroOwners, ownerEstaNoFiltro } from "@/lib/owner-filter";
import { AppHeader } from "@/app/components/AppHeader";
import {
  calcularOportunidade,
  type SKUFull,
  type WIPDisponivel,
} from "@/lib/prazo";
import { indexarAliases, type Alias } from "@/lib/match";
import { formatarDerivacao } from "@/lib/derivacao";
import { BotaoFirmar } from "./BotaoFirmar";
import { PrazoNegociadoBox } from "./PrazoNegociadoBox";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type Item = {
  id: string;
  sku_codigo: string;
  derivacao: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  total: number;
};

function fmtMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}
function fmtData(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fasePill(fase: string) {
  const map: Record<string, string> = {
    Commit: "bg-emerald-100 text-emerald-800",
    "Melhor Cenário": "bg-amber-100 text-amber-800",
    "POC (demonstração)": "bg-slate-100 text-slate-700",
    Fechado: "bg-[#E6F9FC] text-[#1E9DBA]",
  };
  return (
    <span
      className={
        "inline-block px-2 py-0.5 rounded-full text-xs font-semibold " +
        (map[fase] || "bg-slate-100 text-slate-700")
      }
    >
      {fase}
    </span>
  );
}

export default async function DetalheOportunidade({ params }: Props) {
  const { id } = await params;
  const ctx = await ensureAcesso("/oportunidades");
  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("oportunidades")
    .select("*")
    .eq("id", id)
    .single();
  if (!opp) notFound();

  const filtroOwners = await obterFiltroOwners(
    ctx.userId,
    ctx.nome,
    ctx.perfil
  );
  if (!ownerEstaNoFiltro(opp.owner, filtroOwners)) notFound();

  const { data: itens } = await supabase
    .from("oportunidade_itens")
    .select("*")
    .eq("oportunidade_id", id);
  const listaItens = (itens || []) as Item[];

  const { data: skusData } = await supabase
    .from("skus")
    .select("id, codigo, descricao, estoque, lead_time_dias, eh_servico");
  const skus = (skusData || []) as SKUFull[];

  const { data: derivData } = await supabase
    .from("estoque_derivacoes")
    .select("sku_id, derivacao, qtd_disponivel");
  type Derivacao = {
    sku_id: string;
    derivacao: string | null;
    qtd_disponivel: number;
  };
  const derivPorSkuId: Record<string, Derivacao[]> = {};
  (derivData || []).forEach((d: Derivacao) => {
    if (!d.qtd_disponivel || d.qtd_disponivel <= 0) return;
    if (!derivPorSkuId[d.sku_id]) derivPorSkuId[d.sku_id] = [];
    derivPorSkuId[d.sku_id].push(d);
  });
  const codigoParaId: Record<string, string> = {};
  skus.forEach((s) => {
    codigoParaId[s.codigo] = s.id;
  });

  const { data: carteiraData } = await supabase
    .from("carteira_pedidos")
    .select("sku_codigo, quantidade, status");
  const carteiraReservada: Record<string, number> = {};
  (carteiraData || []).forEach((l: { sku_codigo: string; quantidade: number; status: string }) => {
    if (l.status === "liberado") return;
    carteiraReservada[l.sku_codigo] =
      (carteiraReservada[l.sku_codigo] || 0) + (l.quantidade || 0);
  });

  const { data: wipData } = await supabase
    .from("wip")
    .select("sku_codigo, qtd_prevista, data_prevista, status");
  const wipPorSku: Record<string, WIPDisponivel[]> = {};
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  (wipData || []).forEach(
    (w: {
      sku_codigo: string;
      qtd_prevista: number;
      data_prevista: string | null;
      status: string;
    }) => {
      if (!w.data_prevista) return;
      const dt = new Date(w.data_prevista);
      if (dt < hoje) return;
      if (!wipPorSku[w.sku_codigo]) wipPorSku[w.sku_codigo] = [];
      wipPorSku[w.sku_codigo].push({
        sku_codigo: w.sku_codigo,
        qtd: w.qtd_prevista || 1,
        data_prevista: w.data_prevista,
      });
    }
  );

  const { data: aliasesData } = await supabase
    .from("sku_aliases")
    .select("descricao_alias, sku_codigo, derivacao");
  const aliasMap = indexarAliases((aliasesData || []) as Alias[]);

  const resultado = calcularOportunidade(
    listaItens.map((it: Item) => ({
      sku_codigo: it.sku_codigo,
      descricao: it.descricao,
      derivacao: it.derivacao,
      quantidade: it.quantidade,
      preco_unitario: it.preco_unitario,
    })),
    skus,
    carteiraReservada,
    wipPorSku,
    aliasMap,
    opp.regiao
  );

  const prazoColor =
    resultado.prazo_dias == null
      ? "bg-slate-100 text-slate-700"
      : resultado.prazo_dias <= 10
      ? "bg-emerald-500 text-white"
      : resultado.prazo_dias <= 25
      ? "bg-amber-500 text-white"
      : "bg-rose-500 text-white";

  return (
    <>
      <AppHeader
        nome={ctx.nome}
        perfil={ctx.perfil}
        rotaAtiva="/oportunidades"
      />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/oportunidades"
            className="text-xs text-[#706F6F] hover:text-[#1F2C4E] inline-flex items-center gap-1 mb-4"
          >
            ← Voltar para oportunidades
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold mb-1">
                      {opp.record_type}
                    </div>
                    <h1 className="text-2xl font-black text-[#1F2C4E] uppercase tracking-tight">
                      {opp.nome}
                    </h1>
                    <div className="text-sm text-[#706F6F] mt-0.5">
                      {opp.cliente}
                    </div>
                  </div>
                  {fasePill(opp.fase)}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-sm">
                  <Field label="Valor" valor={fmtMoney(opp.valor || 0)} bold />
                  <Field label="Fechamento" valor={fmtData(opp.data_fechamento)} />
                  <Field label="Owner" valor={opp.owner} />
                  <Field label="Região" valor={opp.regiao} />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-[#1F2C4E] uppercase tracking-wide">
                    Itens e cálculo de prazo
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">
                    Memorial por SKU · gargalo destacado em vermelho
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold">SKU · descrição</th>
                      <th className="text-right py-2 px-3 font-semibold">Qtd</th>
                      <th className="text-left py-2 px-3 font-semibold">Fonte</th>
                      <th className="text-left py-2 px-3 font-semibold">Memorial</th>
                      <th className="text-right py-2 px-3 font-semibold">Prazo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {listaItens.map((it: Item, idx: number) => {
                      const r = resultado.itens[idx];
                      const isGargalo = idx === resultado.gargalo_idx;
                      let fonteLabel = "—";
                      if (r.status === "sem_cadastro") fonteLabel = "⚠ Sem cadastro";
                      else if (r.status === "servico") fonteLabel = "🔧 Serviço";
                      else if (r.fonte === "estoque") fonteLabel = "✓ Estoque";
                      else if (r.fonte === "wip") fonteLabel = "🏭 Estoque + WIP";
                      else if (r.fonte === "producao_zero") fonteLabel = "⚙ Produção do zero";
                      return (
                        <tr key={it.id} className={isGargalo ? "bg-rose-50" : ""}>
                          <td className="py-2 px-3 align-top">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                                {it.sku_codigo}
                                {it.derivacao ? "·" + it.derivacao : ""}
                              </span>
                              {isGargalo && (
                                <span className="text-xs px-1.5 py-0.5 bg-rose-200 text-rose-900 rounded font-semibold uppercase tracking-wide">
                                  Gargalo
                                </span>
                              )}
                            </div>
                            <div className="text-sm">{it.descricao}</div>
                            {r.matched_by === "alias" && (
                              <div className="text-xs text-emerald-700 mt-0.5">
                                ✓ alias oficial → {r.sku_codigo_matched}
                                {r.derivacao_sugerida && (
                                  <>
                                    {" · "}
                                    <span className="font-mono">derivação {r.derivacao_sugerida}</span>
                                  </>
                                )}
                              </div>
                            )}
                            {r.matched_by === "descricao" && (
                              <div className="text-xs text-[#326A84] mt-0.5">
                                ↪ vinculado por descrição → {r.sku_codigo_matched} ({Math.round(r.match_score * 100)}%)
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 align-top text-right text-sm font-medium">{it.quantidade}</td>
                          <td className="py-2 px-3 align-top text-xs">{fonteLabel}</td>
                          <td className="py-2 px-3 align-top text-xs text-[#706F6F]">
                            {r.status === "sem_cadastro" ? (
                              "SKU não localizado no cadastro"
                            ) : r.status === "servico" ? (
                              <span className="italic">Item de serviço — não afeta prazo</span>
                            ) : (
                              <>
                                Estoque: {r.estoque} − Carteira: {r.carteira} = <b>{r.disponivel} disp.</b>
                                {r.wip_total > 0 && <> · WIP: {r.wip_total}</>}
                                {r.consumo_estoque > 0 && <> · {r.consumo_estoque} do estoque</>}
                                {r.consumo_wip > 0 && <> · {r.consumo_wip} do WIP</>}
                                {r.consumo_producao_zero > 0 && (
                                  <>
                                    {" · "}
                                    <b className="text-rose-700">{r.consumo_producao_zero} a produzir</b>
                                  </>
                                )}
                                {(() => {
                                  const codigoFinal = r.sku_codigo_matched;
                                  if (!codigoFinal) return null;
                                  const skuId = codigoParaId[codigoFinal];
                                  const derivs = derivPorSkuId[skuId] || [];
                                  if (derivs.length === 0) return null;
                                  return (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      <span className="text-[10px] uppercase tracking-wide text-[#706F6F]/70 mr-1">mix disp.</span>
                                      {derivs
                                        .slice()
                                        .sort((a, b) => (a.derivacao || "").localeCompare(b.derivacao || ""))
                                        .map((d, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#E6F9FC] text-[#1E9DBA] rounded text-[11px]">
                                            <span className="font-mono">{formatarDerivacao(d.derivacao) || "—"}</span>
                                            <span className="font-semibold">{d.qtd_disponivel}</span>
                                          </span>
                                        ))}
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                          </td>
                          <td className="py-2 px-3 align-top text-right">
                            {r.prazo_dias != null ? (
                              <span
                                className={
                                  "inline-block px-2 py-0.5 rounded text-xs font-semibold " +
                                  (r.prazo_dias <= 10
                                    ? "bg-emerald-100 text-emerald-800"
                                    : r.prazo_dias <= 25
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800")
                                }
                              >
                                {r.prazo_dias}d
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div
                className={"rounded-2xl p-6 text-center text-white " + prazoColor}
                style={resultado.prazo_dias == null ? { background: "#1F2C4E" } : undefined}
              >
                <div className="text-xs uppercase tracking-widest opacity-80 mb-2">Menor prazo de liberação</div>
                {resultado.prazo_dias != null ? (
                  <>
                    <div className="text-6xl font-black leading-none">{resultado.prazo_dias}</div>
                    <div className="text-sm mt-1 opacity-90">dias corridos</div>
                    {resultado.gargalo_idx != null ? (
                      <div className="mt-4 pt-4 border-t border-white/20 text-xs">
                        <div className="opacity-80">Gargalo</div>
                        <div className="font-mono font-bold mt-0.5">
                          {resultado.itens[resultado.gargalo_idx].sku_codigo_matched ||
                            resultado.itens[resultado.gargalo_idx].sku_codigo_input}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 pt-4 border-t border-white/20 text-xs opacity-80">
                        Sem gargalo único · todos os itens com o mesmo prazo
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">Sob consulta</div>
                    <div className="text-xs mt-2 opacity-80">Itens sem cadastro mestre</div>
                  </>
                )}
                <div className="mt-4 text-xs opacity-70">
                  Cálculo oficial · {new Date().toLocaleDateString("pt-BR")}
                </div>
              </div>

              {resultado.prazo_entrega_dias != null && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                  <div className="text-xs uppercase tracking-widest text-[#706F6F] font-semibold mb-2">
                    Prazo de entrega ao cliente
                  </div>
                  <div className="text-4xl font-black text-[#1F2C4E] leading-none">
                    {resultado.prazo_entrega_dias}
                  </div>
                  <div className="text-xs mt-1 text-[#706F6F]">dias corridos</div>
                  <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-[#706F6F] leading-relaxed">
                    {resultado.prazo_dias}d liberação
                    {" + 2d fat./expedição"}
                    {resultado.dias_transporte != null && (
                      <> + {resultado.dias_transporte}d transporte</>
                    )}
                    {resultado.dias_transporte == null && opp.regiao && (
                      <> (UF “{opp.regiao}” não reconhecida)</>
                    )}
                    {!opp.regiao && (
                      <> (defina UF/região na oportunidade)</>
                    )}
                  </div>
                </div>
              )}

              <PrazoNegociadoBox
                opp_id={opp.id}
                valorInicial={opp.prazo_negociado_dias ?? null}
                menorPrazo={resultado.prazo_dias}
                bloqueado={opp.fase === "Fechado"}
              />

              <BotaoFirmar opp_id={opp.id} fase={opp.fase} />

              <div className="bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-2xl p-4 text-sm">
                <div className="font-bold text-[#1F2C4E] mb-1 uppercase tracking-wide text-xs">
                  Como o prazo é calculado
                </div>
                <p className="text-xs text-[#1F2C4E]/80 leading-relaxed">
                  <b>Estoque − Carteira</b> = disponível. Se faltar, consome <b>WIP</b> com data prevista.
                  Se ainda faltar, vai pra <b>produção do zero</b>. O prazo da oportunidade é o do SKU{" "}
                  <b>mais demorado</b> (regra do gargalo).
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="border-t border-slate-100 py-5 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[#706F6F]">
          <span>© {new Date().getFullYear()} Confiance Medical</span>
          <span className="hidden sm:inline">#PorUmMundoSemCicatriz</span>
        </div>
      </footer>
    </>
  );
}

function Field({
  label,
  valor,
  bold,
}: {
  label: string;
  valor: string;
  bold?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold">
        {label}
      </div>
      <div className={"mt-0.5 " + (bold ? "font-bold text-[#1F2C4E]" : "text-[#1F2C4E]")}>
        {valor}
      </div>
    </div>
  );
}
