"use client";

import { useMemo, useState } from "react";

export type LinhaDisp = {
  sku_id: string;
  codigo: string;
  descricao: string;
  familia: string;
  derivacao: string | null;
  derivacao_label: string;
  estoque: number;
  carteira: number;
  disponivel: number;
  wip_proxima_qtd: number | null;
  wip_proxima_data: string | null;
  wip_total: number;
  lead_time: number | null;
  eh_servico: boolean;
};

type OrdemKey = "disponivel" | "codigo" | "descricao";

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

export function DisponivelClient({ linhas }: { linhas: LinhaDisp[] }) {
  const [busca, setBusca] = useState("");
  const [ocultarServicos, setOcultarServicos] = useState(true);
  const [ocultarZerado, setOcultarZerado] = useState(false);
  const [soComWip, setSoComWip] = useState(false);
  const [ordem, setOrdem] = useState<OrdemKey>("disponivel");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim());
    let arr = linhas.slice();
    if (ocultarServicos) arr = arr.filter((l) => !l.eh_servico);
    if (ocultarZerado) arr = arr.filter((l) => l.disponivel > 0);
    if (soComWip) arr = arr.filter((l) => l.wip_total > 0);
    if (q) {
      arr = arr.filter((l) => {
        const blob = normalizar(
          `${l.codigo} ${l.descricao} ${l.familia} ${l.derivacao_label}`
        );
        return blob.includes(q);
      });
    }
    arr.sort((a, b) => {
      let cmp = 0;
      if (ordem === "disponivel") cmp = a.disponivel - b.disponivel;
      else if (ordem === "codigo") cmp = a.codigo.localeCompare(b.codigo);
      else if (ordem === "descricao")
        cmp = a.descricao.localeCompare(b.descricao);
      if (cmp === 0)
        cmp = (a.derivacao_label || "").localeCompare(b.derivacao_label || "");
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [linhas, busca, ocultarServicos, ocultarZerado, soComWip, ordem, dir]);

  function toggleOrdem(novo: OrdemKey) {
    if (ordem === novo) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setOrdem(novo);
      // padrão: disponivel asc, demais asc
      setDir("asc");
    }
  }

  function indicador(col: OrdemKey) {
    if (ordem !== col) return "";
    return dir === "asc" ? " ↑" : " ↓";
  }

  return (
    <>
      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, descrição, família ou derivação…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] focus:bg-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#1F2C4E]">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ocultarServicos}
              onChange={(e) => setOcultarServicos(e.target.checked)}
              className="rounded"
            />
            Ocultar serviços
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ocultarZerado}
              onChange={(e) => setOcultarZerado(e.target.checked)}
              className="rounded"
            />
            Só com disponível
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={soComWip}
              onChange={(e) => setSoComWip(e.target.checked)}
              className="rounded"
            />
            Só com WIP previsto
          </label>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-baseline justify-between">
          <div>
            <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
              Disponível por SKU · derivação
            </h2>
            <p className="text-xs text-[#706F6F] mt-0.5">
              Clique no cabeçalho de uma coluna para ordenar. Linhas em vermelho
              estão zeradas ou vendidas.
            </p>
          </div>
          <div className="text-xs text-[#706F6F]">
            {filtradas.length} de {linhas.length}{" "}
            {linhas.length === 1 ? "linha" : "linhas"}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
              <tr>
                <th
                  className="text-left py-2 px-4 font-semibold cursor-pointer hover:text-[#1F2C4E]"
                  onClick={() => toggleOrdem("codigo")}
                >
                  SKU{indicador("codigo")}
                </th>
                <th
                  className="text-left py-2 px-4 font-semibold cursor-pointer hover:text-[#1F2C4E]"
                  onClick={() => toggleOrdem("descricao")}
                >
                  Descrição{indicador("descricao")}
                </th>
                <th className="text-left py-2 px-2 font-semibold">Família</th>
                <th className="text-center py-2 px-2 font-semibold">Deriv.</th>
                <th className="text-right py-2 px-2 font-semibold">Estoque</th>
                <th className="text-right py-2 px-2 font-semibold">Carteira</th>
                <th
                  className="text-right py-2 px-3 font-semibold cursor-pointer hover:text-[#1F2C4E]"
                  onClick={() => toggleOrdem("disponivel")}
                >
                  Disponível{indicador("disponivel")}
                </th>
                <th className="text-left py-2 px-3 font-semibold">
                  WIP previsto
                </th>
                <th className="text-right py-2 px-2 font-semibold">
                  Lead time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-sm text-[#706F6F]"
                  >
                    Nenhuma linha bate com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filtradas.map((l, i) => {
                  const dispZeradoOuNeg = l.disponivel <= 0 && !l.eh_servico;
                  return (
                    <tr
                      key={`${l.sku_id}-${l.derivacao_label}-${i}`}
                      className={
                        dispZeradoOuNeg
                          ? "bg-rose-50 hover:bg-rose-100"
                          : "hover:bg-slate-50"
                      }
                    >
                      <td className="py-2 px-4 font-mono text-xs text-[#1F2C4E] whitespace-nowrap">
                        {l.codigo}
                        {l.eh_servico && (
                          <span className="ml-1 text-[10px] uppercase tracking-wider text-slate-500">
                            svc
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-sm text-[#1F2C4E]">
                        {l.descricao}
                      </td>
                      <td className="py-2 px-2 text-xs text-[#706F6F]">
                        {l.familia}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-xs">
                        {l.derivacao_label}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-sm text-[#1F2C4E]">
                        {l.estoque}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-sm text-[#706F6F]">
                        {l.carteira > 0 ? `−${l.carteira}` : "0"}
                      </td>
                      <td
                        className={
                          "py-2 px-3 text-right font-mono text-base font-black " +
                          (l.eh_servico
                            ? "text-slate-400"
                            : l.disponivel < 0
                            ? "text-rose-700"
                            : l.disponivel === 0
                            ? "text-[#706F6F]"
                            : "text-emerald-700")
                        }
                      >
                        {l.eh_servico ? "—" : l.disponivel}
                      </td>
                      <td className="py-2 px-3 text-xs">
                        {l.wip_total > 0 ? (
                          <div className="leading-tight">
                            <div className="font-semibold text-[#326A84]">
                              +{l.wip_proxima_qtd} em{" "}
                              {fmtData(l.wip_proxima_data)}
                            </div>
                            {l.wip_total > (l.wip_proxima_qtd || 0) && (
                              <div className="text-[10px] text-[#706F6F]">
                                Total previsto: {l.wip_total}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-xs">
                        {l.eh_servico ? (
                          <span className="text-slate-400">—</span>
                        ) : l.lead_time != null ? (
                          <span className="text-[#1F2C4E]">
                            {l.lead_time}d
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold">
                            preencher
                          </span>
                        )}
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
