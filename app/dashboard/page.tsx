import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { obterFiltroOwners, normalizaOwner } from "@/lib/owner-filter";
import { AppHeader } from "../components/AppHeader";
import {
  calcularOportunidade,
  somarDiasCorridos,
  somarDiasUteis,
  type SKUFull,
  type WIPDisponivel,
} from "@/lib/prazo";
import { indexarAliases, type Alias } from "@/lib/match";
import {
  diasTransporteDoUF,
  FATURAMENTO_EXPEDICAO_DIAS,
} from "@/lib/transporte";
import { TabelaFechadas, type LinhaFechada } from "./TabelaFechadas";

export const dynamic = "force-dynamic";

type Opp = {
  id: string;
  cliente: string;
  nome: string;
  valor: number;
  fase: string;
  owner: string;
  regiao: string;
  data_fechamento: string | null;
};

type Pedido = {
  numero_pedido: string;
  cliente: string;
  oportunidade_origem_id: string | null;
  quantidade: number;
  data_promessa: string | null;
  created_at: string;
};

type Item = {
  oportunidade_id: string;
  sku_codigo: string;
  derivacao: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
};

function fmtMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export default async function DashboardPage() {
  const ctx = await ensureAcesso("/dashboard");
  const supabase = await createClient();

  const [
    { data: oppsData },
    { data: itensData },
    { data: skusData },
    { data: carteiraData },
    { data: wipData },
    { data: aliasesData },
    { data: pedidosData },
  ] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("id, cliente, nome, valor, fase, owner, regiao, data_fechamento"),
    supabase
      .from("oportunidade_itens")
      .select(
        "oportunidade_id, sku_codigo, derivacao, descricao, quantidade, preco_unitario"
      ),
    supabase
      .from("skus")
      .select("id, codigo, descricao, estoque, lead_time_dias, eh_servico"),
    supabase
      .from("carteira_pedidos")
      .select("sku_codigo, quantidade, status"),
    supabase
      .from("wip")
      .select("sku_codigo, qtd_prevista, data_prevista, status"),
    supabase
      .from("sku_aliases")
      .select("descricao_alias, sku_codigo, derivacao"),
    supabase
      .from("carteira_pedidos")
      .select(
        "numero_pedido, cliente, oportunidade_origem_id, quantidade, data_promessa, created_at"
      )
      .not("oportunidade_origem_id", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  const todasOpps = (oppsData || []) as Opp[];
  const itens = (itensData || []) as Item[];
  const skus = (skusData || []) as SKUFull[];
  const aliasMap = indexarAliases((aliasesData || []) as Alias[]);
  const pedidosFirmados = (pedidosData || []) as Pedido[];

  // Filtragem por owner: gestor vê só seu time, admin vê tudo
  const filtroOwners = await obterFiltroOwners(
    ctx.userId,
    ctx.nome,
    ctx.perfil
  );
  const opps =
    filtroOwners.tipo === "todos"
      ? todasOpps
      : (() => {
          const nomesPermitidos = new Set(
            filtroOwners.owners.map(normalizaOwner)
          );
          return todasOpps.filter((o: Opp) =>
            nomesPermitidos.has(normalizaOwner(o.owner))
          );
        })();

  const carteiraReservada: Record<string, number> = {};
  (carteiraData || []).forEach(
    (l: { sku_codigo: string; quantidade: number; status: string }) => {
      if (l.status === "liberado") return;
      carteiraReservada[l.sku_codigo] =
        (carteiraReservada[l.sku_codigo] || 0) + (l.quantidade || 0);
    }
  );

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

  const oppsAbertas = opps.filter((o) => o.fase !== "Fechado");
  const oppsFechadas = opps.filter((o) => o.fase === "Fechado");
  const pipelineTotal = oppsAbertas.reduce((s, o) => s + (o.valor || 0), 0);
  const valorFechado = oppsFechadas.reduce((s, o) => s + (o.valor || 0), 0);
  const valorTotalGeral = pipelineTotal + valorFechado;
  const valorPorFase: Record<string, number> = {};
  opps.forEach((o) => {
    valorPorFase[o.fase] = (valorPorFase[o.fase] || 0) + (o.valor || 0);
  });
  const commit = valorPorFase["Commit"] || 0;
  const melhor = valorPorFase["Melhor Cenário"] || 0;
  const poc = valorPorFase["POC (demonstração)"] || 0;

  type ResumoFechada = {
    opp: Opp;
    numero_pedido: string;
    qtd_itens: number;
    qtd_unidades: number;
    data_promessa: string | null;
    data_firmada: string;
  };
  const pedidosPorOpp: Record<string, Pedido[]> = {};
  pedidosFirmados.forEach((p) => {
    if (!p.oportunidade_origem_id) return;
    if (!pedidosPorOpp[p.oportunidade_origem_id])
      pedidosPorOpp[p.oportunidade_origem_id] = [];
    pedidosPorOpp[p.oportunidade_origem_id].push(p);
  });
  const fechadasDetalhe: ResumoFechada[] = oppsFechadas
    .map((o) => {
      const pedidos = pedidosPorOpp[o.id] || [];
      if (pedidos.length === 0) return null;
      const qtd_unidades = pedidos.reduce(
        (s, p) => s + (Number(p.quantidade) || 0),
        0
      );
      const data_firmada = pedidos
        .map((p) => p.created_at)
        .sort()
        .reverse()[0];
      return {
        opp: o,
        numero_pedido: pedidos[0].numero_pedido,
        qtd_itens: pedidos.length,
        qtd_unidades,
        data_promessa: pedidos[0].data_promessa,
        data_firmada,
      } as ResumoFechada;
    })
    .filter((x): x is ResumoFechada => x !== null)
    .sort((a, b) => b.data_firmada.localeCompare(a.data_firmada));

  // Calcula "Prazo de entrega acordado" = data_promessa (liberação)
  //   + FATURAMENTO_EXPEDICAO_DIAS dias úteis
  //   + transporte do UF (dias corridos)
  // Se UF não estiver mapeado, retorna null (mostra "—").
  const fechadasParaTabela: LinhaFechada[] = fechadasDetalhe.map((f) => {
    let prazoEntregaIso: string | null = null;
    if (f.data_promessa) {
      const transporte = diasTransporteDoUF(f.opp.regiao);
      const baseLiberacao = new Date(f.data_promessa);
      const aposFaturamento = somarDiasUteis(
        baseLiberacao,
        FATURAMENTO_EXPEDICAO_DIAS
      );
      const dataFinal =
        transporte != null
          ? somarDiasCorridos(aposFaturamento, transporte)
          : aposFaturamento;
      prazoEntregaIso = dataFinal.toISOString().slice(0, 10);
    }
    return {
      opp_id: f.opp.id,
      numero_pedido: f.numero_pedido,
      cliente: f.opp.cliente,
      nome_oportunidade: f.opp.nome,
      valor: f.opp.valor || 0,
      qtd_itens: f.qtd_itens,
      qtd_unidades: f.qtd_unidades,
      prazo_entrega_data: prazoEntregaIso,
      owner: f.opp.owner || "",
    };
  });

  const valorPorRegiao: Record<string, number> = {};
  oppsAbertas.forEach((o) => {
    const r = o.regiao || "—";
    valorPorRegiao[r] = (valorPorRegiao[r] || 0) + (o.valor || 0);
  });

  const valorPorOwner: Record<string, number> = {};
  oppsAbertas.forEach((o) => {
    const r = o.owner || "—";
    valorPorOwner[r] = (valorPorOwner[r] || 0) + (o.valor || 0);
  });

  const itensPorOpp: Record<string, Item[]> = {};
  itens.forEach((it) => {
    if (!itensPorOpp[it.oportunidade_id]) itensPorOpp[it.oportunidade_id] = [];
    itensPorOpp[it.oportunidade_id].push(it);
  });

  const skusEmProducaoZero: Record<
    string,
    { codigo: string; descricao: string; qtd: number }
  > = {};
  let oppsSobConsulta = 0;
  opps.forEach((o) => {
    const list = itensPorOpp[o.id] || [];
    if (list.length === 0) return;
    const res = calcularOportunidade(
      list.map((it) => ({
        sku_codigo: it.sku_codigo,
        descricao: it.descricao,
        derivacao: it.derivacao,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
      })),
      skus,
      carteiraReservada,
      wipPorSku,
      aliasMap
    );
    if (res.prazo_dias == null && o.fase === "Commit") oppsSobConsulta++;
    res.itens.forEach((r) => {
      if (r.status === "ok" && r.fonte === "producao_zero" && r.consumo_producao_zero > 0) {
        const cod = r.sku_codigo_matched || r.sku_codigo_input;
        if (!skusEmProducaoZero[cod]) {
          skusEmProducaoZero[cod] = {
            codigo: cod,
            descricao: r.descricao,
            qtd: 0,
          };
        }
        skusEmProducaoZero[cod].qtd += r.consumo_producao_zero;
      }
    });
  });
  const topGargalos = Object.values(skusEmProducaoZero)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 8);

  const skusSemLeadTime = skus.filter(
    (s) => !s.eh_servico && s.lead_time_dias == null
  ).length;
  const wipAguardandoData = (wipData || []).filter(
    (w: { data_prevista: string | null }) => !w.data_prevista
  ).length;
  const wipAtrasado = (wipData || []).filter(
    (w: { data_prevista: string | null }) => {
      if (!w.data_prevista) return false;
      return new Date(w.data_prevista) < hoje;
    }
  ).length;
  const orfaos = itens.filter((it) => {
    if (skus.find((s) => s.codigo === it.sku_codigo)) return false;
    if (aliasMap.size === 0) return true;
    const desc = String(it.descricao || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return !aliasMap.has(desc);
  }).length;

  return (
    <>
      <AppHeader
        nome={ctx.nome}
        perfil={ctx.perfil}
        rotaAtiva="/dashboard"
      />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
              Visão consolidada
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
              Dashboard
            </h1>
            <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
              Pipeline, gargalos e capacidade — em tempo real, calculado direto
              do banco.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard
              titulo="Pipeline aberto"
              valor={fmtMoney(pipelineTotal)}
              sub={`${oppsAbertas.length} em aberto`}
              cor="#1F2C4E"
            />
            <KpiCard
              titulo="Em Commit"
              valor={fmtMoney(commit)}
              sub={
                pipelineTotal > 0
                  ? `${Math.round((commit / pipelineTotal) * 100)}% do aberto`
                  : ""
              }
              cor="#326A84"
            />
            <KpiCard
              titulo="Melhor cenário"
              valor={fmtMoney(melhor)}
              sub={
                pipelineTotal > 0
                  ? `${Math.round((melhor / pipelineTotal) * 100)}% do aberto`
                  : ""
              }
              cor="#1E9DBA"
            />
            <KpiCard
              titulo="POC"
              valor={fmtMoney(poc)}
              sub={
                pipelineTotal > 0
                  ? `${Math.round((poc / pipelineTotal) * 100)}% do aberto`
                  : ""
              }
              cor="#64C3D1"
            />
            <KpiCard
              titulo="Firmadas"
              valor={fmtMoney(valorFechado)}
              sub={`${oppsFechadas.length} ${
                oppsFechadas.length === 1 ? "oportunidade" : "oportunidades"
              }`}
              cor="#27AE60"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DistGrafico
              titulo="Pipeline por fase"
              dados={Object.entries(valorPorFase)
                .sort((a, b) => b[1] - a[1])
                .map(([label, valor]) => ({ label, valor }))}
              total={valorTotalGeral}
              cor="#326A84"
            />
            <DistGrafico
              titulo="Pipeline aberto por região"
              dados={Object.entries(valorPorRegiao)
                .sort((a, b) => b[1] - a[1])
                .map(([label, valor]) => ({ label, valor }))}
              total={pipelineTotal}
              cor="#1E9DBA"
            />
          </div>

          <DistGrafico
            titulo="Pipeline aberto por owner"
            dados={Object.entries(valorPorOwner)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([label, valor]) => ({ label, valor }))}
            total={pipelineTotal}
            cor="#64C3D1"
          />

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
                Top gargalos
              </h2>
              <p className="text-xs text-[#706F6F] mt-0.5">
                SKUs que precisariam ser produzidos do zero para atender as
                oportunidades em aberto — candidatos a antecipar produção.
              </p>
            </div>
            {topGargalos.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#706F6F]">
                Nenhum gargalo identificado no pipeline atual.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
                  <tr>
                    <th className="text-left py-2 px-4 font-semibold">SKU</th>
                    <th className="text-left py-2 px-4 font-semibold">
                      Descrição
                    </th>
                    <th className="text-right py-2 px-4 font-semibold">
                      Unidades a produzir
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topGargalos.map((g) => (
                    <tr key={g.codigo} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-mono text-xs text-[#1F2C4E]">
                        {g.codigo}
                      </td>
                      <td className="py-2 px-4 text-sm">{g.descricao}</td>
                      <td className="py-2 px-4 text-right text-lg font-black text-rose-700">
                        {g.qtd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
                  Oportunidades fechadas
                </h2>
                <p className="text-xs text-[#706F6F] mt-0.5">
                  Negociações firmadas com o cliente — pedido já está na
                  Carteira e o estoque foi abatido.
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-2xl font-black text-emerald-600">
                  {fmtMoney(valorFechado)}
                </div>
                <div className="text-xs text-[#706F6F] uppercase tracking-wider">
                  {oppsFechadas.length}{" "}
                  {oppsFechadas.length === 1
                    ? "oportunidade"
                    : "oportunidades"}
                </div>
              </div>
            </div>
            {fechadasDetalhe.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#706F6F]">
                Nenhuma oportunidade firmada ainda. Quando uma negociação
                fechar, use o botão <b>Firmar com cliente</b> dentro da
                oportunidade.
              </div>
            ) : (
              <TabelaFechadas linhas={fechadasParaTabela} />
            )}
            {fechadasDetalhe.length > 20 && (
              <div className="px-5 py-2 text-xs text-[#706F6F] border-t border-slate-100 bg-slate-50">
                Mostrando 20 de {fechadasDetalhe.length} fechadas. Para ver
                todas, abra a tela de <b>Carteira</b>.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Alerta
              titulo="SKUs sem lead time"
              valor={skusSemLeadTime}
              cor="#FFA300"
              dica="PCP precisa preencher"
              href="/estoque?filtro=sem_lead_time"
            />
            <Alerta
              titulo="OPs aguardando data"
              valor={wipAguardandoData}
              cor="#FFA300"
              dica="PCP precisa preencher"
              href="/wip?filtro=aguardando"
            />
            <Alerta
              titulo="OPs atrasadas"
              valor={wipAtrasado}
              cor="#E24B4A"
              dica="Repactuar com produção"
              href="/wip?filtro=atrasada"
            />
            <Alerta
              titulo="Itens órfãos"
              valor={orfaos}
              cor="#E24B4A"
              dica="Sem alias / cadastro"
              href="/admin/orfaos"
            />
          </div>

          {oppsSobConsulta > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-900">
              <b>{oppsSobConsulta}</b>{" "}
              {oppsSobConsulta === 1 ? "oportunidade" : "oportunidades"} em{" "}
              <b>Commit</b> com prazo <b>sob consulta</b> — algum SKU precisa
              de produção do zero mas não tem lead time definido. O PCP precisa
              preencher o lead time desses SKUs para que o prazo seja calculado.
            </div>
          )}
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

function KpiCard({
  titulo,
  valor,
  sub,
  cor,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  cor: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold">
        {titulo}
      </div>
      <div className="text-2xl md:text-3xl font-black mt-1" style={{ color: cor }}>
        {valor}
      </div>
      {sub && <div className="text-xs text-[#706F6F] mt-1">{sub}</div>}
    </div>
  );
}

function DistGrafico({
  titulo,
  dados,
  total,
  cor,
}: {
  titulo: string;
  dados: { label: string; valor: number }[];
  total: number;
  cor: string;
}) {
  const max = dados.length ? Math.max(...dados.map((d) => d.valor)) : 0;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E] mb-4">
        {titulo}
      </h2>
      {dados.length === 0 ? (
        <p className="text-sm text-[#706F6F]">Sem dados.</p>
      ) : (
        <div className="space-y-2.5">
          {dados.map((d) => {
            const pct = total > 0 ? (d.valor / total) * 100 : 0;
            const barPct = max > 0 ? (d.valor / max) * 100 : 0;
            return (
              <div key={d.label}>
                <div className="flex justify-between items-baseline text-sm mb-1">
                  <span className="text-[#1F2C4E]">{d.label}</span>
                  <span className="text-xs text-[#706F6F]">
                    <b className="text-[#1F2C4E]">{fmtMoney(d.valor)}</b>
                    {total > 0 ? (
                      <span className="ml-2 text-[#706F6F]">
                        {Math.round(pct)}%
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${barPct}%`,
                      background: cor,
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Alerta({
  titulo,
  valor,
  cor,
  dica,
  href,
}: {
  titulo: string;
  valor: number;
  cor: string;
  dica: string;
  href?: string;
}) {
  const isZero = valor === 0;
  const interno = (
    <>
      <div
        className="text-xs uppercase tracking-wider font-semibold"
        style={{ color: isZero ? "#706F6F" : cor }}
      >
        {titulo}
      </div>
      <div
        className="text-3xl font-black mt-1"
        style={{ color: isZero ? "#706F6F" : cor }}
      >
        {valor}
      </div>
      <div className="text-xs text-[#706F6F] mt-1 flex items-center gap-1">
        {isZero ? "ok" : dica}
        {href && !isZero && (
          <span
            className="ml-auto text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: cor }}
          >
            abrir →
          </span>
        )}
      </div>
    </>
  );

  const estilo = isZero
    ? { background: "#F2F2F2", borderColor: "#D5D5D5" }
    : { background: `${cor}15`, borderColor: `${cor}40` };

  if (href && !isZero) {
    return (
      <Link
        href={href}
        className="rounded-xl border p-4 block transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
        style={estilo}
        title="Clique para abrir a lista filtrada"
      >
        {interno}
      </Link>
    );
  }
  return (
    <div className="rounded-xl border p-4" style={estilo}>
      {interno}
    </div>
  );
}
