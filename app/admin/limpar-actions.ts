"use server";

import { revalidatePath } from "next/cache";
import { ensureSession } from "@/lib/auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function checkAdmin(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ensureSession();
  if (ctx.perfil !== "admin") {
    return { ok: false, error: "Apenas administrador pode executar esta ação." };
  }
  return { ok: true };
}

/**
 * Limpa TODAS as oportunidades + itens + pedidos firmados associados.
 * Não toca em pedidos importados via PDF (sem oportunidade_origem_id).
 */
export async function limparOportunidades() {
  const auth = await checkAdmin();
  if (!auth.ok) return auth;
  const admin = getAdmin();

  // Apaga pedidos firmados (carteira_pedidos com oportunidade_origem_id != null)
  const { error: errP } = await admin
    .from("carteira_pedidos")
    .delete()
    .not("oportunidade_origem_id", "is", null);
  if (errP) return { ok: false, error: errP.message };

  // Apaga itens das oportunidades
  const { error: errI } = await admin
    .from("oportunidade_itens")
    .delete()
    .not("id", "is", null);
  if (errI) return { ok: false, error: errI.message };

  // Apaga oportunidades
  const { error: errO } = await admin
    .from("oportunidades")
    .delete()
    .not("id", "is", null);
  if (errO) return { ok: false, error: errO.message };

  revalidatePath("/oportunidades");
  revalidatePath("/carteira");
  revalidatePath("/disponivel");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Limpa TODA a carteira de pedidos (importados via PDF + firmados de
 * oportunidades). As oportunidades em si não são apagadas, mas as firmadas
 * voltam a ser tratadas como "Fechado" sem pedido — admin pode reabri-las
 * manualmente se quiser.
 */
export async function limparCarteira() {
  const auth = await checkAdmin();
  if (!auth.ok) return auth;
  const admin = getAdmin();

  const { error } = await admin
    .from("carteira_pedidos")
    .delete()
    .not("id", "is", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/carteira");
  revalidatePath("/disponivel");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Limpa estoque (posições por derivação + estoque agregado nas SKUs).
 * NÃO apaga o cadastro mestre (SKUs continuam cadastrados).
 */
export async function limparEstoque() {
  const auth = await checkAdmin();
  if (!auth.ok) return auth;
  const admin = getAdmin();

  const { error: errD } = await admin
    .from("estoque_derivacoes")
    .delete()
    .not("id", "is", null);
  if (errD) return { ok: false, error: errD.message };

  const { error: errS } = await admin
    .from("skus")
    .update({ estoque: 0 })
    .not("id", "is", null);
  if (errS) return { ok: false, error: errS.message };

  revalidatePath("/estoque");
  revalidatePath("/disponivel");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Limpa TODA a tabela WIP (OPs em andamento).
 */
export async function limparWIP() {
  const auth = await checkAdmin();
  if (!auth.ok) return auth;
  const admin = getAdmin();

  const { error } = await admin
    .from("wip")
    .delete()
    .not("id", "is", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/wip");
  revalidatePath("/disponivel");
  revalidatePath("/dashboard");
  return { ok: true };
}
