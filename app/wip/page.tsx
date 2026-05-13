import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { AppHeader } from "../components/AppHeader";
import { ImportarWIP } from "./ImportarWIP";
import { ListaWIP } from "./ListaWIP";
import { BotaoLimparTudo } from "../admin/BotaoLimparTudo";
import { limparWIP } from "../admin/limpar-actions";

export const dynamic = "force-dynamic";

type OP = {
  id: string;
  op_numero: string;
  sku_codigo: string;
  derivacao: string | null;
  qtd_prevista: number;
  data_prevista: string | null;
  status: string;
};

export default async function WIPPage() {
  const ctx = await ensureAcesso("/wip");
  const supabase = await createClient();
  const perfil = { nome: ctx.nome, perfil: ctx.perfil };

  const { data: wip } = await supabase
    .from("wip")
    .select("*")
    .order("op_numero");

  const lista = (wip || []) as OP[];

  // Recalcula status em tempo real para refletir "atrasada" sem precisar de cron
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const listaComStatus: OP[] = lista.map((o: OP) => {
    if (!o.data_prevista) return { ...o, status: "aguardando_data" };
    const dt = new Date(o.data_prevista);
    return {
      ...o,
      status: dt < hoje ? "atrasada" : "em_producao",
    };
  });

  const qtdAguardando = listaComStatus.filter(
    (o: OP) => o.status === "aguardando_data"
  ).length;
  const qtdProducao = listaComStatus.filter(
    (o: OP) => o.status === "em_producao"
  ).length;
  const qtdAtrasada = listaComStatus.filter(
    (o: OP) => o.status === "atrasada"
  ).length;

  return (
    <>
      <AppHeader
        nome={ctx.nome}
        perfil={ctx.perfil}
        rotaAtiva="/wip"
      />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
                Produção em andamento
              </p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
                Em andamento
              </h1>
              <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
                OPs do ERP com data prevista preenchida pelo PCP. A cada
                upload, datas já preenchidas são preservadas; OPs que somem do
                upload são removidas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ImportarWIP
                wipAtual={listaComStatus.map((o: OP) => ({
                  op_numero: o.op_numero,
                  data_prevista: o.data_prevista,
                }))}
              />
              {ctx.perfil === "admin" && listaComStatus.length > 0 && (
                <BotaoLimparTudo
                  label="OPs em andamento"
                  descricaoAcao="todas as OPs em andamento"
                  action={limparWIP}
                />
              )}
            </div>
          </div>

          {/* Cards de status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <Card
              titulo="Aguardando data"
              valor={qtdAguardando}
              cor="#F59E0B"
              bg="#FEF3C7"
            />
            <Card
              titulo="Em produção"
              valor={qtdProducao}
              cor="#1E9DBA"
              bg="#E6F9FC"
            />
            <Card
              titulo="Atrasadas · repactuar"
              valor={qtdAtrasada}
              cor="#E24B4A"
              bg="#FEE2E2"
            />
          </div>

          {listaComStatus.length === 0 ? (
            <div className="bg-white border border-[#E6F9FC] rounded-2xl p-12 text-center">
              <div className="text-5xl text-slate-300 mb-3">🏭</div>
              <h2 className="text-lg font-bold text-[#1F2C4E] mb-1 uppercase tracking-wide">
                Nenhuma OP em andamento
              </h2>
              <p className="text-sm text-[#706F6F] mb-5">
                Suba a planilha do ERP (Em andamento.xlsx) para começar.
              </p>
              <ImportarWIP wipAtual={[]} />
            </div>
          ) : (
            <ListaWIP wip={listaComStatus} />
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
  bg,
}: {
  titulo: string;
  valor: number;
  cor: string;
  bg: string;
}) {
  return (
    <div
      className="rounded-xl p-5 border"
      style={{ background: bg, borderColor: cor + "40" }}
    >
      <div
        className="text-xs uppercase tracking-wider font-semibold"
        style={{ color: cor }}
      >
        {titulo}
      </div>
      <div className="text-3xl font-black mt-1" style={{ color: cor }}>
        {valor}
      </div>
    </div>
  );
}
