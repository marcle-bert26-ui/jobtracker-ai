"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ProcessedEmail = {
  id: number;
  account: string;
  sender: string;
  subject: string | null;
  received_at: string | null;
  event_type: string;
  application_id: number | null;
  email_link: string | null;
  created_at: string;
};

const API_URL = "http://127.0.0.1:8000";

const ACCOUNT_LABELS: Record<string, string> = {
  outlook: "Outlook (perso)",
  outlook_school: "Outlook (scolaire)",
  yahoo: "Yahoo",
  gmail: "Gmail",
};

const EVENT_LABELS: Record<string, string> = {
  nouvelle_candidature: "Nouvelle candidature",
  entretien: "Entretien",
  reponse_positive: "Réponse positive",
  reponse_negative: "Réponse négative",
  email_recu: "Email reçu (non rattaché)",
  ignore: "Ignoré",
};

function getEventStyle(eventType: string) {
  if (eventType === "ignore") {
    return "bg-slate-100 text-slate-500";
  }

  if (eventType === "nouvelle_candidature") {
    return "bg-blue-100 text-blue-800";
  }

  if (eventType === "entretien") {
    return "bg-purple-100 text-purple-800";
  }

  if (eventType === "reponse_positive") {
    return "bg-green-100 text-green-800";
  }

  if (eventType === "reponse_negative") {
    return "bg-red-100 text-red-800";
  }

  return "bg-orange-100 text-orange-800";
}

function formatDateTime(date: string | null) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmailLogPage() {
  const [entries, setEntries] = useState<ProcessedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function loadLog() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/emails/log?limit=200`);

        if (!response.ok) {
          throw new Error("Impossible de récupérer le journal.");
        }

        const data: ProcessedEmail[] = await response.json();
        setEntries(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue."
        );
      } finally {
        setLoading(false);
      }
    }

    loadLog();
  }, []);

  const filteredEntries =
    filter === "all"
      ? entries
      : filter === "ignored"
      ? entries.filter((entry) => entry.event_type === "ignore")
      : entries.filter((entry) => entry.event_type !== "ignore");

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Retour aux candidatures
        </Link>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5 md:px-8">
            <h1 className="text-2xl font-bold text-slate-900">
              📋 Journal des emails analysés
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Pour vérifier ce que la détection automatique a repéré — ou
              raté. Si un email de candidature a été ignoré à tort, note son
              sujet exact pour affiner les mots-clés.
              <br />
              <span className="text-slate-400">
                ✉️ = clique pour rouvrir l&apos;email dans ta boîte mail
                (Gmail/Outlook : lien direct — Yahoo : recherche
                approchante par sujet, faute de lien direct fiable).
              </span>
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  filter === "all"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tous
              </button>

              <button
                type="button"
                onClick={() => setFilter("matched")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  filter === "matched"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Détectés
              </button>

              <button
                type="button"
                onClick={() => setFilter("ignored")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  filter === "ignored"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Ignorés
              </button>
            </div>
          </div>

          {loading && (
            <div className="p-8 text-center text-slate-500">
              Chargement du journal...
            </div>
          )}

          {error && (
            <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && filteredEntries.length === 0 && (
            <div className="p-10 text-center text-slate-500">
              Aucun email dans cette catégorie pour le moment.
            </div>
          )}

          {!loading && filteredEntries.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {filteredEntries.map((entry) => (
                <li
                  key={entry.id}
                  onClick={() => {
                    if (entry.email_link) {
                      window.open(
                        entry.email_link,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }
                  }}
                  className={`px-6 py-4 md:px-8 ${
                    entry.email_link
                      ? "cursor-pointer transition hover:bg-slate-50"
                      : ""
                  }`}
                  title={
                    entry.email_link
                      ? "Ouvrir cet email dans la boîte mail"
                      : undefined
                  }
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {entry.email_link && (
                          <span className="mr-1.5" aria-hidden="true">
                            ✉️
                          </span>
                        )}
                        {entry.subject || "(sans objet)"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {entry.sender} •{" "}
                        {ACCOUNT_LABELS[entry.account] || entry.account} •{" "}
                        {formatDateTime(entry.received_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getEventStyle(
                          entry.event_type
                        )}`}
                      >
                        {EVENT_LABELS[entry.event_type] || entry.event_type}
                      </span>

                      {entry.application_id && (
                        <Link
                          href={`/applications/${entry.application_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Voir la fiche →
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
