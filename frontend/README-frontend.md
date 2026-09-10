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
| `/emails` | `app/emails/page.tsx` | Journal des emails : recherche, filtres (compte, type, rattachement, dates), pagination, création rapide/en lot de fiche(s), correction des extractions erronées |
| `/reminders` | `app/reminders/page.tsx` | Candidatures à relancer (seuil configurable, report/snooze possible) et candidatures avec infos manquantes |
| `/duplicates` | `app/duplicates/page.tsx` | Détection de candidatures potentiellement en double (groupées par entreprise) et fusion |
| `/kanban` | `app/kanban/page.tsx` | Vue kanban : une colonne par statut, glisser-déposer une carte pour changer le statut de la candidature |
| `/stats` | `app/stats/page.tsx` | Statistiques et graphiques sur les candidatures, dont taux de réponse/entretien et délais moyens |
| `/profile` | `app/profile/page.tsx` | Import (`.pdf`/`.docx`) et édition du CV, base de toutes les générations de documents |
| `/spontaneous` | `app/spontaneous/page.tsx` | Candidature spontanée : suggestions d'entreprises + génération d'un message adapté |

## Notes techniques

- L'URL de l'API backend vient de `process.env.NEXT_PUBLIC_API_URL`, avec repli sur `http://127.0.0.1:8000` si la variable n'est pas définie — voir `frontend/.env.local` dans le README principal pour la configurer.
- Style : Tailwind CSS v4.
- **Filtres persistés dans l'URL** : sur `/`, `/emails` et `/reminders`, l'état des filtres (recherche, statut, plage de dates...) est répercuté dans les paramètres de requête de l'URL plutôt que gardé uniquement en mémoire. Ça permet au bouton "← Retour" (`router.back()`) sur la fiche candidature de restaurer exactement la page et les filtres actifs avant le clic, au lieu de repartir de zéro.
- **Kanban** (`/kanban`) : glisser-déposer implémenté avec l'API HTML5 Drag and Drop native du navigateur, sans dépendance ajoutée. Mise à jour optimiste du statut à l'écran, annulée automatiquement si la sauvegarde côté API échoue.
- **Export CSV** : le bouton "⬇️ Exporter (CSV)" de l'accueil est un simple lien `<a>` vers `GET /applications/export` (le backend renvoie le fichier avec les en-têtes de téléchargement, pas besoin de logique côté frontend).
- **Report ("snooze")** : sur `/reminders`, le bouton "⏰ Reporter" propose 3j/1sem/2sem/1mois ; la candidature reportée disparaît de "à relancer" jusqu'à la date choisie. Un badge sur la fiche candidature (`/applications/[id]`) indique le report en cours et permet de l'annuler.
- **Génération de documents (CV, lettres)** : les boutons de génération font un `fetch` POST vers le backend, récupèrent la réponse en `blob()`, puis déclenchent le téléchargement via un lien `<a download>` créé dynamiquement (`URL.createObjectURL`) — nécessaire ici car le fichier vient d'une requête POST (pas un simple lien direct comme pour l'export CSV en GET).
