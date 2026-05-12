// Tempo de transporte (DIAS CORRIDOS) por UF, baseado na matriz da Confiance.
//
//   Norte:        10 dias
//   Nordeste:     10 dias
//   Sul:           5 dias
//   Centro-Oeste:  8 dias
//   Sudeste:       4 dias (SP e RJ → 2 dias)
//
// Faturamento + expedição = +2 dias corridos adicionais.

export const FATURAMENTO_EXPEDICAO_DIAS = 2;

export type RegiaoBrasil =
  | "Norte"
  | "Nordeste"
  | "Centro-Oeste"
  | "Sudeste"
  | "Sul";

export const UF_PARA_REGIAO: Record<string, RegiaoBrasil> = {
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte",
  RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste",
  PB: "Nordeste", PE: "Nordeste", PI: "Nordeste", RN: "Nordeste",
  SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste",
  MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

export const UF_NOME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
  PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul",
  SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

export const UFS = Object.keys(UF_PARA_REGIAO).sort();

/**
 * Retorna o número de dias úteis de transporte para a UF informada.
 * SP e RJ são exceção dentro do Sudeste (2 dias).
 * Devolve null se a UF não puder ser identificada.
 */
export function diasTransporteDoUF(uf: string | null | undefined): number | null {
  if (!uf) return null;
  const u = String(uf).trim().toUpperCase();

  // Match direto na sigla
  if (u === "SP" || u === "RJ") return 2;
  const regiao = UF_PARA_REGIAO[u];
  if (regiao) return diasPorRegiao(regiao);

  // Fallback: tenta detectar a região na string (legado: "Norte & Nordeste", etc)
  const lower = String(uf).toLowerCase();
  if (/sao\s*paulo|s[aã]o\s*paulo/.test(lower)) return 2;
  if (/rio\s*de\s*janeiro/.test(lower)) return 2;
  if (/sudeste/.test(lower)) return 4;
  if (/sul\b/.test(lower)) return 5;
  if (/centro\s*-?\s*oeste/.test(lower)) return 8;
  if (/nordeste|norte/.test(lower)) return 10;

  return null;
}

function diasPorRegiao(r: RegiaoBrasil): number {
  switch (r) {
    case "Norte":
    case "Nordeste":
      return 10;
    case "Sul":
      return 5;
    case "Centro-Oeste":
      return 8;
    case "Sudeste":
      return 4;
  }
}
