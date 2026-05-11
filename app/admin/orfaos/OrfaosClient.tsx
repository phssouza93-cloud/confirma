"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarAlias } from "../aliases/actions";

export type OrfaoRow = {
  descricao: string;
  sku_codigo_original: string;
  qtd_total: number;
  ocorrencias: number;
  oportunidades: string[];
};

export type SKUOption = {
  codigo: string;
  descricao: string;
  eh_servico: boolean | null;
};

function normalizar(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function OrfaosClient({
  orfaos,
  skus,
}: {
  orfaos: OrfaoRow[];
  skus: SKUOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return orfaos;
    return orfaos.filter((o) =>
      normalizar(`${o.descricao} ${o.sku_codigo_original}`).includes(q)
    );
  }, [orfaos, busca]);

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
    }, 4500);
  }

  function handleCriar(form: FormData) {
    startTransition(async () => {
      const r = await criarAlias(form);
      if (!r.ok) return feedback(r.error || "Erro ao criar alias", false);
      feedback("Alias criado · descrição saiu da lista de órfãos", true);
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <>
      {sucesso && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-2 text-sm">
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2 text-sm">
          {erro}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nos órfãos…"
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
        />
      </div>

      <datalist id="skus-list-orfaos">
        {skus.map((s) => (
          <option key={s.codigo} value={s.codigo}>
            {s.descricao}
          </option>
        ))}
      </datalist>

      {filtrados.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
          <div className="text-emerald-700 font-bold text-lg mb-1">
            ✓ Nenhum item órfão
          </div>
          <p className="text-sm text-emerald-800/80">
            {orfaos.length === 0
              ? "Todos os itens das oportunidades estão casando com SKU ou alias."
              : "Nenhum órfão bate com a busca atual."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((o) => (
            <div
              key={o.descricao}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
            >
              <div className="p-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 items-center mb-1">
                    <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                      {o.sku_codigo_original || "sem código"}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-semibold uppercase tracking-wide">
                      Órfão
                    </span>
                    <span className="text-xs text-[#706F6F]">
                      {o.ocorrencias} oportunidade
                      {o.ocorrencias === 1 ? "" : "s"} · {o.qtd_total} unid.
                    </span>
                  </div>
                  <div className="text-base font-semibold text-[#1F2C4E] break-words">
                    {o.descricao}
                  </div>
                  {o.oportunidades.length > 0 && (
                    <div className="text-xs text-[#706F6F] mt-1">
                      em: {o.oportunidades.slice(0, 3).join(" · ")}
                      {o.oportunidades.length > 3 &&
                        ` (+${o.oportunidades.length - 3})`}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditing(editing === o.descricao ? null : o.descricao)
                  }
                  className="bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold uppercase tracking-wider text-xs px-3 py-2 rounded-lg whitespace-nowrap"
                >
                  {editing === o.descricao ? "Cancelar" : "+ Criar alias"}
                </button>
              </div>
              {editing === o.descricao && (
                <form
                  action={handleCriar}
                  className="bg-[#E6F9FC] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                >
                  <input
                    type="hidden"
                    name="descricao_alias"
                    value={o.descricao}
                  />
                  <div className="md:col-span-7">
                    <label className="text-[10px] uppercase tracking-wider text-[#706F6F] block mb-1">
                      Descrição (do órfão — bloqueada)
                    </label>
                    <input
                      type="text"
                      value={o.descricao}
                      disabled
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-[#706F6F]"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-[10px] uppercase tracking-wider text-[#706F6F] block mb-1">
                      SKU correto
                    </label>
                    <input
                      name="sku_codigo"
                      type="text"
                      required
                      list="skus-list-orfaos"
                      placeholder="ex: CAM0004"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-[#64C3D1]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase tracking-wider text-[#706F6F] block mb-1">
                      Derivação
                    </label>
                    <input
                      name="derivacao"
                      type="text"
                      placeholder="opcional"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#64C3D1]"
                    />
                  </div>
                  <div className="md:col-span-12 flex justify-end">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      {isPending ? "Criando…" : "Criar alias"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
