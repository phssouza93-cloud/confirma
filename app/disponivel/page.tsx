import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { AppHeader } from "../components/AppHeader";
import { formatarDerivacao } from "@/lib/derivacao";
import { DisponivelClient, type LinhaDisp } from "./DisponivelClient";

export const dynamic = "force-dynamic";

type SKU = {
  id: string;
  codigo: string;
  descricao: string;
  familia: string | null;
  estoque: number | null;
  lead_time_dias: number | null;
  eh_servico: boolean | null;
};

type Derivacao = {
  sku_id: string;
  derivacao: string | null;
  qtd_disponivel: number | null;
};

type CarteiraLinha = {
  sku_codigo: string;
  derivacao: string | null;
  quantidade: number | null;
  status: string;
};

type WipLinha = {
  sku_codigo: string;
  qtd_prevista: number | null;
  data_prevista: string | null;
};

export default async function DisponivelPage() {
  const ctx = await ensureAcesso("/disponivel");
  const supabase = await createClient();
  const perfil = { nome: ctx.nome, perfil: ctx.perfil };

  const [
    { data: skusData },
    { data: derivData },
    { data: carteiraData },
    { data: wipData },
  ] = await Promise.all([
    supabase
      .from("skus")
      .select(
        "id, codigo, descricao, familia, estoque, lead_time_dias, eh_servico"
      ),
    supabase
      .from("estoque_derivacoes")
      .select("sku_id, derivacao, qtd_disponivel"),
    supabase
      .from("carteira_pedidos")
      .select("sku_codigo, derivacao, quantidade, status"),
    supabase
      .from("wip")
      .select("sku_codigo, qtd_prevista, data_prevista"),
  ]);

  const skus = (skusData || []) as SKU[];
  const derivs = (derivData || []) as Derivacao[];
  const carteira = (carteiraData || []) as CarteiraLinha[];
  const wip = (wipData || []) as WipLinha[];

  // -- 1) Carteira reservada por (sku_codigo + derivação normalizada)
  // status === 'liberado' significa já entregue ao cliente, não conta
  const carteiraPorChave: Record<string, number> = {};
  carteira.forEach((l) => {
    if (l.status === "liberado") return;
    const der = formatarDerivacao(l.derivacao) || "";
    const chave = `${l.sku_codigo}::${der}`;
    carteiraPorChave[chave] =
      (carteiraPorChave[chave] || 0) + (Number(l.quantidade) || 0);
  });

  // -- 2) Derivações disponíveis por SKU id (estoque físico)
  const derivPorSkuId: Record<string, Derivacao[]> = {};
  derivs.forEach((d) => {
    if (!derivPorSkuId[d.sku_id]) derivPorSkuId[d.sku_id] = [];
    derivPorSkuId[d.sku_id].push(d);
  });

  // -- 3) WIP futuro agregado por sku_codigo
  type WipResumo = { proxima_data: string; qtd_proxima: number; total: number };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const wipPorSku: Record<string, WipResumo> = {};
  wip.forEach((w) => {
    if (!w.data_prevista) return;
    const dt = new Date(w.data_prevista);
    if (dt < hoje) return; // atrasada, não conta como "vai chegar"
    const cod = w.sku_codigo;
    const qtd = Number(w.qtd_prevista) || 0;
    if (!wipPorSku[cod]) {
      wipPorSku[cod] = {
        proxima_data: w.data_prevista,
        qtd_proxima: qtd,
        total: qtd,
      };
    } else {
      wipPorSku[cod].total += qtd;
      if (w.data_prevista < wipPorSku[cod].proxima_data) {
        wipPorSku[cod].proxima_data = w.data_prevista;
        wipPorSku[cod].qtd_proxima = qtd;
      }
    }
  });

  // -- 4) Monta linhas por SKU + derivação
  const linhas: LinhaDisp[] = [];
  skus.forEach((s) => {
    const listDeriv = derivPorSkuId[s.id] || [];
    const wipResumo = wipPorSku[s.codigo];

    if (listDeriv.length === 0) {
      // SKU sem mix → uma única linha agregada
      const estoqueTotal = Number(s.estoque) || 0;
      const carteiraChave = carteiraPorChave[`${s.codigo}::`] || 0;
      // mas tem outras carteiras (com derivação) também? somar tudo
      let carteiraTotal = carteiraChave;
      Object.entries(carteiraPorChave).forEach(([k, v]) => {
        if (k.startsWith(`${s.codigo}::`) && k !== `${s.codigo}::`) {
          carteiraTotal += v;
        }
      });
      linhas.push({
        sku_id: s.id,
        codigo: s.codigo,
        descricao: s.descricao,
        familia: s.familia || "—",
        derivacao: null,
        derivacao_label: "—",
        estoque: estoqueTotal,
        carteira: carteiraTotal,
        disponivel: estoqueTotal - carteiraTotal,
        wip_proxima_qtd: wipResumo?.qtd_proxima ?? null,
        wip_proxima_data: wipResumo?.proxima_data ?? null,
        wip_total: wipResumo?.total ?? 0,
        lead_time: s.lead_time_dias,
        eh_servico: !!s.eh_servico,
      });
    } else {
      listDeriv
        .slice()
        .sort((a, b) =>
          (a.derivacao || "").localeCompare(b.derivacao || "")
        )
        .forEach((d) => {
          const derNormalizada = formatarDerivacao(d.derivacao) || "";
          const carteiraTot =
            carteiraPorChave[`${s.codigo}::${derNormalizada}`] || 0;
          const estoque = Number(d.qtd_disponivel) || 0;
          linhas.push({
            sku_id: s.id,
            codigo: s.codigo,
            descricao: s.descricao,
            familia: s.familia || "—",
            derivacao: d.derivacao,
            derivacao_label: derNormalizada || "—",
            estoque,
            carteira: carteiraTot,
            disponivel: estoque - carteiraTot,
            // WIP é por SKU código (não temos quebra fiel por derivação no WIP)
            wip_proxima_qtd: wipResumo?.qtd_proxima ?? null,
            wip_proxima_data: wipResumo?.proxima_data ?? null,
            wip_total: wipResumo?.total ?? 0,
            lead_time: s.lead_time_dias,
            eh_servico: !!s.eh_servico,
          });
        });
    }
  });

  // KPIs do topo
  const totalLinhas = linhas.length;
  const linhasComDisp = linhas.filter(
    (l) => !l.eh_servico && l.disponivel > 0
  ).length;
  const linhasZeradas = linhas.filter(
    (l) => !l.eh_servico && l.disponivel <= 0
  ).length;
  const linhasComWip = linhas.filter(
    (l) => !l.eh_servico && (l.wip_total || 0) > 0
  ).length;

  return (
    <>
      <AppHeader
        nome={ctx.nome}
        perfil={ctx.perfil}
        rotaAtiva="/disponivel"
      />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
              Visão do PCP
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
              Estoque Disponível
            </h1>
            <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
              <b>Estoque − Carteira = Disponível</b>. O que o consultor pode
              prometer agora sem precisar produzir.
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              titulo="Linhas no mix"
              valor={totalLinhas}
              sub="SKU · derivação"
              cor="#1F2C4E"
            />
            <Kpi
              titulo="Com disponível"
              valor={linhasComDisp}
              sub="prontos pra prometer"
              cor="#27AE60"
            />
            <Kpi
              titulo="Sem saldo"
              valor={linhasZeradas}
              sub="zerado ou vendido"
              cor="#E24B4A"
            />
            <Kpi
              titulo="Com WIP previsto"
              valor={linhasComWip}
              sub="reposição agendada"
              cor="#326A84"
            />
          </div>

          <DisponivelClient linhas={linhas} />
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

function Kpi({
  titulo,
  valor,
  sub,
  cor,
}: {
  titulo: string;
  valor: number;
  sub: string;
  cor: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold">
        {titulo}
      </div>
      <div
        className="text-2xl md:text-3xl font-black mt-1"
        style={{ color: cor }}
      >
        {valor}
      </div>
      <div className="text-xs text-[#706F6F] mt-1">{sub}</div>
    </div>
  );
}
