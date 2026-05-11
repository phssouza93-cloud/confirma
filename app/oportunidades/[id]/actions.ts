"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  matchSKU,
  indexarAliases,
  type Alias,
  type SKUCadastro,
} from "@/lib/match";

type Item = {
  id: string;
  oportunidade_id: string;
  sku_codigo: string;
  derivacao: string | null;
  descricao: string;
  quantidade: number;
};

/**
 * Firma uma oportunidade: muda fase para "Fechado" e cria linhas em
 * carteira_pedidos com os itens da oportunidade. O estoque disponível é
 * abatido implicitamente (Estoque − Carteira = Disponível).
 */
export async function firmarOportunidade(opp_id: string) {
  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("oportunidades")
    .select("*")
    .eq("id", opp_id)
    .single();
  if (!opp) return { ok: false, error: "Oportunidade não encontrada" };
  if (opp.fase === "Fechado")
    return { ok: false, error: "Oportunidade já está firmada" };

  const { data: itensData } = await supabase
    .from("oportunidade_itens")
    .select("*")
    .eq("oportunidade_id", opp_id);
  const itens = (itensData || []) as Item[];
  if (itens.length === 0)
    return { ok: false, error: "Oportunidade sem itens" };

  // SKUs + aliases para fazer match e gravar sku_id correto
  const [{ data: skusData }, { data: aliasesData }] = await Promise.all([
    supabase.from("skus").select("id, codigo, descricao"),
    supabase.from("sku_aliases").select("descricao_alias, sku_codigo, derivacao"),
  ]);
  const skus = (skusData || []) as SKUCadastro[];
  const aliasMap = indexarAliases((aliasesData || []) as Alias[]);
  const skuPorCodigo: Record<string, { id: string; codigo: string }> = {};
  skus.forEach((s) => {
    skuPorCodigo[s.codigo] = { id: s.id, codigo: s.codigo };
  });

  // Número de pedido único derivado do ID da oportunidade
  const numero_pedido = `PED-OPP-${opp_id.substring(0, 8).toUpperCase()}`;

  // data_promessa = data_fechamento da oportunidade (o que o consultor combinou)
  // se não houver, usa hoje
  const dataPromessa = opp.data_fechamento
    ? String(opp.data_fechamento).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const linhas = itens.map((it) => {
    const m = matchSKU(
      { codigo: it.sku_codigo, descricao: it.descricao },
      skus,
      aliasMap
    );
    const codigoFinal = m.sku ? m.sku.codigo : it.sku_codigo;
    const skuId = m.sku ? skuPorCodigo[m.sku.codigo]?.id || null : null;
    // derivacao: do alias se houver, senão do item
    const derivacaoFinal = m.derivacao_sugerida ?? it.derivacao;
    return {
      numero_pedido,
      cliente: opp.cliente,
      sku_codigo: codigoFinal,
      sku_id: skuId,
      derivacao: derivacaoFinal,
      quantidade: Math.round(Number(it.quantidade) || 0),
      data_promessa: dataPromessa,
      status: "em_producao",
      oportunidade_origem_id: opp_id,
      sem_cadastro: !m.sku,
    };
  });

  const { error: errIns } = await supabase
    .from("carteira_pedidos")
    .insert(linhas);
  if (errIns) return { ok: false, error: errIns.message };

  const { error: errUp } = await supabase
    .from("oportunidades")
    .update({ fase: "Fechado" })
    .eq("id", opp_id);
  if (errUp) return { ok: false, error: errUp.message };

  revalidatePath(`/oportunidades/${opp_id}`);
  revalidatePath("/oportunidades");
  revalidatePath("/carteira");
  revalidatePath("/dashboard");
  revalidatePath("/");

  return {
    ok: true,
    numero_pedido,
    linhas_criadas: linhas.length,
  };
}

/**
 * Reabre uma oportunidade firmada: apaga as linhas geradas na carteira
 * e volta a fase para "Commit".
 */
export async function reabrirOportunidade(opp_id: string) {
  const supabase = await createClient();

  const { error: errDel } = await supabase
    .from("carteira_pedidos")
    .delete()
    .eq("oportunidade_origem_id", opp_id);
  if (errDel) return { ok: false, error: errDel.message };

  const { error: errUp } = await supabase
    .from("oportunidades")
    .update({ fase: "Commit" })
    .eq("id", opp_id);
  if (errUp) return { ok: false, error: errUp.message };

  revalidatePath(`/oportunidades/${opp_id}`);
  revalidatePath("/oportunidades");
  revalidatePath("/carteira");
  revalidatePath("/dashboard");
  revalidatePath("/");

  return { ok: true };
}
