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

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center py-16">
        <div className="inline-flex w-14 h-14 rounded-xl bg-[#0F2F4A] text-white items-center justify-center font-bold text-2xl mb-4">
          C
        </div>
        <h1 className="text-3xl font-semibold text-slate-900">Confirma</h1>
        <p className="text-sm text-slate-600 mt-1">
          Confiance Medical · Promessa de Prazo
        </p>

        <div className="mt-10 bg-white border border-slate-200 rounded-xl p-6 text-left shadow-sm">
          <div className="inline-flex items-center gap-2 text-emerald-700 text-xs font-medium mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Projeto iniciado · em desenvolvimento
          </div>
          <h2 className="text-base font-semibold mb-2">Status do setup</h2>
          <ul className="text-sm text-slate-700 space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span> Next.js rodando
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span> Tailwind configurado
            </li>
            <li className="flex items-center gap-2">
              {supabaseStatus === "ok" ? (
                <>
                  <span className="text-emerald-600">✓</span> Conexão Supabase: ok
                </>
              ) : (
                <>
                  <span className="text-rose-600">✗</span> Supabase: {mensagem || "erro"}
                </>
              )}
            </li>
            <li className="flex items-center gap-2 text-slate-400">
              <span>○</span> GitHub · próximo passo
            </li>
            <li className="flex items-center gap-2 text-slate-400">
              <span>○</span> Deploy Netlify · em seguida
            </li>
          </ul>
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div>Stack: Next.js + Tailwind + Supabase</div>
            <div>Hospedagem: Netlify (pendente)</div>
            <div>Versão: 0.0.2 · conexão Supabase</div>
          </div>
        </div>
      </div>
    </main>
  );
}
