"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ReminderApplication = {
  id: number;
  company: string;
  position: string;
  location: string | null;
  status: string;
  job_url: string | null;
  recruiter: string | null;
  recruiter_email: string | null;
  application_date: string | null;
  created_at: string;
  last_activity_date: string;
  days_since_last_activity: number;
  missing_fields: string[];
};

type RemindersResponse = {
  generated_at: string;
  stale_days: number;
  to_relaunch: ReminderApplication[];
  missing_info: ReminderApplication[];
};

const THRESHOLD_PRESETS = [
  { label: "3 jours", value: 3 },
  { label: "1 semaine", value: 7 },
  { label: "2 semaines", value: 14 },
];

function formatDate(date: string | null) {
  if (!date) {
    return "";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getStatusStyle(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (
    normalizedStatus.includes("entretien") ||
    normalizedStatus.includes("interview")
  ) {
    return "bg-blue-100 text-blue-800";
  }

  if (
    normalizedStatus.includes("envoy") ||
    normalizedStatus.includes("candidature")
  ) {
    return "bg-slate-100 text-slate-700";
  }

  if (
    normalizedStatus.includes("accept") ||
    normalizedStatus.includes("offre")
  ) {
    return "bg-green-100 text-green-800";
  }

  if (
    normalizedStatus.includes("refus") ||
    normalizedStatus.includes("rejet")
  ) {
    return "bg-red-100 text-red-800";
  }

  if (
    normalizedStatus.includes("attente") ||
    normalizedStatus.includes("en cours")
  ) {
    return "bg-orange-100 text-orange-800";
  }

  return "bg-slate-100 text-slate-700";
}

function daysLabel(days: number) {
  if (days <= 0) {
    return "Aujourd'hui";
  }

  return `Depuis ${days} jour${days > 1 ? "s" : ""}`;
}

export default function RemindersPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filtres : vivent dans l'URL pour que revenir sur cette page (bouton
  // retour, lien direct...) restaure exactement le seuil et la plage de
  // dates actifs.
  const [staleDays, setStaleDays] = useState(() => {
    const raw = Number.parseInt(searchParams.get("stale_days") ?? "7", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 7;
  });
  const [customStaleDays, setCustomStaleDays] = useState("");
  const [dateFrom, setDateFrom] = useState(
    () => searchParams.get("from") ?? ""
  );
  const [dateTo, setDateTo] = useState(() => searchParams.get("to") ?? "");

  const [data, setData] = useState<RemindersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  const isFirstFilterRun = useRef(true);
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }

    const params = new URLSearchParams();

    if (staleDays !== 7) params.set("stale_days", String(staleDays));
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [staleDays, dateFrom, dateTo, pathname, router]);

  async function loadReminders(days: number) {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/reminders?stale_days=${days}`
      );

      if (!response.ok) {
        throw new Error("Impossible de récupérer les rappels.");
      }

      const result: RemindersResponse = await response.json();

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rechargement volontaire à chaque changement de seuil
    void loadReminders(staleDays);
  }, [staleDays]);

  function applyCustomStaleDays() {
    const parsed = Number.parseInt(customStaleDays, 10);

    if (Number.isFinite(parsed) && parsed > 0) {
      setStaleDays(parsed);
    }
  }

  function withinDateFilter(entry: ReminderApplication) {
    const lastActivity = new Date(entry.last_activity_date);

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (lastActivity < from) {
        return false;
      }
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (lastActivity > to) {
        return false;
      }
    }

    return true;
  }

  const toRelaunch = useMemo(
    () => (data ? data.to_relaunch.filter(withinDateFilter) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, dateFrom, dateTo]
  );

  const missingInfo = useMemo(
    () => (data ? data.missing_info.filter(withinDateFilter) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, dateFrom, dateTo]
  );

  async function markAsRelaunched(applicationId: number) {
    try {
      setMarkingId(applicationId);
      setActionError("");

      const response = await fetch(
        `${API_URL}/applications/${applicationId}/history`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "Relance",
            note: "Relance effectuée depuis le tableau de rappels.",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Impossible d'enregistrer la relance.");
      }

      await loadReminders(staleDays);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la relance."
      );
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-[1200px]">
        {/* EN-TÊTE */}
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-300 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              🔔 Rappels
            </h1>

            <p className="mt-1 text-slate-500">
              Candidatures à relancer ou incomplètes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              ← Accueil
            </Link>

            <Link
              href="/emails"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              📋 Journal des emails
            </Link>

            <Link
              href="/stats"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              📊 Statistiques
            </Link>
          </div>
        </header>

        {/* FILTRES */}
        <section className="mb-6 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Relancer si aucune activité depuis
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {THRESHOLD_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setStaleDays(preset.value);
                      setCustomStaleDays("");
                    }}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      staleDays === preset.value
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={customStaleDays}
                    onChange={(event) =>
                      setCustomStaleDays(event.target.value)
                    }
                    placeholder="Autre"
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <button
                    type="button"
                    onClick={applyCustomStaleDays}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Filtrer par dernière activité
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <span className="text-sm text-slate-400">→</span>

                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Erreur</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {actionError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Erreur</p>
            <p className="mt-1 text-sm">{actionError}</p>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-300 bg-white p-10 text-center text-slate-500 shadow-sm">
            Chargement des rappels...
          </div>
        )}

        {!loading && data && (
          <div className="grid gap-6 xl:grid-cols-2">
            {/* À RELANCER */}
            <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-xl font-bold text-slate-800">
                  🔁 À relancer
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Aucune activité depuis {staleDays} jour
                  {staleDays > 1 ? "s" : ""} ({toRelaunch.length})
                </p>
              </div>

              {toRelaunch.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  Rien à relancer pour l&apos;instant 🎉
                </div>
              )}

              {toRelaunch.map((entry) => (
                <article
                  key={entry.id}
                  className="border-b border-slate-200 px-6 py-5 last:border-b-0"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-800">
                        {entry.position}
                      </h3>

                      <p className="mt-0.5 text-slate-700">
                        {entry.company}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                            entry.status
                          )}`}
                        >
                          {entry.status}
                        </span>

                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          ⏳ {daysLabel(entry.days_since_last_activity)}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-400">
                        Dernière activité :{" "}
                        {formatDate(entry.last_activity_date)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <button
                        type="button"
                        onClick={() => markAsRelaunched(entry.id)}
                        disabled={markingId === entry.id}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                      >
                        {markingId === entry.id
                          ? "..."
                          : "✓ Marquer relancé"}
                      </button>

                      <Link
                        href={`/applications/${entry.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Ouvrir la fiche →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            {/* INFOS MANQUANTES */}
            <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-xl font-bold text-slate-800">
                  ⚠️ Infos manquantes
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Candidatures incomplètes ({missingInfo.length})
                </p>
              </div>

              {missingInfo.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  Tout est complet 🎉
                </div>
              )}

              {missingInfo.map((entry) => (
                <article
                  key={entry.id}
                  className="border-b border-slate-200 px-6 py-5 last:border-b-0"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-800">
                        {entry.position}
                      </h3>

                      <p className="mt-0.5 text-slate-700">
                        {entry.company}
                      </p>

                      <span
                        className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                          entry.status
                        )}`}
                      >
                        {entry.status}
                      </span>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {entry.missing_fields.map((field) => (
                          <span
                            key={field}
                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <Link
                        href={`/applications/${entry.id}`}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                      >
                        Compléter →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
