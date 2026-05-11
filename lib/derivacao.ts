/**
 * Padroniza a derivação para SEMPRE 3 dígitos com zero à esquerda.
 * Aceita número (1 → "001"), string ("17" → "017"), string já formatada ("017" → "017"),
 * null/undefined → null. Para valores não-numéricos, mantém o texto original.
 */
export function formatarDerivacao(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  // Se for número puro, faz zero-pad para 3 dígitos
  if (/^\d+$/.test(s)) {
    return s.padStart(3, "0");
  }
  return s;
}
