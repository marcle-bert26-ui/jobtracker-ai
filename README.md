# JobTracker AI

Application personnelle de gestion et de suivi de recherche d'emploi.

## Objectif

Centraliser les candidatures, suivre les échanges avec les recruteurs et analyser automatiquement les emails provenant d'Outlook, Outlook scolaire, Yahoo et Gmail.

- Gérer les candidatures et leur avancement
- Suivre l'historique des échanges avec les entreprises et recruteurs
- Détecter automatiquement les emails liés à une candidature (confirmation, entretien, réponse positive/négative) et mettre à jour le suivi en conséquence
- Garder l'utilisateur en contrôle : les emails sont importés en lecture seule, aucun envoi automatique n'est effectué

Non encore implémenté (objectifs futurs) : préparation de CV adaptés et de lettres de motivation.

## Statut

🚧 Projet en développement actif. Le cœur applicatif (candidatures, historique, synchronisation d'emails, classification) est fonctionnel.

## Architecture

- **Frontend** : Next.js 16 / React 19 / TypeScript, Tailwind CSS
- **Backend** : FastAPI (Python), SQLAlchemy
- **Base de données** : SQLite (fichier local `jobtracker.db`)
- **Emails** :
  - Outlook / Outlook scolaire via Microsoft Graph (OAuth device flow, `msal`)
  - Yahoo / Gmail via IMAP (mot de passe d'application)
- **Classification IA** : Ollama en local (modèle configurable, ex. `llama3.2`), avec repli automatique sur un système de règles par mots-clés (FR/EN) si Ollama n'est pas disponible
- **Versioning** : Git + GitHub

## Structure du projet

```
jobtracker-ai/
├── backend/
│   ├── main.py                  # Point d'entrée FastAPI
│   ├── database.py               # Config SQLAlchemy / SQLite
│   ├── models.py                 # Application, InteractionHistory, ProcessedEmail, SyncState
│   ├── schemas.py                 # Schémas Pydantic
│   ├── graph_auth.py              # Auth Microsoft Graph (OAuth device flow)
│   ├── authorize_outlook.py       # Script CLI pour autoriser un compte Outlook
│   ├── routes/
│   │   ├── applications.py        # CRUD des candidatures
│   │   ├── history.py             # Historique des interactions par candidature
│   │   └── emails.py              # Synchronisation et journal des emails
│   └── services/
│       ├── email_sync.py          # Sync IMAP + Microsoft Graph, classification, matching
│       └── ai_classifier.py       # Appel à Ollama pour classifier un email
└── frontend/
    └── app/
        ├── page.tsx                        # Accueil : liste, création, synchro emails
        ├── applications/[id]/page.tsx      # Détail / édition d'une candidature
        └── emails/page.tsx                 # Journal des emails traités
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
# Microsoft Graph (Outlook / Outlook scolaire)
MS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

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

**Première autorisation des comptes Outlook** (une seule fois par compte, flux OAuth device code) :

```bash
python authorize_outlook.py outlook
python authorize_outlook.py outlook_school
```

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

## Fonctionnement de la synchronisation des emails

1. Depuis l'interface (page d'accueil) ou via `POST /emails/sync`, l'app interroge chaque compte configuré (Outlook, Outlook scolaire, Yahoo, Gmail).
2. Chaque nouvel email est classifié (via Ollama si disponible, sinon via mots-clés FR/EN) en : `nouvelle_candidature`, `entretien`, `reponse_positive`, `reponse_negative`, `email_recu`, ou `ignore`.
3. Si l'email correspond à une candidature existante (rapprochement par nom d'entreprise sur les 90 derniers jours), son statut et son historique sont mis à jour. Sinon, une nouvelle candidature peut être créée automatiquement (uniquement pour une confirmation de candidature).
4. Tous les emails traités sont journalisés (`ProcessedEmail`) et consultables sur la page `/emails`.

## API — endpoints principaux

| Méthode | Route | Description |
|---|---|---|
| GET/POST | `/applications` | Lister / créer des candidatures |
| GET/PUT/DELETE | `/applications/{id}` | Détail / modification / suppression |
| GET/POST | `/applications/{id}/history` | Historique des interactions |
| DELETE | `/history/{id}` | Supprimer une entrée d'historique |
| POST | `/emails/sync` | Lancer une synchronisation (params : `days`, `reset`) |
| GET | `/emails/log` | Journal des emails traités |
| GET | `/health` | Statut de l'API |

## Roadmap

- [x] Génération de `requirements.txt` / `pyproject.toml`
- [x] Variable d'environnement pour l'URL de l'API côté frontend
- [ ] Préparation de CV adaptés et de lettres de motivation
- [ ] Rappels / relances automatiques (détection des candidatures sans réponse)
