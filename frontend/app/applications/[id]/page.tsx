"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, use, useEffect, useState } from "react";

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

type HistoryEntry = {
  id: number;
  application_id: number;
  type: string;
  date: string;
  note: string | null;
  created_at: string;
};

type HistoryForm = {
  type: string;
  date: string;
  note: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const HISTORY_TYPES = [
  "Candidature envoyée",
  "Relance",
  "Réponse reçue",
  "Entretien",
  "Email reçu",
  "Note",
  "Autre",
];

function applicationToForm(application: Application): ApplicationForm {
  return {
    company: application.company,
    position: application.position,
    location: application.location ?? "",
    source: application.source ?? "",
    job_url: application.job_url ?? "",
    application_date: application.application_date
      ? application.application_date.split("T")[0]
      : "",
    status: application.status,
    recruiter: application.recruiter ?? "",
    recruiter_email: application.recruiter_email ?? "",
    salary: application.salary ?? "",
    notes: application.notes ?? "",
  };
}

function initialHistoryForm(): HistoryForm {
  return {
    type: "Relance",
    date: new Date().toISOString().split("T")[0],
    note: "",
  };
}

function formatDate(date: string | null) {
  if (!date) {
    return "Non renseignée";
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

function formatDateTime(date: string) {
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

function getHistoryTypeStyle(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes("entretien")) {
    return "bg-blue-100 text-blue-800";
  }

  if (normalizedType.includes("réponse")) {
    return "bg-green-100 text-green-800";
  }

  if (normalizedType.includes("relance")) {
    return "bg-orange-100 text-orange-800";
  }

  if (normalizedType.includes("email")) {
    return "bg-purple-100 text-purple-800";
  }

  return "bg-slate-100 text-slate-700";
}

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // NEXT.JS 16 : params est une Promise, on doit utiliser use()
  const { id } = use(params);
  const router = useRouter();

  const [application, setApplication] =
    useState<Application | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Édition ---
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<ApplicationForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // --- Suppression ---
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // --- Historique ---
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyForm, setHistoryForm] = useState<HistoryForm>(
    initialHistoryForm()
  );
  const [submittingHistory, setSubmittingHistory] = useState(false);

  async function loadApplication() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/applications/${id}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Cette candidature est introuvable.");
        }

        throw new Error(
          "Impossible de récupérer cette candidature."
        );
      }

      const data: Application = await response.json();

      setApplication(data);
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

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      setHistoryError("");

      const response = await fetch(
        `${API_URL}/applications/${id}/history`
      );

      if (!response.ok) {
        throw new Error(
          "Impossible de récupérer l'historique."
        );
      }

      const data: HistoryEntry[] = await response.json();

      setHistory(data);
    } catch (err) {
      setHistoryError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadApplication();
    loadHistory();
  }, [id]);

  function startEditing() {
    if (!application) {
      return;
    }

    setEditForm(applicationToForm(application));
    setEditError("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditForm(null);
    setEditError("");
  }

  function updateEditForm(
    field: keyof ApplicationForm,
    value: string
  ) {
    setEditForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [field]: value,
          }
        : currentForm
    );
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    if (!editForm.company.trim() || !editForm.position.trim()) {
      setEditError("L'entreprise et le poste sont obligatoires.");
      return;
    }

    try {
      setSavingEdit(true);
      setEditError("");

      const payload = {
        company: editForm.company.trim(),
        position: editForm.position.trim(),
        location: editForm.location.trim() || null,
        source: editForm.source.trim() || null,
        job_url: editForm.job_url.trim() || null,
        application_date: editForm.application_date || null,
        status: editForm.status,
        recruiter: editForm.recruiter.trim() || null,
        recruiter_email: editForm.recruiter_email.trim() || null,
        salary: editForm.salary.trim() || null,
        notes: editForm.notes.trim() || null,
      };

      const response = await fetch(
        `${API_URL}/applications/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const responseData = await response.json();

        throw new Error(
          responseData.detail ||
            "Impossible de modifier la candidature."
        );
      }

      const updatedApplication: Application = await response.json();

      setApplication(updatedApplication);
      setIsEditing(false);
      setEditForm(null);
    } catch (err) {
      setEditError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la modification."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);

      const response = await fetch(
        `${API_URL}/applications/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok && response.status !== 204) {
        throw new Error(
          "Impossible de supprimer cette candidature."
        );
      }

      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la suppression."
      );
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  function updateHistoryForm(
    field: keyof HistoryForm,
    value: string
  ) {
    setHistoryForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleHistorySubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSubmittingHistory(true);
      setHistoryError("");

      const payload = {
        type: historyForm.type,
        date: historyForm.date || null,
        note: historyForm.note.trim() || null,
      };

      const response = await fetch(
        `${API_URL}/applications/${id}/history`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const responseData = await response.json();

        throw new Error(
          responseData.detail ||
            "Impossible d'ajouter cet événement."
        );
      }

      const newEntry: HistoryEntry = await response.json();

      setHistory((currentHistory) =>
        [newEntry, ...currentHistory].sort(
          (a, b) =>
            new Date(b.date).getTime() -
            new Date(a.date).getTime()
        )
      );

      setHistoryForm(initialHistoryForm());
    } catch (err) {
      setHistoryError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'ajout."
      );
    } finally {
      setSubmittingHistory(false);
    }
  }

  async function handleDeleteHistoryEntry(entryId: number) {
    try {
      const response = await fetch(
        `${API_URL}/history/${entryId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok && response.status !== 204) {
        throw new Error(
          "Impossible de supprimer cet événement."
        );
      }

      setHistory((currentHistory) =>
        currentHistory.filter((entry) => entry.id !== entryId)
      );
    } catch (err) {
      setHistoryError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la suppression."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          Chargement de la candidature...
        </div>
      </main>
    );
  }

  if (error || !application) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-red-700">
            Erreur
          </h1>

          <p className="mt-3 text-slate-600">
            {error || "Candidature introuvable."}
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            ← Retour aux candidatures
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-blue-700 transition hover:text-blue-900"
          >
            ← Retour aux candidatures
          </Link>

          {!isEditing && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                ✏️ Modifier
              </button>

              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
              >
                🗑️ Supprimer
              </button>
            </div>
          )}
        </div>

        {/* CONFIRMATION DE SUPPRESSION */}
        {confirmingDelete && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="font-semibold text-red-800">
              Supprimer définitivement cette candidature ?
            </p>

            <p className="mt-1 text-sm text-red-700">
              Cette action est irréversible et supprimera aussi
              son historique.
            </p>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {deleting ? "Suppression..." : "Oui, supprimer"}
              </button>

              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {isEditing && editForm ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5 md:px-8">
              <h2 className="text-xl font-bold text-slate-800">
                ✏️ Modifier la candidature
              </h2>
            </div>

            <form
              onSubmit={handleEditSubmit}
              className="space-y-5 p-6 md:p-8"
            >
              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Entreprise *
                  </label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(event) =>
                      updateEditForm("company", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Poste *
                  </label>
                  <input
                    type="text"
                    value={editForm.position}
                    onChange={(event) =>
                      updateEditForm("position", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Localisation
                  </label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(event) =>
                      updateEditForm("location", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Source
                  </label>
                  <select
                    value={editForm.source}
                    onChange={(event) =>
                      updateEditForm("source", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Sélectionner une source</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Indeed">Indeed</option>
                    <option value="HelloWork">HelloWork</option>
                    <option value="Site entreprise">
                      Site entreprise
                    </option>
                    <option value="Candidature spontanée">
                      Candidature spontanée
                    </option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Date de candidature
                  </label>
                  <input
                    type="date"
                    value={editForm.application_date}
                    onChange={(event) =>
                      updateEditForm(
                        "application_date",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Statut
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      updateEditForm("status", event.target.value)
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

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Lien de l'offre
                  </label>
                  <input
                    type="url"
                    value={editForm.job_url}
                    onChange={(event) =>
                      updateEditForm("job_url", event.target.value)
                    }
                    placeholder="https://..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Salaire
                  </label>
                  <input
                    type="text"
                    value={editForm.salary}
                    onChange={(event) =>
                      updateEditForm("salary", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Recruteur
                  </label>
                  <input
                    type="text"
                    value={editForm.recruiter}
                    onChange={(event) =>
                      updateEditForm("recruiter", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email du recruteur
                  </label>
                  <input
                    type="email"
                    value={editForm.recruiter_email}
                    onChange={(event) =>
                      updateEditForm(
                        "recruiter_email",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(event) =>
                    updateEditForm("notes", event.target.value)
                  }
                  rows={5}
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {savingEdit ? "Enregistrement..." : "💾 Enregistrer"}
                </button>

                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={savingEdit}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Annuler
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* EN-TÊTE */}
            <div className="border-b border-slate-200 px-6 py-6 md:px-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                    Candidature #{application.id}
                  </p>

                  <h1 className="mt-2 text-3xl font-bold text-slate-900">
                    {application.position}
                  </h1>

                  <p className="mt-2 text-xl text-slate-600">
                    {application.company}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${getStatusStyle(
                    application.status
                  )}`}
                >
                  {application.status}
                </span>
              </div>
            </div>

            {/* INFORMATIONS */}
            <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
              <div className="rounded-xl border border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-800">
                  Informations du poste
                </h2>

                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="text-sm text-slate-500">
                      Entreprise
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {application.company}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">
                      Poste
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {application.position}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">
                      Localisation
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {application.location || "Non renseignée"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">
                      Source
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {application.source || "Non renseignée"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-800">
                  Suivi de la candidature
                </h2>

                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="text-sm text-slate-500">
                      Statut
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {application.status}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">
                      Date de candidature
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {formatDate(application.application_date)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">
                      Recruteur
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {application.recruiter || "Non renseigné"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm text-slate-500">
                      Email du recruteur
                    </dt>
                    <dd className="mt-1 break-all font-medium text-slate-900">
                      {application.recruiter_email || "Non renseigné"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-800">
                  Rémunération
                </h2>

                <p className="mt-4 text-lg font-medium text-slate-900">
                  {application.salary || "Non renseignée"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-800">
                  Offre d'emploi
                </h2>

                {application.job_url ? (
                  <a
                    href={application.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex font-medium text-blue-600 transition hover:text-blue-800 hover:underline"
                  >
                    Voir l'offre originale ↗
                  </a>
                ) : (
                  <p className="mt-4 text-slate-500">
                    Aucun lien enregistré.
                  </p>
                )}
              </div>
            </div>

            {/* NOTES */}
            <div className="border-t border-slate-200 p-6 md:p-8">
              <h2 className="text-lg font-bold text-slate-800">
                Notes et suivi
              </h2>

              <div className="mt-4 min-h-32 whitespace-pre-wrap rounded-xl bg-slate-50 p-5 text-slate-700">
                {application.notes ||
                  "Aucune note enregistrée pour cette candidature."}
              </div>
            </div>
          </section>
        )}

        {/* HISTORIQUE DES ÉCHANGES */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5 md:px-8">
            <h2 className="text-xl font-bold text-slate-800">
              🕒 Historique des échanges
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Relances, réponses, entretiens et notes de suivi.
            </p>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-[1fr_1.4fr] md:p-8">
            {/* FORMULAIRE D'AJOUT D'HISTORIQUE */}
            <form
              onSubmit={handleHistorySubmit}
              className="h-fit space-y-4 rounded-xl border border-slate-200 p-5"
            >
              <h3 className="font-semibold text-slate-800">
                Ajouter un événement
              </h3>

              {historyError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {historyError}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Type
                </label>
                <select
                  value={historyForm.type}
                  onChange={(event) =>
                    updateHistoryForm("type", event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {HISTORY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Date
                </label>
                <input
                  type="date"
                  value={historyForm.date}
                  onChange={(event) =>
                    updateHistoryForm("date", event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Note
                </label>
                <textarea
                  value={historyForm.note}
                  onChange={(event) =>
                    updateHistoryForm("note", event.target.value)
                  }
                  rows={3}
                  placeholder="Détails de l'échange..."
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={submittingHistory}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {submittingHistory ? "Ajout..." : "➕ Ajouter à l'historique"}
              </button>
            </form>

            {/* LISTE DE L'HISTORIQUE */}
            <div>
              {historyLoading && (
                <p className="text-sm text-slate-500">
                  Chargement de l'historique...
                </p>
              )}

              {!historyLoading && history.length === 0 && (
                <p className="text-sm text-slate-500">
                  Aucun événement enregistré pour le moment.
                </p>
              )}

              {!historyLoading && history.length > 0 && (
                <ol className="relative space-y-5 border-l-2 border-slate-200 pl-5">
                  {history.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-blue-500" />

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getHistoryTypeStyle(
                                entry.type
                              )}`}
                            >
                              {entry.type}
                            </span>

                            <span className="text-sm text-slate-500">
                              {formatDateTime(entry.date)}
                            </span>
                          </div>

                          {entry.note && (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                              {entry.note}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteHistoryEntry(entry.id)
                          }
                          className="shrink-0 text-sm text-slate-400 transition hover:text-red-600"
                          aria-label="Supprimer cet événement"
                        >
                          🗑️
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
