"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Application = {
  id: number;
  company: string;
  position: string;
  status: string;
  application_date: string | null;
  created_at: string;
};

type Granularity = "week" | "month";

const STATUS_COLORS: Record<string, string> = {
  entretien: "#2563eb",
  envoy: "#64748b",
  accept: "#16a34a",
  offre: "#16a34a",
  refus: "#dc2626",
  rejet: "#dc2626",
  attente: "#ea580c",
  "en cours": "#ea580c",
};

const DEFAULT_COLOR = "#64748b";
const POSITION_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#4d7c0f",
  "#94a3b8",
];

function getStatusColor(status: string) {
  const normalized = status.toLowerCase();
  const match = Object.entries(STATUS_COLORS).find(([key]) =>
    normalized.includes(key)
  );
  return match ? match[1] : DEFAULT_COLOR;
}

function getApplicationDate(app: Application): Date {
  return new Date(app.application_date ?? app.created_at);
}

function getApplicationYear(app: Application): number | null {
  const date = getApplicationDate(app);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
}

// Numéro de semaine ISO 8601 (lundi = début de semaine, la semaine 1
// contient le premier jeudi de l'année).
function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNumber = (target.getUTCDay() + 6) % 7; // lundi = 0 ... dimanche = 6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // jeudi de cette semaine

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);

  const week =
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

  return { year: target.getUTCFullYear(), week };
}

function bucketFor(dateString: string, granularity: Granularity, showYear: boolean) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return { key: "0000-00", label: "Inconnu" };
  }

  if (granularity === "week") {
    const { year, week } = getIsoWeekInfo(date);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const label = showYear ? `S${week} '${String(year).slice(2)}` : `S${week}`;
    return { key, label };
  }

  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const label = date.toLocaleDateString("fr-FR", {
    month: "short",
    ...(showYear ? { year: "2-digit" as const } : {}),
  });
  return { key, label };
}

export default function StatsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");

  useEffect(() => {
    async function loadApplications() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_URL}/applications`);
        if (!response.ok) {
          throw new Error("Impossible de charger les candidatures.");
        }
        const data = await response.json();
        setApplications(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue."
        );
      } finally {
        setLoading(false);
      }
    }

    loadApplications();
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const app of applications) {
      const year = getApplicationYear(app);
      if (year !== null) years.add(year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [applications]);

  const filteredApplications = useMemo(() => {
    if (selectedYear === "all") return applications;
    return applications.filter((app) => getApplicationYear(app) === selectedYear);
  }, [applications, selectedYear]);

  const timeSeriesData = useMemo(() => {
    const buckets = new Map<string, { key: string; label: string; count: number }>();
    const showYear = selectedYear === "all";

    for (const app of filteredApplications) {
      const dateSource = app.application_date ?? app.created_at;
      const { key, label } = bucketFor(dateSource, granularity, showYear);

      if (!buckets.has(key)) {
        buckets.set(key, { key, label, count: 0 });
      }
      buckets.get(key)!.count += 1;
    }

    return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredApplications, granularity, selectedYear]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const app of filteredApplications) {
      const label = app.status || "Non renseigné";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredApplications]);

  const positionData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const app of filteredApplications) {
      const label = app.position || "Non renseigné";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    const sorted = Array.from(counts.entries())
      .map(([position, count]) => ({ position, count }))
      .sort((a, b) => b.count - a.count);

    const TOP_N = 8;
    if (sorted.length <= TOP_N) {
      return sorted;
    }

    const top = sorted.slice(0, TOP_N);
    const rest = sorted.slice(TOP_N);
    const otherCount = rest.reduce((sum, item) => sum + item.count, 0);

    return [...top, { position: "Autres", count: otherCount }];
  }, [filteredApplications]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Retour aux candidatures
        </Link>

        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-300 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              📊 Statistiques
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Vue d&apos;ensemble de ta recherche d&apos;emploi.
            </p>
          </div>

          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="year-filter"
                className="text-sm font-medium text-slate-600"
              >
                Année :
              </label>
              <select
                id="year-filter"
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(
                    e.target.value === "all" ? "all" : Number(e.target.value)
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Toutes les années</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Erreur</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {loading && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Chargement des statistiques...
          </div>
        )}

        {!loading && !error && applications.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Pas encore de candidature enregistrée — les statistiques
            apparaîtront ici une fois que tu en auras ajouté.
          </div>
        )}

        {!loading && !error && applications.length > 0 && (
          <div className="grid gap-6">
            {/* NOUVELLES CANDIDATURES DANS LE TEMPS */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Nouvelles candidatures
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Nombre de candidatures postulées,{" "}
                    {granularity === "week" ? "par semaine" : "par mois"}.
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => setGranularity("week")}
                    className={`rounded-md px-3 py-1.5 transition ${
                      granularity === "week"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Semaine
                  </button>
                  <button
                    type="button"
                    onClick={() => setGranularity("month")}
                    className={`rounded-md px-3 py-1.5 transition ${
                      granularity === "month"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Mois
                  </button>
                </div>
              </div>

              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#475569" }}
                      angle={granularity === "week" ? -45 : 0}
                      textAnchor={granularity === "week" ? "end" : "middle"}
                      height={granularity === "week" ? 50 : 30}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "#475569" }}
                    />
                    <Tooltip
                      formatter={(value: number) => [value, "Candidatures"]}
                    />
                    <Bar
                      dataKey="count"
                      name="Candidatures"
                      fill="#2563eb"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* RÉPARTITION PAR STATUT */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">
                  Répartition par statut
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Où en sont tes candidatures
                  {selectedYear === "all" ? "" : ` en ${selectedYear}`}.
                </p>

                <div className="mt-4 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ status, count }) => `${status} (${count})`}
                        labelLine={false}
                      >
                        {statusData.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={getStatusColor(entry.status)}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value) => value}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* RÉPARTITION PAR POSTE */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">
                  Répartition par poste
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Les intitulés de poste les plus fréquents
                  {selectedYear === "all" ? "" : ` en ${selectedYear}`}.
                </p>

                <div className="mt-4 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={positionData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 12, fill: "#475569" }}
                      />
                      <YAxis
                        type="category"
                        dataKey="position"
                        width={110}
                        tick={{ fontSize: 11, fill: "#475569" }}
                      />
                      <Tooltip
                        formatter={(value: number) => [value, "Candidatures"]}
                      />
                      <Bar dataKey="count" name="Candidatures" radius={[0, 6, 6, 0]}>
                        {positionData.map((entry, index) => (
                          <Cell
                            key={entry.position}
                            fill={POSITION_COLORS[index % POSITION_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
