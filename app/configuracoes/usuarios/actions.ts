"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ensureAdmin } from "@/lib/auth";
import { ehPerfilValido, type Perfil } from "@/lib/permissoes";
import { randomBytes } from "crypto";

function geraToken(n = 32) {
  return randomBytes(n).toString("base64url");
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function invalidar() {
  revalidatePath("/configuracoes/usuarios");
  revalidatePath("/");
}

export async function criarConvite(formData: FormData) {
  const ctx = await ensureAdmin();
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const nome = String(formData.get("nome") || "").trim();
  const perfil = String(formData.get("perfil") || "consultor");

  if (!email) return { ok: false, error: "Email obrigatório" };
  if (!nome) return { ok: false, error: "Nome obrigatório" };
  if (!ehPerfilValido(perfil))
    return { ok: false, error: "Perfil inválido" };

  // Já existe usuário com esse email?
  const { data: jaExiste } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (jaExiste)
    return { ok: false, error: "Já existe usuário com esse email" };

  // Já tem convite pendente?
  const { data: convitePendente } = await supabase
    .from("convites")
    .select("id")
    .eq("email", email)
    .is("usado_em", null)
    .maybeSingle();
  if (convitePendente)
    return {
      ok: false,
      error: "Já existe convite pendente para esse email. Apague antes de criar outro.",
    };

  const token = geraToken();
  const { error } = await supabase.from("convites").insert({
    email,
    nome,
    perfil,
    token,
    criado_por: ctx.userId,
  });
  if (error) return { ok: false, error: error.message };

  invalidar();
  return { ok: true, token };
}

export async function apagarConvite(id: string) {
  await ensureAdmin();
  if (!id) return { ok: false, error: "ID inválido" };
  const supabase = await createClient();
  const { error } = await supabase.from("convites").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  invalidar();
  return { ok: true };
}

export async function atualizarPerfilUsuario(formData: FormData) {
  const ctx = await ensureAdmin();
  const id = String(formData.get("id") || "");
  const perfil = String(formData.get("perfil") || "");

  if (!id) return { ok: false, error: "ID inválido" };
  if (!ehPerfilValido(perfil))
    return { ok: false, error: "Perfil inválido" };

  // Não permitir admin tirar o próprio perfil de admin (evita lock-out)
  if (id === ctx.userId && perfil !== "admin") {
    return {
      ok: false,
      error: "Você não pode tirar seu próprio acesso admin",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ perfil: perfil as Perfil })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  invalidar();
  return { ok: true };
}

export async function alternarAtivoUsuario(id: string, ativo: boolean) {
  const ctx = await ensureAdmin();
  if (!id) return { ok: false, error: "ID inválido" };
  if (id === ctx.userId && !ativo) {
    return { ok: false, error: "Você não pode desativar a si mesmo" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({ ativo })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  invalidar();
  return { ok: true };
}

/**
 * Ativa o convite: cria o user no Supabase Auth e a linha em usuarios.
 * Chamada PELA PÁGINA PÚBLICA /convite/[token] depois que o convidado
 * define a senha.
 */
export async function aceitarConvite(formData: FormData) {
  const token = String(formData.get("token") || "");
  const senha = String(formData.get("senha") || "");
  const confirma = String(formData.get("confirma") || "");

  if (!token) return { ok: false, error: "Token inválido" };
  if (!senha || senha.length < 8)
    return { ok: false, error: "Senha precisa de no mínimo 8 caracteres" };
  if (senha !== confirma) return { ok: false, error: "Senhas não coincidem" };

  const supabase = await createClient();
  const { data: convite } = await supabase
    .from("convites")
    .select("*")
    .eq("token", token)
    .single();

  if (!convite) return { ok: false, error: "Convite não encontrado" };
  if (convite.usado_em)
    return { ok: false, error: "Convite já foi usado" };
  if (convite.expira_em && new Date(convite.expira_em) < new Date())
    return { ok: false, error: "Convite expirado. Peça um novo." };

  // Cria user no Auth via service role
  const admin = getAdmin();
  const { data: novoUser, error: errAuth } = await admin.auth.admin.createUser({
    email: convite.email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: convite.nome },
  });
  if (errAuth) {
    return { ok: false, error: errAuth.message };
  }

  // Cria linha em usuarios
  const { error: errIns } = await admin.from("usuarios").insert({
    id: novoUser.user!.id,
    email: convite.email,
    nome: convite.nome,
    perfil: convite.perfil,
    ativo: true,
  });
  if (errIns) {
    // limpa o user do Auth se inserir em usuarios falhar
    await admin.auth.admin.deleteUser(novoUser.user!.id);
    return { ok: false, error: errIns.message };
  }

  // Marca convite como usado
  await admin
    .from("convites")
    .update({ usado_em: new Date().toISOString(), usado_por: novoUser.user!.id })
    .eq("id", convite.id);

  return { ok: true };
}
