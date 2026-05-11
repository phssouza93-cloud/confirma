"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { firmarOportunidade, reabrirOportunidade } from "./actions";

type Props = {
  opp_id: string;
  fase: string;
};

export function BotaoFirmar({ opp_id, fase }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const jaFirmada = fase === "Fechado";

  function handleFirmar() {
    const ok = window.confirm(
      "Firmar esta oportunidade?\n\n" +
        "→ Será criado um número de pedido na Carteira\n" +
        "→ O estoque disponível será abatido automaticamente\n" +
        "→ A oportunidade será marcada como Fechado"
    );
    if (!ok) return;
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      const r = await firmarOportunidade(opp_id);
      if (!r.ok) {
        setErro(r.error || "Erro ao firmar oportunidade");
        return;
      }
      setSucesso(
        `Pedido ${r.numero_pedido} criado · ${r.linhas_criadas} item(ns) na carteira`
      );
      router.refresh();
    });
  }

  function handleReabrir() {
    const ok = window.confirm(
      "Reabrir esta oportunidade?\n\n" +
        "→ As linhas dela serão removidas da Carteira\n" +
        "→ O estoque voltará a ficar disponível\n" +
        "→ A oportunidade voltará para Commit"
    );
    if (!ok) return;
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      const r = await reabrirOportunidade(opp_id);
      if (!r.ok) {
        setErro(r.error || "Erro ao reabrir oportunidade");
        return;
      }
      setSucesso("Oportunidade reaberta · linhas removidas da carteira");
      router.refresh();
    });
  }

  if (jaFirmada) {
    return (
      <div className="bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-full bg-[#1E9DBA] text-white flex items-center justify-center text-xs font-bold">
            ✓
          </span>
          <span className="text-sm font-bold text-[#1F2C4E] uppercase tracking-wide">
            Oportunidade firmada
          </span>
        </div>
        <p className="text-xs text-[#1F2C4E]/80 leading-relaxed mb-3">
          Já existe pedido aberto na <b>Carteira</b> com esses itens. O estoque
          disponível foi abatido.
        </p>
        <button
          type="button"
          onClick={handleReabrir}
          disabled={isPending}
          className="w-full text-xs uppercase tracking-wider font-semibold text-[#706F6F] hover:text-[#1F2C4E] px-3 py-2 rounded-lg border border-slate-200 hover:bg-white transition disabled:opacity-50"
        >
          {isPending ? "Reabrindo…" : "Reabrir oportunidade"}
        </button>
        {sucesso && (
          <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
            {sucesso}
          </div>
        )}
        {erro && (
          <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
            {erro}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold mb-2">
        Negociação fechou?
      </div>
      <button
        type="button"
        onClick={handleFirmar}
        disabled={isPending}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wide text-sm px-4 py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Firmando…" : "✓ Firmar com cliente"}
      </button>
      <p className="text-xs text-[#706F6F] mt-2 leading-relaxed">
        Cria pedido na <b>Carteira</b> e abate o estoque disponível
        automaticamente.
      </p>
      {sucesso && (
        <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
          {erro}
        </div>
      )}
    </div>
  );
}
