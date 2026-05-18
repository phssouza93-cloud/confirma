"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  matchSKU,
  indexarAliases,
  type Alias,
  type SKUCadastro,
} from "@/lib/match";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

  // SKUs + aliases + derivações disponíveis + carteira atual
  // (precisamos das derivações pra alocar automaticamente quando o item da
  // oportunidade vier sem derivação especificada)
  const [
    { data: skusData },
    { data: aliasesData },
    { data: derivData },
    { data: carteiraData },
  ] = await Promise.all([
    supabase.from("skus").select("id, codigo, descricao"),
    supabase.from("sku_aliases").select("descricao_alias, sku_codigo, derivacao"),
    supabase.from("estoque_derivacoes").select("sku_id, derivacao, qtd_disponivel"),
    supabase.from("carteira_pedidos").select("sku_codigo, derivacao, quantidade, status"),
  ]);
  const skus = (skusData || []) as SKUCadastro[];
  const aliasMap = indexarAliases((aliasesData || []) as Alias[]);
  const skuPorCodigo: Record<string, { id: string; codigo: string }> = {};
  skus.forEach((s) => {
    skuPorCodigo[s.codigo] = { id: s.id, codigo: s.codigo };
  });

  // Mapa de derivações disponíveis por SKU código
  type DerivInfo = { derivacao: string | null; qtd: number };
  const derivsPorCodigo: Record<string, DerivInfo[]> = {};
  ((derivData || []) as Array<{
    sku_id: string;
    derivacao: string | null;
    qtd_disponivel: number;
  }>).forEach((d) => {
    const codigo = skus.find((s) => s.id === d.sku_id)?.codigo;
    if (!codigo) return;
    if (!derivsPorCodigo[codigo]) derivsPorCodigo[codigo] = [];
    derivsPorCodigo[codigo].push({
      derivacao: d.derivacao,
      qtd: Number(d.qtd_disponivel) || 0,
    });
  });

  // Carteira já reservada por (sku, derivação) — pra calcular o disponível
  // real e alocar a derivação com mais saldo
  const carteiraReservadaPorChave: Record<string, number> = {};
  ((carteiraData || []) as Array<{
    sku_codigo: string;
    derivacao: string | null;
    quantidade: number;
    status: string;
  }>).forEach((l) => {
    if (l.status === "liberado") return;
    const der = (l.derivacao || "").trim();
    const chave = `${l.sku_codigo}::${der}`;
    carteiraReservadaPorChave[chave] =
      (carteiraReservadaPorChave[chave] || 0) + (Number(l.quantidade) || 0);
  });

  function escolherDerivacao(codigo: string): string | null {
    const lista = derivsPorCodigo[codigo];
    if (!lista || lista.length === 0) return null;
    // Calcula disponível de cada derivação (estoque - carteira já reservada)
    // e escolhe a que tiver MAIS disponível.
    const comDisp = lista
      .map((d) => {
        const der = (d.derivacao || "").trim();
        const reservada = carteiraReservadaPorChave[`${codigo}::${der}`] || 0;
        return {
          derivacao: d.derivacao,
          disponivel: d.qtd - reservada,
        };
      })
      .sort((a, b) => b.disponivel - a.disponivel);
    // Pega a primeira (mais disponível), mesmo que negativa
    const escolhida = comDisp[0];
    return escolhida ? escolhida.derivacao : null;
  }

  // Número de pedido único derivado do ID da oportunidade
  const numero_pedido = `PED-OPP-${opp_id.substring(0, 8).toUpperCase()}`;

  // data_promessa = hoje + prazo_negociado_dias (DIAS CORRIDOS).
  // Se não houver prazo_negociado, usa data_fechamento; em último caso, hoje.
  function addDiasCorridos(base: Date, dias: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + Math.max(0, Math.round(dias)));
    return d;
  }
  let dataPromessa: string;
  if (opp.prazo_negociado_dias != null && Number(opp.prazo_negociado_dias) > 0) {
    const dt = addDiasCorridos(new Date(), Number(opp.prazo_negociado_dias));
    dataPromessa = dt.toISOString().slice(0, 10);
  } else if (opp.data_fechamento) {
    dataPromessa = String(opp.data_fechamento).slice(0, 10);
  } else {
    dataPromessa = new Date().toISOString().slice(0, 10);
  }

  const linhas = itens.map((it) => {
    const m = matchSKU(
      { codigo: it.sku_codigo, descricao: it.descricao },
      skus,
      aliasMap
    );
    const codigoFinal = m.sku ? m.sku.codigo : it.sku_codigo;
    const skuId = m.sku ? skuPorCodigo[m.sku.codigo]?.id || null : null;

    // Determina a derivação:
    //  1) Se o alias sugeriu uma → usa
    //  2) Se o item já tinha derivação → usa
    //  3) Se nenhum dos dois MAS o SKU tem derivações cadastradas →
    //     escolhe automaticamente a com mais saldo disponível
    let derivacaoFinal = m.derivacao_sugerida ?? it.derivacao;
    if (
      (!derivacaoFinal || String(derivacaoFinal).trim() === "") &&
      m.sku &&
      derivsPorCodigo[m.sku.codigo] &&
      derivsPorCodigo[m.sku.codigo].length > 0
    ) {
      derivacaoFinal = escolherDerivacao(m.sku.codigo);
    }

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

  // Usa service role pra inserir na carteira e atualizar a oportunidade —
  // bypassa RLS, garante que consultor/gestor consigam firmar.
  const admin = getAdmin();
  const { data: linhasInseridas, error: errIns } = await admin
    .from("carteira_pedidos")
    .insert(linhas)
    .select();
  if (errIns) return { ok: false, error: errIns.message };
  if (!linhasInseridas || linhasInseridas.length === 0)
    return { ok: false, error: "Nenhuma linha foi criada na carteira" };

  const { error: errUp } = await admin
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
  const admin = getAdmin();

  const { error: errDel } = await admin
    .from("carteira_pedidos")
    .delete()
    .eq("oportunidade_origem_id", opp_id);
  if (errDel) return { ok: false, error: errDel.message };

  const { error: errUp } = await admin
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

/**
 * Atualiza o prazo de liberação negociado (em dias úteis) que o consultor
 * combinou com o cliente. Esse valor é usado como data_promessa quando a
 * oportunidade é firmada.
 */
export async function salvarPrazoNegociado(
  opp_id: string,
  prazo_dias: number | null
) {
  const admin = getAdmin();
  const valor =
    prazo_dias == null || Number.isNaN(prazo_dias) || prazo_dias < 0
      ? null
      : Math.round(Number(prazo_dias));
  const { error } = await admin
    .from("oportunidades")
    .update({ prazo_negociado_dias: valor })
    .eq("id", opp_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/oportunidades/${opp_id}`);
  return { ok: true };
}
