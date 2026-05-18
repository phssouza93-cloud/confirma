import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { AppHeader } from "../components/AppHeader";
import { ImportarEstoque } from "./ImportarEstoque";
import { ImportarCadastroMestre } from "./ImportarCadastroMestre";
import { EstoqueClient, type LinhaEstoque } from "./EstoqueClient";
import { BotaoLimparTudo } from "../admin/BotaoLimparTudo";
import { limparEstoque } from "../admin/limpar-actions";

export const dynamic = "force-dynamic";

type SKU = {
  id: string;
  codigo: string;
  descricao: string;
  familia: string | null;
  estoque: number;
  lead_time_dias: number | null;
  eh_servico: boolean | null;
};

type Derivacao = {
  sku_id: string;
  derivacao: string | null;
  qtd_disponivel: number;
};

export default async function EstoquePage() {
  const ctx = await ensureAcesso("/estoque");
  const supabase = await createClient();

  const { data: skus } = await supabase
    .from("skus")
    .select("*")
    .order("codigo");

  const { data: derivacoes } = await supabase
    .from("estoque_derivacoes")
    .select("sku_id, derivacao, qtd_disponivel");

  const lista = (skus || []) as SKU[];
  const derivPorSku: Record<string, Derivacao[]> = {};
  (derivacoes || []).forEach((d: Derivacao) => {
    if (!derivPorSku[d.sku_id]) derivPorSku[d.sku_id] = [];
    derivPorSku[d.sku_id].push(d);
  });

  const linhas: LinhaEstoque[] = lista.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    descricao: s.descricao,
    familia: s.familia,
    estoque: s.estoque || 0,
    lead_time_dias: s.lead_time_dias,
    eh_servico: !!s.eh_servico,
    derivacoes: (derivPorSku[s.id] || []).map((d) => ({
      derivacao: d.derivacao,
      qtd_disponivel: d.qtd_disponivel,
    })),
  }));

  const totalUnidades = lista.reduce(
    (s: number, x: SKU) => s + (x.estoque || 0),
    0
  );
  const skusComEstoque = lista.filter((s: SKU) => (s.estoque || 0) > 0).length;
  const skusSemLeadTime = lista.filter(
    (s: SKU) => !s.eh_servico && s.lead_time_dias == null
  ).length;

  return (
    <>
      <AppHeader
        nome={ctx.nome}
        perfil={ctx.perfil}
        rotaAtiva="/estoque"
      />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
                Cadastro mestre + posição
              </p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
                Estoque
              </h1>
              <p className="text-sm text-[#706F6F] mt-1">
                Base de SKUs com posição por derivação · alimenta o cálculo de
                prazo das oportunidades
              </p>
            </div>
            <div className="flex gap-2">
              {ctx.perfil === "admin" && (
                <>
                  <ImportarCadastroMestre qtdAtual={lista.length} />
                  <ImportarEstoque qtdAtual={totalUnidades} />
                  {totalUnidades > 0 && (
                    <BotaoLimparTudo
                      label="estoque"
                      descricaoAcao="todas as posições de estoque (por derivação e agregado). O cadastro mestre de SKUs será preservado."
                      action={limparEstoque}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Indicadores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card titulo="SKUs cadastrados" valor={String(lista.length)} cor="#1F2C4E" />
            <Card
              titulo="Com estoque"
              valor={String(skusComEstoque)}
              cor="#326A84"
            />
            <Card
              titulo="Unidades totais"
              valor={totalUnidades.toLocaleString("pt-BR")}
              cor="#1E9DBA"
            />
            <Card
              titulo="Sem lead time"
              valor={String(skusSemLeadTime)}
              cor={skusSemLeadTime > 0 ? "#FFA300" : "#64C3D1"}
            />
          </div>

          {/* Tabela / Empty state */}
          {lista.length === 0 ? (
            <div className="bg-white border border-[#E6F9FC] rounded-2xl p-12 text-center">
              <div className="text-5xl text-slate-300 mb-3">📦</div>
              <h2 className="text-lg font-bold text-[#1F2C4E] mb-1 uppercase tracking-wide">
                Cadastro vazio
              </h2>
              <p className="text-sm text-[#706F6F] mb-5">
                Comece pelo <b>Cadastro mestre</b> (lista de SKUs) e depois
                importe a posição de estoque por derivação.
              </p>
              {ctx.perfil === "admin" && (
                <div className="flex gap-2 justify-center">
                  <ImportarCadastroMestre qtdAtual={0} />
                  <ImportarEstoque qtdAtual={0} />
                </div>
              )}
            </div>
          ) : (
            <EstoqueClient linhas={linhas} podeEditar={ctx.perfil === "admin"} />
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

function Card({
  titulo,
  valor,
  cor,
}: {
  titulo: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold">
        {titulo}
      </div>
      <div className="text-3xl font-black mt-1" style={{ color: cor }}>
        {valor}
      </div>
    </div>
  );
}
