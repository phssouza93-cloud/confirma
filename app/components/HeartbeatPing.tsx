"use client";

import { useEffect } from "react";
import { pingSessao } from "../configuracoes/usuarios/actions";

const DEVICE_KEY = "confirma:device_id";
const INTERVALO_MS = 90 * 1000; // 90 segundos

/**
 * Componente invisível que dispara um ping de heartbeat a cada 90s,
 * atualizando ultimo_acesso da sessão atual em sessoes_ativas.
 * Permite que outros usuários (admins) vejam quem está online.
 */
export function HeartbeatPing() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId) return;

    // Primeiro ping imediato pra marcar como online já
    pingSessao(deviceId).catch(() => {});

    const id = setInterval(() => {
      // Não pinga se a aba estiver oculta há muito tempo (economiza requisições)
      if (document.visibilityState === "hidden") return;
      pingSessao(deviceId).catch(() => {});
    }, INTERVALO_MS);

    return () => clearInterval(id);
  }, []);

  return null;
}
