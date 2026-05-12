"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { PERFIL_LABEL } from "@/lib/permissoes";
import { criarOportunidade } from "./actions";
import { UFS, UF_NOME, diasTransporteDoUF } from "@/lib/transporte";

const STORAGE_KEY = "confirma:novaopp:preenchido";

type DadosImportados = {
  cliente?: string;
  nome?: string;
  owner?: string;
  valor?: number;
  data_fechamento?: string | null;
  regiao?: string;
  itens?: Array<{
    sku_codigo: string;
    derivacao: string;
    descricao: string;
    quantidade: number;
  }>;
};

export type OwnerOption = {
  nome: string;
  perfil: string;
};

export type SKUOption = {
  codigo: string;
  descricao: string;
  eh_servico: boolean | null;
};

type Item = {
  id: string;
  sku_codigo: string;
  derivacao: string;
  descricao: string;
  quantidade: string;
};

function gerarId() {
  return Math.random().toString(36).slice(2, 10);
}

function itemVazio(): Item {
  return {
    id: gerarId(),
    sku_codigo: "",
    derivacao: "",
    descricao: "",
    quantidade: "1",
  };
}

export function NovaOportunidadeForm({
  owners,
  ownerPadrao,
  skus,
}: {
  owners: OwnerOption[];
  ownerPadrao: string;
  skus: SKUOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<Item[]>([itemVazio()]);
  const formRef = useRef<HTMLFormElement>(null);
  const [importBanner, setImportBanner] = useState<string | null>(null);

  // Se houver dados importados do PDF no localStorage, preenche o formulário
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const dados: DadosImportados = JSON.parse(raw);
      localStorage.removeItem(STORAGE_KEY);

      // Preenche os campos do form via DOM (acessamos via refs)
      setTimeout(() => {
        const f = formRef.current;
        if (!f) return;
        const setVal = (name: string, value: string) => {
          const el = f.elements.namedItem(name) as
            | HTMLInputElement
            | HTMLSelectElement
            | null;
          if (el) el.value = value;
        };
        if (dados.cliente) setVal("cliente", dados.cliente);
        if (dados.nome) setVal("nome", dados.nome);
        if (dados.owner) {
          // só preenche se o owner está dentre as opções
          const ownersDisponiveis = owners.map((o) => o.nome);
          if (ownersDisponiveis.includes(dados.owner)) {
            setVal("owner", dados.owner);
          }
        }
        if (dados.regiao) setVal("regiao", dados.regiao);
        if (dados.valor != null && dados.valor > 0) {
          setVal(
            "valor",
            dados.valor.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          );
        }
        if (dados.data_fechamento) setVal("data_fechamento", dados.data_fechamento);
      }, 50);

      // Preenche os itens via state React
      if (dados.itens && dados.itens.length > 0) {
        setItens(
          dados.itens.map((it) => ({
            id: gerarId(),
            sku_codigo: it.sku_codigo || "",
            derivacao: it.derivacao || "",
            descricao: it.descricao || "",
            quantidade: String(it.quantidade || 1),
          }))
        );
      }

      setImportBanner(
        `Campos do PDF preenchidos · ${dados.itens?.length || 0} item(ns) detectado(s). Confira e ajuste antes de salvar.`
      );
    } catch {
      // ignora erro de parse
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mapa código → descrição para autocomplete reverso
  const descPorCodigo: Record<string, string> = {};
  skus.forEach((s) => {
    descPorCodigo[s.codigo] = s.descricao;
  });

  function adicionarItem() {
    setItens((arr) => [...arr, itemVazio()]);
  }

  function removerItem(id: string) {
    setItens((arr) => (arr.length === 1 ? arr : arr.filter((it) => it.id !== id)));
  }

  function atualizarItem(id: string, campo: keyof Item, valor: string) {
    setItens((arr) =>
      arr.map((it) => {
        if (it.id !== id) return it;
        const novo = { ...it, [campo]: valor };
        // Se atualizou SKU código e a descrição está vazia, sugere descrição
        if (
          campo === "sku_codigo" &&
          !it.descricao &&
          descPorCodigo[valor.toUpperCase()]
        ) {
          novo.descricao = descPorCodigo[valor.toUpperCase()];
        }
        return novo;
      })
    );
  }

  function handleSubmit(form: FormData) {
    setErro(null);
    const itensValidos = itens
      .filter(
        (it) =>
          (it.descricao && it.descricao.trim()) ||
          (it.sku_codigo && it.sku_codigo.trim())
      )
      .map((it) => ({
        sku_codigo: it.sku_codigo.trim().toUpperCase() || "SEM-SKU",
        derivacao: it.derivacao.trim() || null,
        descricao:
          it.descricao.trim() ||
          (it.sku_codigo && descPorCodigo[it.sku_codigo.trim().toUpperCase()]) ||
          "",
        quantidade: Number(it.quantidade) || 1,
      }));
    if (itensValidos.length === 0) {
      setErro("Adicione pelo menos um item com descrição");
      return;
    }
    form.set("itens_json", JSON.stringify(itensValidos));

    startTransition(async () => {
      const r = await criarOportunidade(form);
      // Se chegou aqui sem redirect, é porque deu erro (redirect interrompe o fluxo)
      if (r && !r.ok) setErro(r.error || "Erro ao criar oportunidade");
    });
  }

  return (
    <>
      <datalist id="skus-codigos-novaopp">
        {skus.map((s) => (
          <option key={s.codigo} value={s.codigo}>
            {s.descricao}
          </option>
        ))}
      </datalist>

      <form ref={formRef} action={handleSubmit} className="space-y-6">
        {importBanner && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-2 text-sm">
            ✓ {importBanner}
          </div>
        )}
        {/* Cabeçalho */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
            Cabeçalho
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="text-xs text-[#706F6F] block mb-1">
                Cliente *
              </label>
              <input
                name="cliente"
                type="text"
                required
                placeholder="ex: MOGAMI"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
              />
            </div>
            <div className="md:col-span-6">
              <label className="text-xs text-[#706F6F] block mb-1">
                Nome da oportunidade *
              </label>
              <input
                name="nome"
                type="text"
                required
                placeholder="ex: MOGAMI - SET SCAM3"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
              />
            </div>
            <div className="md:col-span-4">
              <label className="text-xs text-[#706F6F] block mb-1">Owner *</label>
              <select
                name="owner"
                required
                defaultValue={ownerPadrao}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
              >
                {owners.map((o) => (
                  <option key={o.nome} value={o.nome}>
                    {o.nome}{" "}
                    {o.perfil ? `(${(PERFIL_LABEL as Record<string, string>)[o.perfil] || o.perfil})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-[#706F6F] block mb-1">Fase</label>
              <select
                name="fase"
                defaultValue="Commit"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
              >
                <option value="Commit">Commit</option>
                <option value="Melhor Cenário">Melhor Cenário</option>
                <option value="POC (demonstração)">POC (demonstração)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[#706F6F] block mb-1">UF *</label>
              <select
                name="regiao"
                required
                defaultValue=""
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {UFS.map((uf) => {
                  const dias = diasTransporteDoUF(uf);
                  return (
                    <option key={uf} value={uf}>
                      {uf} — {UF_NOME[uf]} ({dias}d)
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-[#706F6F] block mb-1">Record type</label>
              <select
                name="record_type"
                defaultValue="Vendas Privadas"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
              >
                <option value="Vendas Privadas">Vendas Privadas</option>
                <option value="Vendas Públicas">Vendas Públicas</option>
                <option value="Distribuidor">Distribuidor</option>
              </select>
            </div>
            <div className="md:col-span-6">
              <label className="text-xs text-[#706F6F] block mb-1">
                Valor total (R$)
              </label>
              <input
                name="valor"
                type="text"
                placeholder="213.613,00"
                inputMode="decimal"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
              />
            </div>
            <div className="md:col-span-6">
              <label className="text-xs text-[#706F6F] block mb-1">
                Data de fechamento prevista
              </label>
              <input
                name="data_fechamento"
                type="date"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
              />
            </div>
          </div>
        </section>

        {/* Itens */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-baseline justify-between">
            <div>
              <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
                Itens
              </h2>
              <p className="text-xs text-[#706F6F] mt-0.5">
                Adicione cada produto da proposta. O SKU é opcional — se
                preencher e bater com o cadastro, o motor de prazo encaixa
                automaticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={adicionarItem}
              className="bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold uppercase tracking-wider text-xs px-3 py-2 rounded-lg"
            >
              + Item
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
              <tr>
                <th className="text-left py-2 px-3 font-semibold w-32">SKU</th>
                <th className="text-left py-2 px-3 font-semibold w-20">
                  Deriv.
                </th>
                <th className="text-left py-2 px-3 font-semibold">Descrição</th>
                <th className="text-right py-2 px-3 font-semibold w-20">Qtd</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((it, idx) => (
                <tr key={it.id}>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      list="skus-codigos-novaopp"
                      value={it.sku_codigo}
                      onChange={(e) =>
                        atualizarItem(it.id, "sku_codigo", e.target.value)
                      }
                      placeholder="ex: MNT0017"
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono uppercase focus:outline-none focus:border-[#64C3D1]"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={it.derivacao}
                      onChange={(e) =>
                        atualizarItem(it.id, "derivacao", e.target.value)
                      }
                      placeholder="opcional"
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#64C3D1]"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={it.descricao}
                      onChange={(e) =>
                        atualizarItem(it.id, "descricao", e.target.value)
                      }
                      placeholder="ex: MONITOR LED 32&quot; 4K"
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#64C3D1]"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={it.quantidade}
                      onChange={(e) =>
                        atualizarItem(it.id, "quantidade", e.target.value)
                      }
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm text-right focus:outline-none focus:border-[#64C3D1]"
                    />
                  </td>
                  <td className="py-2 px-2 text-right">
                    {itens.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerItem(it.id)}
                        title="Remover"
                        className="text-rose-700 hover:text-rose-900 px-2 py-1"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {erro && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2 text-sm">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <a
            href="/oportunidades"
            className="text-xs uppercase tracking-wider font-semibold text-[#706F6F] hover:text-[#1F2C4E] px-4 py-3 rounded-lg hover:bg-slate-100"
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wide text-sm px-6 py-3 rounded-xl disabled:opacity-50"
          >
            {isPending ? "Criando…" : "Criar oportunidade"}
          </button>
        </div>
      </form>
    </>
  );
}
