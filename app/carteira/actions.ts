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

  // Constrói payload de linhas (uma linha por item de cada pedido)
  type Linha = {
    numero_pedido: string;
    cliente: string;
    sku_codigo: string;
    sku_id: string | null;
    derivacao: string | null;
    quantidade: number;
    data_promessa: string | null;
    status: string;
    sem_cadastro: boolean;
  };
  const linhas: Linha[] = [];
  let reconhecidos = 0;
  let orfaos = 0;

  for (const p of pedidos) {
    for (const it of p.itens) {
      const m = matchSKU(it, skus);
      const reconhecido = !!m.sku;
      if (reconhecido) reconhecidos++;
      else orfaos++;
      linhas.push({
        numero_pedido: p.numero_pedido,
        cliente: p.cliente,
        sku_codigo: reconhecido && m.sku ? m.sku.codigo : it.sku_codigo,
        sku_id: m.sku?.id || null,
        derivacao: it.derivacao,
        quantidade: it.quantidade,
        data_promessa: p.data_promessa,
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
  };
}

export async function apagarPedido(numeroPedido: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("carteira_pedidos")
    .delete()
    .eq("numero_pedido", numeroPedido);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/carteira");
  return { ok: true };
}
