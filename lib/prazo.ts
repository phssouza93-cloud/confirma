// Motor de cálculo de prazo
// Fórmula: Estoque Disponível = Estoque − Carteira ; WIP só entra se faltar

import { matchSKU, type SKUCadastro, type Alias } from "./match";

export const PARAMS = {
  bufferDiasUteis: 3,
  logisticaDiasUteis: 5,
  validadeHoras: 24,
};

export type ItemInput = {
  sku_codigo: string;
  descricao: string;
  derivacao: string | null;
  quantidade: number;
};

export type SKUFull = SKUCadastro & {
  estoque: number;
  lead_time_dias: number | null;
  eh_servico?: boolean;
};

export type WIPDisponivel = {
  sku_codigo: string;
  qtd: number;
  data_prevista: string; // ISO
};

export type ResultadoItem = {
  sku_codigo_input: string;
  sku_codigo_matched: string | null;
  descricao: string;
  derivacao: string | null;
  derivacao_sugerida: string | null; // do alias
  matched_by: "alias" | "codigo" | "descricao" | null;
  match_score: number;
  status: "ok" | "sem_cadastro" | "servico";
  quantidade: number;
  estoque: number;
  carteira: number;
  disponivel: number;
  wip_total: number;
  consumo_estoque: number;
  consumo_wip: number;
  consumo_producao_zero: number;
  fonte: "estoque" | "wip" | "producao_zero" | null;
  prazo_dias: number | null;
};

export type ResultadoOportunidade = {
  itens: ResultadoItem[];
  prazo_dias: number | null;
  gargalo_idx: number | null;
  total_valor: number;
};

