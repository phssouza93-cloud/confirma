import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "../components/AppHeader";
import { ImportarEstoque } from "./ImportarEstoque";

export const dynamic = "force-dynamic";

type SKU = {
  id: string;
  codigo: string;
  descricao: string;
  familia: string | null;
  estoque: number;
  lead_time_dias: number;
};

export default async function EstoquePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nome, perfil")
    .eq("id", user.id)
    .single();

  const { data: skus } = await supabase
    .from("skus")
    .select("*")
    .order("codigo");

  const lista = (skus || []) as SKU[];
  const totalUnidades = lista.reduce(
    (s: number, x: SKU) => s + (x.estoque || 0),
    0
  );
  const familias = new Set(lista.map((s: SKU) => s.familia).filter(Boolean))
    .size;

  return (
    <>
      <AppHeader
        nome={perfil?.nome || user.email?.split("@")[0] || "Usuário"}
        perfil={perfil?.perfil || "consultor"}
        rotaAtiva="/estoque"
      />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
                Cadastro mestre
              </p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
                Estoque
              </h1>
              <p className="text-sm text-[#706F6F] mt-1">
                Base de SKUs do app · alimenta o cálculo de prazo das
                oportunidades
              </p>
            </div>
            <ImportarEstoque qtdAtual={lista.length} />
          </div>

          {/* Indicadores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <Card
              titulo="SKUs cadastrados"
              valor={String(lista.length)}
              cor="#1F2C4E"
            />
            <Card
              titulo="Unidades em estoque"
              valor={totalUnidades.toLocaleString("pt-BR")}
              cor="#326A84"
            />
            <Card titulo="Famílias" valor={String(familias)} cor="#1E9DBA" />
          </div>

          {/* Tabela / Empty state */}
          {lista.length === 0 ? (
            <div className="bg-white border border-[#E6F9FC] rounded-2xl p-12 text-center">
              <div className="text-5xl text-slate-300 mb-3">📦</div>
              <h2 className="text-lg font-bold text-[#1F2C4E] mb-1 uppercase tracking-wide">
                Cadastro mestre vazio
              </h2>
              <p className="text-sm text-[#706F6F] mb-5">
                Importe sua planilha de estoque (formato Estoque.xlsx) para
                começar.
              </p>
              <ImportarEstoque qtdAtual={0} />
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">
                      Código
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Descrição
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Família
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      Estoque
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      Lead time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.map((s: SKU) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2 px-4 font-mono text-xs text-[#1F2C4E]">
                        {s.codigo}
                      </td>
                      <td className="py-2 px-4 text-sm">{s.descricao}</td>
                      <td className="py-2 px-4 text-xs text-[#706F6F]">
                        {s.familia || "—"}
                      </td>
                      <td className="py-2 px-4 text-right text-sm font-medium">
                        {s.estoque}
                      </td>
                      <td className="py-2 px-4 text-right text-xs text-[#706F6F]">
                        {s.lead_time_dias}d
                      </td>
                    </tr>
                  ))}
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
      <div
        className="text-3xl font-black mt-1"
        style={{ color: cor }}
      >
        {valor}
      </div>
    </div>
  );
}
