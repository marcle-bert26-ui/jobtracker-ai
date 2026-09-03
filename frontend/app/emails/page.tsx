"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type ProcessedEmail = {
  id: number;
  account: string;
  sender: string;
  subject: string | null;
  received_at: string | null;
  event_type: string;
  company: string | null;
  position: string | null;
  location: string | null;
  application_id: number | null;
  email_link: string | null;
  created_at: string;
};

type EmailLogResponse = {
  total: number;
  items: ProcessedEmail[];
};

type QuickApplicationResult = {
  application_id: number;
  created: boolean;
  company: string | null;
  position: string | null;
  location: string | null;
  ai_used: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const PAGE_SIZE = 30;

const ACCOUNT_LABELS: Record<string, string> = {
  outlook: "Outlook (perso)",
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

const EVENT_FILTER_OPTIONS = [
  { value: "", label: "Tous les types" },
  { value: "nouvelle_candidature", label: "Nouvelle candidature" },
  { value: "entretien", label: "Entretien" },
  { value: "reponse_positive", label: "Réponse positive" },
  { value: "reponse_negative", label: "Réponse négative" },
  { value: "email_recu", label: "Email reçu (non rattaché)" },
  { value: "ignore", label: "Ignoré" },
];

const ACCOUNT_FILTER_OPTIONS = [
  { value: "", label: "Tous les comptes" },
  { value: "outlook", label: "Outlook (perso)" },
  { value: "yahoo", label: "Yahoo" },
  { value: "gmail", label: "Gmail" },
];

const ATTACHMENT_FILTER_OPTIONS = [
  { value: "", label: "Toutes" },
  { value: "yes", label: "Rattachées à une fiche" },
  { value: "no", label: "Non rattachées" },
];

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<ProcessedEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [creationError, setCreationError] = useState("");

  // L'état des filtres vit dans l'URL (paramètres de requête) plutôt que
  // seulement en mémoire : revenir sur cette page (bouton retour, lien
  // direct...) restaure exactement la recherche/les filtres/la page
  // actifs au lieu de repartir de zéro.
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("q") ?? ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => searchParams.get("q") ?? ""
  );
  const [account, setAccount] = useState(
    () => searchParams.get("account") ?? ""
  );
  const [eventType, setEventType] = useState(
    () => searchParams.get("type") ?? ""
  );
  const [attachment, setAttachment] = useState(
    () => searchParams.get("attached") ?? ""
  );
  const [dateFrom, setDateFrom] = useState(
    () => searchParams.get("from") ?? ""
  );
  const [dateTo, setDateTo] = useState(() => searchParams.get("to") ?? "");
  const [page, setPage] = useState(() => {
    const rawPage = Number.parseInt(searchParams.get("page") ?? "0", 10);
    return Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 0;
  });

  // Recherche différée : on évite d'interroger l'API à chaque frappe.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Tout changement de filtre (après le montage initial) revient à la
  // première page. On ignore le tout premier passage pour ne pas écraser
  // la page lue depuis l'URL au chargement.
  const isFirstFilterRun = useRef(true);
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    setPage(0);
  }, [debouncedSearch, account, eventType, attachment, dateFrom, dateTo]);

  // Répercute les filtres actifs dans l'URL (remplace l'entrée courante,
  // sans empiler l'historique à chaque changement) : revenir sur cette
  // page restaure ainsi exactement ce qui était affiché.
  useEffect(() => {
    const params = new URLSearchParams();

    if (debouncedSearch) params.set("q", debouncedSearch);
    if (account) params.set("account", account);
    if (eventType) params.set("type", eventType);
    if (attachment) params.set("attached", attachment);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (page > 0) params.set("page", String(page));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [
    debouncedSearch,
    account,
    eventType,
    attachment,
    dateFrom,
    dateTo,
    page,
    pathname,
    router,
  ]);

  useEffect(() => {
    async function loadLog() {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(page * PAGE_SIZE));

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }
        if (account) {
          params.set("account", account);
        }
        if (eventType) {
          params.set("event_type", eventType);
        }
        if (attachment) {
          params.set("has_application", attachment === "yes" ? "true" : "false");
        }
        if (dateFrom) {
          params.set("date_from", dateFrom);
        }
        if (dateTo) {
          // On inclut toute la journée de fin sélectionnée.
          params.set("date_to", `${dateTo}T23:59:59`);
        }

        const response = await fetch(
          `${API_URL}/emails/log?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error("Impossible de récupérer le journal.");
        }

        const data: EmailLogResponse | ProcessedEmail[] = await response.json();

        if (Array.isArray(data)) {
          // Compatibilité avec l'ancien format de réponse (tableau brut).
          setEntries(data);
          setTotal(data.length);
        } else {
          setEntries(data.items ?? []);
          setTotal(data.total ?? 0);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadLog();
  }, [debouncedSearch, account, eventType, attachment, dateFrom, dateTo, page]);

  const hasActiveFilters =
    debouncedSearch !== "" ||
    account !== "" ||
    eventType !== "" ||
    attachment !== "" ||
    dateFrom !== "" ||
    dateTo !== "";

  function resetFilters() {
    setSearchInput("");
    setAccount("");
    setEventType("");
    setAttachment("");
    setDateFrom("");
    setDateTo("");
  }

  const totalPages = useMemo(
    () => Math.max(Math.ceil(total / PAGE_SIZE), 1),
    [total]
  );

  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  async function createApplicationFromEmail(emailId: number) {
    try {
      setCreatingId(emailId);
      setCreationError("");

      const response = await fetch(
        `${API_URL}/emails/${emailId}/create-application`,
        { method: "POST" }
      );

      if (!response.ok) {
        let detail = "";

        try {
          const errorBody = await response.json();
          detail = errorBody.detail || "";
        } catch {
          // Réponse non-JSON (ex : erreur serveur brute) — on garde le
          // message générique ci-dessous.
        }

        throw new Error(
          detail ||
            `Impossible de créer la fiche à partir de cet email (HTTP ${response.status}).`
        );
      }

      const result: QuickApplicationResult = await response.json();

      router.push(`/applications/${result.application_id}?edit=1`);
    } catch (err) {
      setCreationError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
      setCreatingId(null);
    }
  }

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
              Tous les emails déjà scannés sont conservés ici, sans limite —
              utilise la recherche et les filtres pour naviguer.
              <br />
              <span className="text-slate-400">
                ✉️ = clique pour rouvrir l&apos;email dans ta boîte mail
                (Gmail/Outlook : lien direct — Yahoo : recherche
                approchante par sujet, faute de lien direct fiable).
                <br />
                ➕ = crée rapidement une fiche à partir de cet email (IA
                locale si disponible), à compléter ensuite.
              </span>
            </p>

            {/* RECHERCHE */}
            <div className="mt-4">
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="🔍 Rechercher par sujet, expéditeur, entreprise ou poste..."
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* FILTRES */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  Compte
                </span>
                <select
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {ACCOUNT_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  Type d&apos;événement
                </span>
                <select
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {EVENT_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  Rattachement
                </span>
                <select
                  value={attachment}
                  onChange={(event) => setAttachment(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {ATTACHMENT_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  Reçu à partir du
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  Jusqu&apos;au
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {total} résultat{total > 1 ? "s" : ""} filtré
                  {total > 1 ? "s" : ""}
                </p>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
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

          {creationError && (
            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {creationError}
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="p-10 text-center text-slate-500">
              Aucun email {hasActiveFilters ? "ne correspond à ces filtres" : "pour le moment"}.
            </div>
          )}

          {!loading && entries.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {entries.map((entry) => (
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

                      {(entry.company || entry.position || entry.location) && (
                        <p className="mt-1 text-xs text-slate-400">
                          {[entry.company, entry.position, entry.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
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

                      {!entry.application_id && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void createApplicationFromEmail(entry.id);
                          }}
                          disabled={creatingId === entry.id}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {creatingId === entry.id
                            ? "Création..."
                            : "➕ Créer une fiche"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row md:px-8">
              <p className="text-sm text-slate-500">
                {rangeStart}–{rangeEnd} sur {total}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  disabled={page === 0}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Précédent
                </button>

                <span className="text-sm text-slate-500">
                  Page {page + 1} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(current + 1, totalPages - 1)
                    )
                  }
                  disabled={page + 1 >= totalPages}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
