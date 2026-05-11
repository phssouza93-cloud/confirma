/**
 * Permissões do Confirma.
 *
 * Cada perfil tem acesso a um conjunto de áreas/rotas. A regra é simples:
 * temAcesso(perfil, rota) === true → mostra no header e permite entrar.
 */

export type Perfil = "admin" | "pcp" | "consultor" | "gestor";

export const PERFIS: Perfil[] = ["admin", "pcp", "consultor", "gestor"];

export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: "Administrador",
  pcp: "PCP",
  consultor: "Consultor",
  gestor: "Gestor",
};

export const PERFIL_DESCRICAO: Record<Perfil, string> = {
  admin:
    "Acesso total — inclui Configurações (usuários, convites) e Admin (aliases, órfãos).",
  pcp:
    "Cadastro mestre e produção: Estoque, Em andamento, Carteira, Disponível e Admin (aliases/órfãos).",
  consultor:
    "Comercial: Oportunidades, Disponível. Pode criar, calcular e firmar oportunidades.",
  gestor:
    "Visão executiva: Dashboard, Oportunidades, Disponível e Disponível. Sem cadastros.",
};

/**
 * Áreas do sistema. Usamos prefixo de rota.
 */
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
  pcp: [
    "inicio",
    "estoque",
    "wip",
    "carteira",
    "disponivel",
    "admin",
  ],
  consultor: ["inicio", "oportunidades", "disponivel"],
  gestor: ["inicio", "dashboard", "oportunidades", "disponivel"],
};

export function ehPerfilValido(p: string): p is Perfil {
  return (PERFIS as string[]).includes(p);
}

export function areasDoPerfil(perfil: string): Area[] {
  if (!ehPerfilValido(perfil)) return [];
  return PERMISSOES[perfil];
}

/**
 * Verifica se um perfil tem acesso a uma rota (matching por prefixo).
 */
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
