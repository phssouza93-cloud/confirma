import { LoginForm } from "./LoginForm";
import { LogoConfiance } from "../components/LogoConfiance";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ erro?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { erro } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center bg-white px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-3">
            <LogoConfiance variant="symbol" className="w-14 h-14" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#1F2C4E] uppercase">
            Confirma
          </h1>
          <p className="text-sm text-[#706F6F] mt-1">
            Confiance Medical · Promessa de Prazo
          </p>
        </div>

        <div className="bg-white border border-[#E6F9FC] rounded-2xl shadow-sm overflow-hidden">
          <div className="brand-gradient h-1"></div>
          <div className="p-6 md:p-8">
            <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E] mb-1">
              Entrar
            </h2>
            <p className="text-xs text-[#706F6F] mb-5">
              Use seu email e senha cadastrados.
            </p>

            <LoginForm erroInicial={erro} />

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-[#706F6F] leading-relaxed">
                Acesso restrito. Sem conta? Peça acesso ao administrador.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#706F6F]">
          #PorUmMundoSemCicatriz
        </p>
      </div>
    </main>
  );
}
