"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type CompanySuggestion = {
  name: string;
  why: string | null;
  application_id: number;
  created: boolean;
};

type ProfileResponse = {
  has_cv: boolean;
};

type BulkAddResult = {
  name: string;
  application_id: number | null;
  success: boolean;
  error: string | null;
};

function googleSearchUrl(company: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${company} site carrières recrutement`
  )}`;
}

function linkedinSearchUrl(company: string) {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(
    company
  )}`;
}

export default function SpontaneousPage() {
  const [hasCv, setHasCv] = useState<boolean | null>(null);

  // Suggestions
  const [sector, setSector] = useState("");
  const [location, setLocation] = useState("");
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Ajout manuel
  const [manualCompany, setManualCompany] = useState("");
  const [manualContext, setManualContext] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualAdded, setManualAdded] = useState<CompanySuggestion | null>(null);

  // Ajout en lot
  const [bulkText, setBulkText] = useState("");
  const [bulkContext, setBulkContext] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkAddResult[]>([]);

  useEffect(() => {
    async function checkProfile() {
      try {
        const response = await fetch(`${API_URL}/profile/cv`);
        if (response.ok) {
          const data: ProfileResponse = await response.json();
          setHasCv(data.has_cv);
        }
      } catch {
        setHasCv(false);
      }
    }

    void checkProfile();
  }, []);

  async function fetchSuggestions() {
    if (!sector.trim()) {
      setSuggestError("Indique un secteur ou type de poste.");
      return;
    }

    try {
      setSuggestLoading(true);
      setSuggestError("");
      setHasSearched(true);

      const response = await fetch(`${API_URL}/spontaneous/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector: sector.trim(),
          location: location.trim() || null,
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
        throw new Error(detail || "Impossible de générer des suggestions.");
      }

      const data: { companies: CompanySuggestion[] } = await response.json();
      setSuggestions((current) => [...data.companies, ...current]);
    } catch (err) {
      setSuggestError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    } finally {
      setSuggestLoading(false);
    }
  }

  async function addManualCompany() {
    if (!manualCompany.trim()) {
      setManualError("Indique le nom de l'entreprise.");
      return;
    }

    try {
      setAddingManual(true);
      setManualError("");
      setManualAdded(null);

      const response = await fetch(`${API_URL}/spontaneous/add-company`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: manualCompany.trim(),
          context: manualContext.trim() || null,
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
        throw new Error(detail || "Impossible d'ajouter cette entreprise.");
      }

      const data: {
        name: string;
        application_id: number;
        created: boolean;
      } = await response.json();

      setManualAdded({
        name: data.name,
        why: manualContext.trim() || null,
        application_id: data.application_id,
        created: data.created,
      });
      setManualCompany("");
      setManualContext("");
    } catch (err) {
      setManualError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    } finally {
      setAddingManual(false);
    }
  }

  async function addCompaniesBulk() {
    const companies = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (companies.length === 0) {
      setBulkError("Colle au moins un nom d'entreprise (une par ligne).");
      return;
    }

    try {
      setBulkAdding(true);
      setBulkError("");
      setBulkResults([]);

      const response = await fetch(
        `${API_URL}/spontaneous/add-companies-bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companies,
            context: bulkContext.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Impossible de traiter la liste.");
      }

      const data: { results: BulkAddResult[] } = await response.json();
      setBulkResults(data.results);
      setBulkText("");
    } catch (err) {
      setBulkError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    } finally {
      setBulkAdding(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm font-medium text-blue-700 transition hover:text-blue-900"
        >
          ← Retour aux candidatures
        </Link>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            🎯 Candidature spontanée
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Basé sur ton CV importé (page{" "}
            <Link href="/profile" className="text-blue-600 hover:underline">
              Mon profil
            </Link>
            ). Chaque entreprise ci-dessous devient directement une fiche
            candidature — génère son CV et sa lettre de motivation depuis
            la fiche, comme pour n&apos;importe quelle autre candidature.
          </p>
        </div>

        {hasCv === false && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Tu n&apos;as pas encore importé de CV —{" "}
            <Link href="/profile" className="font-semibold underline">
              importe-le d&apos;abord
            </Link>{" "}
            pour utiliser cette page.
          </div>
        )}

        {/* SUGGESTIONS D'ENTREPRISES */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-bold text-slate-800">
            Trouver des entreprises à cibler
          </h2>
          <p className="mt-1 text-sm text-amber-700">
            ⚠️ L&apos;IA locale n&apos;a pas accès à internet — ces noms
            viennent uniquement de ce qu&apos;elle a appris à
            l&apos;entraînement, potentiellement daté ou incomplet, et
            aucune adresse email n&apos;est fournie (elle n&apos;a aucun
            moyen fiable de la connaître). Vérifie toujours qu&apos;une
            entreprise existe bien et recrute avant de la contacter — un
            lien de recherche est fourni pour chacune.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              placeholder="Secteur ou type de poste (ex : ingénierie procédés industriels)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Zone géographique (optionnel)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={() => void fetchSuggestions()}
            disabled={suggestLoading || hasCv === false}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {suggestLoading
              ? "Recherche en cours..."
              : "🔍 Suggérer des entreprises (crée les fiches)"}
          </button>

          {suggestError && (
            <p className="mt-3 text-sm text-red-600">{suggestError}</p>
          )}

          {hasSearched &&
            !suggestLoading &&
            suggestions.length === 0 &&
            !suggestError && (
              <p className="mt-3 text-sm text-slate-500">
                Aucune suggestion trouvée — essaie un secteur plus large.
              </p>
            )}

          {suggestions.length > 0 && (
            <ul className="mt-4 space-y-2">
              {suggestions.map((suggestion) => (
                <li
                  key={`${suggestion.application_id}-${suggestion.name}`}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {suggestion.name}
                      </p>
                      {suggestion.why && (
                        <p className="mt-1 text-sm text-slate-500">
                          {suggestion.why}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/applications/${suggestion.application_id}`}
                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      Voir la fiche →
                    </Link>
                  </div>

                  <div className="mt-2 flex gap-3 text-xs">
                    <a
                      href={googleSearchUrl(suggestion.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      🔎 Chercher sur Google
                    </a>
                    <a
                      href={linkedinSearchUrl(suggestion.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      🔎 Chercher sur LinkedIn
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AJOUT MANUEL */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-bold text-slate-800">
            Ajouter une entreprise toi-même
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Pour une entreprise que tu as déjà en tête, hors suggestions —
            crée directement sa fiche candidature.
          </p>

          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={manualCompany}
              onChange={(event) => setManualCompany(event.target.value)}
              placeholder="Nom de l'entreprise *"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="text"
              value={manualContext}
              onChange={(event) => setManualContext(event.target.value)}
              placeholder="Pourquoi cette entreprise (optionnel — sert de note sur la fiche)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={() => void addManualCompany()}
            disabled={addingManual}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {addingManual ? "Ajout..." : "➕ Créer la fiche"}
          </button>

          {manualError && (
            <p className="mt-3 text-sm text-red-600">{manualError}</p>
          )}

          {manualAdded && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-800">{manualAdded.name}</p>
              <Link
                href={`/applications/${manualAdded.application_id}`}
                className="text-sm font-semibold text-blue-700 hover:underline"
              >
                Voir la fiche →
              </Link>
            </div>
          )}
        </section>

        {/* AJOUT EN LOT */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-bold text-slate-800">
            Coller une longue liste d&apos;entreprises
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Une entreprise par ligne — chacune devient une fiche
            candidature spontanée distincte.
          </p>

          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            rows={8}
            placeholder={"Artelia\nTRIGO\nVulcain Engineering Group\n..."}
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <input
            type="text"
            value={bulkContext}
            onChange={(event) => setBulkContext(event.target.value)}
            placeholder="Note commune à toutes (optionnel)"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="button"
            onClick={() => void addCompaniesBulk()}
            disabled={bulkAdding}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {bulkAdding
              ? "Création en cours..."
              : "➕ Créer une fiche par entreprise"}
          </button>

          {bulkError && (
            <p className="mt-3 text-sm text-red-600">{bulkError}</p>
          )}

          {bulkResults.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {bulkResults.map((result) => (
                <li
                  key={result.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className={
                      result.success ? "text-slate-700" : "text-red-600"
                    }
                  >
                    {result.success ? "✓" : "✗"} {result.name}
                    {result.error && ` — ${result.error}`}
                  </span>
                  {result.success && result.application_id && (
                    <Link
                      href={`/applications/${result.application_id}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Voir →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
