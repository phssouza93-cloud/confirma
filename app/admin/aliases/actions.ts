"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureAdmin } from "../guard";

function normalizar(d: string | null | undefined) {
  if (!d) return "";
  return String(d).trim();
}

function normalizarDerivacao(d: string | null | undefined) {
  if (d == null) return null;
  const s = String(d).trim();
  if (s === "") return null;
  if (/^\d+$/.test(s)) return s.padStart(3, "0");
  return s;
}

function pathsParaInvalidar() {
  revalidatePath("/admin");
  revalidatePath("/admin/aliases");
  revalidatePath("/admin/orfaos");
  revalidatePath("/oportunidades");
  revalidatePath("/dashboard");
}

export async function criarAlias(formData: FormData) {
  await ensureAdmin();
  const supabase = await createClient();

  const descricao_alias = normalizar(formData.get("descricao_alias") as string);
  const sku_codigo = normalizar(formData.get("sku_codigo") as string).toUpperCase();
  const derivacao = normalizarDerivacao(formData.get("derivacao") as string);

  if (!descricao_alias)
    return { ok: false, error: "Descrição é obrigatória" };
  if (!sku_codigo) return { ok: false, error: "SKU é obrigatório" };

  // valida sku existe
  const { data: sku } = await supabase
    .from("skus")
    .select("codigo")
    .eq("codigo", sku_codigo)
    .single();
  if (!sku)
    return { ok: false, error: `SKU ${sku_codigo} não existe no cadastro` };

  const { error } = await supabase.from("sku_aliases").insert({
    descricao_alias,
    sku_codigo,
    derivacao,
  });
  if (error) {
    if (error.message.includes("duplicate"))
      return { ok: false, error: "Já existe alias para essa descrição" };
    return { ok: false, error: error.message };
  }

  pathsParaInvalidar();
  return { ok: true };
}

export async function atualizarAlias(formData: FormData) {
  await ensureAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") || "");
  const descricao_alias = normalizar(formData.get("descricao_alias") as string);
  const sku_codigo = normalizar(formData.get("sku_codigo") as string).toUpperCase();
  const derivacao = normalizarDerivacao(formData.get("derivacao") as string);

  if (!id) return { ok: false, error: "ID inválido" };
  if (!descricao_alias)
    return { ok: false, error: "Descrição é obrigatória" };
  if (!sku_codigo) return { ok: false, error: "SKU é obrigatório" };

  const { data: sku } = await supabase
    .from("skus")
    .select("codigo")
    .eq("codigo", sku_codigo)
    .single();
  if (!sku)
    return { ok: false, error: `SKU ${sku_codigo} não existe no cadastro` };

  const { error } = await supabase
    .from("sku_aliases")
    .update({ descricao_alias, sku_codigo, derivacao })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  pathsParaInvalidar();
  return { ok: true };
}

export async function deletarAlias(id: string) {
  await ensureAdmin();
  if (!id) return { ok: false, error: "ID inválido" };
  const supabase = await createClient();
  const { error } = await supabase.from("sku_aliases").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  pathsParaInvalidar();
  return { ok: true };
}
