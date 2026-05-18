"use client";

import { useTransition } from "react";
import { logoutAction } from "../login/actions";

const DEVICE_KEY = "confirma:device_id";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const fd = new FormData();
      const id =
        typeof window !== "undefined"
          ? localStorage.getItem(DEVICE_KEY) || ""
          : "";
      fd.set("device_id", id);
      await logoutAction(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs uppercase tracking-wider font-semibold text-[#706F6F] hover:text-[#1F2C4E] px-3 py-2 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
      title="Sair"
    >
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
