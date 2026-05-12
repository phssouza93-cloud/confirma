import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { AppHeader } from "@/app/components/AppHeader";
import { NovaOportunidadeForm, type OwnerOption, type SKUOption } from "./NovaOportunidadeForm";

export const dynamic = "force-dynamic";

type UsuarioRow = {
  id: string;
  nome: string;
  perfil: string;
  lider_id: string | null;
  ativo: boolean | null;
};

export default async function NovaOportunidadePage() {
  const ctx = await ensureAcesso("/oportunidades");
  const supabase = await createClient();

  const [{ data: usuariosData }, { data: skusData }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nome, perfil, lider_id, ativo")
      .eq("ativo", true),
    supabase
      .from("skus")
      .select("codigo, descricao, eh_servico")
      .order("codigo"),
  ]);

  const usuarios = (usuariosData || []) as UsuarioRow[];
  const skus = (skusData || []) as SKUOption[];

  // Calcula quais owners o user pode escolher:
  // - admin: todos os usuários ativos
  // - gestor: ele + consultores que ele lidera
  // - consultor: só ele
  let owners: OwnerOption[] = [];
  if (ctx.perfil === "admin") {
    owners = usuarios.map((u) => ({ nome: u.nome, perfil: u.perfil }));
  } else if (ctx.perfil === "gestor") {
    const meusLiderados = usuarios.filter((u) => u.lider_id === ctx.userId);
    owners = [
      { nome: ctx.nome, perfil: "gestor" },
      ...meusLiderados.map((u) => ({ nome: u.nome, perfil: u.perfil })),
    ];
  } else {
    owners = [{ nome: ctx.nome, perfil: ctx.perfil }];
  }
  // Dedup por nome
  const ownersUnique: OwnerOption[] = [];
  const vistos = new Set<string>();
  owners.forEach((o) => {
    if (!vistos.has(o.nome)) {
      ownersUnique.push(o);
      vistos.add(o.nome);
    }
  });

  return (
    <>
      <AppHeader nome={ctx.nome} perfil={ctx.perfil} rotaAtiva="/oportunidades" />
      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/oportunidades"
            className="text-xs text-[#706F6F] hover:text-[#1F2C4E] inline-flex items-center gap-1 mb-4"
          >
            ← Voltar para oportunidades
          </Link>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
              Pipeline comercial
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
              Nova oportunidade
            </h1>
            <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
              Preencha o cabeçalho e os itens. O motor de prazo vai calcular
              automaticamente assim que a oportunidade for salva.
            </p>
          </div>

          <NovaOportunidadeForm
            owners={ownersUnique}
            ownerPadrao={ctx.nome}
            skus={skus}
          />
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
