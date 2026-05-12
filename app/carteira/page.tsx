import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { AppHeader } from "../components/AppHeader";
import { ImportarPedidos } from "./ImportarPedidos";
import { ListaCarteira } from "./ListaCarteira";

export const dynamic = "force-dynamic";

type Linha = {
  id: string;
  numero_pedido: string;
  cliente: string;
  sku_codigo: string;
  derivacao: string | null;
  quantidade: number;
  data_promessa: string | null;
  prev_liberacao: string | null;
  status: string;
  sem_cadastro: boolean;
};

export default async function CarteiraPage() {
  const ctx = await ensureAcesso("/carteira");
  const supabase = await createClient();

  const { data: linhas } = await supabase
    .from("carteira_pedidos")
    .select("*")
    .order("numero_pedido", { ascending: false });

  const lista = (linhas || []) as Linha[];

  const numPedidos = new Set(lista.map((l: Linha) => l.numero_pedido)).size;
  const totalUnidades = lista.reduce(
    (s: number, l: Linha) => s + (l.quantidade || 0),
    0
  );
  const orfaos = lista.filter((l: Linha) => l.sem_cadastro).length;

  return (
    <>
      <AppHeader
        nome={ctx.nome}
        perfil={ctx.perfil}
        rotaAtiva="/carteira"
      />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
                Backlog comercial
              </p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
                Carteira de pedidos
              </h1>
              <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
                Pedidos já fechados aguardando produção/liberação.{" "}
                <b>Reduzem o estoque disponível</b> para novas negociações.
              </p>
            </div>
            <ImportarPedidos />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <Card titulo="Pedidos" valor={numPedidos} cor="#1F2C4E" />
            <Card titulo="Unidades" valor={totalUnidades} cor="#326A84" />
            <Card titulo="Itens sem cadastro" valor={orfaos} cor="#FFA300" />
          </div>

          {lista.length === 0 ? (
            <div className="bg-white border border-[#E6F9FC] rounded-2xl p-12 text-center">
              <div className="text-5xl text-slate-300 mb-3">📋</div>
              <h2 className="text-lg font-bold text-[#1F2C4E] mb-1 uppercase tracking-wide">
                Carteira vazia
              </h2>
              <p className="text-sm text-[#706F6F] mb-5">
                Suba PDFs de pedidos para começar.
              </p>
              <ImportarPedidos />
            </div>
          ) : (
            <ListaCarteira linhas={lista} />
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
  valor: number;
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
