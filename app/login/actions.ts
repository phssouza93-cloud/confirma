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
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    return redirect("/login?erro=" + encodeURIComponent(error.message));
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function cadastroAction(formData: FormData) {
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const confirma = String(formData.get("confirma") || "");

  if (!nome || !email || !senha) {
    return redirect("/cadastro?erro=" + encodeURIComponent("Preencha todos os campos"));
  }
  if (senha !== confirma) {
    return redirect("/cadastro?erro=" + encodeURIComponent("As senhas não coincidem"));
  }
  if (senha.length < 12) {
    return redirect("/cadastro?erro=" + encodeURIComponent("Senha deve ter no mínimo 12 caracteres"));
  }
  const requisitos = [
    [/[A-Z]/, "Senha precisa de letra maiúscula"],
    [/[a-z]/, "Senha precisa de letra minúscula"],
    [/[0-9]/, "Senha precisa de número"],
    [/[^A-Za-z0-9]/, "Senha precisa de caractere especial"],
  ] as const;
  for (const [regex, msg] of requisitos) {
    if (!regex.test(senha)) {
      return redirect("/cadastro?erro=" + encodeURIComponent(msg));
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome } },
  });

  if (error) {
    return redirect("/cadastro?erro=" + encodeURIComponent(error.message));
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
