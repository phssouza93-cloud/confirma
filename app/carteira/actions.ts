"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ItemPedidoInput = {
  sku_codigo: string;
  derivacao: string | null;
  quantidade: number;
  descricao_original: string;
};

export type PedidoInput = {
  numero_pedido: string;
  cliente: string;
  data_promessa: string | null; // ISO date
  itens: ItemPedidoInput[];
};

// Tokeniza descrição para matching fuzzy
function tokenize(s: string): string[] {
  if (!s) return [];
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(
      (t) =>
        t.length > 2 &&
        !["com", "para", "sem", "que", "dos", "das", "por", "uma", "tipo", "grau"].includes(t)
    );
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const uni = new Set([...sa, ...sb]).size;
  return uni ? inter / uni : 0;
}

type SKUCadastro = {
  id: string;
  codigo: string;
  descricao: string;
};

function matchSKU(
  item: { sku_codigo: string; descricao_original: string },
  skus: SKUCadastro[]
): { sku?: SKUCadastro; matched: "codigo" | "descricao" | null; score: number } {
  // 1) match exato por código
  const direct = skus.find((s) => s.codigo === item.sku_codigo);
  if (direct) return { sku: direct, matched: "codigo", score: 1 };
  // 2) fuzzy por descrição
  if (!item.descricao_original) return { matched: null, score: 0 };
  const query = tokenize(item.descricao_original);
  if (!query.length) return { matched: null, score: 0 };
  let best: SKUCadastro | undefined;
  let bestScore = 0;
  skus.forEach((s) => {
    const skuTokens = tokenize(s.descricao);
    const score = jaccard(query, skuTokens);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  });
  if (bestScore >= 0.3 && best) return { sku: best, matched: "descricao", score: bestScore };
  return { matched: null, score: 0 };
}

export async function importarPedidos(pedidos: PedidoInput[]) {
  if (!pedidos || pedidos.length === 0) {
    return { ok: false, error: "Nenhum pedido para importar" };
  }
  const supabase = await createClient();

  // Busca cadastro de SKUs uma vez (pra fuzzy match)
  const { data: skusData } = await supabase
    .from("skus")
    .select("id, codigo, descricao");
  const skus = (skusData || []) as SKUCadastro[];

  // -- Preserva prev_liberacao já preenchida pelo PCP quando o pedido
  //    estiver sendo reimportado (mesmo numero_pedido + sku + derivação).
  //    Buscamos as linhas existentes desses pedidos, montamos um map por
  //    chave e depois reaproveitamos o valor na inserção.
  const numerosPedido = Array.from(
    new Set(pedidos.map((p) => p.numero_pedido))
  );
  const prevLiberacaoExistente: Record<string, string | null> = {};
  if (numerosPedido.length > 0) {
    const { data: existentes } = await supabase
      .from("carteira_pedidos")
      .select(
        "numero_pedido, sku_codigo, derivacao, prev_liberacao, oportunidade_origem_id"
      )
      .in("numero_pedido", numerosPedido);
    (existentes || []).forEach(
      (l: {
        numero_pedido: string;
        sku_codigo: string;
        derivacao: string | null;
        prev_liberacao: string | null;
        oportunidade_origem_id: string | null;
      }) => {
        // Linhas de oportunidades firmadas NÃO são afetadas pela
        // reimportação — pertencem ao fluxo de firmar opp.
        if (l.oportunidade_origem_id) return;
        const der = (l.derivacao || "").trim();
        const chave = `${l.numero_pedido}::${l.sku_codigo}::${der}`;
        if (l.prev_liberacao) prevLiberacaoExistente[chave] = l.prev_liberacao;
      }
    );
    // Apaga linhas antigas (somente as SEM oportunidade_origem_id) pra
    // evitar duplicatas no reimport. Linhas de firmar opp ficam intactas.
    await supabase
      .from("carteira_pedidos")
      .delete()
      .in("numero_pedido", numerosPedido)
      .is("oportunidade_origem_id", null);
  }

  // Constrói payload de linhas (uma linha por item de cada pedido)
  type Linha = {
    numero_pedido: string;
    cliente: string;
    sku_codigo: string;
    sku_id: string | null;
    derivacao: string | null;
    quantidade: number;
    data_promessa: string | null;
    prev_liberacao: string | null;
    status: string;
    sem_cadastro: boolean;
  };
  const linhas: Linha[] = [];
  let reconhecidos = 0;
  let orfaos = 0;
  let prevPreservadas = 0;

  for (const p of pedidos) {
    for (const it of p.itens) {
      const m = matchSKU(it, skus);
      const reconhecido = !!m.sku;
      if (reconhecido) reconhecidos++;
      else orfaos++;
      const skuCodigoFinal =
        reconhecido && m.sku ? m.sku.codigo : it.sku_codigo;
      const der = (it.derivacao || "").trim();
      const chave = `${p.numero_pedido}::${skuCodigoFinal}::${der}`;
      const prev = prevLiberacaoExistente[chave] || null;
      if (prev) prevPreservadas++;
      linhas.push({
        numero_pedido: p.numero_pedido,
        cliente: p.cliente,
        sku_codigo: skuCodigoFinal,
        sku_id: m.sku?.id || null,
        derivacao: it.derivacao,
        quantidade: it.quantidade,
        data_promessa: p.data_promessa,
        prev_liberacao: prev,
        status: "em_producao",
        sem_cadastro: !reconhecido,
      });
    }
  }

  if (linhas.length === 0) {
    return { ok: false, error: "Nenhum item para importar" };
  }

  const { error } = await supabase.from("carteira_pedidos").insert(linhas);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/carteira");
  return {
    ok: true,
    pedidos: pedidos.length,
    linhas: linhas.length,
    reconhecidos,
    orfaos,
    prev_liberacao_preservadas: prevPreservadas,
  };
}

