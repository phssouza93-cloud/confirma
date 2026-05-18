"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ensureAdmin, ensureSessionSemRedirectSenha } from "@/lib/auth";
import { ehPerfilValido, type Perfil } from "@/lib/permissoes";
import { validarSenhaForte, SENHA_PADRAO_PRIMEIRO_ACESSO } from "@/lib/senha";
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

/**
 * Apaga DEFINITIVAMENTE um usuário (do Supabase Auth + tabela usuarios).
 * Antes de apagar: limpa lider_id de quem tinha esse usuário como líder
 * (pra não deixar referências órfãs). Não apaga oportunidades nem nada
 * que tenha o owner como nome — esses ficam no banco com o nome registrado.
 */
export async function apagarUsuario(id: string) {
  const ctx = await ensureAdmin();
  if (!id) return { ok: false, error: "ID inválido" };
  if (id === ctx.userId) {
    return { ok: false, error: "Você não pode apagar a si mesmo." };
  }
  const admin = getAdmin();

  // 1) Limpa lider_id em quem tinha esse usuário como líder
  await admin
    .from("usuarios")
    .update({ lider_id: null })
    .eq("lider_id", id);

  // 2) Apaga da tabela usuarios (perfil/permissões)
  const { error: errDel } = await admin
    .from("usuarios")
    .delete()
    .eq("id", id);
  if (errDel) return { ok: false, error: errDel.message };

  // 3) Apaga do Supabase Auth (login). Se falhar, não reverte o passo 2.
  try {
    await admin.auth.admin.deleteUser(id);
  } catch (e) {
    console.warn("Falha ao apagar do auth:", e);
  }

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

/**
 * Cadastra um usuário DIRETO (sem convite por link). Cria no Supabase Auth
 * com a senha padrão de primeiro acesso e marca precisa_trocar_senha=true.
 * O usuário entra com a senha padrão e é forçado a trocar.
 */
export async function criarUsuarioDireto(formData: FormData) {
  await ensureAdmin();
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

  // Verifica duplicidade
  const { data: jaExiste } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (jaExiste)
    return { ok: false, error: "Já existe usuário com esse email" };

  // Cria no Auth com senha padrão
  const { data: novoUser, error: errAuth } = await admin.auth.admin.createUser({
    email,
    password: SENHA_PADRAO_PRIMEIRO_ACESSO,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (errAuth) return { ok: false, error: errAuth.message };
  const userId = novoUser.user!.id;

  // Cria linha em usuarios
  const { error: errIns } = await admin.from("usuarios").upsert(
    {
      id: userId,
      email,
      nome,
      perfil: perfil as Perfil,
      ativo: true,
      lider_id: perfil === "consultor" ? lider_id : null,
      precisa_trocar_senha: true,
    },
    { onConflict: "id" }
  );
  if (errIns) {
    // rollback do auth
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: errIns.message };
  }

  invalidar();
  return { ok: true };
}

/**
 * Encerra TODAS as sessões ativas de um usuário (limpa sessoes_ativas).
 * Usado quando o usuário fica preso no limite de 2 dispositivos por entries fantasmas.
 * Não invalida o token JWT — o usuário pode continuar usando até o token expirar,
 * mas no próximo login os slots de dispositivo estarão livres.
 */
export async function encerrarSessoesUsuario(id: string) {
  await ensureAdmin();
  if (!id) return { ok: false, error: "ID inválido" };
  const admin = getAdmin();
  const { error } = await admin
    .from("sessoes_ativas")
    .delete()
    .eq("user_id", id);
  if (error) return { ok: false, error: error.message };
  invalidar();
  return { ok: true };
}

/**
 * Reseta a senha de um usuário para a senha padrão de primeiro acesso
 * e marca precisa_trocar_senha=true. Só admin pode chamar.
 */
export async function resetarSenhaUsuario(id: string) {
  await ensureAdmin();
  if (!id) return { ok: false, error: "ID inválido" };
  const admin = getAdmin();

  // 1) Reseta senha no Auth
  const { error: errAuth } = await admin.auth.admin.updateUserById(id, {
    password: SENHA_PADRAO_PRIMEIRO_ACESSO,
  });
  if (errAuth) return { ok: false, error: errAuth.message };

  // 2) Marca flag de troca obrigatória
  const { error: errFlag } = await admin
    .from("usuarios")
    .update({ precisa_trocar_senha: true })
    .eq("id", id);
  if (errFlag) return { ok: false, error: errFlag.message };

  // 3) Limpa sessões ativas dele (força re-login em todos os dispositivos)
  await admin.from("sessoes_ativas").delete().eq("user_id", id);

  invalidar();
  return { ok: true };
}

/**
 * O próprio usuário troca sua senha. Usado na página /trocar-senha.
 * Valida força da senha (mín 8, 1 maiúscula, 1 especial) e marca a flag
 * precisa_trocar_senha=false.
 */
export async function trocarMinhaSenha(senhaNova: string) {
  const ctx = await ensureSessionSemRedirectSenha();
  const validacao = validarSenhaForte(senhaNova);
  if (!validacao.ok) {
    return { ok: false, error: "Senha fraca: " + validacao.erros.join(", ") };
  }
  if (senhaNova === SENHA_PADRAO_PRIMEIRO_ACESSO) {
    return {
      ok: false,
      error: "Você precisa escolher uma senha DIFERENTE da senha padrão",
    };
  }

  const admin = getAdmin();
  // 1) Atualiza senha no Auth
  const { error: errAuth } = await admin.auth.admin.updateUserById(ctx.userId, {
    password: senhaNova,
  });
  if (errAuth) return { ok: false, error: errAuth.message };

  // 2) Limpa a flag
  const { error: errFlag } = await admin
    .from("usuarios")
    .update({ precisa_trocar_senha: false })
    .eq("id", ctx.userId);
  if (errFlag) return { ok: false, error: errFlag.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Registra (ou atualiza) o "dispositivo" atual do usuário em sessoes_ativas.
 * Aplica a regra: máx 2 dispositivos distintos. Se já tiver 2 e o atual não
 * estiver na lista, retorna ok=false com mensagem.
 * Sessões inativas (>7 dias) são removidas no início pra liberar slot.
 */
export async function registrarSessao(
  device_id: string,
  user_agent: string
): Promise<{ ok: boolean; error?: string }> {
  if (!device_id) return { ok: false, error: "Sem identificador de dispositivo" };
  const ctx = await ensureSessionSemRedirectSenha();
  const admin = getAdmin();

  // 1) Limpa sessões com mais de 7 dias sem acesso
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await admin
    .from("sessoes_ativas")
    .delete()
    .eq("user_id", ctx.userId)
    .lt("ultimo_acesso", seteDiasAtras);

  // 2) Vê se o device atual já está registrado
  const { data: existente } = await admin
    .from("sessoes_ativas")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("device_id", device_id)
    .maybeSingle();

  if (existente) {
    // Já existe — só atualiza ultimo_acesso
    await admin
      .from("sessoes_ativas")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("id", existente.id);
    return { ok: true };
  }

  // 3) Conta sessões ativas
  const { count } = await admin
    .from("sessoes_ativas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId);

  if ((count || 0) >= 2) {
    return {
      ok: false,
      error:
        "Você já está logado em 2 dispositivos. Saia de um deles antes de entrar em um terceiro.",
    };
  }

  // 4) Registra
  await admin.from("sessoes_ativas").insert({ user_id: ctx.userId,
    device_id,
    user_agent: user_agent.slice(0, 200),
  });
  return { ok: true };
}
