import { loginAction } from "./actions";

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
            <svg viewBox="0 0 100 100" className="w-14 h-14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="50" cy="50" r="38" fill="none" stroke="#1F2C4E" strokeWidth="12" />
              <path d="M 50 88 A 38 38 0 0 0 88 50" fill="none" stroke="#64C3D1" strokeWidth="12" />
            </svg>
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

            <form action={loginAction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2C4E] mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="voce@confiancemedical.com.br"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#326A84] focus:ring-2 focus:ring-[#64C3D1]/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F2C4E] mb-1.5 uppercase tracking-wide">
                  Senha
                </label>
                <input
                  type="password"
                  name="senha"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#326A84] focus:ring-2 focus:ring-[#64C3D1]/30 outline-none"
                />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-800">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold py-2.5 rounded-lg uppercase tracking-wide text-sm transition"
              >
                Entrar
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-[#706F6F] leading-relaxed">
                Acesso restrito · só por convite.
                <br />
                Sem conta? Peça um convite ao administrador.
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
