import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/app/components/AppHeader";
import { ensureAdmin } from "../guard";
import { OrfaosClient, type OrfaoRow, type SKUOption } from "./OrfaosClient";

export const dynamic = "force-dynamic";

type ItemOpp = {
  oportunidade_id: string;
  sku_codigo: string;
  descricao: string;
  quantidade: number;
};

type Opp = {
  id: string;
  cliente: string;
  nome: string;
};

function normalizar(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function AdminOrfaosPage() {
  const ctx = await ensureAdmin();
  const supabase = await createClient();

  const [
    { data: skusData },
    { data: aliasesData },
    { data: itensData },
    { data: oppsData },
  ] = await Promise.all([
    supabase.from("skus").select("codigo, descricao, eh_servico").order("codigo"),
    supabase.from("sku_aliases").select("descricao_alias"),
    supabase
      .from("oportunidade_itens")
      .select("oportunidade_id, sku_codigo, descricao, quantidade"),
    supabase.from("oportunidades").select("id, cliente, nome"),
  ]);

  const skus = (skusData || []) as SKUOption[];
  const aliasDescs = new Set(
    ((aliasesData || []) as { descricao_alias: string }[]).map((a) =>
      normalizar(a.descricao_alias)
    )
  );
  const codigosCadastrados = new Set(skus.map((s) => s.codigo));
  const opps = ((oppsData || []) as Opp[]).reduce(
    (acc: Record<string, Opp>, o) => {
      acc[o.id] = o;
      return acc;
    },
    {}
  );

  // Agrupa por descrição normalizada
  type Grupo = {
    descricao: string;
    sku_codigo_original: string;
    qtd_total: number;
    ocorrencias: number;
    oportunidades: string[]; // nomes
  };
  const grupos: Record<string, Grupo> = {};
  (itensData || []).forEach((it: ItemOpp) => {
    if (codigosCadastrados.has(it.sku_codigo)) return;
    const dn = normalizar(it.descricao);
    if (aliasDescs.has(dn)) return;
    const opp = opps[it.oportunidade_id];
    const label = opp ? `${opp.cliente} · ${opp.nome}` : "—";
    if (!grupos[dn]) {
      grupos[dn] = {
        descricao: it.descricao,
        sku_codigo_original: it.sku_codigo,
        qtd_total: 0,
        ocorrencias: 0,
        oportunidades: [],
      };
    }
    grupos[dn].qtd_total += Number(it.quantidade) || 0;
    grupos[dn].ocorrencias += 1;
    if (label !== "—" && !grupos[dn].oportunidades.includes(label)) {
      grupos[dn].oportunidades.push(label);
    }
  });

  const orfaos: OrfaoRow[] = Object.values(grupos)
    .sort((a, b) => b.ocorrencias - a.ocorrencias)
    .map((g) => ({
      descricao: g.descricao,
      sku_codigo_original: g.sku_codigo_original,
      qtd_total: g.qtd_total,
      ocorrencias: g.ocorrencias,
      oportunidades: g.oportunidades,
    }));

  return (
    <>
      <AppHeader nome={ctx.nome} perfil={ctx.perfil} rotaAtiva="/admin" />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <Link
              href="/admin"
              className="text-xs text-[#706F6F] hover:text-[#1F2C4E] inline-flex items-center gap-1 mb-3"
            >
              ← Voltar para Admin
            </Link>
            <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
              Admin
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
              Itens órfãos
            </h1>
            <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
              Descrições que aparecem em oportunidades mas não casam nem com o
              cadastro mestre nem com um alias existente. Para cada uma, crie
              um alias apontando pro SKU correto e ela some daqui.
            </p>
          </div>

          <OrfaosClient orfaos={orfaos} skus={skus} />
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
