import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { obterFiltroOwners, normalizaOwner } from "@/lib/owner-filter";
import { AppHeader } from "../components/AppHeader";
import { ImportarOportunidades } from "./ImportarOportunidades";
import { ImportarPdfOportunidade } from "./ImportarPdfOportunidade";
import { BotaoLimparTudo } from "../admin/BotaoLimparTudo";
import { limparOportunidades } from "../admin/limpar-actions";

export const dynamic = "force-dynamic";

type Opp = {
  id: string;
  cliente: string;
  nome: string;
  valor: number;
  fase: string;
  record_type: string;
  data_fechamento: string | null;
  owner: string;
  regiao: string;
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

export default async function OportunidadesPage() {
  const ctx = await ensureAcesso("/oportunidades");
  const supabase = await createClient();

  const filtroOwners = await obterFiltroOwners(ctx.userId, ctx.nome, ctx.perfil);

  const [{ data: opps }, { data: skusData }, { data: aliasesData }] = await Promise.all([
    supabase
      .from("oportunidades")
      .select("*")
      .order("valor", { ascending: false }),
    supabase.from("skus").select("id, codigo, descricao"),
    supabase.from("sku_aliases").select("descricao_alias, sku_codigo, derivacao"),
  ]);

  const todasOpps = (opps || []) as Opp[];
  const lista =
    filtroOwners.tipo === "todos"
      ? todasOpps
      : (() => {
          const nomesPermitidos = new Set(
            filtroOwners.owners.map(normalizaOwner)
          );
          return todasOpps.filter((o) =>
            nomesPermitidos.has(normalizaOwner(o.owner))
          );
        })();
  const total = lista.reduce((s: number, o: Opp) => s + (o.valor || 0), 0);
  const commit = lista
    .filter((o: Opp) => o.fase === "Commit")
    .reduce((s: number, o: Opp) => s + (o.valor || 0), 0);

  return (
    <>
      <AppHeader
        nome={ctx.nome}
        perfil={ctx.perfil}
        rotaAtiva="/oportunidades"
      />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
                Pipeline comercial
              </p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase leading-tight">
                Oportunidades negociadas na feira Hospitalar
              </h1>
              <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
                Clique numa oportunidade para abrir a tela de negociação com
                cálculo de prazo em tempo real.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/oportunidades/nova"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg"
              >
                + Nova oportunidade
              </Link>
              <ImportarPdfOportunidade skus={(skusData || []) as { id: string; codigo: string; descricao: string }[]} aliases={(aliasesData || []) as { descricao_alias: string; sku_codigo: string; derivacao: string | null }[]} />
              {ctx.perfil === "admin" && <ImportarOportunidades qtdAtual={lista.length} />}
              {ctx.perfil === "admin" && lista.length > 0 && (
                <BotaoLimparTudo
                  label="oportunidades"
                  descricaoAcao="todas as oportunidades, seus itens e os pedidos firmados"
                  action={limparOportunidades}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <Card titulo="Pipeline total" valor={fmtMoney(total)} cor="#1F2C4E" />
            <Card
              titulo="Em Commit"
              valor={fmtMoney(commit)}
              cor="#326A84"
              sub={total > 0 ? Math.round((commit / total) * 100) + "% do pipeline" : ""}
            />
            <Card
              titulo="Oportunidades"
              valor={String(lista.length)}
              cor="#1E9DBA"
            />
          </div>

          {lista.length === 0 ? (
            <div className="bg-white border border-[#E6F9FC] rounded-2xl p-12 text-center">
              <div className="text-5xl text-slate-300 mb-3">📊</div>
              <h2 className="text-lg font-bold text-[#1F2C4E] mb-1 uppercase tracking-wide">
                Nenhuma oportunidade
              </h2>
              <p className="text-sm text-[#706F6F] mb-5">
                {ctx.perfil === "admin"
                  ? "Importe a planilha do pipeline para começar."
                  : "Você ainda não tem oportunidades atribuídas. Quando uma for criada com seu nome como owner, ela aparecerá aqui."}
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Link
                  href="/oportunidades/nova"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg"
                >
                  + Nova oportunidade
                </Link>
                <ImportarPdfOportunidade skus={(skusData || []) as { id: string; codigo: string; descricao: string }[]} aliases={(aliasesData || []) as { descricao_alias: string; sku_codigo: string; derivacao: string | null }[]} />
                {ctx.perfil === "admin" && <ImportarOportunidades qtdAtual={0} />}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">
                      Oportunidade
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">Valor</th>
                    <th className="text-left py-3 px-4 font-semibold">Fase</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Fechamento
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">Owner</th>
                    <th className="text-left py-3 px-4 font-semibold">Região</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.map((o: Opp) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <Link
                          href={`/oportunidades/${o.id}`}
                          className="text-[#1F2C4E] hover:text-[#326A84] font-medium"
                        >
                          {o.nome}
                        </Link>
                        <div className="text-xs text-[#706F6F]">{o.cliente}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {fmtMoney(o.valor)}
                      </td>
                      <td className="py-3 px-4">{fasePill(o.fase)}</td>
                      <td className="py-3 px-4 text-xs">
                        {fmtData(o.data_fechamento)}
                      </td>
                      <td className="py-3 px-4 text-xs">{o.owner}</td>
                      <td className="py-3 px-4 text-xs">{o.regiao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

function Card({
  titulo,
  valor,
  cor,
  sub,
}: {
  titulo: string;
  valor: string;
  cor: string;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold">
        {titulo}
      </div>
      <div className="text-3xl font-black mt-1" style={{ color: cor }}>
        {valor}
      </div>
      {sub && <div className="text-xs text-[#706F6F] mt-1">{sub}</div>}
    </div>
  );
}
