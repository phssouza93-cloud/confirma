"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SKUCadastroInput = {
  codigo: string;
  descricao: string;
  familia?: string | null;
  lead_time_dias?: number | null;
};

export type DerivacaoInput = {
  codigo: string;
  derivacao: string | null; // já no formato 3 dígitos
  qtd_disponivel: number;
  deposito?: string | null;
};

/**
 * Importa o cadastro mestre — popula a tabela skus sem mexer no estoque.
 * Faz upsert por código, então atualiza descrição/família se já existir.
 */
export async function importarCadastroMestre(skus: SKUCadastroInput[]) {
  if (!skus || skus.length === 0) {
    return { ok: false, error: "Nenhum SKU para importar" };
  }
  const supabase = await createClient();

  // Busca SKUs existentes pra preservar lead_time SOMENTE quando a planilha
  // não trouxer a coluna (s.lead_time_dias === undefined).
  // Se a planilha trouxer (número ou null), o valor da planilha PREVALECE.
  const { data: atuais } = await supabase
    .from("skus")
    .select("codigo, lead_time_dias");
  const leadTimePorCodigo: Record<string, number> = {};
  (atuais || []).forEach((s: { codigo: string; lead_time_dias: number | null }) => {
    if (s.lead_time_dias != null) leadTimePorCodigo[s.codigo] = s.lead_time_dias;
  });

  const payload = skus.map((s) => {
    const codigoStr = String(s.codigo).trim();
    const planilhaTrouxeLT = Object.prototype.hasOwnProperty.call(
      s,
      "lead_time_dias"
    );
    const lt = planilhaTrouxeLT
      ? s.lead_time_dias ?? null
      : leadTimePorCodigo[codigoStr] ?? null;
    return {
      codigo: codigoStr,
      descricao: String(s.descricao).trim(),
      familia: s.familia ? String(s.familia).trim() : null,
      lead_time_dias: lt,
      ativo: true,
    };
  });
  // Deduplica por código (planilha pode ter o mesmo código mais de uma vez).
  // Mantém a última ocorrência — geralmente é a versão mais atualizada da descrição.
  const dedup: Record<string, (typeof payload)[number]> = {};
  payload.forEach((s) => {
    dedup[s.codigo] = s;
  });
  const payloadFinal = Object.values(dedup);
  const duplicatas = payload.length - payloadFinal.length;

  const { error } = await supabase
    .from("skus")
    .upsert(payloadFinal, { onConflict: "codigo", ignoreDuplicates: false });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/estoque");
  return {
    ok: true,
    inseridos: payloadFinal.length,
    duplicatas_ignoradas: duplicatas,
  };
}

/**
 * Atualiza o lead_time_dias de um SKU específico.
 * Chamado pela edição inline na tela de Estoque.
 */
export async function atualizarLeadTime(codigo: string, dias: number | null) {
  if (!codigo) return { ok: false, error: "Código vazio" };
  // null = limpa (sem lead time definido); número = atualiza
  const valor =
    dias === null || dias === undefined || Number.isNaN(Number(dias))
      ? null
      : Math.max(0, Math.round(Number(dias)));
  const supabase = await createClient();
  const { error } = await supabase
    .from("skus")
    .update({ lead_time_dias: valor })
    .eq("codigo", codigo);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/estoque");
  return { ok: true };
}

/**
 * Importa a posição de estoque por derivação.
 * Substitui a posição atual: limpa estoque_derivacoes e insere a nova foto.
 * Em seguida, recalcula skus.estoque como soma das derivações.
 */
export async function importarPosicaoEstoque(linhas: DerivacaoInput[]) {
  if (!linhas || linhas.length === 0) {
    return { ok: false, error: "Nenhuma linha para importar" };
  }
  const supabase = await createClient();

  // 1) busca os SKUs existentes pra mapear código → id
  const { data: skusData } = await supabase.from("skus").select("id, codigo");
  const mapaSku: Record<string, string> = {};
  (skusData || []).forEach((s: { id: string; codigo: string }) => {
    mapaSku[s.codigo] = s.id;
  });

  // 2) cria SKUs que faltam (apenas com código — descrição vazia se não tiver cadastro mestre)
  const novosSkus: { codigo: string; descricao: string; familia: string | null }[] = [];
  linhas.forEach((l) => {
    const codigo = String(l.codigo).trim();
    if (!mapaSku[codigo]) {
      const fam = codigo.substring(0, 3);
      novosSkus.push({
        codigo,
        descricao: codigo, // placeholder até o cadastro mestre vir
        familia: fam,
      });
    }
  });
  if (novosSkus.length > 0) {
    // remove duplicatas
    const uniq = Object.values(
      novosSkus.reduce((acc: Record<string, typeof novosSkus[0]>, s) => {
        acc[s.codigo] = s;
        return acc;
      }, {})
    );
    const { error } = await supabase
      .from("skus")
      .upsert(uniq, { onConflict: "codigo", ignoreDuplicates: true });
    if (error) return { ok: false, error: error.message };
    // recarrega o mapa
    const { data: skusData2 } = await supabase
      .from("skus")
      .select("id, codigo");
    (skusData2 || []).forEach((s: { id: string; codigo: string }) => {
      mapaSku[s.codigo] = s.id;
    });
  }

  // 3) limpa a tabela de derivações para fazer a nova foto
  // Usamos UUID zero porque comparar uuid com string vazia silenciosamente não deleta.
  await supabase
    .from("estoque_derivacoes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  // 4) insere as derivações
  const linhasPayload = linhas
    .filter((l) => mapaSku[String(l.codigo).trim()])
    .map((l) => ({
      sku_id: mapaSku[String(l.codigo).trim()],
      derivacao: l.derivacao,
      qtd_disponivel: Math.round(Number(l.qtd_disponivel) || 0),
      deposito: l.deposito || "EP",
    }));
  if (linhasPayload.length > 0) {
    const { error } = await supabase
      .from("estoque_derivacoes")
      .insert(linhasPayload);
    if (error) return { ok: false, error: error.message };
  }

  // 5) recalcula skus.estoque = soma das derivações
  const totaisPorSku: Record<string, number> = {};
  linhasPayload.forEach((l) => {
    totaisPorSku[l.sku_id] = (totaisPorSku[l.sku_id] || 0) + l.qtd_disponivel;
  });
  // zera todos antes (caso algum sumiu do upload)
  await supabase
    .from("skus")
    .update({ estoque: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  // Paraleliza os updates em chunks pra não estourar timeout do Netlify.
  // Cada chunk dispara N updates em paralelo via Promise.all.
  const entries = Object.entries(totaisPorSku);
  const CHUNK_SIZE = 25;
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(([skuId, total]) =>
        supabase.from("skus").update({ estoque: total }).eq("id", skuId)
      )
    );
  }

  revalidatePath("/estoque");
  return { ok: true, derivacoes: linhasPayload.length };
}
