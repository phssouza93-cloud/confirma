"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { obterFiltroOwners, normalizaOwner } from "@/lib/owner-filter";

export type NovoItem = {
  sku_codigo: string;
  derivacao?: string | null;
  descricao: string;
  quantidade: number;
};

export async function criarOportunidade(formData: FormData) {
  const ctx = await ensureAcesso("/oportunidades");
  const supabase = await createClient();

  const cliente = String(formData.get("cliente") || "").trim();
  const nome = String(formData.get("nome") || "").trim();
  const owner = String(formData.get("owner") || "").trim();
  const fase = String(formData.get("fase") || "Commit").trim();
  const regiao = String(formData.get("regiao") || "").trim();
  const record_type = String(formData.get("record_type") || "Vendas Privadas").trim();
  const valorRaw = String(formData.get("valor") || "0").replace(/\./g, "").replace(",", ".");
  const valor = Number(valorRaw) || 0;
  const data_fechamento = String(formData.get("data_fechamento") || "").trim() || null;
  const itensJson = String(formData.get("itens_json") || "[]");

  if (!cliente) return { ok: false, error: "Cliente é obrigatório" };
  if (!nome) return { ok: false, error: "Nome da oportunidade é obrigatório" };
  if (!owner) return { ok: false, error: "Owner é obrigatório" };

  let itens: NovoItem[] = [];
  try {
    itens = JSON.parse(itensJson);
  } catch {
    return { ok: false, error: "Itens inválidos" };
  }
  if (!Array.isArray(itens) || itens.length === 0)
    return { ok: false, error: "Adicione pelo menos um item" };

  for (const it of itens) {
    if (!it.descricao || !String(it.descricao).trim())
      return { ok: false, error: "Cada item precisa de descrição" };
    if (!it.quantidade || Number(it.quantidade) <= 0)
      return { ok: false, error: "Cada item precisa de quantidade > 0" };
  }

  // Valida que o owner está dentro do escopo do user
  const filtroOwners = await obterFiltroOwners(ctx.userId, ctx.nome, ctx.perfil);
  if (filtroOwners.tipo === "lista") {
    const alvo = normalizaOwner(owner);
    const permitidos = filtroOwners.owners.map(normalizaOwner);
    if (!permitidos.includes(alvo)) {
      return {
        ok: false,
        error: "Você não tem permissão para criar oportunidade com esse owner",
      };
    }
  }

  // Insere oportunidade
  const { data: novaOpp, error: errOpp } = await supabase
    .from("oportunidades")
    .insert({
      cliente,
      nome,
      owner,
      fase,
      regiao,
      record_type,
      valor,
      data_fechamento,
    })
    .select("id")
    .single();
  if (errOpp || !novaOpp)
    return { ok: false, error: errOpp?.message || "Erro ao criar oportunidade" };

  // Insere itens
  const rateio = itens.length > 0 ? valor / itens.length : 0;
  const linhasItens = itens.map((it) => ({
    oportunidade_id: novaOpp.id,
    sku_codigo: String(it.sku_codigo || "").trim().toUpperCase(),
    derivacao: it.derivacao ? String(it.derivacao).trim() : null,
    descricao: String(it.descricao).trim(),
    quantidade: Math.round(Number(it.quantidade) || 0),
    preco_unitario: rateio / (Number(it.quantidade) || 1),
    total: rateio,
  }));

  const { error: errItens } = await supabase
    .from("oportunidade_itens")
    .insert(linhasItens);
  if (errItens) {
    // se itens falharem, apaga a opp pra não deixar lixo
    await supabase.from("oportunidades").delete().eq("id", novaOpp.id);
    return { ok: false, error: errItens.message };
  }

  revalidatePath("/oportunidades");
  revalidatePath("/dashboard");

  redirect(`/oportunidades/${novaOpp.id}`);
}
