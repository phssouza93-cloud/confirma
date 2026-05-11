"use client";

import { useState, useTransition } from "react";
import { atualizarLeadTime } from "./actions";

type Props = {
  codigo: string;
  valorInicial: number | null;
};

export function LeadTimeInput({ codigo, valorInicial }: Props) {
  const [valor, setValor] = useState<string>(
    valorInicial == null ? "" : String(valorInicial)
  );
  const [pending, startTransition] = useTransition();
  const [salvouFlash, setSalvouFlash] = useState(false);

  function salvar(novo: string) {
    const trimmed = novo.trim();
    const novoValor: number | null = trimmed === "" ? null : Number(trimmed);
    if (novoValor != null && (isNaN(novoValor) || novoValor < 0)) return;
    if (novoValor === valorInicial) return; // não mudou
    startTransition(async () => {
      const res = await atualizarLeadTime(codigo, novoValor);
      if (res.ok) {
        setSalvouFlash(true);
        setTimeout(() => setSalvouFlash(false), 1500);
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        value={valor}
        min={0}
        placeholder="—"
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => salvar(valor)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={
          "w-14 text-right border rounded px-1.5 py-0.5 text-xs outline-none focus:border-[#326A84] focus:ring-2 focus:ring-[#64C3D1]/30 " +
          (salvouFlash
            ? "border-emerald-400 bg-emerald-50"
            : valor === ""
            ? "border-slate-200 bg-slate-50 text-slate-400"
            : "border-slate-200")
        }
        disabled={pending}
      />
      <span className="text-xs text-[#706F6F]">d</span>
    </div>
  );
}
