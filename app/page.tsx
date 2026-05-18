import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureAcesso } from "@/lib/auth";
import { AppHeader } from "./components/AppHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ctx = await ensureAcesso("/");
  const supabase = await createClient();

  const nomeExibicao = ctx.nome;
  const perfilExibicao = ctx.perfil;

  // Contadores em tempo real do banco
  const [
    { count: qtdSkus },
    { count: qtdOpp },
    { count: qtdCarteira },
    { count: qtdWip },
  ] = await Promise.all([
    supabase.from("skus").select("*", { count: "exact", head: true }),
    supabase.from("oportunidades").select("*", { count: "exact", head: true }),
    supabase
      .from("carteira_pedidos")
      .select("*", { count: "exact", head: true }),
    supabase.from("wip").select("*", { count: "exact", head: true }),
  ]);

  return (
    <>
      <AppHeader nome={nomeExibicao} perfil={perfilExibicao} rotaAtiva="/" />
      <main className="flex-1 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-2">
              Bem-vindo, {nomeExibicao.split(" ")[0]}
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#1F2C4E] uppercase leading-tight">
              Confirma
            </h1>
            <p className="mt-3 text-base text-[#706F6F] max-w-2xl">
              Plataforma de promessa de prazo da Confiance Medical. Acesse as
              áreas abaixo para gerenciar o cadastro, a produção e o pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardArea
              href="/estoque"
              titulo="Estoque"
              descricao="Cadastro mestre de SKUs"
              cor="#1F2C4E"
              indicador={`${qtdSkus ?? 0} SKUs`}
              ativo
            />
            <CardArea
              href="/wip"
              titulo="Em andamento"
              descricao="OPs do ERP com data prevista"
              cor="#326A84"
              indicador={`${qtdWip ?? 0} OPs`}
              ativo
            />
            <CardArea
              href="/carteira"
              titulo="Carteira de pedidos"
              descricao="Pedidos em produção/liberação"
              cor="#1E9DBA"
              indicador={`${qtdCarteira ?? 0} linhas`}
              ativo
            />
            <CardArea
              href="/oportunidades"
              titulo="Oportunidades"
              descricao="Pipeline + cálculo de prazo"
              cor="#64C3D1"
              indicador={`${qtdOpp ?? 0} no pipeline`}
              ativo
            />
            <CardArea
              href="/dashboard"
              titulo="Dashboard"
              descricao="KPIs e gargalos"
              cor="#FFA300"
              indicador="visão consolidada"
              ativo
            />
          </div>

          <div className="mt-8 bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-[#1F2C4E] mb-1 uppercase tracking-wide">
              Próximo passo
            </h3>
            <p className="text-sm text-[#1F2C4E]/80 leading-relaxed">
              A tela de Estoque já está funcional. Importe sua planilha
              Estoque.xlsx para popular o cadastro mestre — a base que vai
              alimentar o cálculo de prazo das próximas telas.
            </p>
          </div>
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

function CardArea({
  href,
  titulo,
  descricao,
  cor,
  indicador,
  ativo,
}: {
  href: string;
  titulo: string;
  descricao: string;
  cor: string;
  indicador: string;
  ativo: boolean;
}) {
  const conteudo = (
    <div
      className={
        "bg-white border rounded-xl p-5 transition h-full " +
        (ativo
          ? "border-slate-200 hover:border-[#64C3D1] hover:shadow-sm cursor-pointer"
          : "border-slate-100 opacity-60 cursor-not-allowed")
      }
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 font-bold text-lg"
        style={{ background: `${cor}15`, color: cor }}
      >
        {titulo.charAt(0)}
      </div>
      <h3 className="text-sm font-bold text-[#1F2C4E] uppercase tracking-wide mb-1">
        {titulo}
      </h3>
      <p className="text-xs text-[#706F6F] leading-relaxed">{descricao}</p>
      <p className="text-xs mt-3 font-semibold" style={{ color: cor }}>
        {indicador}
      </p>
    </div>
  );
  if (!ativo) return conteudo;
  return <Link href={href}>{conteudo}</Link>;
}
