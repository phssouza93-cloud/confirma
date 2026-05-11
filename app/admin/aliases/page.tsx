import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/app/components/AppHeader";
import { ensureAdmin } from "../guard";
import { AliasesClient, type AliasRow, type SKUOption } from "./AliasesClient";

export const dynamic = "force-dynamic";

export default async function AdminAliasesPage() {
  const ctx = await ensureAdmin();
  const supabase = await createClient();

  const [{ data: aliasesData }, { data: skusData }] = await Promise.all([
    supabase
      .from("sku_aliases")
      .select("id, descricao_alias, sku_codigo, derivacao, updated_at")
      .order("descricao_alias"),
    supabase
      .from("skus")
      .select("codigo, descricao, eh_servico")
      .order("codigo"),
  ]);

  const aliases = (aliasesData || []) as AliasRow[];
  const skus = (skusData || []) as SKUOption[];

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
              Aliases descrição → SKU
            </h1>
            <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
              Mapas manuais usados quando uma oportunidade traz uma descrição
              que não bate com o cadastro mestre. O motor de prazo prioriza
              alias sobre código e sobre fuzzy match.
            </p>
          </div>

          <AliasesClient aliases={aliases} skus={skus} />
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
