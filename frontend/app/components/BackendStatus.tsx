"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
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

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(`${API_URL}/health`, {
          signal: controller.signal,
        });

        if (!cancelled) {
          setStatus(response.ok ? "online" : "offline");
        }
      } catch {
        if (!cancelled) {
          setStatus("offline");
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const config = STATUS_CONFIG[status];

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border ${config.border} ${config.bg} px-3 py-1.5 text-xs font-semibold ${config.text} shadow-md`}
      title={
        status === "offline"
          ? "Le serveur backend ne répond pas. Vérifie qu'il est bien lancé."
          : undefined
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${config.dot} ${
          status === "checking" ? "animate-pulse" : ""
        }`}
      />
      {config.label}
    </div>
  );
}
