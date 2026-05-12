/**
 * Permissões do Confirma.
 *
 * Perfis e o que cada um acessa. Filtragem por owner é feita nas próprias
 * páginas de Oportunidades e Dashboard (gestor vê suas + dos liderados,
 * consultor só as próprias).
 */

export type Perfil = "admin" | "consultor" | "gestor";

export const PERFIS: Perfil[] = ["admin", "gestor", "consultor"];

export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  consultor: "Consultor",
};

export const PERFIL_DESCRICAO: Record<Perfil, string> = {
  admin:
    "Acesso total: todas as áreas e todas as oportunidades. Gerencia usuários, aliases e cadastros.",
  gestor:
    "Acessa Estoque, WIP, Carteira e Disponível inteiros. Vê suas oportunidades e as dos consultores liderados. Dashboard filtrado pelo time.",
  consultor:
    "Acessa Carteira inteira, Disponível e apenas as oportunidades dele. Sem cadastros nem dashboard.",
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
  gestor: [
    "inicio",
    "estoque",
    "wip",
    "carteira",
    "disponivel",
    "oportunidades",
    "dashboard",
  ],
  consultor: ["inicio", "carteira", "disponivel", "oportunidades"],
};

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