function diasUteisEntre(d1: Date, d2: Date): number {
  const ms = d2.getTime() - d1.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function calcularItem(
  item: ItemInput,
  skus: SKUFull[],
  carteiraReservada: Record<string, number>, // sku_codigo → qtd reservada
  wipPorSku: Record<string, WIPDisponivel[]>, // sku_codigo → lista de OPs com data
  aliasMap?: Map<string, Alias>
): ResultadoItem {
  const m = matchSKU(
    { codigo: item.sku_codigo, descricao: item.descricao },
    skus,
    aliasMap
  );

  if (!m.sku) {
    return {
      sku_codigo_input: item.sku_codigo,
      sku_codigo_matched: null,
      descricao: item.descricao,
      derivacao: item.derivacao,
      derivacao_sugerida: null,
      matched_by: null,
      match_score: 0,
      status: "sem_cadastro",
      quantidade: item.quantidade,
      estoque: 0,
      carteira: 0,
      disponivel: 0,
      wip_total: 0,
      consumo_estoque: 0,
      consumo_wip: 0,
      consumo_producao_zero: 0,
      fonte: null,
      prazo_dias: null,
    };
  }

  const skuFull = skus.find((s) => s.codigo === m.sku!.codigo)!;
  const codigo = skuFull.codigo;

  // Item de serviço — não afeta o cálculo de prazo, não tem estoque/WIP
  if (skuFull.eh_servico) {
    return {
      sku_codigo_input: item.sku_codigo,
      sku_codigo_matched: codigo,
      descricao: skuFull.descricao,
      derivacao: item.derivacao,
      derivacao_sugerida: m.derivacao_sugerida,
      matched_by: m.matched_by,
      match_score: m.score,
      status: "servico",
      quantidade: item.quantidade,
      estoque: 0,
      carteira: 0,
      disponivel: 0,
      wip_total: 0,
      consumo_estoque: 0,
      consumo_wip: 0,
      consumo_producao_zero: 0,
      fonte: null,
      prazo_dias: null,
    };
  }

  const estoque = skuFull.estoque;
  const carteira = carteiraReservada[codigo] || 0;
  const disponivel = Math.max(0, estoque - carteira);
  const wipOps = (wipPorSku[codigo] || []).slice().sort(
    (a, b) => new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime()
  );
  const wipTotal = wipOps.reduce((s, x) => s + x.qtd, 0);

  const qtd = item.quantidade;
  let consumo_estoque = 0;
  let consumo_wip = 0;
  let consumo_producao_zero = 0;
  let fonte: ResultadoItem["fonte"] = null;
  let prazo_dias = 0;

  if (qtd <= disponivel) {
    consumo_estoque = qtd;
    fonte = "estoque";
    prazo_dias = PARAMS.logisticaDiasUteis + PARAMS.bufferDiasUteis;
  } else {
    consumo_estoque = disponivel;
    const falta = qtd - disponivel;
    if (falta <= wipTotal) {
      consumo_wip = falta;
      // pega a data da OP que cobre o último item necessário
      let acumulado = 0;
      let dataWip = wipOps.length ? new Date(wipOps[wipOps.length - 1].data_prevista) : new Date();
      for (const op of wipOps) {
        acumulado += op.qtd;
        if (acumulado >= falta) {
          dataWip = new Date(op.data_prevista);
          break;
        }
      }
      const hoje = new Date();
      const dias = diasUteisEntre(hoje, dataWip);
      fonte = "wip";
      prazo_dias = dias + PARAMS.logisticaDiasUteis + PARAMS.bufferDiasUteis;
    } else {
      consumo_wip = wipTotal;
      consumo_producao_zero = falta - wipTotal;
      fonte = "producao_zero";
      if (skuFull.lead_time_dias == null) {
        // Sem lead time definido pelo PCP → não dá pra prometer prazo
        prazo_dias = -1; // sentinela: substituído por null no retorno
      } else {
        prazo_dias =
          skuFull.lead_time_dias +
          PARAMS.logisticaDiasUteis +
          PARAMS.bufferDiasUteis;
      }
    }
  }

  return {
    sku_codigo_input: item.sku_codigo,
    sku_codigo_matched: codigo,
    descricao: skuFull.descricao,
    derivacao: item.derivacao,
    derivacao_sugerida: m.derivacao_sugerida,
    matched_by: m.matched_by,
    match_score: m.score,
    status: "ok",
    quantidade: qtd,
    estoque,
    carteira,
    disponivel,
    wip_total: wipTotal,
    consumo_estoque,
    consumo_wip,
    consumo_producao_zero,
    fonte,
    prazo_dias: prazo_dias === -1 ? null : prazo_dias,
  };
}

export function calcularOportunidade(
  itens: (ItemInput & { preco_unitario?: number })[],
  skus: SKUFull[],
  carteiraReservada: Record<string, number>,
  wipPorSku: Record<string, WIPDisponivel[]>,
  aliasMap?: Map<string, Alias>
): ResultadoOportunidade {
  const resultados = itens.map((it) =>
    calcularItem(it, skus, carteiraReservada, wipPorSku, aliasMap)
  );
  // Se algum item está em produção do zero sem lead time definido,
  // não dá pra prometer prazo. O prazo geral vira "sob consulta".
  const temProducaoSemLeadTime = resultados.some(
    (r) =>
      r.status === "ok" &&
      r.fonte === "producao_zero" &&
      r.prazo_dias == null
  );
  // Prazo = MAX (regra do gargalo)
  const prazos = resultados
    .filter((r) => r.status === "ok" && r.prazo_dias != null)
    .map((r) => r.prazo_dias as number);
  const prazo = temProducaoSemLeadTime
    ? null
    : prazos.length
    ? Math.max(...prazos)
    : null;
  // Gargalo só é destacado quando UM ÚNICO item tem o maior prazo.
  // Se houver empate no máximo (ex.: todos atendem em 8d), não destaca ninguém.
  let gargaloIdx: number | null = null;
  if (prazo != null) {
    const indicesNoMax: number[] = [];
    resultados.forEach((r, i) => {
      if (r.status === "ok" && r.prazo_dias === prazo) indicesNoMax.push(i);
    });
    if (indicesNoMax.length === 1) {
      gargaloIdx = indicesNoMax[0];
    }
  }
  const totalValor = itens.reduce(
    (s, it) => s + it.quantidade * (it.preco_unitario || 0),
    0
  );
  return {
    itens: resultados,
    prazo_dias: prazo,
    gargalo_idx: gargaloIdx,
    total_valor: totalValor,
  };
}
