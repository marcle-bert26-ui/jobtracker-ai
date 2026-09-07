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

type DuplicateGroup = {
  key: string;
  applications: Application[];
};

type DuplicatesResponse = {
  groups: DuplicateGroup[];
};

type MergeResult = {
  kept_id: number;
  merged_count: number;
};

function formatDate(date: string | null) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Sélection courante pour un groupe : quelle fiche garder, et lesquelles
// des autres fusionner dedans (toutes par défaut, décochables).
type GroupSelection = {
  keepId: number;
  mergeIds: Set<number>;
};

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selections, setSelections] = useState<Record<string, GroupSelection>>(
    {}
  );
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState("");

  async function loadDuplicates() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/applications/duplicates`);

      if (!response.ok) {
        throw new Error("Impossible de récupérer les doublons.");
      }

      const data: DuplicatesResponse = await response.json();
      setGroups(data.groups);

      // Sélection par défaut : garder la plus ancienne (souvent la
      // première créée, donc la plus complète/relue), fusionner le reste.
      const defaultSelections: Record<string, GroupSelection> = {};
      for (const group of data.groups) {
        const [first, ...rest] = group.applications;
        defaultSelections[group.key] = {
          keepId: first.id,
          mergeIds: new Set(rest.map((application) => application.id)),
        };
      }
      setSelections(defaultSelections);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial des doublons
    void loadDuplicates();
  }, []);

  function setKeepId(groupKey: string, applicationId: number) {
    setSelections((current) => {
      const group = groups.find((g) => g.key === groupKey);
      if (!group) return current;

      const mergeIds = new Set(
        group.applications
          .map((application) => application.id)
          .filter((id) => id !== applicationId)
      );

      return {
        ...current,
        [groupKey]: { keepId: applicationId, mergeIds },
      };
    });
  }

  function toggleMerge(groupKey: string, applicationId: number) {
    setSelections((current) => {
      const selection = current[groupKey];
      if (!selection || applicationId === selection.keepId) return current;

      const mergeIds = new Set(selection.mergeIds);
      if (mergeIds.has(applicationId)) {
        mergeIds.delete(applicationId);
      } else {
        mergeIds.add(applicationId);
      }

      return { ...current, [groupKey]: { ...selection, mergeIds } };
    });
  }

  async function mergeGroup(groupKey: string) {
    const selection = selections[groupKey];
    if (!selection || selection.mergeIds.size === 0) return;

    try {
      setMergingKey(groupKey);
      setMergeError("");

      const response = await fetch(`${API_URL}/applications/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keep_id: selection.keepId,
          merge_ids: Array.from(selection.mergeIds),
        }),
      });

      if (!response.ok) {
        let detail = "";
        try {
          const body = await response.json();
          detail = body.detail || "";
        } catch {
          // ignore
        }
        throw new Error(detail || "Impossible de fusionner ces candidatures.");
      }

      const result: MergeResult = await response.json();

      // Retire le groupe fusionné de la liste (ou le recharge si des
      // doublons restent, ex: fusion partielle).
      if (result.merged_count === (groups.find((g) => g.key === groupKey)?.applications.length ?? 0) - 1) {
        setGroups((current) => current.filter((g) => g.key !== groupKey));
      } else {
        await loadDuplicates();
      }
    } catch (err) {
      setMergeError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    } finally {
      setMergingKey(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Retour aux candidatures
        </Link>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5 md:px-8">
            <h1 className="text-2xl font-bold text-slate-900">
              🧹 Doublons de candidatures
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Candidatures groupées par nom d&apos;entreprise similaire.
              Deux fiches pour la même entreprise ne sont pas forcément un
              doublon (ça peut être deux postes différents) — vérifie
              avant de fusionner : la fusion déplace tout l&apos;historique
              et les emails rattachés vers la fiche conservée, puis
              supprime les autres définitivement.
            </p>
          </div>

          {loading && (
            <div className="p-8 text-center text-slate-500">
              Recherche de doublons...
            </div>
          )}

          {error && (
            <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {mergeError && (
            <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {mergeError}
            </div>
          )}

          {!loading && !error && groups.length === 0 && (
            <div className="p-10 text-center text-slate-500">
              Aucun doublon détecté 🎉
            </div>
          )}

          {!loading &&
            groups.map((group) => {
              const selection = selections[group.key];
              if (!selection) return null;

              return (
                <div
                  key={group.key}
                  className="border-b border-slate-200 px-6 py-5 last:border-b-0 md:px-8"
                >
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                    {group.applications[0].company}
                  </p>

                  <div className="space-y-2">
                    {group.applications.map((application) => {
                      const isKeep = selection.keepId === application.id;
                      const isMerging = selection.mergeIds.has(application.id);

                      return (
                        <div
                          key={application.id}
                          className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                            isKeep
                              ? "border-green-300 bg-green-50"
                              : isMerging
                              ? "border-red-200 bg-red-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`keep-${group.key}`}
                            checked={isKeep}
                            onChange={() =>
                              setKeepId(group.key, application.id)
                            }
                            className="mt-1"
                            title="Conserver cette fiche"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900">
                              {application.position}
                            </p>
                            <p className="text-sm text-slate-500">
                              {application.status} · Créée le{" "}
                              {formatDate(application.created_at)}
                              {application.location
                                ? ` · ${application.location}`
                                : ""}
                            </p>
                          </div>

                          {isKeep ? (
                            <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                              ✓ Conservée
                            </span>
                          ) : (
                            <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                              <input
                                type="checkbox"
                                checked={isMerging}
                                onChange={() =>
                                  toggleMerge(group.key, application.id)
                                }
                              />
                              Fusionner
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => mergeGroup(group.key)}
                    disabled={
                      mergingKey === group.key || selection.mergeIds.size === 0
                    }
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {mergingKey === group.key
                      ? "Fusion en cours..."
                      : `Fusionner ${selection.mergeIds.size} fiche${
                          selection.mergeIds.size > 1 ? "s" : ""
                        } dans celle conservée`}
                  </button>
                </div>
              );
            })}
        </section>
      </div>
    </main>
  );
}
