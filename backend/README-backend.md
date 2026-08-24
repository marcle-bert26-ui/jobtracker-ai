# JobTracker AI — Backend

API FastAPI de l'application JobTracker AI. Voir le [README principal](../README.md) pour la vue d'ensemble du projet et l'installation du frontend.

## Lancer en développement

```bash
python -m venv .venv
source .venv/bin/activate  # Windows : .venv\Scripts\activate
pip install fastapi uvicorn sqlalchemy python-dotenv requests msal
uvicorn main:app --reload
```

API disponible sur `http://127.0.0.1:8000`, documentation interactive sur `http://127.0.0.1:8000/docs`.

Nécessite un fichier `.env` à la racine de `backend/` — voir le [README principal](../README.md#backend) pour le détail des variables (`MS_CLIENT_ID`, `YAHOO_EMAIL`/`YAHOO_APP_PASSWORD`, `GMAIL_EMAIL`/`GMAIL_APP_PASSWORD`, `OLLAMA_URL`/`OLLAMA_MODEL`).

> ⚠️ Aucun `requirements.txt` n'est encore présent dans le repo ; la commande `pip install` ci-dessus liste les dépendances déduites des imports.

## Structure

```
backend/
├── main.py                  # App FastAPI, middleware CORS, montage des routers
├── database.py              # Engine SQLAlchemy, session, Base (SQLite : jobtracker.db)
├── models.py                 # Modèles SQLAlchemy
├── schemas.py                 # Schémas Pydantic (requêtes/réponses)
├── graph_auth.py              # Authentification Microsoft Graph (OAuth device flow, cache token)
├── authorize_outlook.py       # Script CLI : autorisation manuelle d'un compte Outlook
├── routes/
│   ├── applications.py        # CRUD candidatures
│   ├── history.py             # Historique des interactions
│   └── emails.py              # Déclenchement de sync + journal des emails
└── services/
    ├── email_sync.py           # Cœur de la sync : IMAP (Yahoo/Gmail) + Graph (Outlook), classification, rapprochement
    └── ai_classifier.py        # Appel à Ollama pour classifier un email (avec repli sur mots-clés géré dans email_sync.py)
```

## Modèles de données (`models.py`)

- **`Application`** — une candidature (entreprise, poste, statut, recruteur, etc.), avec sa liste d'`InteractionHistory`.
- **`InteractionHistory`** — un événement lié à une candidature (candidature envoyée, relance, réponse reçue, entretien, note...).
- **`ProcessedEmail`** — trace de chaque email déjà traité par la sync (déduplication via `message_id`, lien optionnel vers une `Application`).
- **`SyncState`** — dernière date de synchronisation par compte, pour ne relire que les nouveaux emails à chaque appel.

## Authentification des comptes email

- **Outlook / Outlook scolaire** (Microsoft Graph) : nécessitent une autorisation OAuth manuelle une seule fois par compte, via device code flow :
  ```bash
  python authorize_outlook.py outlook
  python authorize_outlook.py outlook_school
  ```
  Le token est ensuite mis en cache dans `backend/token_cache/` et renouvelé silencieusement.
- **Yahoo / Gmail** (IMAP) : authentification par mot de passe d'application, fourni via `.env` — aucune étape manuelle supplémentaire.

## Synchronisation et classification des emails

`services/email_sync.py` orchestre, pour chaque compte configuré :
1. Récupération des emails reçus depuis la dernière synchro (ou `N` jours si le paramètre `days` est fourni à `POST /emails/sync`).
2. Classification de chaque nouvel email :
   - via **Ollama** (`services/ai_classifier.py`) si le service répond (`is_available()`),
   - sinon via un système de **mots-clés FR/EN** (`classify_email`) intégré à `email_sync.py`.
3. Rapprochement avec une candidature existante par nom d'entreprise (fenêtre de 90 jours), création automatique d'une nouvelle candidature uniquement si l'email est une confirmation de candidature (`nouvelle_candidature`) sans correspondance trouvée.
4. Mise à jour du statut de la candidature selon une progression définie (`STATUS_PROGRESSION`), ajout d'une entrée d'historique, et journalisation de l'email dans `ProcessedEmail`.

Le paramètre `reset=true` sur `POST /emails/sync` supprime l'historique de sync et les emails journalisés pour le(s) compte(s) concerné(s), pour forcer un rebalayage complet.

## Endpoints

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Statut de l'API |
| GET/POST | `/applications` | Lister / créer des candidatures |
| GET/PUT/DELETE | `/applications/{id}` | Détail / modification / suppression |
| GET/POST | `/applications/{id}/history` | Historique des interactions |
| DELETE | `/history/{id}` | Supprimer une entrée d'historique |
| POST | `/emails/sync` | Lancer une synchronisation (`days`, `reset` en query params) |
| GET | `/emails/log` | Journal des emails traités (`limit` en query param) |

## Points d'attention

- Un verrou (`threading.Lock`) empêche de lancer deux synchronisations en parallèle (`409` sinon).
- `Base.metadata.create_all()` crée les tables au démarrage si elles n'existent pas — pas de système de migration (type Alembic) pour l'instant.
- CORS n'autorise actuellement que `localhost:3000` / `127.0.0.1:3000`.
