"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OPInput = {
  op_numero: string;
  sku_codigo: string;
  derivacao: string | null;
  qtd_prevista: number;
};

type OPExistente = {
  id: string;
  op_numero: string;
  sku_codigo: string;
  derivacao: string | null;
  qtd_prevista: number;
  data_prevista: string | null;
  status: string;
};

function calcularStatus(data_prevista: string | null): string {
  if (!data_prevista) return "aguardando_data";
  const dt = new Date(data_prevista);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (dt < hoje) return "atrasada";
  return "em_producao";
}

/**
 * Upload diferencial: preserva data_prevista das OPs que continuam,
 * adiciona novas (sem data), remove OPs que sumiram do upload.
 */
export async function importarWIP(novas: OPInput[]) {
  const supabase = await createClient();

  // 1) busca WIP atual
  const { data: atuais, error: errSel } = await supabase
    .from("wip")
    .select("*");
  if (errSel) return { ok: false, error: errSel.message };

  const mapaAtual: Record<string, OPExistente> = {};
  (atuais as OPExistente[]).forEach((o) => {
    mapaAtual[o.op_numero] = o;
  });
  const numerosNovos = new Set(novas.map((n) => n.op_numero));

  // 2) diff
  const aRemover = (atuais as OPExistente[])
    .filter((o) => !numerosNovos.has(o.op_numero))
    .map((o) => o.op_numero);

  let mantidas = 0;
  let inseridas = 0;

  const payload = novas.map((n) => {
    const antiga = mapaAtual[n.op_numero];
    if (antiga) {
      mantidas++;
      return {
        op_numero: n.op_numero,
        sku_codigo: n.sku_codigo,
        derivacao: n.derivacao,
        qtd_prevista: n.qtd_prevista,
        data_prevista: antiga.data_prevista, // PRESERVA
        status: calcularStatus(antiga.data_prevista),
      };
    } else {
      inseridas++;
      return {
        op_numero: n.op_numero,
        sku_codigo: n.sku_codigo,
        derivacao: n.derivacao,
        qtd_prevista: n.qtd_prevista,
        data_prevista: null,
        status: "aguardando_data",
      };
    }
  });

  // 3) remove as que sumiram
  if (aRemover.length > 0) {
    const { error: errDel } = await supabase
      .from("wip")
      .delete()
      .in("op_numero", aRemover);
    if (errDel) return { ok: false, error: errDel.message };
  }

  // 4) upsert das atuais/novas
  if (payload.length > 0) {
    const { error: errUp } = await supabase
      .from("wip")
      .upsert(payload, { onConflict: "op_numero" });
    if (errUp) return { ok: false, error: errUp.message };
  }

  revalidatePath("/wip");
  return { ok: true, mantidas, inseridas, removidas: aRemover.length };
}

export async function atualizarDataPrevista(
  opNumero: string,
  dataIso: string | null
) {
  const supabase = await createClient();
  const status = calcularStatus(dataIso);
  const { error } = await supabase
    .from("wip")
    .update({ data_prevista: dataIso, status, atualizado_em: new Date().toISOString() })
    .eq("op_numero", opNumero);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/wip");
  return { ok: true };
}
