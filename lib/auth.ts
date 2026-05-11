import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { temAcesso } from "@/lib/permissoes";

export type SessionContext = {
  userId: string;
  nome: string;
  perfil: string;
  email: string;
  ativo: boolean;
};

/**
 * Garante que há usuário logado e ele tem perfil ATIVO.
 * Retorna {nome, perfil, etc} pra usar no header e dentro da página.
 */
export async function ensureSession(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nome, perfil, ativo")
    .eq("id", user.id)
    .single();

  if (!perfil) {
    // Usuário no Auth mas sem linha em usuarios → desloga
    await supabase.auth.signOut();
    redirect("/login?erro=Usu%C3%A1rio+sem+permiss%C3%A3o");
  }
  if (perfil.ativo === false) {
    await supabase.auth.signOut();
    redirect("/login?erro=Usu%C3%A1rio+desativado");
  }

  return {
    userId: user.id,
    nome: perfil.nome || user.email?.split("@")[0] || "Usuário",
    perfil: perfil.perfil || "consultor",
    email: user.email || "",
    ativo: perfil.ativo !== false,
  };
}

/**
 * Garante que o usuário tem acesso a uma rota específica.
 * Se não tiver, redireciona para "/".
 */
export async function ensureAcesso(rota: string): Promise<SessionContext> {
  const ctx = await ensureSession();
  if (!temAcesso(ctx.perfil, rota)) redirect("/");
  return ctx;
}

/**
 * Atalho: só admin.
 */
export async function ensureAdmin(): Promise<SessionContext> {
  const ctx = await ensureSession();
  if (ctx.perfil !== "admin") redirect("/");
  return ctx;
}
