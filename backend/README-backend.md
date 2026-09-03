# JobTracker AI — Backend

API FastAPI de l'application JobTracker AI. Voir le [README principal](../README.md) pour la vue d'ensemble du projet et l'installation du frontend.

## Lancer en développement

```bash
python -m venv .venv
source .venv/bin/activate  # Windows : .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API disponible sur `http://127.0.0.1:8000`, documentation interactive sur `http://127.0.0.1:8000/docs`.

Nécessite un fichier `.env` à la racine de `backend/` — voir le [README principal](../README.md#backend) pour le détail des variables (`OUTLOOK_RELAY_EMAIL`/`OUTLOOK_RELAY_APP_PASSWORD`, `YAHOO_EMAIL`/`YAHOO_APP_PASSWORD`, `GMAIL_EMAIL`/`GMAIL_APP_PASSWORD`, `OLLAMA_URL`/`OLLAMA_MODEL`).

> ℹ️ Après avoir remplacé un fichier backend, redémarre complètement `uvicorn`
> (Ctrl+C puis relancer) plutôt que de compter sur l'auto-reload — surtout
> après plusieurs remplacements de fichiers d'affilée. Pour vérifier qu'une
> route est bien prise en compte, regarde la liste sur `/docs`.

## Structure

```
backend/
├── main.py                    # App FastAPI, middleware CORS, montage des routers
├── database.py                # Engine SQLAlchemy, session, Base, migrations légères (SQLite : jobtracker.db)
├── models.py                  # Modèles SQLAlchemy
├── schemas.py                 # Schémas Pydantic (requêtes/réponses)
├── graph_auth.py               # (inutilisé actuellement) plomberie Microsoft Graph (OAuth device flow), conservée au cas où un compte Graph serait reconnecté un jour
├── authorize_outlook.py        # (inutilisé actuellement) idem
├── routes/
│   ├── applications.py         # CRUD candidatures
│   ├── history.py              # Historique des interactions
│   ├── emails.py               # Sync, journal des emails (recherche/filtres/pagination), création rapide de fiche
│   └── reminders.py            # Candidatures à relancer / infos manquantes
└── services/
    ├── email_sync.py            # Cœur de la sync : IMAP (Outlook/Yahoo/Gmail), classification, extraction, rapprochement
    ├── ai_classifier.py         # Appel à Ollama pour classifier un email (repli sur mots-clés géré dans email_sync.py)
    └── reminders.py             # Calcul des candidatures à relancer / infos manquantes
```

## Modèles de données (`models.py`)

- **`Application`** — une candidature (entreprise, poste, localisation, statut, recruteur, etc.), avec sa liste d'`InteractionHistory`.
- **`InteractionHistory`** — un événement lié à une candidature (candidature envoyée, relance, réponse reçue, entretien, note...), avec un lien optionnel (`email_link`) vers l'email d'origine quand l'entrée vient d'une détection automatique.
- **`ProcessedEmail`** — trace de chaque email déjà traité par la sync (déduplication via `message_id`), avec l'entreprise/poste/localisation extraits, un lien optionnel vers une `Application`, et un lien pour rouvrir l'email dans la boîte mail. Rien n'est jamais purgé : tout reste consultable via `/emails/log`.
- **`SyncState`** — dernière date de synchronisation par compte, pour ne relire que les nouveaux emails à chaque appel.

## Authentification des comptes email

Tous les comptes passent par **IMAP** avec mot de passe d'application (aucun flux OAuth actif actuellement) :

- **Yahoo / Gmail** : mot de passe d'application classique, fourni via `.env`.
- **Outlook personnel** : Microsoft a désactivé l'authentification IMAP directe pour de plus en plus de comptes personnels (erreur `AUTHENTICATE failed`), même avec un mot de passe d'application. La solution en place est un **relais Gmail** : les emails Outlook sont transférés automatiquement vers une boîte Gmail dédiée, que le backend lit ensuite via IMAP (`OUTLOOK_RELAY_EMAIL` / `OUTLOOK_RELAY_APP_PASSWORD`). Voir le [README principal](../README.md#outlook-personnel-via-relais-gmail) pour la configuration complète.

`graph_auth.py` et `authorize_outlook.py` contiennent une plomberie Microsoft Graph (OAuth device flow) qui n'est actuellement utilisée par aucun compte configuré (l'ancien compte `outlook_school` qui s'en servait a été retiré) — conservée telle quelle au cas où un compte Graph serait reconnecté plus tard.

## Synchronisation et classification des emails

`services/email_sync.py` orchestre, pour chaque compte configuré :

1. Récupération des emails reçus depuis la dernière synchro (ou `N` jours si le paramètre `days` est fourni à `POST /emails/sync`).
2. Classification de chaque nouvel email :
   - via **Ollama** (`services/ai_classifier.py`) si le service répond (`is_available()`),
   - sinon via un système de **mots-clés FR/EN** (`classify_email`) intégré à `email_sync.py`.
   - dans les deux cas, un **filet de sécurité** promeut automatiquement en `nouvelle_candidature` tout email qui confirme clairement une candidature (mentionne "candidature", "candidat", "postulé"...) même s'il ne correspond à aucune formulation figée reconnue, plutôt que de le rejeter silencieusement.
3. Extraction de l'entreprise, du poste et de la localisation (motifs de texte type "chez X", "envoyée à X", "X vous remercie..." ; ou via l'IA si disponible).
4. Rapprochement avec une candidature existante par nom d'entreprise (fenêtre de 90 jours), création automatique d'une nouvelle candidature uniquement si l'email est une confirmation de candidature (`nouvelle_candidature`) sans correspondance trouvée.
5. Mise à jour du statut de la candidature selon une progression définie (`STATUS_PROGRESSION`), ajout d'une entrée d'historique (avec lien vers l'email d'origine), et journalisation de l'email dans `ProcessedEmail`.
6. **Commit après chaque email traité** (pas seulement à la fin de la synchro) : si la synchro est interrompue (coupure réseau, redémarrage du serveur...), tout ce qui a déjà été traité reste enregistré, et une resynchro reprend sans retraiter ce qui est déjà en base.

Le paramètre `reset=true` sur `POST /emails/sync` supprime l'historique de sync et les emails journalisés pour le(s) compte(s) concerné(s), pour forcer un rebalayage complet — sans jamais toucher aux candidatures déjà créées (manuellement ou automatiquement).

Depuis le journal des emails (`GET /emails/log`), tout email non rattaché à une fiche peut être transformé en candidature via `POST /emails/{id}/create-application` : réutilise ce qui a déjà été extrait, retente l'extraction (IA si disponible à ce moment-là) si l'entreprise ou le poste manquent encore, et rattache à une candidature existante plutôt que de créer un doublon si l'entreprise correspond déjà à une fiche récente.

## Endpoints

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Statut de l'API |
| GET/POST | `/applications` | Lister / créer des candidatures |
| GET/PUT/DELETE | `/applications/{id}` | Détail / modification / suppression |
| GET/POST | `/applications/{id}/history` | Historique des interactions |
| DELETE | `/history/{id}` | Supprimer une entrée d'historique |
| POST | `/emails/sync` | Lancer une synchronisation (`days`, `reset` en query params) |
| GET | `/emails/log` | Journal des emails traités — recherche et filtres (`search`, `account`, `event_type`, `has_application`, `date_from`, `date_to`), pagination (`limit`, `offset`) |
| POST | `/emails/{id}/create-application` | Créer/rattacher rapidement une fiche candidature à partir d'un email du journal |
| GET | `/reminders` | Candidatures à relancer + infos manquantes (param : `stale_days`, défaut 7) |

## Points d'attention

- Un verrou (`threading.Lock`) empêche de lancer deux synchronisations en parallèle (`409` sinon).
- `Base.metadata.create_all()` crée les tables au démarrage si elles n'existent pas, et `run_lightweight_migrations()` ajoute automatiquement les colonnes manquantes sur une base SQLite existante (pas de système de migration type Alembic, mais pas besoin d'intervention manuelle non plus).
- CORS n'autorise actuellement que `localhost:3000` / `127.0.0.1:3000`.
- Le corps des emails n'est pas stocké en base (seulement sujet, expéditeur, date) — la re-détection à la demande (`create-application`) ne peut donc se baser que sur le sujet, moins riche qu'au moment du scan initial.
