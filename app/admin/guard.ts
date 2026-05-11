import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminContext = {
  userId: string;
  nome: string;
  perfil: string;
  email: string;
};

/**
 * Garante que o usuário logado tem perfil "admin". Caso contrário,
 * redireciona pra home. Retorna info do usuário pra usar no AppHeader.
 */
export async function ensureAdmin(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nome, perfil")
    .eq("id", user.id)
    .single();

  const tipo = perfil?.perfil || "consultor";
  if (tipo !== "admin") redirect("/");

  return {
    userId: user.id,
    nome: perfil?.nome || user.email?.split("@")[0] || "Usuário",
    perfil: tipo,
    email: user.email || "",
  };
}
