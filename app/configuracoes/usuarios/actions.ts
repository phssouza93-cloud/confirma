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
  const admin = getAdmin();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const nome = String(formData.get("nome") || "").trim();
  const perfil = String(formData.get("perfil") || "consultor");
  const liderIdRaw = String(formData.get("lider_id") || "").trim();
  const lider_id = liderIdRaw === "" ? null : liderIdRaw;

  if (!email) return { ok: false, error: "Email obrigatório" };
  if (!nome) return { ok: false, error: "Nome obrigatório" };
  if (!ehPerfilValido(perfil))
    return { ok: false, error: "Perfil inválido" };

  const { data: jaExiste } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (jaExiste)
    return { ok: false, error: "Já existe usuário com esse email" };

  const { data: convitePendente } = await admin
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
  const { error } = await admin.from("convites").insert({
    email,
    nome,
    perfil,
    token,
    criado_por: ctx.userId,
    lider_id: perfil === "consultor" ? lider_id : null,
  });
  if (error) return { ok: false, error: error.message };

  invalidar();
  return { ok: true, token };
}

export async function atualizarLiderUsuario(
  id: string,
  lider_id: string | null
) {
  const ctx = await ensureAdmin();
  if (!id) return { ok: false, error: "ID inválido" };
  if (id === lider_id)
    return { ok: false, error: "Usuário não pode ser líder de si mesmo" };
  if (id === ctx.userId && lider_id)
    return { ok: false, error: "Admin não pode ter líder" };

  const admin = getAdmin();
  const { error, data } = await admin
    .from("usuarios")
    .update({ lider_id })
    .eq("id", id)
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Nenhuma linha afetada — verifique o ID" };

  invalidar();
  return { ok: true };
}

export async function apagarConvite(id: string) {
  await ensureAdmin();
  if (!id) return { ok: false, error: "ID inválido" };
  const admin = getAdmin();
  const { error } = await admin.from("convites").delete().eq("id", id);
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

  if (id === ctx.userId && perfil !== "admin") {
    return {
      ok: false,
      error: "Você não pode tirar seu próprio acesso admin",
    };
  }

  const admin = getAdmin();
  // Se está virando admin/gestor, limpa o lider_id (não faz sentido ter líder)
  const update: { perfil: Perfil; lider_id?: null } = {
    perfil: perfil as Perfil,
  };
  if (perfil === "admin" || perfil === "gestor") update.lider_id = null;

  const { error, data } = await admin
    .from("usuarios")
    .update(update)
    .eq("id", id)
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Nenhuma linha afetada" };

  invalidar();
  return { ok: true };
}

export async function alternarAtivoUsuario(id: string, ativo: boolean) {
  const ctx = await ensureAdmin();
  if (!id) return { ok: false, error: "ID inválido" };
  if (id === ctx.userId && !ativo) {
    return { ok: false, error: "Você não pode desativar a si mesmo" };
  }
  const admin = getAdmin();
  const { error, data } = await admin
    .from("usuarios")
    .update({ ativo })
    .eq("id", id)
    .select();
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Nenhuma linha afetada" };
  invalidar();
  return { ok: true };
}

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
  const userId = novoUser.user!.id;

  const { error: errIns } = await admin.from("usuarios").upsert(
    {
      id: userId,
      email: convite.email,
      nome: convite.nome,
      perfil: convite.perfil,
      ativo: true,
      lider_id: convite.lider_id || null,
    },
    { onConflict: "id" }
  );
  if (errIns) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: errIns.message };
  }

  await admin
    .from("convites")
    .update({ usado_em: new Date().toISOString(), usado_por: userId })
    .eq("id", convite.id);

  return { ok: true };
}
