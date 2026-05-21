"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

type NavItem = { href: string; label: string };

export function MobileNavMenu({
  itens,
  rotaAtiva,
}: {
  itens: NavItem[];
  rotaAtiva?: string;
}) {
  const [aberto, setAberto] = useState(false);

  // Trava scroll do body quando o drawer está aberto
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (aberto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-slate-100 text-[#1F2C4E]"
      >
        {aberto ? (
          // X
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          // hamburger
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {aberto && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setAberto(false)}
            className="md:hidden fixed inset-0 bg-black/30 z-40"
            aria-hidden="true"
          />
          {/* Painel */}
          <div
            className="md:hidden fixed top-[64px] left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50 max-h-[calc(100vh-64px)] overflow-y-auto"
            role="dialog"
            aria-label="Menu de navegação"
          >
            <nav className="flex flex-col py-2">
              {itens.map((item) => {
                const ativo = rotaAtiva === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAberto(false)}
                    className={
                      "px-6 py-3 text-sm uppercase tracking-wider border-l-4 transition " +
                      (ativo
                        ? "bg-[#E6F9FC] text-[#1F2C4E] font-bold border-[#1F2C4E]"
                        : "text-[#1F2C4E] hover:bg-slate-50 border-transparent")
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
