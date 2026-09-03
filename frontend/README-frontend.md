# JobTracker AI — Frontend

Interface Next.js 16 / React 19 de l'application JobTracker AI. Voir le [README principal](../README.md) pour la vue d'ensemble du projet et l'installation du backend.

## Lancer en développement

```bash
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000). Le backend (`http://127.0.0.1:8000`) doit tourner en parallèle — voir le README principal.

## Pages

| Route | Fichier | Contenu |
|---|---|---|
| `/` | `app/page.tsx` | Liste des candidatures (filtre de statut persisté dans l'URL), création, déclenchement de la synchro emails |
| `/applications/[id]` | `app/applications/[id]/page.tsx` | Détail, édition et historique d'une candidature (`?edit=1` ouvre directement en mode édition) |
| `/emails` | `app/emails/page.tsx` | Journal des emails : recherche, filtres (compte, type, rattachement, dates), pagination, création rapide de fiche depuis un email non rattaché |
| `/reminders` | `app/reminders/page.tsx` | Candidatures à relancer (seuil configurable) et candidatures avec infos manquantes |
| `/stats` | `app/stats/page.tsx` | Statistiques et graphiques sur les candidatures |

## Notes techniques

- L'URL de l'API backend vient de `process.env.NEXT_PUBLIC_API_URL`, avec repli sur `http://127.0.0.1:8000` si la variable n'est pas définie — voir `frontend/.env.local` dans le README principal pour la configurer.
- Style : Tailwind CSS v4.
- **Filtres persistés dans l'URL** : sur `/`, `/emails` et `/reminders`, l'état des filtres (recherche, statut, plage de dates...) est répercuté dans les paramètres de requête de l'URL plutôt que gardé uniquement en mémoire. Ça permet au bouton "← Retour" (`router.back()`) sur la fiche candidature de restaurer exactement la page et les filtres actifs avant le clic, au lieu de repartir de zéro.
