import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { temAcesso } from "@/lib/permissoes";

export type SessionContext = {
  userId: string;
  nome: string;
  perfil: string;
  email: string;
  ativo: boolean;
  precisa_trocar_senha: boolean;
};

/**
 * Versão "raw" sem redirect por troca de senha — pra ser usada pela
 * própria página /trocar-senha (que precisa saber quem é o usuário,
 * mas não pode redirecionar pra si mesma).
 */
export async function ensureSessionSemRedirectSenha(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nome, perfil, ativo, precisa_trocar_senha")
    .eq("id", user.id)
    .single();

  if (!perfil) {
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
    precisa_trocar_senha: perfil.precisa_trocar_senha === true,
  };
}

/**
 * Garante que há usuário logado e ele tem perfil ATIVO.
 * Se o usuário tem flag precisa_trocar_senha=true, força redirect pra
 * /trocar-senha.
 */
export async function ensureSession(): Promise<SessionContext> {
  const ctx = await ensureSessionSemRedirectSenha();
  if (ctx.precisa_trocar_senha) redirect("/trocar-senha");
  return ctx;
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
