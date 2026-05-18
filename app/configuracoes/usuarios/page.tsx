import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/app/components/AppHeader";
import { ensureAdmin } from "@/lib/auth";
import { UsuariosClient, type UsuarioRow, type ConviteRow } from "./UsuariosClient";

export const dynamic = "force-dynamic";

export default async function ConfigUsuariosPage() {
  const ctx = await ensureAdmin();
  const supabase = await createClient();

  const [
    { data: usuariosData },
    { data: convitesData },
    { data: sessoesData },
  ] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, email, nome, perfil, ativo, lider_id, created_at")
      .order("nome"),
    supabase
      .from("convites")
      .select(
        "id, email, nome, perfil, token, criado_em, expira_em, usado_em"
      )
      .is("usado_em", null)
      .order("criado_em", { ascending: false }),
    supabase.from("sessoes_ativas").select("user_id, ultimo_acesso"),
  ]);

  const usuarios = (usuariosData || []) as UsuarioRow[];
  const convites = (convitesData || []) as ConviteRow[];

  // Conta sessões + pega a última atividade (mais recente) por usuário.
  // O cálculo de "online" (janela de 3 min) é feito no cliente — assim
  // não precisa Date.now() no server component (regra react-hooks/purity).
  const sessoesPorUsuario: Record<string, number> = {};
  const ultimaAtividadePorUsuario: Record<string, string | null> = {};
  (sessoesData || []).forEach(
    (s: { user_id: string; ultimo_acesso: string | null }) => {
      sessoesPorUsuario[s.user_id] = (sessoesPorUsuario[s.user_id] || 0) + 1;
      const atual = ultimaAtividadePorUsuario[s.user_id];
      if (!atual || (s.ultimo_acesso && s.ultimo_acesso > atual)) {
        ultimaAtividadePorUsuario[s.user_id] = s.ultimo_acesso;
      }
    }
  );

  return (
    <>
      <AppHeader
        nome={ctx.nome}
        perfil={ctx.perfil}
        rotaAtiva="/configuracoes/usuarios"
      />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <Link
              href="/"
              className="text-xs text-[#706F6F] hover:text-[#1F2C4E] inline-flex items-center gap-1 mb-3"
            >
              ← Voltar para Início
            </Link>
            <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
              Configurações · Acesso restrito · admin
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
              Usuários
            </h1>
            <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
              Convide pessoas para acessar o Confirma. Cada convite gera um
              link único que você pode mandar pela ferramenta da sua escolha
              (WhatsApp, email, Slack). Acessos são por perfil.
            </p>
          </div>

          <UsuariosClient
            usuarios={usuarios}
            convites={convites}
            currentUserId={ctx.userId}
            sessoesPorUsuario={sessoesPorUsuario}
            ultimaAtividadePorUsuario={ultimaAtividadePorUsuario}
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
