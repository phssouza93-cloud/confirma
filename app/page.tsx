import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "./login/actions";
import { LogoConfiance } from "./components/LogoConfiance";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O middleware já redireciona para /login se não houver usuário,
  // mas mantemos a checagem por segurança
  if (!user) return null;

  // Busca o perfil estendido na tabela usuarios
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nome, perfil")
    .eq("id", user.id)
    .single();

  const nomeExibicao = perfil?.nome || user.email?.split("@")[0] || "Usuário";
  const perfilExibicao = perfil?.perfil || "consultor";
  const iniciais = nomeExibicao
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <LogoConfiance className="h-10 w-auto" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-[#1F2C4E]">{nomeExibicao}</div>
              <div className="text-xs uppercase tracking-wider text-[#706F6F]">
                {perfilExibicao}
              </div>
            </div>
            <span className="w-9 h-9 rounded-full bg-[#E6F9FC] text-[#1E9DBA] flex items-center justify-center font-bold text-sm">
              {iniciais}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs uppercase tracking-wider font-semibold text-[#706F6F] hover:text-[#1F2C4E] px-3 py-2 rounded-lg hover:bg-slate-50 transition"
                title="Sair"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Faixa do degradê da marca */}
      <div className="brand-gradient h-1"></div>

      {/* Conteúdo principal */}
      <section className="flex-1 px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-2">
              Bem-vindo, {nomeExibicao.split(" ")[0]}
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#1F2C4E] uppercase leading-tight">
              Confirma
            </h1>
            <p className="mt-3 text-base text-[#706F6F] max-w-2xl">
              Plataforma de promessa de prazo da Confiance Medical. As bases de
              dados do app estão prontas — em breve você verá oportunidades,
              estoque, WIP e carteira aqui.
            </p>
          </div>

          {/* Cards de área (placeholders por enquanto) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardArea
              titulo="Oportunidades"
              descricao="Pipeline em negociação e cálculo de prazo"
              icone="briefcase"
              cor="#326A84"
            />
            <CardArea
              titulo="Estoque & Produção"
              descricao="Cadastro mestre, WIP e carteira de pedidos"
              icone="package"
              cor="#1E9DBA"
            />
            <CardArea
              titulo="Dashboard"
              descricao="KPIs de pipeline, gargalos e capacidade"
              icone="chart"
              cor="#64C3D1"
            />
          </div>

          <div className="mt-8 bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-[#1E9DBA] flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#1F2C4E] mb-1 uppercase tracking-wide">
                  Próximo passo
                </h3>
                <p className="text-sm text-[#1F2C4E]/80 leading-relaxed">
                  Vamos migrar as telas funcionais do protótipo (Consultor, PCP, Gestor)
                  para esta versão online com dados de verdade. Cada upload de planilha vai
                  passar a salvar no banco, e o cálculo de prazo será compartilhado entre
                  todos os usuários da empresa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-5 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-[#706F6F]">
          <span>
            © {new Date().getFullYear()} Confiance Medical · Todos os direitos
            reservados
          </span>
          <span className="hidden sm:inline">#PorUmMundoSemCicatriz</span>
        </div>
      </footer>
    </main>
  );
}

function CardArea({
  titulo,
  descricao,
  cor,
}: {
  titulo: string;
  descricao: string;
  icone: string;
  cor: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-[#64C3D1] hover:shadow-sm transition cursor-pointer">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ background: `${cor}15`, color: cor }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="7" width="18" height="13" rx="2"></rect>
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </div>
      <h3 className="text-sm font-bold text-[#1F2C4E] uppercase tracking-wide mb-1">
        {titulo}
      </h3>
      <p className="text-xs text-[#706F6F] leading-relaxed">{descricao}</p>
      <p className="text-xs text-[#706F6F]/60 mt-3 italic">em construção</p>
    </div>
  );
}
