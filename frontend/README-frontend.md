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
| `/` | `app/page.tsx` | Liste des candidatures, création, déclenchement de la synchro emails |
| `/applications/[id]` | `app/applications/[id]/page.tsx` | Détail, édition et historique d'une candidature |
| `/emails` | `app/emails/page.tsx` | Journal des emails traités par la synchronisation |

## Notes techniques

- L'URL de l'API backend est codée en dur (`const API_URL = "http://127.0.0.1:8000"`) dans chaque page — à externaliser en variable d'environnement (`NEXT_PUBLIC_API_URL`) si le backend est déployé ailleurs qu'en local.
- Style : Tailwind CSS v4.
