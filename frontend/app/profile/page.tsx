"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ProfileResponse = {
  has_cv: boolean;
  filename: string | null;
  cv_text: string | null;
  uploaded_at: string | null;
};

function formatDateTime(date: string | null) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editedText, setEditedText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/profile/cv`);

      if (!response.ok) {
        throw new Error("Impossible de récupérer le profil.");
      }

      const data: ProfileResponse = await response.json();
      setProfile(data);
      setEditedText(data.cv_text || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial du profil
    void loadProfile();
  }, []);

  async function handleFileUpload(file: File) {
    try {
      setUploading(true);
      setError("");
      setSuccessMessage("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/profile/cv`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let detail = "";
        try {
          const body = await response.json();
          detail = body.detail || "";
        } catch {
          // ignore
        }
        throw new Error(detail || "Impossible d'importer ce fichier.");
      }

      const data: ProfileResponse = await response.json();
      setProfile(data);
      setEditedText(data.cv_text || "");
      setSuccessMessage("CV importé avec succès.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSaveText() {
    if (!editedText.trim()) {
      setError("Le texte du CV ne peut pas être vide.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch(`${API_URL}/profile/cv`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv_text: editedText }),
      });

      if (!response.ok) {
        throw new Error("Impossible d'enregistrer le CV.");
      }

      const data: ProfileResponse = await response.json();
      setProfile(data);
      setSuccessMessage("CV enregistré.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch(`${API_URL}/profile/cv`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Impossible de supprimer le CV.");
      }

      setProfile({ has_cv: false, filename: null, cv_text: null, uploaded_at: null });
      setEditedText("");
      setSuccessMessage("CV supprimé.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setDeleting(false);
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

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5 md:px-8">
            <h1 className="text-2xl font-bold text-slate-900">👤 Mon profil</h1>
            <p className="mt-1 text-sm text-slate-500">
              Importe ton CV (.pdf ou .docx) — il sert de base pour générer
              des CV et lettres de motivation adaptés à chaque candidature,
              et des messages de candidature spontanée. Rien n&apos;est
              inventé : l&apos;IA s&apos;appuie uniquement sur ce qui est
              écrit ici.
            </p>
          </div>

          <div className="space-y-5 p-6 md:p-8">
            {loading && (
              <p className="text-center text-slate-500">Chargement...</p>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            {!loading && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {profile?.has_cv
                      ? "Remplacer le CV importé"
                      : "Importer un CV (.pdf ou .docx)"}
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleFileUpload(file);
                    }}
                    disabled={uploading}
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
                  />

                  {uploading && (
                    <p className="mt-2 text-sm text-slate-500">
                      Import et extraction du texte en cours...
                    </p>
                  )}

                  {profile?.has_cv && (
                    <p className="mt-2 text-xs text-slate-400">
                      Actuel : {profile.filename} — importé le{" "}
                      {formatDateTime(profile.uploaded_at)}
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">
                      Texte du CV{" "}
                      {profile?.has_cv
                        ? "(vérifie/corrige l'extraction si besoin)"
                        : "(ou colle-le directement ici)"}
                    </label>
                  </div>

                  <textarea
                    value={editedText}
                    onChange={(event) => setEditedText(event.target.value)}
                    rows={16}
                    placeholder="Colle ici le texte de ton CV si tu préfères ne pas importer de fichier..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm leading-relaxed outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveText()}
                      disabled={saving}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {saving ? "Enregistrement..." : "💾 Enregistrer le texte"}
                    </button>

                    {profile?.has_cv && (
                      <button
                        type="button"
                        onClick={() => void handleDelete()}
                        disabled={deleting}
                        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deleting ? "..." : "🗑️ Supprimer le CV"}
                      </button>
                    )}
                  </div>
                </div>

                {profile?.has_cv && (
                  <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                    <Link
                      href="/spontaneous"
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      🎯 Candidature spontanée
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
