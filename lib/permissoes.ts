/**
 * Permissões do Confirma.
 *
 * Perfis e o que cada um acessa. Filtragem por owner é feita nas próprias
 * páginas de Oportunidades e Dashboard (gestor vê suas + dos liderados,
 * consultor só as próprias).
 */

export type Perfil = "admin" | "backoffice" | "consultor" | "gestor";

export const PERFIS: Perfil[] = ["admin", "backoffice", "gestor", "consultor"];

export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: "Administrador",
  backoffice: "Backoffice",
  gestor: "Gestor Regional",
  consultor: "Consultor Comercial",
};

export const PERFIL_DESCRICAO: Record<Perfil, string> = {
  admin:
    "Acesso total: todas as áreas e todas as oportunidades. Edita Estoque, WIP, Carteira. Gerencia usuários, aliases e cadastros.",
  backoffice:
    "Lança oportunidades de qualquer consultor durante a feira. Consulta Estoque, WIP, Carteira e Disponível (sem editar). Não acessa Dashboard.",
  gestor:
    "Consulta Estoque, WIP, Carteira e Disponível. Vê suas oportunidades e as dos consultores liderados. Dashboard filtrado pelo time.",
  consultor:
    "Consulta Estoque, WIP, Carteira, Disponível e Dashboard. Cria e edita apenas as próprias oportunidades.",
};

export const AREAS = {
  inicio: "/",
  estoque: "/estoque",
  wip: "/wip",
  carteira: "/carteira",
  disponivel: "/disponivel",
  oportunidades: "/oportunidades",
  dashboard: "/dashboard",
  admin: "/admin",
  configuracoes: "/configuracoes",
} as const;

type Area = keyof typeof AREAS;

const PERMISSOES: Record<Perfil, Area[]> = {
  admin: [
    "inicio",
    "estoque",
    "wip",
    "carteira",
    "disponivel",
    "oportunidades",
    "dashboard",
    "admin",
    "configuracoes",
  ],
  backoffice: [
    "inicio",
    "estoque",
    "wip",
    "carteira",
    "disponivel",
    "oportunidades",
    // Sem Dashboard
  ],
  gestor: [
    "inicio",
    "estoque",
    "wip",
    "carteira",
    "disponivel",
    "oportunidades",
    "dashboard",
  ],
  consultor: [
    "inicio",
    "estoque",
    "wip",
    "carteira",
    "disponivel",
    "oportunidades",
    "dashboard",
  ],
};

/**
 * Quem pode editar/importar/limpar nas telas operacionais
 * (Estoque, WIP, Carteira). Só o admin.
 */
export function podeEditarOperacional(perfil: string): boolean {
  return perfil === "admin";
}

/**
 * Quem pode criar/editar oportunidades de qualquer owner. Admin e Backoffice.
 * Gestor edita as suas + liderados; Consultor só as próprias.
 */
export function podeLancarOportunidadeQualquerOwner(perfil: string): boolean {
  return perfil === "admin" || perfil === "backoffice";
}

export function ehPerfilValido(p: string): p is Perfil {
  return (PERFIS as string[]).includes(p);
}

export function areasDoPerfil(perfil: string): Area[] {
  if (!ehPerfilValido(perfil)) return [];
  return PERMISSOES[perfil];
}

export function temAcesso(perfil: string, rota: string): boolean {
  if (!ehPerfilValido(perfil)) return false;
  const areas = PERMISSOES[perfil];
  for (const a of areas) {
    const prefixo = AREAS[a];
    if (prefixo === "/" && rota === "/") return true;
    if (prefixo !== "/" && rota.startsWith(prefixo)) return true;
  }
  return false;
}
