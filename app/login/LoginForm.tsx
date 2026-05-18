"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "./actions";

const DEVICE_KEY = "confirma:device_id";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    // UUID v4 simples
    id =
      "dev-" +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2) +
      "-" +
      Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function LoginForm({ erroInicial }: { erroInicial?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(erroInicial || null);
  const [pending, startTransition] = useTransition();
  // Lazy init: roda só 1x no primeiro render. Guard pra SSR (sem window).
  const [deviceId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return getOrCreateDeviceId();
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!email || !senha) {
      setErro("Preencha email e senha");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("senha", senha);
      fd.set("device_id", deviceId);
      fd.set(
        "user_agent",
        typeof navigator !== "undefined" ? navigator.userAgent : ""
      );
      const res = await loginAction(fd);
      if (res && !res.ok) {
        setErro(res.error || "Erro ao entrar");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[#1F2C4E] mb-1.5 uppercase tracking-wide">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="voce@confiancemedical.com.br"
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#326A84] focus:ring-2 focus:ring-[#64C3D1]/30 outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#1F2C4E] mb-1.5 uppercase tracking-wide">
          Senha
        </label>
        <div className="relative">
          <input
            type={mostrarSenha ? "text" : "password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••••••"
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
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-800">
          {erro}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold py-2.5 rounded-lg uppercase tracking-wide text-sm transition disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
