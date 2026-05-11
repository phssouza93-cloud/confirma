"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aceitarConvite } from "../../configuracoes/usuarios/actions";

export function ConviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function handleSubmit(form: FormData) {
    setErro(null);
    startTransition(async () => {
      const r = await aceitarConvite(form);
      if (!r.ok) {
        setErro(r.error || "Erro ao ativar convite");
        return;
      }
      setSucesso(true);
      setTimeout(() => router.push("/login?ok=conta_criada"), 1500);
    });
  }

  if (sucesso) {
    return (
      <div className="text-center py-4">
        <div className="text-emerald-700 font-bold text-lg mb-2">
          ✓ Conta criada
        </div>
        <p className="text-sm text-[#706F6F]">
          Redirecionando para o login…
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="block text-xs font-semibold text-[#1F2C4E] mb-1.5 uppercase tracking-wide">
          Senha
        </label>
        <input
          type="password"
          name="senha"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="mínimo 8 caracteres"
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#1F2C4E] mb-1.5 uppercase tracking-wide">
          Confirmar senha
        </label>
        <input
          type="password"
          name="confirma"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
        />
      </div>
      {erro && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-xs">
          {erro}
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold uppercase tracking-wider text-sm py-3 rounded-lg disabled:opacity-50"
      >
        {isPending ? "Criando conta…" : "Criar conta e entrar"}
      </button>
    </form>
  );
}
