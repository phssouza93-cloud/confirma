import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { AppHeader } from "../components/AppHeader";
import { ImportarEstoque } from "./ImportarEstoque";
import { ImportarCadastroMestre } from "./ImportarCadastroMestre";
import { LeadTimeInput } from "./LeadTimeInput";

export const dynamic = "force-dynamic";

type SKU = {
  id: string;
  codigo: string;
  descricao: string;
  familia: string | null;
  estoque: number;
  lead_time_dias: number | null;
};

type Derivacao = {
  sku_id: string;
  derivacao: string | null;
  qtd_disponivel: number;
};

export default async function EstoquePage() {
  const ctx = await ensureAcesso("/estoque");
  const supabase = await createClient();
  const perfil = { nome: ctx.nome, perfil: ctx.perfil };

  const { data: skus } = await supabase
    .from("skus")
    .select("*")
    .order("codigo");

  const { data: derivacoes } = await supabase
    .from("estoque_derivacoes")
    .select("sku_id, derivacao, qtd_disponivel");

  const lista = (skus || []) as SKU[];
  const derivPorSku: Record<string, Derivacao[]> = {};
  (derivacoes || []).forEach((d: Derivacao) => {
    if (!derivPorSku[d.sku_id]) derivPorSku[d.sku_id] = [];
    derivPorSku[d.sku_id].push(d);
  });

  const totalUnidades = lista.reduce(
    (s: number, x: SKU) => s + (x.estoque || 0),
    0
  );
  const familias = new Set(
    lista.map((s: SKU) => s.familia).filter(Boolean)
  ).size;
  const skusComEstoque = lista.filter((s: SKU) => (s.estoque || 0) > 0).length;

  return (
    <>
      <AppHeader
        nome={ctx.nome}
        perfil={ctx.perfil}
        rotaAtiva="/estoque"
      />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
                Cadastro mestre + posição
              </p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
                Estoque
              </h1>
              <p className="text-sm text-[#706F6F] mt-1">
                Base de SKUs com posição por derivação · alimenta o cálculo de
                prazo das oportunidades
              </p>
            </div>
            <div className="flex gap-2">
              <ImportarCadastroMestre qtdAtual={lista.length} />
              <ImportarEstoque qtdAtual={totalUnidades} />
            </div>
          </div>

          {/* Indicadores */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            <Card titulo="SKUs cadastrados" valor={String(lista.length)} cor="#1F2C4E" />
            <Card
              titulo="Com estoque"
              valor={String(skusComEstoque)}
              cor="#326A84"
            />
            <Card
              titulo="Unidades totais"
              valor={totalUnidades.toLocaleString("pt-BR")}
              cor="#1E9DBA"
            />
            <Card titulo="Famílias" valor={String(familias)} cor="#64C3D1" />
          </div>

          {/* Tabela / Empty state */}
          {lista.length === 0 ? (
            <div className="bg-white border border-[#E6F9FC] rounded-2xl p-12 text-center">
              <div className="text-5xl text-slate-300 mb-3">📦</div>
              <h2 className="text-lg font-bold text-[#1F2C4E] mb-1 uppercase tracking-wide">
                Cadastro vazio
              </h2>
              <p className="text-sm text-[#706F6F] mb-5">
                Comece pelo <b>Cadastro mestre</b> (lista de SKUs) e depois
                importe a posição de estoque por derivação.
              </p>
              <div className="flex gap-2 justify-center">
                <ImportarCadastroMestre qtdAtual={0} />
                <ImportarEstoque qtdAtual={0} />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Código</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Descrição
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Família
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      Estoque
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Derivações
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      Lead time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.map((s: SKU) => {
                    const derivs = (derivPorSku[s.id] || [])
                      .filter((d) => d.qtd_disponivel > 0)
                      .sort((a, b) =>
                        (a.derivacao || "").localeCompare(b.derivacao || "")
                      );
                    // Só mostra pílulas quando há derivações REAIS (com código)
                    // Se todas são null, não tem o que mostrar (o estoque já aparece na coluna ao lado)
                    const derivsComCodigo = derivs.filter(
                      (d) => d.derivacao && d.derivacao.trim() !== ""
                    );
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2 px-4 font-mono text-xs text-[#1F2C4E]">
                          {s.codigo}
                        </td>
                        <td className="py-2 px-4 text-sm">{s.descricao}</td>
                        <td className="py-2 px-4 text-xs text-[#706F6F]">
                          {s.familia || "—"}
                        </td>
                        <td className="py-2 px-4 text-right text-sm font-medium">
                          {s.estoque || 0}
                        </td>
                        <td className="py-2 px-4">
                          {derivsComCodigo.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {derivsComCodigo.map((d, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#E6F9FC] text-[#1E9DBA] rounded text-xs"
                                >
                                  <span className="font-mono">
                                    {d.derivacao}
                                  </span>
                                  <span className="font-semibold">
                                    {d.qtd_disponivel}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right">
                          <LeadTimeInput
                            codigo={s.codigo}
                            valorInicial={s.lead_time_dias}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <footer className="border-t border-slate-100 py-5 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[#706F6F]">
          <span>© {new Date().getFullYear()} Confiance Medical</span>
          <span className="hidden sm:inline">#PorUmMundoSemCicatriz</span>
        </div>
      </footer>
    </>
  );
}

function Card({
  titulo,
  valor,
  cor,
}: {
  titulo: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-[#706F6F] font-semibold">
        {titulo}
      </div>
      <div className="text-3xl font-black mt-1" style={{ color: cor }}>
        {valor}
      </div>
    </div>
  );
}
