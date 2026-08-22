const applications = [
  {
    company: "Cleeven",
    position: "Consultant",
    location: "Bâle, Suisse",
    status: "Entretien",
    date: "18 août 2026",
    color: "bg-blue-100 text-blue-700",
  },
  {
    company: "Daimler Buses",
    position: "E-System Expert",
    location: "Sarcelles, France",
    status: "En cours",
    date: "20 août 2026",
    color: "bg-amber-100 text-amber-700",
  },
  {
    company: "Louis Vuitton",
    position: "Ingénieur Industrialisation",
    location: "Beaulieu-sur-Layon",
    status: "Terminée",
    date: "15 juillet 2026",
    color: "bg-green-100 text-green-700",
  },
];

const stats = [
  {
    label: "Candidatures",
    value: "12",
    detail: "au total",
    icon: "💼",
  },
  {
    label: "En cours",
    value: "7",
    detail: "candidatures",
    icon: "🔄",
  },
  {
    label: "Entretiens",
    value: "3",
    detail: "à venir",
    icon: "📅",
  },
  {
    label: "Actions",
    value: "2",
    detail: "à faire",
    icon: "⚡",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              JobTracker <span className="text-blue-600">AI</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Ton assistant personnel de recherche d'emploi
            </p>
          </div>

          <button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            + Nouvelle candidature
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Welcome */}
        <section className="mb-8">
          <h2 className="text-3xl font-bold">Bonjour Marc 👋</h2>
          <p className="mt-2 text-slate-500">
            Voici où en est ta recherche d'emploi aujourd'hui.
          </p>
        </section>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  {stat.label}
                </span>
                <span className="text-xl">{stat.icon}</span>
              </div>

              <div className="mt-4 flex items-end gap-2">
                <span className="text-3xl font-bold">{stat.value}</span>
                <span className="mb-1 text-sm text-slate-500">
                  {stat.detail}
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* Main content */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Applications */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="font-semibold">Dernières candidatures</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Les dernières opportunités suivies
                </p>
              </div>

              <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Voir tout →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {applications.map((application) => (
                <div
                  key={`${application.company}-${application.position}`}
                  className="flex flex-col gap-4 px-6 py-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h4 className="font-semibold">{application.position}</h4>
                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {application.company}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      📍 {application.location}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${application.color}`}
                      >
                        {application.status}
                      </span>
                      <p className="mt-2 text-xs text-slate-400">
                        {application.date}
                      </p>
                    </div>

                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100">
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="font-semibold">À faire</h3>
              <p className="mt-1 text-sm text-slate-500">
                Tes prochaines actions
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <span>⏰</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      Relancer un recruteur
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      Candidature sans réponse depuis 10 jours
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex gap-3">
                  <span>🎯</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Préparer un entretien
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      Entretien Cleeven — Consultant
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex gap-3">
                  <span>📄</span>
                  <div>
                    <p className="text-sm font-semibold">
                      Adapter un CV
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Nouvelle offre détectée
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Email sync */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">📬 Synchronisation des emails</h3>
              <p className="mt-1 text-sm text-slate-500">
                Outlook et Yahoo seront analysés en lecture seule.
              </p>
            </div>

            <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
              ⚪ Non connecté
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}