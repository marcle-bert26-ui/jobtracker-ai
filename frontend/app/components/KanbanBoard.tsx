"use client";

import Link from "next/link";
import { useState } from "react";

type KanbanApplication = {
  id: number;
  company: string;
  position: string;
  location: string | null;
  status: string;
  application_date: string | null;
};

const COLUMNS = [
  "Candidature envoyée",
  "En attente",
  "Relance",
  "Entretien",
  "Offre reçue",
  "Acceptée",
  "Refusée",
];

const COLUMN_ACCENTS: Record<string, string> = {
  "Candidature envoyée": "border-t-slate-400",
  "En attente": "border-t-orange-400",
  Relance: "border-t-amber-400",
  Entretien: "border-t-blue-400",
  "Offre reçue": "border-t-purple-400",
  Acceptée: "border-t-green-400",
  Refusée: "border-t-red-400",
};

function formatDate(date: string | null) {
  if (!date) return "—";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export default function KanbanBoard({
  applications,
  onStatusChange,
}: {
  applications: KanbanApplication[];
  onStatusChange: (applicationId: number, newStatus: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  function handleDrop(status: string) {
    setDragOverColumn(null);

    if (draggingId === null) return;

    const application = applications.find((a) => a.id === draggingId);
    if (application && application.status !== status) {
      onStatusChange(draggingId, status);
    }

    setDraggingId(null);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((status) => {
        const columnApplications = applications.filter(
          (application) => application.status === status
        );

        return (
          <div
            key={status}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverColumn(status);
            }}
            onDragLeave={() =>
              setDragOverColumn((current) =>
                current === status ? null : current
              )
            }
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(status);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-xl border-t-4 bg-slate-50 ${
              COLUMN_ACCENTS[status] || "border-t-slate-300"
            } ${dragOverColumn === status ? "ring-2 ring-blue-300" : ""}`}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <p className="text-sm font-semibold text-slate-700">{status}</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                {columnApplications.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 px-2 pb-2">
              {columnApplications.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-slate-400">
                  Aucune candidature
                </p>
              )}

              {columnApplications.map((application) => (
                <div
                  key={application.id}
                  draggable
                  onDragStart={() => setDraggingId(application.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverColumn(null);
                  }}
                  className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing ${
                    draggingId === application.id ? "opacity-40" : ""
                  }`}
                >
                  <Link
                    href={`/applications/${application.id}`}
                    className="block"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900 hover:underline">
                      {application.company}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {application.position}
                    </p>
                  </Link>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">
                      {application.location || "—"} ·{" "}
                      {formatDate(application.application_date)}
                    </span>
                  </div>

                  {/* Repli sans glisser-déposer, utile au tactile */}
                  <select
                    value={application.status}
                    onChange={(event) =>
                      onStatusChange(application.id, event.target.value)
                    }
                    onClick={(event) => event.stopPropagation()}
                    className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 outline-none transition focus:border-blue-400"
                  >
                    {COLUMNS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
