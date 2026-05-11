import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CadastroPage() {
  // Cadastro público está fechado. Acesso só por convite.
  redirect("/login?erro=Cadastro+fechado.+Pe%C3%A7a+um+convite+ao+administrador.");
}
