import Link from "next/link";
import { LogoConfiance } from "./LogoConfiance";
import { LogoutButton } from "./LogoutButton";
import { temAcesso, PERFIL_LABEL, ehPerfilValido } from "@/lib/permissoes";
import { GearMenu } from "./GearMenu";

type Props = {
  nome: string;
  perfil: string;
  rotaAtiva?: string;
};

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/", label: "Início" },
  { href: "/estoque", label: "Estoque" },
  { href: "/wip", label: "Em andamento" },
  { href: "/carteira", label: "Carteira" },
  { href: "/disponivel", label: "Disponível" },
  { href: "/oportunidades", label: "Oportunidades" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppHeader({ nome, perfil, rotaAtiva }: Props) {
  const iniciais = nome
    .split(" ")
    .map((p: string) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const isAdmin = perfil === "admin";
  const perfilLabel = ehPerfilValido(perfil) ? PERFIL_LABEL[perfil] : perfil;

  // Filtra a navegação principal pelas permissões do perfil
  const navVisivel = NAV.filter((item) => temAcesso(perfil, item.href));

  return (
    <header className="bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/">
            <LogoConfiance className="h-9 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navVisivel.map((item) => {
              const ativo = rotaAtiva === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "px-3 py-1.5 text-xs uppercase tracking-wider rounded-md transition " +
                    (ativo
                      ? "bg-[#1F2C4E] text-white font-semibold"
                      : "text-[#706F6F] hover:text-[#1F2C4E] hover:bg-slate-50")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <GearMenu rotaAtiva={rotaAtiva} />}
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-[#1F2C4E]">{nome}</div>
            <div className="text-xs uppercase tracking-wider text-[#706F6F]">
              {perfilLabel}
            </div>
          </div>
          <span className="w-9 h-9 rounded-full bg-[#E6F9FC] text-[#1E9DBA] flex items-center justify-center font-bold text-sm">
            {iniciais}
          </span>
          <LogoutButton />
        </div>
      </div>
      <div className="brand-gradient h-1"></div>
    </header>
  );
}
