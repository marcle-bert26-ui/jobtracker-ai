"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";
const CHECK_INTERVAL_MS = 10000;
const TIMEOUT_MS = 4000;

type ConnectionStatus = "checking" | "online" | "offline";

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  checking: {
    label: "Vérification...",
    dot: "bg-slate-400",
    text: "text-slate-600",
    bg: "bg-white",
    border: "border-slate-200",
  },
  online: {
    label: "Backend connecté",
    dot: "bg-green-500",
    text: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  offline: {
    label: "Backend hors ligne",
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

export default function BackendStatus() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");

  const pingBackend = useCallback(async (): Promise<ConnectionStatus> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}/health`, {
        signal: controller.signal,
      });
      return response.ok ? "online" : "offline";
    } catch {
      return "offline";
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function runCheck() {
      const result = await pingBackend();
      if (!cancelled) {
        setStatus(result);
      }
    }

    runCheck();
    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pingBackend]);

  const handleManualRetry = async () => {
    setStatus("checking");

    // Déclenche le protocole personnalisé enregistré dans Windows (une
    // fois via launcher/enregistrer_protocole.vbs), qui relance le
    // backend. Si le protocole n'a jamais été enregistré, le navigateur
    // ignore silencieusement cette ligne (aucun risque).
    window.location.href = "jobtracker://start";

    // Le backend met quelques secondes à redémarrer : on revérifie
    // plusieurs fois avant d'abandonner.
    const ATTEMPTS = 8;
    const DELAY_MS = 2000;

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      const result = await pingBackend();

      if (result === "online") {
        setStatus("online");
        return;
      }
    }

    setStatus("offline");
  };

  const config = STATUS_CONFIG[status];
  const isClickable = status === "offline";

  return (
    <div
      onClick={isClickable ? handleManualRetry : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border ${config.border} ${config.bg} px-3 py-1.5 text-xs font-semibold ${config.text} shadow-md ${
        isClickable ? "cursor-pointer transition hover:brightness-95" : ""
      }`}
      title={
        status === "offline"
          ? "Clique pour relancer le backend automatiquement (nécessite d'avoir enregistré le protocole une fois — voir launcher/enregistrer_protocole.vbs)."
          : undefined
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${config.dot} ${
          status === "checking" ? "animate-pulse" : ""
        }`}
      />
      {config.label}
      {isClickable && <span className="ml-0.5">↻</span>}
    </div>
  );
}
