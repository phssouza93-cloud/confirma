import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PERFIL_LABEL, ehPerfilValido } from "@/lib/permissoes";
import { ConviteForm } from "./ConviteForm";
import { LogoConfiance } from "../../components/LogoConfiance";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ConvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: convite } = await supabase
    .from("convites")
    .select("id, email, nome, perfil, criado_em, expira_em, usado_em")
    .eq("token", token)
    .maybeSingle();

  const agora = new Date();
  const invalido = !convite;
  const usado = !!convite?.usado_em;
  const expirado =
    !!convite?.expira_em && new Date(convite.expira_em) < agora;
  const ok = !!convite && !usado && !expirado;
  const perfilLabel =
    convite && ehPerfilValido(convite.perfil)
      ? PERFIL_LABEL[convite.perfil]
      : convite?.perfil || "";

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
            {invalido && (
              <Mensagem
                titulo="Convite inválido"
                texto="Este link não corresponde a nenhum convite. Verifique se você copiou o link inteiro, ou peça um novo convite para o administrador."
                tipo="erro"
              />
            )}
            {!invalido && usado && (
              <Mensagem
                titulo="Convite já utilizado"
                texto="Esse convite já foi usado para criar uma conta. Se for você, basta fazer login normalmente."
                tipo="aviso"
                comLogin
              />
            )}
            {!invalido && !usado && expirado && (
              <Mensagem
                titulo="Convite expirado"
                texto="Este convite passou da data de validade. Peça um novo convite ao administrador."
                tipo="erro"
              />
            )}
            {ok && (
              <>
                <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E] mb-1">
                  Você foi convidado
                </h2>
                <p className="text-xs text-[#706F6F] mb-5">
                  Defina sua senha para acessar o Confirma como{" "}
                  <b>{perfilLabel}</b>.
                </p>
                <div className="bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-lg p-3 mb-5 text-sm">
                  <div className="text-[#1F2C4E]">
                    <b>{convite.nome}</b>
                  </div>
                  <div className="text-xs text-[#706F6F]">{convite.email}</div>
                </div>
                <ConviteForm token={token} />
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[#706F6F] mt-4">
          <Link href="/login" className="hover:text-[#1F2C4E]">
            Já tem conta? Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

function Mensagem({
  titulo,
  texto,
  tipo,
  comLogin,
}: {
  titulo: string;
  texto: string;
  tipo: "erro" | "aviso";
  comLogin?: boolean;
}) {
  return (
    <div>
      <h2
        className={
          "text-sm uppercase tracking-widest font-bold mb-2 " +
          (tipo === "erro" ? "text-rose-700" : "text-amber-700")
        }
      >
        {titulo}
      </h2>
      <p className="text-sm text-[#706F6F] mb-4 leading-relaxed">{texto}</p>
      {comLogin && (
        <Link
          href="/login"
          className="block text-center bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold uppercase tracking-wider text-sm py-3 rounded-lg"
        >
          Ir para login
        </Link>
      )}
    </div>
  );
}
