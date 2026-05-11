"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");

  if (!email || !senha) {
    return redirect("/login?erro=" + encodeURIComponent("Preencha email e senha"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return redirect("/login?erro=" + encodeURIComponent(error.message));
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Cadastro público desabilitado.
 * Acesso ao Confirma só por convite criado pelo admin em /configuracoes/usuarios.
 */
export async function cadastroAction(_formData: FormData) {
  return redirect(
    "/login?erro=" +
      encodeURIComponent("Cadastro fechado. Peça um convite ao administrador.")
  );
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
