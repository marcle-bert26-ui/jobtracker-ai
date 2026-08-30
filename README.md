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
  - Outlook personnel / Hotmail via IMAP (mot de passe d'application)
  - Outlook scolaire via Microsoft Graph (OAuth device flow, `msal`)
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
# Microsoft Graph (Outlook scolaire uniquement — les comptes personnels
# passent par IMAP ci-dessous, plus simple)
MS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

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

**Première autorisation du compte Outlook scolaire** (une seule fois, flux
OAuth device code — le compte personnel n'en a pas besoin, IMAP suffit) :

```bash
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
