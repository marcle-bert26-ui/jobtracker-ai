"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Application = {
  id: number;
  company: string;
  position: string;
  location: string | null;
  status: string;
  application_date: string | null;
  created_at: string;
};

// Colonnes dans l'ordre logique de progression d'une candidature.
// "Refusée" ferme la branche plutôt que de la faire progresser, mais
// reste une colonne à part entière pour ne perdre aucune candidature.
const COLUMNS = [
  "Candidature envoyée",
  "En attente",
  "Relance",
  "Entretien",
  "Offre reçue",
  "Acceptée",
  "Refusée",
];

const COLUMN_STYLES: Record<string, string> = {
  "Candidature envoyée": "border-t-slate-400",
  "En attente": "border-t-orange-400",
  Relance: "border-t-amber-400",
  Entretien: "border-t-blue-500",
  "Offre reçue": "border-t-emerald-400",
  Acceptée: "border-t-green-500",
  Refusée: "border-t-red-400",
};

function formatDate(date: string | null) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function KanbanPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");

  async function loadApplications() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/applications`);

      if (!response.ok) {
        throw new Error("Impossible de charger les candidatures.");
      }

      const data: Application[] = await response.json();
      setApplications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial des candidatures
    void loadApplications();
  }, []);

  // Colonne "fourre-tout" pour les statuts hors de la liste connue (ex :
  // saisis librement ailleurs) — pour ne jamais faire disparaître une
  // candidature de la vue kanban.
  const knownStatuses = new Set(COLUMNS);
  const otherStatuses = Array.from(
    new Set(
      applications
        .map((application) => application.status)
        .filter((status) => !knownStatuses.has(status))
    )
  );
  const allColumns = [...COLUMNS, ...otherStatuses];

  async function moveApplication(applicationId: number, newStatus: string) {
    const application = applications.find((a) => a.id === applicationId);
    if (!application || application.status === newStatus) return;

    const previousApplications = applications;

    // Mise à jour optimiste : le déplacement s'affiche immédiatement, on
    // annule si la sauvegarde échoue.
    setApplications((current) =>
      current.map((a) =>
        a.id === applicationId ? { ...a, status: newStatus } : a
      )
    );

    try {
      setUpdateError("");

      const response = await fetch(`${API_URL}/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Impossible de mettre à jour le statut.");
      }
    } catch (err) {
      setApplications(previousApplications);
      setUpdateError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-blue-700 transition hover:text-blue-900"
          >
            ← Retour aux candidatures
          </Link>

          <h1 className="text-2xl font-bold text-slate-900">📌 Kanban</h1>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {updateError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {updateError}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Chargement...
          </div>
        )}

        {!loading && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {allColumns.map((column) => {
              const columnApplications = applications.filter(
                (application) => application.status === column
              );

              return (
                <div
                  key={column}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverColumn(column);
                  }}
                  onDragLeave={() => setDragOverColumn(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOverColumn(null);
                    if (dragId !== null) {
                      void moveApplication(dragId, column);
                    }
                  }}
                  className={`flex w-72 shrink-0 flex-col rounded-2xl border-t-4 bg-white shadow-sm transition ${
                    COLUMN_STYLES[column] || "border-t-slate-300"
                  } ${dragOverColumn === column ? "ring-2 ring-blue-300" : ""}`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-700">
                      {column}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      {columnApplications.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2 p-3">
                    {columnApplications.length === 0 && (
                      <p className="px-1 py-4 text-center text-xs text-slate-400">
                        Aucune candidature
                      </p>
                    )}

                    {columnApplications.map((application) => (
                      <Link
                        key={application.id}
                        href={`/applications/${application.id}`}
                        draggable
                        onDragStart={() => setDragId(application.id)}
                        onDragEnd={() => setDragId(null)}
                        className={`block cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow active:cursor-grabbing ${
                          dragId === application.id ? "opacity-40" : ""
                        }`}
                      >
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {application.company}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {application.position}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            {formatDate(
                              application.application_date ||
                                application.created_at
                            )}
                          </span>
                          {application.location && (
                            <span className="truncate">
                              {application.location}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Glisse une carte vers une autre colonne pour changer son statut.
          </p>
        )}
      </div>
    </main>
  );
}
