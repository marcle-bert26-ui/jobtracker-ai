"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type CompanySuggestion = {
  name: string;
  why: string;
};

type ProfileResponse = {
  has_cv: boolean;
};

export default function SpontaneousPage() {
  const [hasCv, setHasCv] = useState<boolean | null>(null);

  // Suggestions
  const [sector, setSector] = useState("");
  const [location, setLocation] = useState("");
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Générateur de lettre
  const [company, setCompany] = useState("");
  const [context, setContext] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

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
      setSuggestions(data.companies || []);
    } catch (err) {
      setSuggestError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    } finally {
      setSuggestLoading(false);
    }
  }

  async function generateLetter() {
    if (!company.trim()) {
      setGenerateError("Indique le nom de l'entreprise ciblée.");
      return;
    }

    try {
      setGenerating(true);
      setGenerateError("");

      const response = await fetch(`${API_URL}/spontaneous/generate-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          context: context.trim() || null,
          extra_instructions: extraInstructions.trim() || null,
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
        throw new Error(detail || "Impossible de générer la lettre.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `candidature-spontanee-${company.trim()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Une erreur est survenue."
      );
    } finally {
      setGenerating(false);
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
            ).
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
            ⚠️ L&apos;IA locale n&apos;a pas accès à internet — ces
            suggestions viennent uniquement de ce qu&apos;elle a appris à
            l&apos;entraînement, potentiellement daté ou incomplet.
            Vérifie toujours qu&apos;une entreprise existe bien et recrute
            avant de la contacter.
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
            {suggestLoading ? "Recherche en cours..." : "🔍 Suggérer des entreprises"}
          </button>

          {suggestError && (
            <p className="mt-3 text-sm text-red-600">{suggestError}</p>
          )}

          {hasSearched && !suggestLoading && suggestions.length === 0 && !suggestError && (
            <p className="mt-3 text-sm text-slate-500">
              Aucune suggestion trouvée — essaie un secteur plus large.
            </p>
          )}

          {suggestions.length > 0 && (
            <ul className="mt-4 space-y-2">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.name}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {suggestion.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCompany(suggestion.name);
                        window.scrollTo({
                          top: document.body.scrollHeight,
                          behavior: "smooth",
                        });
                      }}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Générer une lettre pour cette entreprise →
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {suggestion.why}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* GÉNÉRATEUR DE LETTRE */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-bold text-slate-800">
            Générer une lettre de candidature spontanée
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Brouillon à relire avant envoi — l&apos;IA s&apos;appuie sur
            ton CV importé.
          </p>

          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Nom de l'entreprise *"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              rows={2}
              placeholder="Contexte / ce qui motive cette candidature (optionnel)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="text"
              value={extraInstructions}
              onChange={(event) => setExtraInstructions(event.target.value)}
              placeholder="Consignes supplémentaires (optionnel)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={() => void generateLetter()}
            disabled={generating || hasCv === false}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {generating ? "Génération en cours..." : "📄 Générer la lettre (PDF)"}
          </button>

          {generateError && (
            <p className="mt-3 text-sm text-red-600">{generateError}</p>
          )}
        </section>
      </div>
    </main>
  );
}
