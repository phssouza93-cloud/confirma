"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ItemOppInput = {
  sku_codigo: string;
  derivacao: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
};

export type OppInput = {
  cliente: string;
  nome: string;
  fase: string;
  record_type: string;
  data_fechamento: string | null;
  owner: string;
  regiao: string;
  itens: ItemOppInput[];
};

export async function importarOportunidades(opps: OppInput[]) {
  if (!opps || opps.length === 0) {
    return { ok: false, error: "Nenhuma oportunidade para importar" };
  }
  const supabase = await createClient();

  // Substitui o pipeline inteiro (semântica de fotos do CRM)
  await supabase
    .from("oportunidade_itens")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase
    .from("oportunidades")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  for (const opp of opps) {
    const valor = opp.itens.reduce(
      (s, it) => s + it.quantidade * (it.preco_unitario || 0),
      0
    );
    const { data: created, error: errOpp } = await supabase
      .from("oportunidades")
      .insert({
        cliente: opp.cliente,
        nome: opp.nome,
        valor,
        fase: opp.fase,
        record_type: opp.record_type,
        data_fechamento: opp.data_fechamento,
        owner: opp.owner,
        regiao: opp.regiao,
      })
      .select("id")
      .single();
    if (errOpp || !created) {
      return { ok: false, error: errOpp?.message || "Erro ao criar oportunidade" };
    }
    if (opp.itens.length > 0) {
      const itens = opp.itens.map((it) => ({
        oportunidade_id: created.id,
        sku_codigo: it.sku_codigo,
        derivacao: it.derivacao,
        descricao: it.descricao,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
        total: it.quantidade * (it.preco_unitario || 0),
      }));
      const { error: errIt } = await supabase
        .from("oportunidade_itens")
        .insert(itens);
      if (errIt) {
        return { ok: false, error: errIt.message };
      }
    }
  }

  revalidatePath("/oportunidades");
  revalidatePath("/");
  return { ok: true, total: opps.length };
}

export async function atualizarQuantidadeItem(
  itemId: string,
  quantidade: number
) {
  const supabase = await createClient();
  // Busca o item pra recalcular o total
  const { data: item } = await supabase
    .from("oportunidade_itens")
    .select("preco_unitario, oportunidade_id")
    .eq("id", itemId)
    .single();
  if (!item) return { ok: false, error: "Item não encontrado" };
  const total = quantidade * (item.preco_unitario || 0);
  const { error } = await supabase
    .from("oportunidade_itens")
    .update({ quantidade, total })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  // Recalcula valor da oportunidade
  const { data: itens } = await supabase
    .from("oportunidade_itens")
    .select("total")
    .eq("oportunidade_id", item.oportunidade_id);
  const valor = (itens || []).reduce(
    (s: number, x: { total: number }) => s + (x.total || 0),
    0
  );
  await supabase
    .from("oportunidades")
    .update({ valor })
    .eq("id", item.oportunidade_id);

  revalidatePath(`/oportunidades/${item.oportunidade_id}`);
  revalidatePath("/oportunidades");
  return { ok: true };
}
