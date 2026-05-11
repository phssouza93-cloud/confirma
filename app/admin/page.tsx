import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "../components/AppHeader";
import { ensureAdmin } from "./guard";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const ctx = await ensureAdmin();
  const supabase = await createClient();

  // Contadores para os cards
  const [
    { count: qtdAliases },
    { data: aliasesData },
    { data: skusData },
    { data: itensData },
  ] = await Promise.all([
    supabase.from("sku_aliases").select("*", { count: "exact", head: true }),
    supabase.from("sku_aliases").select("descricao_alias"),
    supabase.from("skus").select("codigo"),
    supabase.from("oportunidade_itens").select("sku_codigo, descricao"),
  ]);

  // Calcula órfãos: itens sem SKU e sem alias
  const codigos = new Set((skusData || []).map((s: { codigo: string }) => s.codigo));
  const aliasDescs = new Set(
    (aliasesData || []).map((a: { descricao_alias: string }) =>
      String(a.descricao_alias || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
  );
  const orfaosDescricoes = new Set<string>();
  (itensData || []).forEach(
    (it: { sku_codigo: string; descricao: string }) => {
      if (codigos.has(it.sku_codigo)) return;
      const dn = String(it.descricao || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (aliasDescs.has(dn)) return;
      orfaosDescricoes.add(it.descricao);
    }
  );

  return (
    <>
      <AppHeader nome={ctx.nome} perfil={ctx.perfil} rotaAtiva="/admin" />
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#326A84] font-semibold mb-1">
              Acesso restrito · admin
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1F2C4E] uppercase">
              Administração
            </h1>
            <p className="text-sm text-[#706F6F] mt-1 max-w-2xl">
              Gerenciar cadastros sem precisar mexer em SQL. Aliases definem
              como descrições viram SKUs no motor de prazo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              href="/admin/aliases"
              titulo="Aliases descrição → SKU"
              descricao="Mapas manuais que dizem ao motor: 'quando vier essa descrição, é esse SKU'. Resolve descrições antigas que não batem com o cadastro mestre."
              indicador={`${qtdAliases ?? 0} aliases ativos`}
              cor="#1E9DBA"
            />
            <Card
              href="/admin/orfaos"
              titulo="Itens órfãos"
              descricao="Descrições nas oportunidades que não casam nem por código nem por alias. Crie o alias direto daqui pra entrarem no cálculo de prazo."
              indicador={`${orfaosDescricoes.size} descrições sem match`}
              cor={orfaosDescricoes.size > 0 ? "#E24B4A" : "#27AE60"}
              alerta={orfaosDescricoes.size > 0}
            />
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

function Card({
  href,
  titulo,
  descricao,
  indicador,
  cor,
  alerta,
}: {
  href: string;
  titulo: string;
  descricao: string;
  indicador: string;
  cor: string;
  alerta?: boolean;
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#64C3D1] hover:shadow-sm transition block"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 font-bold text-xl"
        style={{ background: `${cor}15`, color: cor }}
      >
        {titulo.charAt(0)}
      </div>
      <h2 className="text-lg font-bold text-[#1F2C4E] mb-2">{titulo}</h2>
      <p className="text-sm text-[#706F6F] leading-relaxed mb-4">
        {descricao}
      </p>
      <div
        className={
          "inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full " +
          (alerta
            ? "bg-rose-50 text-rose-700"
            : "bg-slate-50 text-[#1F2C4E]")
        }
      >
        {alerta && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
        {indicador}
      </div>
    </Link>
  );
}
