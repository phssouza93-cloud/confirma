// Matching de SKU: alias > código exato > fuzzy por descrição

export type SKUCadastro = {
  id: string;
  codigo: string;
  descricao: string;
};

export type Alias = {
  descricao_alias: string;
  sku_codigo: string;
  derivacao: string | null;
};

const STOPWORDS = new Set([
  "com",
  "para",
  "sem",
  "que",
  "dos",
  "das",
  "por",
  "uma",
  "tipo",
  "grau",
]);

export function normalizarDescricao(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (acentos)
    .replace(/\s+/g, " ") // colapsa espaços múltiplos
    .trim();
}

export function tokenize(s: string): string[] {
  if (!s) return [];
  return normalizarDescricao(s)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const uni = new Set([...sa, ...sb]).size;
  return uni ? inter / uni : 0;
}

export type MatchResult = {
  sku: SKUCadastro | null;
  matched_by: "alias" | "codigo" | "descricao" | null;
  score: number;
  derivacao_sugerida: string | null; // do alias, se houver
};

/**
 * Constrói um mapa de aliases indexado pela descrição normalizada,
 * para lookup O(1) na hora do match.
 */
export function indexarAliases(aliases: Alias[]): Map<string, Alias> {
  const m = new Map<string, Alias>();
  aliases.forEach((a) => {
    m.set(normalizarDescricao(a.descricao_alias), a);
  });
  return m;
}

export function matchSKU(
  item: { codigo: string | null; descricao: string | null },
  skus: SKUCadastro[],
  aliasMap?: Map<string, Alias>
): MatchResult {
  // 1) Alias por descrição (vínculo manual oficial)
  if (aliasMap && item.descricao) {
    const key = normalizarDescricao(item.descricao);
    const a = aliasMap.get(key);
    if (a) {
      const sku = skus.find((s) => s.codigo === a.sku_codigo);
      if (sku) {
        return {
          sku,
          matched_by: "alias",
          score: 1,
          derivacao_sugerida: a.derivacao,
        };
      }
    }
  }
  // 2) Match exato por código
  if (item.codigo) {
    const direct = skus.find((s) => s.codigo === item.codigo);
    if (direct)
      return {
        sku: direct,
        matched_by: "codigo",
        score: 1,
        derivacao_sugerida: null,
      };
  }
  // 3) Fuzzy por descrição
  if (!item.descricao)
    return { sku: null, matched_by: null, score: 0, derivacao_sugerida: null };
  const query = tokenize(item.descricao);
  if (!query.length)
    return { sku: null, matched_by: null, score: 0, derivacao_sugerida: null };
  let best: SKUCadastro | null = null;
  let bestScore = 0;
  skus.forEach((s) => {
    const tk = tokenize(s.descricao);
    const score = jaccard(query, tk);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  });
  if (bestScore >= 0.3 && best)
    return {
      sku: best,
      matched_by: "descricao",
      score: bestScore,
      derivacao_sugerida: null,
    };
  return { sku: null, matched_by: null, score: 0, derivacao_sugerida: null };
}
