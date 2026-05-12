"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  PERFIS,
  PERFIL_LABEL,
  PERFIL_DESCRICAO,
} from "@/lib/permissoes";
import {
  criarConvite,
  apagarConvite,
  atualizarPerfilUsuario,
  alternarAtivoUsuario,
  atualizarLiderUsuario,
} from "./actions";

export type UsuarioRow = {
  id: string;
  email: string;
  nome: string;
  perfil: string;
  ativo: boolean | null;
  lider_id: string | null;
  created_at: string | null;
};

export type ConviteRow = {
  id: string;
  email: string;
  nome: string;
  perfil: string;
  token: string;
  criado_em: string | null;
  expira_em: string | null;
  usado_em: string | null;
};

function fmtData(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function badgePerfil(p: string) {
  const cores: Record<string, string> = {
    admin: "bg-[#1F2C4E] text-white",
    gestor: "bg-amber-500 text-white",
    consultor: "bg-emerald-600 text-white",
  };
  const label = (PERFIL_LABEL as Record<string, string>)[p] || p;
  return (
    <span
      className={
        "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider " +
        (cores[p] || "bg-slate-300 text-slate-700")
      }
    >
      {label}
    </span>
  );
}

export function UsuariosClient({
  usuarios,
  convites,
  currentUserId,
}: {
  usuarios: UsuarioRow[];
  convites: ConviteRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [perfilForm, setPerfilForm] = useState<string>("consultor");

  // Quem pode ser líder = gestores ativos
  const gestores = useMemo(
    () => usuarios.filter((u) => u.perfil === "gestor" && u.ativo !== false),
    [usuarios]
  );
  const usuariosPorId = useMemo(() => {
    const m: Record<string, UsuarioRow> = {};
    usuarios.forEach((u) => (m[u.id] = u));
    return m;
  }, [usuarios]);

  function feedback(msg: string, ok: boolean) {
    if (ok) {
      setSucesso(msg);
      setErro(null);
    } else {
      setErro(msg);
      setSucesso(null);
    }
    setTimeout(() => {
      setSucesso(null);
      setErro(null);
    }, 5000);
  }

  function linkDoConvite(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/convite/${token}`;
  }

  function handleCriar(form: FormData) {
    startTransition(async () => {
      const r = await criarConvite(form);
      if (!r.ok || !r.token) {
        return feedback(r.error || "Erro ao criar convite", false);
      }
      const link = linkDoConvite(r.token);
      setLinkConvite(link);
      setShowForm(false);
      setPerfilForm("consultor");
      feedback("Convite criado · copie o link abaixo e envie", true);
      router.refresh();
    });
  }

  function handleApagarConvite(id: string, email: string) {
    if (!window.confirm(`Apagar o convite para ${email}?`)) return;
    startTransition(async () => {
      const r = await apagarConvite(id);
      if (!r.ok) return feedback(r.error || "Erro ao apagar", false);
      feedback("Convite apagado", true);
      router.refresh();
    });
  }

  function handlePerfilChange(id: string, perfil: string, nome: string) {
    if (
      !window.confirm(
        `Alterar perfil de ${nome} para ${
          (PERFIL_LABEL as Record<string, string>)[perfil] || perfil
        }?`
      )
    )
      return;
    const form = new FormData();
    form.set("id", id);
    form.set("perfil", perfil);
    startTransition(async () => {
      const r = await atualizarPerfilUsuario(form);
      if (!r.ok) return feedback(r.error || "Erro", false);
      feedback("Perfil atualizado", true);
      router.refresh();
    });
  }

  function handleLiderChange(id: string, lider_id: string) {
    const novoLider = lider_id === "" ? null : lider_id;
    startTransition(async () => {
      const r = await atualizarLiderUsuario(id, novoLider);
      if (!r.ok) return feedback(r.error || "Erro", false);
      feedback(novoLider ? "Líder atribuído" : "Líder removido", true);
      router.refresh();
    });
  }

  function handleAtivar(id: string, ativo: boolean, nome: string) {
    const acao = ativo ? "Reativar" : "Desativar";
    if (!window.confirm(`${acao} usuário ${nome}?`)) return;
    startTransition(async () => {
      const r = await alternarAtivoUsuario(id, ativo);
      if (!r.ok) return feedback(r.error || "Erro", false);
      feedback(`Usuário ${ativo ? "reativado" : "desativado"}`, true);
      router.refresh();
    });
  }

  async function copiarLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // fallback: seleciona texto
    }
  }

  return (
    <>
      {sucesso && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-2 text-sm">
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2 text-sm">
          {erro}
        </div>
      )}

      {linkConvite && (
        <div className="bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-2xl p-4">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <div className="text-xs uppercase tracking-wider font-bold text-[#1F2C4E]">
              ✓ Convite gerado
            </div>
            <button
              type="button"
              onClick={() => setLinkConvite(null)}
              className="text-xs text-[#706F6F] hover:text-[#1F2C4E]"
            >
              Fechar
            </button>
          </div>
          <p className="text-xs text-[#1F2C4E]/80 mb-3">
            Copie o link abaixo e envie para a pessoa. Ele expira em 7 dias.
          </p>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={linkConvite}
              readOnly
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-[#1F2C4E] focus:outline-none"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={() => copiarLink(linkConvite)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg whitespace-nowrap"
            >
              {copiado ? "✓ Copiado" : "Copiar link"}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
          Usuários cadastrados ({usuarios.length})
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="bg-[#1F2C4E] hover:bg-[#326A84] text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg"
        >
          {showForm ? "Cancelar" : "+ Convidar usuário"}
        </button>
      </div>

      {showForm && (
        <form
          action={handleCriar}
          className="bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-2xl p-4 space-y-3"
        >
          <div className="text-xs uppercase tracking-wider text-[#1F2C4E] font-semibold">
            Novo convite
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <label className="text-xs text-[#706F6F] block mb-1">Nome</label>
              <input
                name="nome"
                type="text"
                required
                placeholder="ex: Maria Silva"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1]"
              />
            </div>
            <div className="md:col-span-4">
              <label className="text-xs text-[#706F6F] block mb-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="email@confiancemedical.com.br"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[#706F6F] block mb-1">
                Perfil
              </label>
              <select
                name="perfil"
                value={perfilForm}
                onChange={(e) => setPerfilForm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1]"
              >
                {PERFIS.map((p) => (
                  <option key={p} value={p}>
                    {PERFIL_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[#706F6F] block mb-1">
                Líder {perfilForm === "consultor" ? "" : "(opcional)"}
              </label>
              <select
                name="lider_id"
                disabled={perfilForm !== "consultor"}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64C3D1] disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">— sem líder —</option>
                {gestores.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {perfilForm === "consultor" && gestores.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg px-3 py-2">
              Nenhum gestor cadastrado ainda. Você pode criar o consultor sem
              líder e depois atribuir, ou convidar o gestor primeiro.
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs">
            <div className="font-semibold text-[#1F2C4E] mb-1.5">
              O que cada perfil pode acessar:
            </div>
            <div className="space-y-1 text-[#706F6F]">
              {PERFIS.map((p) => (
                <div key={p}>
                  <b className="text-[#1F2C4E]">{PERFIL_LABEL[p]}:</b>{" "}
                  {PERFIL_DESCRICAO[p]}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold uppercase tracking-wider text-xs px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {isPending ? "Gerando…" : "Gerar link de convite"}
            </button>
          </div>
        </form>
      )}

      {convites.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-amber-50/30">
            <h2 className="text-sm uppercase tracking-widest font-bold text-amber-900">
              Convites pendentes ({convites.length})
            </h2>
            <p className="text-xs text-amber-800/80 mt-0.5">
              Pessoas convidadas que ainda não criaram a senha. O link expira
              em 7 dias.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
              <tr>
                <th className="text-left py-2 px-4 font-semibold">Nome</th>
                <th className="text-left py-2 px-3 font-semibold">Email</th>
                <th className="text-left py-2 px-3 font-semibold">Perfil</th>
                <th className="text-right py-2 px-3 font-semibold">Criado</th>
                <th className="text-right py-2 px-3 font-semibold">Expira</th>
                <th className="text-right py-2 px-3 font-semibold">Link</th>
                <th className="text-right py-2 px-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {convites.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-2 px-4 text-sm text-[#1F2C4E]">{c.nome}</td>
                  <td className="py-2 px-3 text-xs text-[#706F6F]">
                    {c.email}
                  </td>
                  <td className="py-2 px-3">{badgePerfil(c.perfil)}</td>
                  <td className="py-2 px-3 text-right text-xs text-[#706F6F]">
                    {fmtData(c.criado_em)}
                  </td>
                  <td className="py-2 px-3 text-right text-xs text-[#706F6F]">
                    {fmtData(c.expira_em)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => copiarLink(linkDoConvite(c.token))}
                      className="text-xs uppercase font-semibold text-[#326A84] hover:text-[#1F2C4E] px-2 py-1 rounded hover:bg-slate-100"
                    >
                      Copiar
                    </button>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleApagarConvite(c.id, c.email)}
                      className="text-xs uppercase font-semibold text-rose-700 hover:text-rose-900 px-2 py-1 rounded hover:bg-rose-50"
                    >
                      Apagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-[#706F6F]">
            <tr>
              <th className="text-left py-2 px-4 font-semibold">Nome</th>
              <th className="text-left py-2 px-3 font-semibold">Email</th>
              <th className="text-left py-2 px-3 font-semibold">Perfil</th>
              <th className="text-left py-2 px-3 font-semibold">Líder</th>
              <th className="text-center py-2 px-3 font-semibold">Status</th>
              <th className="text-right py-2 px-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => {
              const ativo = u.ativo !== false;
              const isVoce = u.id === currentUserId;
              const lider = u.lider_id ? usuariosPorId[u.lider_id] : null;
              return (
                <tr key={u.id} className={ativo ? "" : "bg-slate-50/50"}>
                  <td className="py-2 px-4 text-sm text-[#1F2C4E]">
                    {u.nome}
                    {isVoce && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-[#1E9DBA] font-semibold">
                        você
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-xs text-[#706F6F]">
                    {u.email}
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={u.perfil}
                      onChange={(e) =>
                        handlePerfilChange(u.id, e.target.value, u.nome)
                      }
                      disabled={isPending}
                      className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold focus:outline-none focus:border-[#64C3D1]"
                    >
                      {PERFIS.map((p) => (
                        <option key={p} value={p}>
                          {PERFIL_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    {u.perfil === "consultor" ? (
                      <select
                        value={u.lider_id || ""}
                        onChange={(e) =>
                          handleLiderChange(u.id, e.target.value)
                        }
                        disabled={isPending}
                        className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-[#64C3D1]"
                      >
                        <option value="">— sem líder —</option>
                        {gestores.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nome}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {lider ? lider.nome : "—"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {ativo ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold uppercase tracking-wider">
                        Ativo
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                        Desativado
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      disabled={isPending || isVoce}
                      onClick={() => handleAtivar(u.id, !ativo, u.nome)}
                      title={
                        isVoce ? "Não é possível desativar a si mesmo" : ""
                      }
                      className={
                        "text-xs uppercase font-semibold px-2 py-1 rounded " +
                        (ativo
                          ? "text-rose-700 hover:text-rose-900 hover:bg-rose-50"
                          : "text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50") +
                        " disabled:opacity-30 disabled:cursor-not-allowed"
                      }
                    >
                      {ativo ? "Desativar" : "Reativar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Perfis />
    </>
  );
}

function Perfis() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E] mb-3">
        O que cada perfil acessa
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        {PERFIS.map((p) => (
          <div
            key={p}
            className="border border-slate-100 rounded-xl p-3 bg-slate-50/40"
          >
            <div className="flex items-center gap-2 mb-1">
              {badgePerfil(p)}
            </div>
            <div className="text-xs text-[#706F6F] leading-relaxed">
              {PERFIL_DESCRICAO[p]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
