import { ensureSessionSemRedirectSenha } from "@/lib/auth";
import { TrocarSenhaForm } from "./TrocarSenhaForm";

export const dynamic = "force-dynamic";

export default async function TrocarSenhaPage() {
  const ctx = await ensureSessionSemRedirectSenha();

  return (
    <main className="flex-1 flex items-center justify-center bg-white px-6 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-3">
            <svg
              viewBox="0 0 100 100"
              className="w-14 h-14"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#1F2C4E"
                strokeWidth="12"
              />
              <path
                d="M 50 88 A 38 38 0 0 0 88 50"
                fill="none"
                stroke="#64C3D1"
                strokeWidth="12"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#1F2C4E] uppercase">
            Trocar Senha
          </h1>
          <p className="text-sm text-[#706F6F] mt-1">
            {ctx.precisa_trocar_senha
              ? "Você precisa criar uma senha pessoal antes de continuar."
              : "Atualize sua senha de acesso."}
          </p>
        </div>

        <div className="bg-white border border-[#E6F9FC] rounded-2xl shadow-sm overflow-hidden">
          <div className="brand-gradient h-1"></div>
          <div className="p-6 md:p-8">
            <TrocarSenhaForm
              obrigatorio={ctx.precisa_trocar_senha}
              email={ctx.email}
            />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#706F6F]">
          #PorUmMundoSemCicatriz
        </p>
      </div>
    </main>
  );
}
