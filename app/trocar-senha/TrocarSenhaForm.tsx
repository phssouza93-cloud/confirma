"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trocarMinhaSenha } from "../configuracoes/usuarios/actions";
import { validarSenhaForte, descreveRegrasSenha } from "@/lib/senha";

type Props = {
  obrigatorio: boolean;
  email: string;
};

export function TrocarSenhaForm({ obrigatorio, email }: Props) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirma, setMostrarConfirma] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [pending, startTransition] = useTransition();

  const validacao = validarSenhaForte(senha);
  const senhasIguais = senha === confirma && senha.length > 0;
  const podeSubmeter = validacao.ok && senhasIguais && !pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!validacao.ok) {
      setErro("Senha fraca: " + validacao.erros.join(", "));
      return;
    }
    if (!senhasIguais) {
      setErro("As senhas não coincidem");
      return;
    }
    startTransition(async () => {
      const res = await trocarMinhaSenha(senha);
      if (!res.ok) {
        setErro(res.error || "Erro ao trocar senha");
        return;
      }
      setSucesso(true);
      setTimeout(() => router.push("/"), 1500);
    });
  }

  if (sucesso) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">✓</div>
        <h2 className="text-lg font-bold text-emerald-700 mb-1">
          Senha alterada
        </h2>
        <p className="text-sm text-[#706F6F]">Redirecionando…</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E] mb-1">
        {obrigatorio ? "Criar senha pessoal" : "Trocar senha"}
      </h2>
      <p className="text-xs text-[#706F6F] mb-1">
        Logado como <b>{email}</b>
      </p>
      {obrigatorio && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 mt-2 mb-4">
          ⚠ Esta é sua primeira entrada (ou senha foi resetada). Crie uma senha
          pessoal antes de continuar.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className="block text-xs font-semibold text-[#1F2C4E] mb-1.5 uppercase tracking-wide">
            Nova senha
          </label>
          <div className="relative">
            <input
              type={mostrarSenha ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoFocus
              autoComplete="new-password"
              placeholder="Mín. 8 caracteres"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:border-[#326A84] focus:ring-2 focus:ring-[#64C3D1]/30 outline-none"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#706F6F] hover:text-[#1F2C4E] px-2 py-1 rounded"
              title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrarSenha ? "🙈" : "👁"}
            </button>
          </div>
          <ul className="mt-2 space-y-0.5 text-[11px] text-[#706F6F]">
            {descreveRegrasSenha().map((regra) => {
              const ok =
                senha.length > 0 &&
                !validacao.erros.some((e) =>
                  e.toLowerCase().includes(regra.toLowerCase().split(" ")[2] || "")
                );
              const realmenteOk =
                senha.length > 0 && !validacao.erros.some((e) => e === regra);
              return (
                <li
                  key={regra}
                  className={
                    realmenteOk
                      ? "text-emerald-700"
                      : senha.length > 0
                      ? "text-rose-700"
                      : ""
                  }
                >
                  {realmenteOk ? "✓" : "•"} {regra}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1F2C4E] mb-1.5 uppercase tracking-wide">
            Confirmar nova senha
          </label>
          <div className="relative">
            <input
              type={mostrarConfirma ? "text" : "password"}
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repita a senha"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:border-[#326A84] focus:ring-2 focus:ring-[#64C3D1]/30 outline-none"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setMostrarConfirma((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#706F6F] hover:text-[#1F2C4E] px-2 py-1 rounded"
              title={mostrarConfirma ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrarConfirma ? "🙈" : "👁"}
            </button>
          </div>
          {confirma.length > 0 && !senhasIguais && (
            <p className="mt-1 text-[11px] text-rose-700">
              As senhas não coincidem
            </p>
          )}
        </div>

        {erro && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-800">
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={!podeSubmeter}
          className="w-full bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold py-2.5 rounded-lg uppercase tracking-wide text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </>
  );
}
