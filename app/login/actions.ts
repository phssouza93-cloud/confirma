"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Login com email/senha + controle de limite de 2 dispositivos por usuário.
 * Retorna { ok, error } pro client tratar — não usa mais redirect direto.
 */
export async function loginAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const device_id = String(formData.get("device_id") || "").slice(0, 100);
  const user_agent = String(formData.get("user_agent") || "").slice(0, 200);

  if (!email || !senha) {
    return { ok: false, error: "Preencha email e senha" };
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return { ok: false, error: error.message || "Email ou senha inválidos" };
  }

  // Limite de 2 dispositivos: usa client admin pra não esbarrar em RLS
  if (device_id && authData.user) {
    const admin = getAdmin();
    const userId = authData.user.id;

    // Limpa sessões inativas (> 7 dias) antes de checar
    const seteDiasAtras = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    await admin
      .from("sessoes_ativas")
      .delete()
      .eq("user_id", userId)
      .lt("ultimo_acesso", seteDiasAtras);

    // Vê se o device atual já está registrado
    const { data: existente } = await admin
      .from("sessoes_ativas")
      .select("id")
      .eq("user_id", userId)
      .eq("device_id", device_id)
      .maybeSingle();

    if (existente) {
      await admin
        .from("sessoes_ativas")
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq("id", existente.id);
    } else {
      const { count } = await admin
        .from("sessoes_ativas")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count || 0) >= 2) {
        await supabase.auth.signOut();
        return {
          ok: false,
          error:
            "Você já está logado em 2 dispositivos. Saia de um deles antes de entrar em um terceiro.",
        };
      }
      await admin.from("sessoes_ativas").insert({
        user_id: userId,
        device_id,
        user_agent,
      });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
