"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { importarWIP, type OPInput } from "./actions";

type Etapa = "fechado" | "upload" | "processando" | "preview";

type WIPAtual = {
  op_numero: string;
  data_prevista: string | null;
};

type Props = {
  wipAtual: WIPAtual[];
};

type Diff = {
  mantidasComData: OPInput[];
  mantidasSemData: OPInput[];
  novas: OPInput[];
  removidas: { op_numero: string; data_prevista: string | null }[];
};

export function ImportarWIP({ wipAtual }: Props) {
  const [etapa, setEtapa] = useState<Etapa>("fechado");
  const [fileName, setFileName] = useState<string>("");
  const [diff, setDiff] = useState<Diff | null>(null);
  const [novoUpload, setNovoUpload] = useState<OPInput[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir() {
    setEtapa("upload");
    setErro(null);
    setDiff(null);
    setNovoUpload([]);
    setFileName("");
  }
  function fechar() {
    setEtapa("fechado");
    setErro(null);
    setDiff(null);
    setNovoUpload([]);
    setFileName("");
  }

  function calcularDiff(ops: OPInput[]): Diff {
    const mapaAtual: Record<string, WIPAtual> = {};
    wipAtual.forEach((o) => {
      mapaAtual[o.op_numero] = o;
    });
    const numerosNovos = new Set(ops.map((n) => n.op_numero));
    const novas: OPInput[] = [];
    const mantidasComData: OPInput[] = [];
    const mantidasSemData: OPInput[] = [];
    ops.forEach((o) => {
      const ant = mapaAtual[o.op_numero];
      if (!ant) novas.push(o);
      else if (ant.data_prevista) mantidasComData.push(o);
      else mantidasSemData.push(o);
    });
    const removidas = wipAtual
      .filter((o) => !numerosNovos.has(o.op_numero))
      .map((o) => ({ op_numero: o.op_numero, data_prevista: o.data_prevista }));
    return { mantidasComData, mantidasSemData, novas, removidas };
  }

  function processarArquivo(file: File) {
    setFileName(file.name);
    setEtapa("processando");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
        });
        const ops: OPInput[] = [];
        rows.forEach((r) => {
          const op = r["O.P./O.S."] ?? r["O.P."] ?? r["OP"] ?? r["Numero OP"];
          const sku = r["Produto/Serviço"] ?? r["Produto"] ?? r["SKU"];
          if (!op || !sku) return;
          ops.push({
            op_numero: String(op).trim(),
            sku_codigo: String(sku).trim(),
            derivacao:
              r["Derivação"] !== null && r["Derivação"] !== undefined
                ? String(r["Derivação"]).trim()
                : (r["Derivacao"] !== null && r["Derivacao"] !== undefined
                  ? String(r["Derivacao"]).trim()
                  : null),
            qtd_prevista: Number(
              r["Qtde Prevista"] ?? r["Quantidade"] ?? r["Qtd"] ?? 1
            ) || 1,
          });
        });
        if (ops.length === 0) {
          setErro(
            "Não consegui identificar OPs. Colunas esperadas: O.P./O.S., Produto/Serviço, Derivação, Qtde Prevista."
          );
          setEtapa("upload");
          return;
        }
        const d = calcularDiff(ops);
        setNovoUpload(ops);
        setDiff(d);
        setEtapa("preview");
      } catch (err) {
        setErro(
          "Erro ao ler a planilha: " +
            (err instanceof Error ? err.message : String(err))
        );
        setEtapa("upload");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function confirmar() {
    startTransition(async () => {
      const res = await importarWIP(novoUpload);
      if (!res.ok) {
        setErro(res.error || "Erro desconhecido");
        return;
      }
      fechar();
    });
  }

  if (etapa === "fechado") {
    return (
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm bg-[#1F2C4E] hover:bg-[#326A84] text-white rounded-lg font-medium uppercase tracking-wide text-xs transition"
      >
        Importar do ERP
      </button>
    );
  }

  return (
    <>
      <button
        onClick={abrir}
        className="px-3 py-2 text-sm bg-[#1F2C4E] hover:bg-[#326A84] text-white rounded-lg font-medium uppercase tracking-wide text-xs transition"
      >
        Importar do ERP
      </button>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) fechar();
        }}
      >
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          {etapa === "upload" && (
            <>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2C4E] uppercase tracking-wide">
                    Importar Em Andamento
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">
                    Datas já preenchidas pelo PCP são preservadas.
                  </p>
                </div>
                <button
                  onClick={fechar}
                  className="text-slate-400 hover:text-slate-700 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <label className="block border-2 border-dashed border-slate-300 hover:border-[#326A84] hover:bg-[#E6F9FC]/30 rounded-lg p-10 text-center cursor-pointer transition">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processarArquivo(f);
                    }}
                  />
                  <div className="text-4xl text-slate-400 mb-2">↑</div>
                  <div className="font-medium text-[#1F2C4E]">
                    Arraste a planilha ou clique para selecionar
                  </div>
                  <div className="text-xs text-[#706F6F] mt-1">
                    Colunas esperadas: O.P./O.S., Produto/Serviço, Derivação, Qtde Prevista
                  </div>
                </label>
                <div className="mt-4 bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-lg p-3 text-xs text-[#1F2C4E]">
                  <b>Como o upload funciona:</b> OPs que continuam mantêm a
                  data já preenchida. Novas entram sem data. OPs que sumiram do
                  upload são <b>removidas</b> (entendidas como liberadas).
                </div>
                {erro && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                    {erro}
                  </div>
                )}
              </div>
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  onClick={fechar}
                  className="px-4 py-2 text-sm text-[#706F6F] hover:bg-slate-100 rounded"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
          {etapa === "processando" && (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin w-10 h-10 border-4 border-[#1F2C4E] border-t-transparent rounded-full"></div>
              <div className="mt-4 font-medium text-[#1F2C4E]">
                Comparando upload com base atual...
              </div>
              <div className="text-xs text-[#706F6F] mt-1">{fileName}</div>
            </div>
          )}
          {etapa === "preview" && diff && (
            <>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2C4E] uppercase tracking-wide">
                    Pré-visualizar mudanças
                  </h2>
                  <p className="text-xs text-[#706F6F] mt-0.5">{fileName}</p>
                </div>
                <button
                  onClick={fechar}
                  className="text-slate-400 hover:text-slate-700 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <CardDiff
                    titulo="Continuam"
                    valor={
                      diff.mantidasComData.length + diff.mantidasSemData.length
                    }
                    sub={`${diff.mantidasComData.length} com data preservada`}
                    cor="#326A84"
                  />
                  <CardDiff
                    titulo="Entram"
                    valor={diff.novas.length}
                    sub="OPs novas (sem data)"
                    cor="#1E9DBA"
                  />
                  <CardDiff
                    titulo="Saem"
                    valor={diff.removidas.length}
                    sub="OPs liberadas"
                    cor="#E24B4A"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ListaDiff
                    titulo={`Saem (${diff.removidas.length})`}
                    cor="red"
                    itens={diff.removidas.map((r) => ({
                      principal: r.op_numero,
                      secundario: r.data_prevista
                        ? `data: ${new Date(r.data_prevista).toLocaleDateString("pt-BR")}`
                        : "sem data",
                    }))}
                  />
                  <ListaDiff
                    titulo={`Entram (${diff.novas.length})`}
                    cor="emerald"
                    itens={diff.novas.map((n) => ({
                      principal: n.op_numero,
                      secundario: `${n.sku_codigo}${n.derivacao ? "·" + n.derivacao : ""}`,
                    }))}
                  />
                </div>
                {diff.mantidasComData.length > 0 && (
                  <div className="mt-4 bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-lg p-3 text-xs text-[#1F2C4E]">
                    <b>{diff.mantidasComData.length} OPs</b> mantêm a data já
                    preenchida pelo PCP — não precisa redigitar.
                  </div>
                )}
                {erro && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                    {erro}
                  </div>
                )}
              </div>
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-between">
                <button
                  onClick={() => setEtapa("upload")}
                  className="text-sm text-[#706F6F] hover:text-[#1F2C4E]"
                >
                  ← Voltar
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={fechar}
                    className="px-4 py-2 text-sm text-[#706F6F] hover:bg-slate-100 rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmar}
                    disabled={pending}
                    className="px-4 py-2 text-sm bg-[#1F2C4E] hover:bg-[#326A84] text-white rounded font-medium uppercase tracking-wide text-xs transition disabled:opacity-50"
                  >
                    {pending ? "Aplicando..." : "Aplicar upload"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function CardDiff({
  titulo,
  valor,
  sub,
  cor,
}: {
  titulo: string;
  valor: number;
  sub: string;
  cor: string;
}) {
  return (
    <div
      className="rounded-lg p-3 border"
      style={{ background: `${cor}10`, borderColor: `${cor}40` }}
    >
      <div
        className="text-xs uppercase tracking-wider font-semibold"
        style={{ color: cor }}
      >
        {titulo}
      </div>
      <div className="text-2xl font-black mt-0.5" style={{ color: cor }}>
        {valor}
      </div>
      <div className="text-xs text-[#706F6F] mt-1">{sub}</div>
    </div>
  );
}

function ListaDiff({
  titulo,
  cor,
  itens,
}: {
  titulo: string;
  cor: "red" | "emerald";
  itens: { principal: string; secundario: string }[];
}) {
  const corClasses =
    cor === "red"
      ? "bg-red-50 border-red-200 text-red-800"
      : "bg-emerald-50 border-emerald-200 text-emerald-800";
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div
        className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide border-b ${corClasses}`}
      >
        {titulo}
      </div>
      <div className="max-h-48 overflow-y-auto">
        {itens.length === 0 ? (
          <div className="p-3 text-xs text-slate-400 italic">nenhuma</div>
        ) : (
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {itens.slice(0, 30).map((it, i) => (
                <tr key={i}>
                  <td className="py-1.5 px-3 font-mono">{it.principal}</td>
                  <td className="py-1.5 px-3 text-slate-500">
                    {it.secundario}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {itens.length > 30 && (
          <div className="px-3 py-1.5 text-xs text-slate-400 bg-slate-50">
            mostrando 30 de {itens.length}
          </div>
        )}
      </div>
    </div>
  );
}
