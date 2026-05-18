"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarPrazoNegociado } from "./actions";

type Props = {
  opp_id: string;
  valorInicial: number | null;
  menorPrazo: number | null;
  bloqueado?: boolean;
};

export function PrazoNegociadoBox({
  opp_id,
  valorInicial,
  menorPrazo,
  bloqueado,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [valor, setValor] = useState<string>(
    valorInicial != null ? String(valorInicial) : ""
  );
  const [valorInicialAnterior, setValorInicialAnterior] = useState(valorInicial);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (valorInicial !== valorInicialAnterior) {
    setValorInicialAnterior(valorInicial);
    setValor(valorInicial != null ? String(valorInicial) : "");
  }

  function salvar() {
    setErro(null);
    setSalvo(false);
    const num = valor.trim() === "" ? null : Number(valor);
    if (num != null && (Number.isNaN(num) || num < 0 || num > 999)) {
      setErro("Informe um número de 0 a 999");
      return;
    }
    startTransition(async () => {
      const r = await salvarPrazoNegociado(opp_id, num);
      if (!r.ok) {
        setErro(r.error || "Erro ao salvar");
        return;
      }
      setSalvo(true);
      router.refresh();
      setTimeout(() => setSalvo(false), 2500);
    });
  }

  const sugestao =
    menorPrazo != null && valor.trim() === ""
      ? `Sugerido: ${menorPrazo}d (menor prazo de liberação)`
      : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="text-xs uppercase tracking-widest opacity-80 mb-2 text-[#1F2C4E] font-bold">
        Prazo de liberação negociado
      </div>
      <p className="text-xs text-[#706F6F] mb-3 leading-relaxed">
        Prazo (em dias corridos) que você combinou com o cliente. Quando você
        firmar, vai virar a <b>data de promessa</b> na Carteira.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={999}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          disabled={isPending || bloqueado}
          placeholder={menorPrazo != null ? String(menorPrazo) : "ex: 30"}
          className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-2xl font-bold text-[#1F2C4E] text-center focus:outline-none focus:border-[#64C3D1] focus:bg-white disabled:opacity-50"
        />
        <span className="text-sm text-[#706F6F]">dias corridos</span>
      </div>
      {sugestao && (
        <div className="text-xs text-[#326A84] mt-2">{sugestao}</div>
      )}
      {salvo && (
        <div className="text-xs text-emerald-700 mt-2 font-semibold">
          ✓ Prazo salvo
        </div>
      )}
      {erro && (
        <div className="text-xs text-rose-700 mt-2">{erro}</div>
      )}
      {bloqueado && (
        <div className="text-xs text-[#706F6F] mt-2 italic">
          Oportunidade já firmada · prazo não editável
        </div>
      )}
    </div>
  );
}
