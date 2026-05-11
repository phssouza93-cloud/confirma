import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let supabaseStatus: "ok" | "erro" = "erro";
  let mensagem = "";
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();
    if (error) {
      mensagem = error.message;
    } else {
      supabaseStatus = "ok";
    }
  } catch (e) {
    mensagem = e instanceof Error ? e.message : String(e);
  }

  const status = [
    { ok: true, label: "Next.js rodando" },
    { ok: true, label: "Tailwind configurado" },
    {
      ok: supabaseStatus === "ok",
      label:
        supabaseStatus === "ok"
          ? "Conexão Supabase: ok"
          : `Supabase: ${mensagem || "erro"}`,
    },
    { ok: true, label: "GitHub conectado" },
    { ok: true, label: "Deploy Netlify ativo" },
  ];

  return (
    <main className="flex-1 flex flex-col">
      {/* Header com logo */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Image
            src="https://confiancemedical.com.br/wp-content/uploads/2025/11/logo-horizontal-completo.png"
            alt="Confiance Medical"
            width={220}
            height={56}
            priority
            className="h-10 w-auto"
          />
          <div className="text-xs uppercase tracking-widest text-[#706F6F] font-[var(--font-montserrat)]">
            Promessa de Prazo
          </div>
        </div>
      </header>

      {/* Faixa do degradê oficial da marca */}
      <div className="brand-gradient h-1"></div>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-3">
              Plataforma interna
            </p>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-[#1F2C4E] uppercase leading-tight">
              Confirma
            </h1>
            <p className="mt-4 text-lg text-[#706F6F] max-w-xl mx-auto">
              Transforme cada negociação em uma promessa de prazo confiável,
              lastreada em estoque, carteira e produção em tempo real.
            </p>
          </div>

          {/* Cartão de status */}
          <div className="bg-white border border-[#E6F9FC] rounded-2xl shadow-sm overflow-hidden">
            <div className="brand-gradient h-1"></div>
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
                    Status do setup
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">
                    Infraestrutura em produção
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F9FC] text-[#1E9DBA] text-xs font-semibold uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1E9DBA]"></span>
                  v0.0.3
                </span>
              </div>

              <ul className="space-y-3">
                {status.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    {s.ok ? (
                      <span className="w-6 h-6 rounded-full bg-[#E6F9FC] text-[#1E9DBA] flex items-center justify-center flex-shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </span>
                    )}
                    <span className={s.ok ? "text-[#1F2C4E]" : "text-red-700"}>
                      {s.label}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-[#706F6F] uppercase tracking-wider font-semibold mb-1">
                    Stack
                  </div>
                  <div className="text-[#1F2C4E]">
                    Next.js · Tailwind · Supabase
                  </div>
                </div>
                <div>
                  <div className="text-[#706F6F] uppercase tracking-wider font-semibold mb-1">
                    Hospedagem
                  </div>
                  <div className="text-[#1F2C4E]">Netlify</div>
                </div>
                <div>
                  <div className="text-[#706F6F] uppercase tracking-wider font-semibold mb-1">
                    Próxima entrega
                  </div>
                  <div className="text-[#1F2C4E]">
                    Autenticação + telas do app
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-[#706F6F]">
            #PorUmMundoSemCicatriz
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-5 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-[#706F6F]">
          <span>
            © {new Date().getFullYear()} Confiance Medical · Todos os direitos
            reservados
          </span>
          <span className="hidden sm:inline">Versão protótipo · em desenvolvimento</span>
        </div>
      </footer>
    </main>
  );
}
