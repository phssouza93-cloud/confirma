"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SKUInput = {
  codigo: string;
  descricao: string;
  familia: string | null;
  estoque: number;
  lead_time_dias?: number;
};

export async function importarSKUs(skus: SKUInput[]) {
  if (!skus || skus.length === 0) {
    return { ok: false, error: "Nenhum SKU para importar" };
  }
  const supabase = await createClient();

  // Garante valores default e limpa
  const payload = skus.map((s) => ({
    codigo: String(s.codigo).trim(),
    descricao: String(s.descricao).trim(),
    familia: s.familia ? String(s.familia).trim() : null,
    estoque: Number(s.estoque) || 0,
    lead_time_dias: s.lead_time_dias ?? 20,
    ativo: true,
  }));

  const { error } = await supabase
    .from("skus")
    .upsert(payload, { onConflict: "codigo" });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/estoque");
  return { ok: true, inseridos: payload.length };
}

export async function apagarSKU(codigo: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("skus").delete().eq("codigo", codigo);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/estoque");
  return { ok: true };
}
