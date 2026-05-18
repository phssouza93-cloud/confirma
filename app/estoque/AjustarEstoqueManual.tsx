"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ajustarEstoqueDerivacao } from "./actions";

type SKUOption = {
  codigo: string;
  descricao: string;
};

export function AjustarEstoqueManual({ skus }: { skus: SKUOption[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function feedback(msg: string, ok: boolean) {
    if (ok) {
      setSucesso(msg);
      setErro(null);
    } else {
      setErro(msg);
      setSucesso(null);
    }
    setTimeout(() => {
      setSucesso(null);
      setErro(null);
    }, 5000);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = await ajustarEstoqueDerivacao(formData);
      if (!r.ok) {
        return feedback(r.error || "Erro ao ajustar estoque", false);
      }
      const sku = String(formData.get("sku_codigo") || "");
      const der = String(formData.get("derivacao") || "");
      const qtd = String(formData.get("qtd") || "0");
      feedback(
        `Estoque de ${sku}${der ? "·" + der : ""} ajustado para ${qtd}`,
        true
      );
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <>
        {sucesso && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
            {sucesso}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setAberto(true);
            setErro(null);
            setSucesso(null);
          }}
          className="bg-[#E6F9FC] hover:bg-[#64C3D1]/30 text-[#1F2C4E] font-semibold uppercase tracking-wider text-xs px-3 py-2 rounded-lg border border-[#64C3D1]/40"
          title="Ajustar manualmente a quantidade de uma derivação"
        >
          + Ajuste manual
        </button>
      </>
    );
  }

  return (
    <div className="w-full bg-[#E6F9FC]/60 border border-[#64C3D1]/40 rounded-2xl p-4 mt-3">
      <form action={handleSubmit} className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-xs uppercase tracking-wider font-bold text-[#1F2C4E]">
            Ajuste manual de estoque
          </div>
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="text-xs text-[#706F6F] hover:text-[#1F2C4E]"
          >
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="text-xs text-[#706F6F] block mb-1">SKU</label>
            <input
              name="sku_codigo"
              type="text"
              list="skus-codigos-estoque-manual"
              required
              placeholder="ex: CAM0006"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-[#64C3D1]"
            />
            <datalist id="skus-codigos-estoque-manual">
              {skus.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.descricao}
                </option>
              ))}
            </datalist>
          </div>
          <div className="md:col-span-3">
            <label className="text-xs text-[#706F6F] block mb-1">
              Derivação
            </label>
            <input
              name="derivacao"
              type="text"
              placeholder="018"
              maxLength={5}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#64C3D1]"
            />
          </div>
          <div className="md:col-span-4">
            <label className="text-xs text-[#706F6F] block mb-1">
              Quantidade nova (absoluta)
            </label>
            <input
              name="qtd"
              type="number"
              min="0"
              required
              defaultValue="0"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1]"
            />
          </div>
        </div>

        <p className="text-[11px] text-[#706F6F]">
          A quantidade informada <b>substitui</b> a atual (não soma). Para SKUs
          com derivações, informe a derivação específica — o total do SKU é
          recalculado automaticamente.
        </p>

        {erro && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-xs">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setAberto(false)}
            disabled={isPending}
            className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-[#706F6F] hover:text-[#1F2C4E] hover:bg-white rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {isPending ? "Salvando…" : "Aplicar ajuste"}
          </button>
        </div>
      </form>
    </div>
  );
}
