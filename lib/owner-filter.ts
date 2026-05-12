import { createClient } from "@/lib/supabase/server";

/**
 * Dado um SessionContext, retorna a lista de owners (nomes da coluna
 * oportunidades.owner) que o usuário pode ver.
 *
 * - admin: null (significa "todos", sem filtro)
 * - gestor: o próprio nome + nomes dos consultores que ele lidera
 * - consultor: só o próprio nome
 *
 * Comparação é case-insensitive — feita no normaliza().
 */
export type FiltroOwners =
  | { tipo: "todos" }
  | { tipo: "lista"; owners: string[] };

export function normalizaOwner(s: string | null | undefined): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function obterFiltroOwners(
  userId: string,
  nome: string,
  perfil: string
): Promise<FiltroOwners> {
  if (perfil === "admin") return { tipo: "todos" };
  if (perfil === "consultor") return { tipo: "lista", owners: [nome] };
  if (perfil === "gestor") {
    const supabase = await createClient();
    const { data: liderados } = await supabase
      .from("usuarios")
      .select("nome")
      .eq("lider_id", userId);
    const nomes = (liderados || []).map(
      (l: { nome: string }) => l.nome
    );
    return { tipo: "lista", owners: [nome, ...nomes] };
  }
  return { tipo: "lista", owners: [] };
}

/**
 * Verifica se um owner específico (vindo do banco) bate com o filtro.
 */
export function ownerEstaNoFiltro(
  owner: string | null | undefined,
  filtro: FiltroOwners
): boolean {
  if (filtro.tipo === "todos") return true;
  const alvo = normalizaOwner(owner);
  return filtro.owners.some((o) => normalizaOwner(o) === alvo);
}
