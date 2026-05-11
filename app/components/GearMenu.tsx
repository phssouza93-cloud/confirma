"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  rotaAtiva?: string;
};

type Item = { href: string; label: string; descricao?: string };

const ITEMS: Item[] = [
  {
    href: "/configuracoes/usuarios",
    label: "Usuários",
    descricao: "Convidar e gerenciar acessos",
  },
  {
    href: "/admin/aliases",
    label: "Aliases",
    descricao: "Mapeamento descrição → SKU",
  },
  {
    href: "/admin/orfaos",
    label: "Itens órfãos",
    descricao: "Descrições sem match",
  },
];

export function GearMenu({ rotaAtiva }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha quando clica fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const algumAtivo = ITEMS.some(
    (i) => rotaAtiva && rotaAtiva.startsWith(i.href)
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "w-9 h-9 rounded-lg flex items-center justify-center transition " +
          (algumAtivo
            ? "bg-[#1F2C4E] text-white"
            : "text-[#706F6F] hover:text-[#1F2C4E] hover:bg-slate-50")
        }
        title="Configurações"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <GearIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-xs uppercase tracking-widest font-bold text-[#1F2C4E]">
              Configurações
            </div>
            <div className="text-xs text-[#706F6F] mt-0.5">
              Acesso restrito · admin
            </div>
          </div>
          <nav className="py-1">
            {ITEMS.map((it) => {
              const ativo = rotaAtiva && rotaAtiva.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={
                    "block px-4 py-2 hover:bg-slate-50 transition " +
                    (ativo ? "bg-[#E6F9FC]" : "")
                  }
                >
                  <div
                    className={
                      "text-sm font-semibold " +
                      (ativo ? "text-[#1E9DBA]" : "text-[#1F2C4E]")
                    }
                  >
                    {it.label}
                  </div>
                  {it.descricao && (
                    <div className="text-xs text-[#706F6F]">
                      {it.descricao}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
