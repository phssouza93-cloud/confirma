"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  PERFIS,
  PERFIL_LABEL,
  PERFIL_DESCRICAO,
} from "@/lib/permissoes";
import {
  apagarUsuario,
  atualizarPerfilUsuario,
  alternarAtivoUsuario,
  atualizarLiderUsuario,
  criarUsuarioDireto,
  resetarSenhaUsuario,
  encerrarSessoesUsuario,
} from "./actions";
import { SENHA_PADRAO_PRIMEIRO_ACESSO } from "@/lib/senha";

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
  sessoesPorUsuario,
}: {
  usuarios: UsuarioRow[];
  convites: ConviteRow[];
  currentUserId: string;
  sessoesPorUsuario: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [perfilForm, setPerfilForm] = useState<string>("consultor");

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
      const r = await criarUsuarioDireto(form);
      if (!r.ok) {
        return feedback(r.error || "Erro ao criar usuário", false);
      }
      setShowForm(false);
      setPerfilForm("consultor");
      feedback(
        `Usuário criado. Senha inicial: "${SENHA_PADRAO_PRIMEIRO_ACESSO}". O usuário será obrigado a trocá-la no primeiro acesso.`,
        true
      );
      router.refresh();
    });
  }

  function handleEncerrarSessoes(id: string, nome: string, count: number) {
    if (count === 0) return;
    const ok = window.confirm(
      `Encerrar ${count} sessão(ões) ativa(s) de ${nome}?\n\n` +
        `Vai liberar todos os slots de dispositivos. O usuário continua logado nos dispositivos atuais até o token expirar, mas no próximo login os slots estarão livres.`
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await encerrarSessoesUsuario(id);
      if (!r.ok) return feedback(r.error || "Erro", false);
      feedback(`Sessões de ${nome} encerradas`, true);
      router.refresh();
    });
  }

  function handleResetarSenha(id: string, nome: string) {
    const ok = window.confirm(
      `Resetar a senha de ${nome} para "${SENHA_PADRAO_PRIMEIRO_ACESSO}"?\n\nO usuário será obrigado a criar uma nova senha no próximo login, e todas as sessões dele serão encerradas.`
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await resetarSenhaUsuario(id);
      if (!r.ok) return feedback(r.error || "Erro ao resetar senha", false);
      feedback(
        `Senha resetada. Avise ${nome}: a senha padrão é "${SENHA_PADRAO_PRIMEIRO_ACESSO}".`,
        true
      );
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

  function handleApagar(id: string, nome: string) {
    const ok = window.confirm(
      `Apagar PERMANENTEMENTE o usuário ${nome}?\n\n` +
        `Essa ação remove o login e o cadastro de permissões. ` +
        `Oportunidades e pedidos antigos vão continuar com o nome dele registrado, mas ele não poderá mais entrar no sistema.\n\n` +
        `Essa ação não pode ser desfeita.`
    );
    if (!ok) return;
    startTransition(async () => {
      const r = await apagarUsuario(id);
      if (!r.ok) return feedback(r.error || "Erro", false);
      feedback("Usuário apagado", true);
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
          {showForm ? "Cancelar" : "+ Novo usuário"}
        </button>
      </div>

      {showForm && (
        <form
          action={handleCriar}
          className="bg-[#E6F9FC] border border-[#64C3D1]/40 rounded-2xl p-4 space-y-3"
        >
          <div className="text-xs uppercase tracking-wider text-[#1F2C4E] font-semibold">
            Novo usuário
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
              {isPending ? "Criando…" : "Criar usuário"}
            </button>
          </div>
        </form>
      )}

      {false && convites.length > 0 && (
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
                      onClick={() => alert("Fluxo de convites foi removido. Crie usuário direto.")}
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

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
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
              const sessoes = sessoesPorUsuario[u.id] || 0;
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
                    <div className="inline-flex items-center gap-1">
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
                      <button
                        type="button"
                        disabled={isPending || sessoes === 0}
                        onClick={() =>
                          handleEncerrarSessoes(u.id, u.nome, sessoes)
                        }
                        title={
                          sessoes === 0
                            ? "Sem sessões ativas"
                            : `Encerrar ${sessoes} sessão(ões) ativa(s) — libera slots de dispositivo`
                        }
                        className="text-xs uppercase font-semibold px-2 py-1 rounded text-sky-700 hover:text-white hover:bg-sky-600 disabled:opacity-30 disabled:cursor-not-allowed border border-sky-200 hover:border-sky-600"
                      >
                        Sessões {sessoes}/2
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleResetarSenha(u.id, u.nome)}
                        title={`Resetar senha pra "${SENHA_PADRAO_PRIMEIRO_ACESSO}" (usuário troca no próximo login)`}
                        className="text-xs uppercase font-semibold px-2 py-1 rounded text-amber-700 hover:text-white hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed border border-amber-200 hover:border-amber-600"
                      >
                        Resetar senha
                      </button>
                      <button
                        type="button"
                        disabled={isPending || isVoce}
                        onClick={() => handleApagar(u.id, u.nome)}
                        title={
                          isVoce
                            ? "Não é possível apagar a si mesmo"
                            : "Apagar permanentemente"
                        }
                        className="text-xs uppercase font-semibold px-2 py-1 rounded text-rose-700 hover:text-white hover:bg-rose-600 disabled:opacity-30 disabled:cursor-not-allowed border border-rose-200 hover:border-rose-600"
                      >
                        Apagar
                      </button>
                    </div>
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
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <div>
        <h2 className="text-sm uppercase tracking-widest font-bold text-[#1F2C4E]">
          Perfis e o que cada um acessa
        </h2>
        <p className="text-xs text-[#706F6F] mt-0.5">
          Referência rápida pra quem vai gerenciar usuários.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PERFIS.map((p) => (
          <div
            key={p}
            className="bg-slate-50 border border-slate-200 rounded-xl p-3"
          >
            <div className="mb-1">{badgePerfil(p)}</div>
            <p className="text-xs text-[#706F6F] leading-snug">
              {(PERFIL_DESCRICAO as Record<string, string>)[p]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
