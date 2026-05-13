"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  label: string; // ex.: "oportunidades"
  descricaoAcao: string; // ex.: "todas as oportunidades e itens"
  action: () => Promise<{ ok: boolean; error?: string }>;
};

export function BotaoLimparTudo({ label, descricaoAcao, action }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const palavraConfirmacao = "LIMPAR";

  function executar() {
    if (confirmacao !== palavraConfirmacao) {
      setErro(`Digite "${palavraConfirmacao}" exatamente pra confirmar.`);
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setErro(res.error || "Erro ao limpar dados");
        return;
      }
      setAberto(false);
      setConfirmacao("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          setConfirmacao("");
          setErro(null);
        }}
        className="bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 text-rose-700 font-semibold uppercase tracking-wider text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
        title={`Limpar ${descricaoAcao} (admin)`}
      >
        🗑 Limpar tudo
      </button>

      {aberto && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm uppercase tracking-widest font-bold text-rose-700">
                ⚠ Limpar {label}
              </h2>
              <p className="text-xs text-[#706F6F] mt-1">
                Essa ação apaga <b>{descricaoAcao}</b> e <b>não pode ser desfeita</b>.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <label className="text-xs text-[#1F2C4E] font-semibold">
                Digite <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{palavraConfirmacao}</span> pra confirmar:
              </label>
              <input
                type="text"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value.toUpperCase())}
                placeholder={palavraConfirmacao}
                disabled={pending}
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-rose-400 focus:bg-white"
              />
              {erro && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded px-3 py-2 text-xs">
                  {erro}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAberto(false)}
                disabled={pending}
                className="text-xs uppercase tracking-wider font-semibold text-[#706F6F] hover:text-[#1F2C4E] px-3 py-2 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executar}
                disabled={pending || confirmacao !== palavraConfirmacao}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? "Limpando…" : "Limpar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
