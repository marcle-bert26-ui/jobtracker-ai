# JobTracker AI

Application personnelle de gestion et de suivi de recherche d'emploi.

## Objectif

Centraliser les candidatures, suivre les échanges avec les recruteurs et analyser automatiquement les emails provenant d'Outlook, Yahoo et Gmail.

- Gérer les candidatures et leur avancement
- Suivre l'historique des échanges avec les entreprises et recruteurs
- Détecter automatiquement les emails liés à une candidature (confirmation, entretien, réponse positive/négative), en extraire l'entreprise, le poste et la localisation, et mettre à jour le suivi en conséquence
- Repérer les candidatures à relancer (aucune activité depuis un certain temps) ou incomplètes (infos manquantes)
- Générer des CV et lettres de motivation adaptés à chaque candidature, et des messages de candidature spontanée, à partir d'un CV importé une fois — sans jamais inventer d'expérience ou de compétence absente du CV d'origine
- Garder l'utilisateur en contrôle : les emails sont importés en lecture seule, aucun envoi automatique n'est effectué, et toute détection/génération automatique reste éditable/complétable à la main

## Statut

🚧 Projet en développement actif. Le cœur applicatif (candidatures, historique, synchronisation d'emails, classification) est fonctionnel.

## Architecture

- **Frontend** : Next.js 16 / React 19 / TypeScript, Tailwind CSS
- **Backend** : FastAPI (Python), SQLAlchemy
- **Base de données** : SQLite (fichier local `jobtracker.db`)
- **Emails** :
  - Outlook personnel / Hotmail via IMAP (mot de passe d'application)
  - Yahoo / Gmail via IMAP (mot de passe d'application)
- **Classification IA** : Ollama en local (modèle configurable, ex. `llama3.2`), avec repli automatique sur un système de règles par mots-clés (FR/EN) si Ollama n'est pas disponible
- **Versioning** : Git + GitHub

## Structure du projet

```
jobtracker-ai/
├── backend/
│   ├── main.py                  # Point d'entrée FastAPI
│   ├── database.py               # Config SQLAlchemy / SQLite + migrations légères
│   ├── models.py                 # Application, InteractionHistory, ProcessedEmail, SyncState, ExtractionCorrection, UserProfile
│   ├── schemas.py                 # Schémas Pydantic
│   ├── graph_auth.py              # (inutilisé actuellement) plomberie Microsoft Graph, conservée au cas où
│   ├── authorize_outlook.py       # (inutilisé actuellement) idem
│   ├── routes/
│   │   ├── applications.py        # CRUD, doublons/fusion, stats de réponse, export CSV, snooze
│   │   ├── history.py             # Historique des interactions par candidature
│   │   ├── emails.py              # Synchronisation, journal des emails, création rapide/en lot de fiches, correction d'extraction
│   │   ├── reminders.py           # Candidatures à relancer / infos manquantes
│   │   ├── profile.py              # Import/consultation/édition du CV
│   │   └── documents.py            # Génération CV/lettres adaptés + candidature spontanée
│   └── services/
│       ├── email_sync.py          # Sync IMAP, classification, extraction, matching, commit incrémental
│       ├── ai_classifier.py       # Appel à Ollama pour classifier un email
│       ├── corrections.py         # Mémorisation des corrections d'extraction + exemples pour l'IA
│       ├── stats.py                # Délais/taux de réponse par candidature
│       ├── reminders.py            # Calcul des candidatures à relancer / infos manquantes
│       ├── cv_extraction.py        # Extraction de texte depuis un CV .pdf/.docx
│       ├── document_generator.py   # Génération de CV/lettres/candidatures spontanées via l'IA
│       └── pdf_generator.py        # Mise en page PDF des documents générés
└── frontend/
    └── app/
        ├── page.tsx                        # Accueil : liste, création, synchro emails, filtre de statut
        ├── applications/[id]/page.tsx      # Détail / édition d'une candidature (`?edit=1` = édition directe)
        ├── emails/page.tsx                 # Journal des emails (recherche, filtres, création rapide/en lot, correction)
        ├── reminders/page.tsx              # Candidatures à relancer / infos manquantes
        ├── duplicates/page.tsx             # Détection et fusion de candidatures en double
        ├── kanban/page.tsx                  # Vue kanban (glisser-déposer par statut)
        ├── stats/page.tsx                  # Statistiques (graphiques, taux de réponse, délais)
        ├── profile/page.tsx                 # Import/consultation/édition du CV
        └── spontaneous/page.tsx             # Candidature spontanée (suggestions + génération de lettre)
```

## Installation

### Prérequis

- Python 3.11+
- Node.js 20+
- (Optionnel) [Ollama](https://ollama.com) installé en local pour la classification IA

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows : .venv\Scripts\activate
pip install -r requirements.txt
```

Créer un fichier `backend/.env` :

```env
# Outlook personnel / Hotmail — Microsoft bloque désormais l'authentification
# basique en IMAP direct, même avec un mot de passe d'application. On passe
# donc par un relais : une boîte Gmail dédiée qui reçoit tes emails Outlook
# transférés automatiquement (voir "Outlook personnel via relais" plus bas
# pour la configuration complète).
OUTLOOK_RELAY_EMAIL=jobtrackeraimlb@gmail.com
OUTLOOK_RELAY_APP_PASSWORD=xxxxxxxxxxxxxxxx

# Yahoo (mot de passe d'application, pas le mot de passe du compte)
YAHOO_EMAIL=exemple@yahoo.fr
YAHOO_APP_PASSWORD=xxxxxxxxxxxxxxxx

# Gmail (mot de passe d'application)
GMAIL_EMAIL=exemple@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx

# IA locale (optionnel — sans ça, repli automatique sur les mots-clés)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest
```

> ℹ️ Vérifie le nom exact de ton modèle avec `ollama list` dans un terminal,
> et utilise cette valeur exacte pour `OLLAMA_MODEL` (le nom doit
> correspondre précisément, y compris `:latest` ou une autre étiquette).

Lancer le serveur :

```bash
cd backend
uvicorn main:app --reload
```

L'API est disponible sur `http://127.0.0.1:8000` (doc interactive sur `/docs`).

### Frontend

Créer un fichier `frontend/.env.local` (optionnel — par défaut, l'app utilise `http://127.0.0.1:8000`) :

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

```bash
cd frontend
npm install
npm run dev
```

L'application est disponible sur `http://localhost:3000`.

## Outlook personnel via relais Gmail

Microsoft a désactivé l'authentification "basique" (identifiant + mot de
passe) en IMAP pour de plus en plus de comptes personnels — même avec un
mot de passe d'application, la connexion échoue avec l'erreur
`AUTHENTICATE failed`. Seul Microsoft Graph (OAuth) fonctionne encore
officiellement, mais nécessite une inscription Azure.

Solution de contournement, sans Azure :

1. Crée une nouvelle adresse Gmail, dédiée uniquement à cet usage
   (ex. `jobtrackeraimlb@gmail.com`).
2. Sur ce nouveau compte Gmail : Paramètres → "Transfert et POP/IMAP" →
   active l'accès IMAP (même étape que pour le compte Gmail principal).
3. Sur [outlook.live.com](https://outlook.live.com) → Paramètres → Courrier
   → Transfert et IMAP → active **"Activer le transfert"** vers cette
   nouvelle adresse Gmail.
4. Configure `OUTLOOK_RELAY_EMAIL` / `OUTLOOK_RELAY_APP_PASSWORD` dans le
   `.env` avec les identifiants de cette boîte Gmail relais (mot de passe
   d'application Gmail — nécessite la double authentification activée sur
   ce nouveau compte).

Le transfert natif conserve l'expéditeur d'origine dans l'email, donc la
détection de l'entreprise fonctionne normalement sur les emails transférés.

> ⚠️ Le bouton "ouvrir dans la boîte mail" (✉️) sur ces entrées ouvre
> Gmail — si tu es connecté à plusieurs comptes Google dans le même
> navigateur, il peut s'ouvrir sur le mauvais compte (pas la boîte
> relais). Bascule manuellement de compte si besoin.

## Fonctionnement de la synchronisation des emails

1. Depuis l'interface (page d'accueil) ou via `POST /emails/sync`, l'app interroge chaque compte configuré (Outlook, Yahoo, Gmail).
2. Chaque nouvel email est classifié (via Ollama si disponible, sinon via mots-clés FR/EN) en : `nouvelle_candidature`, `entretien`, `reponse_positive`, `reponse_negative`, `email_recu`, ou `ignore`. Un filet de sécurité promeut automatiquement en `nouvelle_candidature` tout email confirmant clairement une candidature (mentionne "candidature"/"postulé"/...) même s'il ne correspond à aucune formulation figée connue.
3. L'entreprise, le poste et la localisation sont extraits (mots-clés + motifs de texte, ou IA si disponible).
4. Si l'email correspond à une candidature existante (rapprochement par nom d'entreprise sur les 90 derniers jours), son statut et son historique sont mis à jour. Sinon, une nouvelle candidature peut être créée automatiquement (uniquement pour une confirmation de candidature).
5. Chaque email traité est sauvegardé **immédiatement** (commit après chaque email, pas seulement à la fin) : une synchro interrompue ne fait pas perdre ce qui a déjà été traité, et peut reprendre là où elle s'est arrêtée sans retraiter les emails déjà vus.
6. Tous les emails traités sont journalisés (`ProcessedEmail`) et consultables sur la page `/emails` — recherche texte, filtres (compte, type d'événement, rattachement, dates), pagination, sélection multiple pour créer plusieurs fiches d'un coup. Depuis un email non rattaché à une fiche (ignoré ou non), un bouton permet de créer rapidement une candidature à partir de cet email (avec une nouvelle tentative d'extraction via l'IA si elle est disponible à ce moment-là).
7. Si l'entreprise, le poste ou la localisation détectés sont faux, ils peuvent être corrigés directement depuis le journal (bouton "✏️ Corriger"). Ces corrections sont mémorisées et réinjectées comme exemples dans le prompt de l'IA lors des synchros suivantes, pour l'aider à éviter la même erreur sur des emails similaires (pas de ré-entraînement — de l'apprentissage en contexte).

## CV, lettres de motivation et candidature spontanée

1. Sur la page **Mon profil** (`/profile`), importe ton CV (`.pdf` ou `.docx`) — le texte est extrait automatiquement et reste modifiable directement dans l'appli (utile si l'extraction n'est pas parfaite, par exemple sur un CV très mis en forme).
2. Depuis une fiche candidature, deux boutons génèrent un **PDF téléchargeable** à partir de ce CV : "📄 Lettre de motivation" et "📋 CV adapté" (contenu réorganisé/mis en avant pour le poste visé — rien n'est inventé, l'IA doit s'en tenir au contenu réel du CV).
3. Sur la page **Candidature spontanée** (`/spontaneous`) :
   - suggestions d'entreprises à cibler selon un secteur (et éventuellement une zone géographique) ;
   - génération d'un message de candidature spontanée pour une entreprise donnée.

⚠️ L'IA locale (Ollama) n'a pas accès à internet : les suggestions d'entreprises viennent uniquement de ses connaissances d'entraînement, potentiellement datées ou incomplètes — à vérifier avant tout contact. Tous les documents générés sont des brouillons à relire avant envoi.

## API — endpoints principaux

| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/applications` | Lister / créer des candidatures |
| GET/PUT/DELETE | `/applications/{id}` | Détail / modification / suppression |
| GET | `/applications/export` | Export CSV de toutes les candidatures (backup/partage) |
| POST/DELETE | `/applications/{id}/snooze` | Reporter / annuler le report du rappel de relance (`{days: N}`) |
| GET | `/applications/duplicates` | Candidatures potentiellement en double (groupées par entreprise) |
| POST | `/applications/merge` | Fusionner des candidatures en double dans une seule |
| GET | `/applications/response-metrics` | Dates de première réponse/entretien par candidature (utilisé pour les stats) |
| GET/POST | `/applications/{id}/history` | Historique des interactions |
| DELETE | `/history/{id}` | Supprimer une entrée d'historique |
| POST | `/emails/sync` | Lancer une synchronisation (params : `days`, `reset`) |
| GET | `/emails/log` | Journal des emails traités — recherche et filtres (`search`, `account`, `event_type`, `has_application`, `date_from`, `date_to`), pagination (`limit`, `offset`) |
| POST | `/emails/{id}/create-application` | Créer/rattacher rapidement une fiche candidature à partir d'un email du journal |
| POST | `/emails/bulk-create-applications` | Idem, pour plusieurs emails sélectionnés d'un coup |
| POST | `/emails/{id}/correct` | Corriger l'entreprise/le poste/la localisation détectés (alimente l'IA pour les prochaines synchros) |
| GET | `/reminders` | Candidatures à relancer + infos manquantes (param : `stale_days`, défaut 7) |
| GET/POST/PUT/DELETE | `/profile/cv` | Consulter / importer / corriger / supprimer le CV |
| POST | `/applications/{id}/generate-cover-letter` | Générer une lettre de motivation adaptée (PDF) |
| POST | `/applications/{id}/generate-cv` | Générer un CV adapté (PDF) |
| POST | `/spontaneous/suggestions` | Suggérer des entreprises à cibler (candidature spontanée) |
| POST | `/spontaneous/generate-letter` | Générer un message de candidature spontanée (PDF) |
| GET | `/health` | Statut de l'API |

## Roadmap

- [x] Génération de `requirements.txt` / `pyproject.toml`
- [x] Variable d'environnement pour l'URL de l'API côté frontend
- [x] Préparation de CV adaptés et de lettres de motivation (à partir d'un CV importé, en PDF)
- [x] Recherche/génération de candidature spontanée (suggestions d'entreprises + message généré)
- [x] Rappels / relances (détection des candidatures sans réponse et des infos manquantes)
- [x] Détection automatique de la localisation du poste dans les emails
- [x] Journal des emails : recherche, filtres avancés, pagination, création rapide de fiche depuis un email
- [x] Filtres de recherche/pagination persistés dans l'URL (le bouton retour restaure l'état exact de la page précédente)
- [x] Détection de doublons de candidatures + fusion
- [x] Actions groupées dans le journal des emails (créer plusieurs fiches d'un coup)
- [x] Vue kanban (glisser-déposer par statut)
- [x] Statistiques avancées : taux de réponse, délais moyens avant réponse/entretien, par entreprise
- [x] Correction des extractions IA depuis le journal, réinjectée comme exemples pour les prochaines synchros
- [x] Report ("snooze") d'un rappel de relance sur une candidature précise
- [x] Export CSV de toutes les candidatures (backup/partage)
