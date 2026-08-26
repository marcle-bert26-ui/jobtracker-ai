"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Application = {
  id: number;
  company: string;
  position: string;
  location: string | null;
  source: string | null;
  job_url: string | null;
  application_date: string | null;
  status: string;
  recruiter: string | null;
  recruiter_email: string | null;
  salary: string | null;
  notes: string | null;
  created_at: string;
};

type ApplicationForm = {
  company: string;
  position: string;
  location: string;
  source: string;
  job_url: string;
  application_date: string;
  status: string;
  recruiter: string;
  recruiter_email: string;
  salary: string;
  notes: string;
};

type SyncAccountResult = {
  account: string;
  configured: boolean;
  scanned: number;
  new_applications: number;
  updated_applications: number;
  ignored: number;
  error: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const ACCOUNT_LABELS: Record<string, string> = {
  outlook: "Outlook (perso)",
  yahoo: "Yahoo",
  gmail: "Gmail",
  outlook_school: "Outlook (scolaire)",
};

const initialForm: ApplicationForm = {
  company: "",
  position: "",
  location: "",
  source: "",
  job_url: "",
  application_date: new Date().toISOString().split("T")[0],
  status: "Candidature envoyée",
  recruiter: "",
  recruiter_email: "",
  salary: "",
  notes: "",
};

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

export default function Home() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [form, setForm] = useState<ApplicationForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncAccountResult[] | null>(
    null
  );
  const [syncError, setSyncError] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("Toutes");

  const statusCounts = applications.reduce<Record<string, number>>(
    (counts, application) => {
      counts[application.status] = (counts[application.status] || 0) + 1;
      return counts;
    },
    {}
  );

  const availableStatuses = Object.keys(statusCounts).sort();

  const filteredApplications =
    statusFilter === "Toutes"
      ? applications
      : applications.filter(
          (application) => application.status === statusFilter
        );

  async function handleSyncEmails() {
    await runSync(`${API_URL}/emails/sync`);
  }

  async function handleDeepResync() {
    const confirmed = window.confirm(
      "Ça va réanalyser tous les emails des 60 derniers jours avec l'IA, " +
        "même ceux déjà traités. Ça peut prendre plusieurs minutes. Continuer ?"
    );

    if (!confirmed) {
      return;
    }

    await runSync(`${API_URL}/emails/sync?days=60&reset=true`);
  }

  async function runSync(url: string) {
    try {
      setSyncing(true);
      setSyncError("");
      setSyncResults(null);

      const response = await fetch(url, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("La synchronisation a échoué.");
      }

      const data: { results: SyncAccountResult[] } =
        await response.json();

      setSyncResults(data.results);

      await loadApplications();
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue pendant la synchronisation."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function loadApplications() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/applications/`);

      if (!response.ok) {
        throw new Error("Impossible de récupérer les candidatures.");
      }

      const data: Application[] = await response.json();

      setApplications(data);
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
    loadApplications();
  }, []);

  function updateForm(
    field: keyof ApplicationForm,
    value: string
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.company.trim() || !form.position.trim()) {
      setError("L'entreprise et le poste sont obligatoires.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccessMessage("");

      const payload = {
        company: form.company.trim(),
        position: form.position.trim(),
        location: form.location.trim() || null,
        source: form.source.trim() || null,
        job_url: form.job_url.trim() || null,
        application_date: form.application_date || null,
        status: form.status,
        recruiter: form.recruiter.trim() || null,
        recruiter_email: form.recruiter_email.trim() || null,
        salary: form.salary.trim() || null,
        notes: form.notes.trim() || null,
      };

      const response = await fetch(`${API_URL}/applications/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseData = await response.json();

        throw new Error(
          responseData.detail ||
            "Impossible d'ajouter la candidature."
        );
      }

      const newApplication: Application = await response.json();

      setApplications((currentApplications) => [
        newApplication,
        ...currentApplications,
      ]);

      setForm({
        ...initialForm,
        application_date: new Date()
          .toISOString()
          .split("T")[0],
      });

      setSuccessMessage(
        "Candidature ajoutée avec succès !"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'ajout."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px]">
        {/* EN-TÊTE */}
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-300 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              JobTracker AI
            </h1>

            <p className="mt-1 text-slate-500">
              Suivi intelligent de mes candidatures
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              {applications.length} candidature
              {applications.length > 1 ? "s" : ""}
            </div>

            <button
              type="button"
              onClick={loadApplications}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              ↻ Actualiser
            </button>

            <button
              type="button"
              onClick={handleSyncEmails}
              disabled={syncing}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {syncing ? "Synchronisation..." : "📧 Synchroniser les emails"}
            </button>

            <button
              type="button"
              onClick={handleDeepResync}
              disabled={syncing}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              title="Réanalyse tout, y compris les emails déjà traités, sur les 60 derniers jours"
            >
              🔁 Réanalyser (60j)
            </button>

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

        {/* RÉSULTATS DE SYNCHRONISATION */}
        {syncError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Erreur de synchronisation</p>
            <p className="mt-1 text-sm">{syncError}</p>
          </div>
        )}

        {syncResults && (
          <div className="mb-6 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
            <p className="font-semibold text-slate-800">
              📧 Résultat de la synchronisation
            </p>

            <p className="mt-1 text-xs text-slate-400">
              La détection utilise l&apos;IA locale (Ollama) si elle est lancée sur
              ton PC, sinon des règles-clés en secours.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {syncResults.map((result) => (
                <div
                  key={result.account}
                  className="rounded-lg border border-slate-200 p-3 text-sm"
                >
                  <p className="font-semibold text-slate-800">
                    {ACCOUNT_LABELS[result.account] || result.account}
                  </p>

                  {!result.configured && (
                    <p className="mt-1 text-slate-500">
                      Compte non configuré (voir fichier .env)
                    </p>
                  )}

                  {result.configured && result.error && (
                    <p className="mt-1 text-red-600">{result.error}</p>
                  )}

                  {result.configured && !result.error && (
                    <ul className="mt-1 space-y-0.5 text-slate-600">
                      <li>{result.scanned} email(s) analysé(s)</li>
                      <li>
                        {result.new_applications} nouvelle(s) candidature(s)
                      </li>
                      <li>
                        {result.updated_applications} candidature(s) mise(s)
                        à jour
                      </li>
                      <li>{result.ignored} email(s) ignoré(s)</li>
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Erreur</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-700">
            <p className="font-semibold">
              ✓ {successMessage}
            </p>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
          {/* FORMULAIRE D'AJOUT */}
          <section className="h-fit rounded-2xl border border-slate-300 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-xl font-bold text-slate-800">
                ➕ Ajouter une candidature
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Ajoute manuellement un poste à ton suivi.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <label
                  htmlFor="company"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Entreprise *
                </label>

                <input
                  id="company"
                  type="text"
                  value={form.company}
                  onChange={(event) =>
                    updateForm(
                      "company",
                      event.target.value
                    )
                  }
                  placeholder="Ex : Cleeven"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="position"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Poste *
                </label>

                <input
                  id="position"
                  type="text"
                  value={form.position}
                  onChange={(event) =>
                    updateForm(
                      "position",
                      event.target.value
                    )
                  }
                  placeholder="Ex : Consultant ingénieur"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="location"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Localisation
                </label>

                <input
                  id="location"
                  type="text"
                  value={form.location}
                  onChange={(event) =>
                    updateForm(
                      "location",
                      event.target.value
                    )
                  }
                  placeholder="Ex : Bâle, Suisse"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="source"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Source
                </label>

                <select
                  id="source"
                  value={form.source}
                  onChange={(event) =>
                    updateForm(
                      "source",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Sélectionner une source
                  </option>
                  <option value="LinkedIn">
                    LinkedIn
                  </option>
                  <option value="Indeed">
                    Indeed
                  </option>
                  <option value="HelloWork">
                    HelloWork
                  </option>
                  <option value="Site entreprise">
                    Site entreprise
                  </option>
                  <option value="Candidature spontanée">
                    Candidature spontanée
                  </option>
                  <option value="Autre">
                    Autre
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="application_date"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Date de candidature
                </label>

                <input
                  id="application_date"
                  type="date"
                  value={form.application_date}
                  onChange={(event) =>
                    updateForm(
                      "application_date",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Statut
                </label>

                <select
                  id="status"
                  value={form.status}
                  onChange={(event) =>
                    updateForm(
                      "status",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option>Candidature envoyée</option>
                  <option>En attente</option>
                  <option>Entretien</option>
                  <option>Relance</option>
                  <option>Offre reçue</option>
                  <option>Acceptée</option>
                  <option>Refusée</option>
                </select>
              </div>

              <details className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
                  Informations supplémentaires
                </summary>

                <div className="space-y-4 border-t border-slate-200 p-4">
                  <div>
                    <label
                      htmlFor="job_url"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Lien de l&apos;offre
                    </label>

                    <input
                      id="job_url"
                      type="url"
                      value={form.job_url}
                      onChange={(event) =>
                        updateForm(
                          "job_url",
                          event.target.value
                        )
                      }
                      placeholder="https://..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="recruiter"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Recruteur
                    </label>

                    <input
                      id="recruiter"
                      type="text"
                      value={form.recruiter}
                      onChange={(event) =>
                        updateForm(
                          "recruiter",
                          event.target.value
                        )
                      }
                      placeholder="Nom du contact"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="recruiter_email"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Email du recruteur
                    </label>

                    <input
                      id="recruiter_email"
                      type="email"
                      value={form.recruiter_email}
                      onChange={(event) =>
                        updateForm(
                          "recruiter_email",
                          event.target.value
                        )
                      }
                      placeholder="contact@entreprise.com"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="salary"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Salaire
                    </label>

                    <input
                      id="salary"
                      type="text"
                      value={form.salary}
                      onChange={(event) =>
                        updateForm(
                          "salary",
                          event.target.value
                        )
                      }
                      placeholder="Ex : 45 000 € brut/an"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="notes"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Notes
                    </label>

                    <textarea
                      id="notes"
                      value={form.notes}
                      onChange={(event) =>
                        updateForm(
                          "notes",
                          event.target.value
                        )
                      }
                      placeholder="Informations importantes, suivi, prochaines étapes..."
                      rows={5}
                      className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </details>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {submitting
                  ? "Ajout en cours..."
                  : "➕ Ajouter la candidature"}
              </button>
            </form>
          </section>

          {/* LISTE DES CANDIDATURES */}
          <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-7 py-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    Mes candidatures
                  </h2>

                  <p className="mt-1 text-slate-500">
                    Données enregistrées dans JobTracker
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter("Toutes")}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    statusFilter === "Toutes"
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Toutes ({applications.length})
                </button>

                {availableStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      statusFilter === status
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {status} ({statusCounts[status]})
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <div className="p-8 text-center text-slate-500">
                Chargement des candidatures...
              </div>
            )}

            {!loading && applications.length === 0 && (
              <div className="p-10 text-center text-slate-500">
                Aucune candidature enregistrée pour le moment.
              </div>
            )}

            {!loading &&
              applications.length > 0 &&
              filteredApplications.length === 0 && (
                <div className="p-10 text-center text-slate-500">
                  Aucune candidature avec ce statut.
                </div>
              )}

            {!loading &&
              filteredApplications.map((application) => (
                <article
                  key={application.id}
                  className="border-b border-slate-200 px-7 py-6 last:border-b-0"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-slate-800">
                        {application.position}
                      </h3>

                      <p className="mt-1 text-lg text-slate-700">
                        {application.company}
                      </p>

                      {application.location && (
                        <p className="mt-2 text-base text-slate-500">
                          📍 {application.location}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                        {application.source && (
                          <span>
                            Source : {application.source}
                          </span>
                        )}

                        {application.application_date && (
                          <span>
                            📅{" "}
                            {formatDate(
                              application.application_date
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                      <span
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusStyle(
                          application.status
                        )}`}
                      >
                        {application.status}
                      </span>

                      <Link
                        href={`/applications/${application.id}`}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md"
                      >
                        Ouvrir la fiche →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
          </section>
        </div>
      </div>
    </main>
  );
}