/**
 * Exclui um pedido inteiro (todas as linhas com aquele numero_pedido) da
 * carteira. Só permite excluir pedidos que NÃO vieram de oportunidades
 * firmadas — pra esses, o usuário precisa reabrir a oportunidade.
 * Exclusão hard, sem auditoria/histórico.
 */
export async function apagarPedido(numeroPedido: string) {
  if (!numeroPedido) return { ok: false, error: "Pedido inválido" };
  const supabase = await createClient();

  const { data: comOrigem } = await supabase
    .from("carteira_pedidos")
    .select("id")
    .eq("numero_pedido", numeroPedido)
    .not("oportunidade_origem_id", "is", null)
    .limit(1);
  if (comOrigem && comOrigem.length > 0) {
    return {
      ok: false,
      error:
        "Esse pedido veio de uma oportunidade firmada. Reabra a oportunidade pra removê-lo da carteira.",
    };
  }

  const { error } = await supabase
    .from("carteira_pedidos")
    .delete()
    .eq("numero_pedido", numeroPedido);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carteira");
  revalidatePath("/disponivel");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Atualiza a previsão de liberação de UM pedido inteiro.
 */
export async function atualizarPrevLiberacaoPedido(
  numero_pedido: string,
  prev_liberacao: string | null
) {
  if (!numero_pedido) return { ok: false, error: "Pedido inválido" };
  const valor =
    prev_liberacao && prev_liberacao.trim() !== "" ? prev_liberacao : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("carteira_pedidos")
    .update({ prev_liberacao: valor })
    .eq("numero_pedido", numero_pedido);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carteira");
  return { ok: true };
}

/**
 * Atualiza prev_liberacao de UMA linha específica.
 */
export async function atualizarPrevLiberacaoLinha(
  linha_id: string,
  prev_liberacao: string | null
) {
  if (!linha_id) return { ok: false, error: "Linha inválida" };
  const valor =
    prev_liberacao && prev_liberacao.trim() !== "" ? prev_liberacao : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("carteira_pedidos")
    .update({ prev_liberacao: valor })
    .eq("id", linha_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carteira");
  return { ok: true };
}
