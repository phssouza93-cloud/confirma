"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  criarAlias,
  atualizarAlias,
  deletarAlias,
} from "./actions";

export type AliasRow = {
  id: string;
  descricao_alias: string;
  sku_codigo: string;
  derivacao: string | null;
  updated_at: string | null;
};

export type SKUOption = {
  codigo: string;
  descricao: string;
  eh_servico: boolean | null;
};

function fmtData(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function normalizar(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function AliasesClient({
  aliases,
  skus,
}: {
  aliases: AliasRow[];
  skus: SKUOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [showNovo, setShowNovo] = useState(false);

  // Mapa código → descrição para mostrar contexto na lista
  const skuMap = useMemo(() => {
    const m: Record<string, SKUOption> = {};
    skus.forEach((s) => {
      m[s.codigo] = s;
    });
    return m;
  }, [skus]);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return aliases;
    return aliases.filter((a) => {
      const sku = skuMap[a.sku_codigo];
      const blob = normalizar(
        `${a.descricao_alias} ${a.sku_codigo} ${a.derivacao || ""} ${
          sku?.descricao || ""
        }`
      );
      return blob.includes(q);
    });
  }, [aliases, busca, skuMap]);

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
      feedback("Alias criado com sucesso", true);
      setShowNovo(false);
      router.refresh();
    });
  }

  function handleSalvar(form: FormData) {
    startTransition(async () => {
      const r = await atualizarAlias(form);
      if (!r.ok) return feedback(r.error || "Erro ao salvar", false);
      feedback("Alias atualizado", true);
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDeletar(id: string, descricao: string) {
    const ok = window.confirm(
      `Apagar o alias para "${descricao}"?\n\nDescrições com esse texto voltarão a não casar com nenhum SKU.`
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await deletarAlias(id);
      if (!r.ok) return feedback(r.error || "Erro ao deletar", false);
      feedback("Alias removido", true);
      router.refresh();
    });
  }

  return (
    <>
      {/* feedback */}
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

      {/* filtros + botão */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição, SKU ou derivação…"
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
        />
        <button
          type="button"
          onClick={() => {
            setShowNovo((v) => !v);
            setEditingId(null);
          }}
          className="bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg transition"
        >
          {showNovo ? "Cancelar" : "+ Novo alias"}
        </button>
      </div>

      {/* form novo */}
      {showNovo && (
        <form
          action={handleCriar}
          className="bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-2xl p-4 space-y-3"
        >
          <div className="text-xs uppercase tracking-wider text-[#1F2C4E] font-semibold">
            Novo alias
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="text-xs text-[#706F6F] block mb-1">
                Descrição (como vem da oportunidade)
              </label>
              <input
                name="descricao_alias"
                type="text"
                required
                placeholder="ex: MICROCÂMERA DIGITAL SCAM 4K"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1]"
              />
            </div>
            <div className="md:col-span-4">
              <label className="text-xs text-[#706F6F] block mb-1">
                SKU código
              </label>
              <input
                name="sku_codigo"
                type="text"
                required
                list="skus-list"
                placeholder="ex: CAM0004"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-[#64C3D1]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[#706F6F] block mb-1">
                Derivação
              </label>
              <input
                name="derivacao"
                type="text"
                placeholder="opcional"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#64C3D1]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNovo(false)}
              className="text-xs uppercase tracking-wider font-semibold text-[#706F6F] hover:text-[#1F2C4E] px-3 py-2 rounded-lg hover:bg-white"
            >
              Cancelar
            </button>
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

      {/* datalist com sugestões de SKU pra autocomplete */}
      <datalist id="skus-list">
        {skus.map((s) => (
          <option key={s.codigo} value={s.codigo}>
            {s.descricao}
          </option>
        ))}
      </datalist>

      {/* tabela */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
            Aliases cadastrados
          </h2>
          <div className="text-xs text-[#706F6F]">
            {filtrados.length} de {aliases.length}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
              <tr>
                <th className="text-left py-2 px-4 font-semibold">Descrição</th>
                <th className="text-left py-2 px-3 font-semibold">SKU</th>
                <th className="text-center py-2 px-2 font-semibold">Deriv.</th>
                <th className="text-left py-2 px-3 font-semibold">
                  SKU descrição
                </th>
                <th className="text-right py-2 px-3 font-semibold">
                  Atualizado
                </th>
                <th className="text-right py-2 px-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-[#706F6F]"
                  >
                    Nenhum alias bate com a busca.
                  </td>
                </tr>
              ) : (
                filtrados.map((a) => {
                  const sku = skuMap[a.sku_codigo];
                  if (editingId === a.id) {
                    return (
                      <tr key={a.id} className="bg-[#E6F9FC]/40">
                        <td colSpan={6} className="p-3">
                          <form
                            action={handleSalvar}
                            className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
                          >
                            <input type="hidden" name="id" value={a.id} />
                            <div className="md:col-span-5">
                              <label className="text-[10px] uppercase tracking-wider text-[#706F6F] block mb-1">
                                Descrição
                              </label>
                              <input
                                name="descricao_alias"
                                defaultValue={a.descricao_alias}
                                required
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#64C3D1]"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <label className="text-[10px] uppercase tracking-wider text-[#706F6F] block mb-1">
                                SKU
                              </label>
                              <input
                                name="sku_codigo"
                                defaultValue={a.sku_codigo}
                                required
                                list="skus-list"
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono uppercase focus:outline-none focus:border-[#64C3D1]"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-[10px] uppercase tracking-wider text-[#706F6F] block mb-1">
                                Deriv.
                              </label>
                              <input
                                name="derivacao"
                                defaultValue={a.derivacao || ""}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-[#64C3D1]"
                              />
                            </div>
                            <div className="md:col-span-2 flex gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-xs uppercase font-semibold text-[#706F6F] px-2 py-1.5 rounded-lg hover:bg-slate-100"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                disabled={isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold uppercase text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
                              >
                                Salvar
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-2 px-4 text-sm text-[#1F2C4E]">
                        {a.descricao_alias}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-[#1F2C4E]">
                        {a.sku_codigo}
                        {sku?.eh_servico && (
                          <span className="ml-1 text-[10px] uppercase tracking-wider text-slate-500">
                            svc
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-xs">
                        {a.derivacao || "—"}
                      </td>
                      <td className="py-2 px-3 text-xs text-[#706F6F]">
                        {sku?.descricao || (
                          <span className="text-rose-700">
                            ⚠ SKU não existe
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-xs text-[#706F6F]">
                        {fmtData(a.updated_at)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(a.id);
                              setShowNovo(false);
                            }}
                            className="text-xs uppercase font-semibold text-[#326A84] hover:text-[#1F2C4E] px-2 py-1 rounded hover:bg-slate-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeletar(a.id, a.descricao_alias)
                            }
                            className="text-xs uppercase font-semibold text-rose-700 hover:text-rose-900 px-2 py-1 rounded hover:bg-rose-50"
                          >
                            Apagar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
