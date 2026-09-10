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
│   ├── applications.py         # CRUD candidatures, doublons/fusion, statistiques de réponse, export CSV, snooze
│   ├── history.py              # Historique des interactions
│   ├── emails.py               # Sync, journal des emails (recherche/filtres/pagination), création rapide/en lot de fiches, correction d'extraction
│   ├── reminders.py            # Candidatures à relancer / infos manquantes
│   ├── profile.py               # Import/consultation/édition du CV
│   └── documents.py             # Génération CV/lettres adaptés + candidature spontanée
└── services/
    ├── email_sync.py            # Cœur de la sync : IMAP (Outlook/Yahoo/Gmail), classification, extraction, rapprochement
    ├── ai_classifier.py         # Appel à Ollama pour classifier un email (repli sur mots-clés géré dans email_sync.py)
    ├── corrections.py           # Mémorisation des corrections utilisateur + exemples réinjectés dans le prompt IA
    ├── stats.py                  # Dates de première réponse/entretien par candidature (délais, taux de réponse)
    ├── reminders.py             # Calcul des candidatures à relancer / infos manquantes
    ├── cv_extraction.py          # Extraction de texte depuis un CV .pdf/.docx (pypdf / python-docx)
    ├── document_generator.py     # Génération de CV/lettres/candidatures spontanées via Ollama
    └── pdf_generator.py          # Mise en page PDF des documents générés (reportlab)
```

## Modèles de données (`models.py`)

- **`Application`** — une candidature (entreprise, poste, localisation, statut, recruteur, etc.), avec sa liste d'`InteractionHistory`. Le champ `snoozed_until`, quand renseigné, exclut la candidature de la liste "à relancer" de `/reminders` jusqu'à cette date (sans toucher au reste de la fiche).
- **`InteractionHistory`** — un événement lié à une candidature (candidature envoyée, relance, réponse reçue, entretien, note...), avec un lien optionnel (`email_link`) vers l'email d'origine quand l'entrée vient d'une détection automatique.
- **`ProcessedEmail`** — trace de chaque email déjà traité par la sync (déduplication via `message_id`), avec l'entreprise/poste/localisation extraits, un lien optionnel vers une `Application`, et un lien pour rouvrir l'email dans la boîte mail. Rien n'est jamais purgé : tout reste consultable via `/emails/log`.
- **`SyncState`** — dernière date de synchronisation par compte, pour ne relire que les nouveaux emails à chaque appel.
- **`ExtractionCorrection`** — corrections apportées à la main (entreprise/poste/localisation) sur ce que la détection avait trouvé pour un email. Sert d'exemples réinjectés dans le prompt IA pour améliorer les extractions suivantes (voir `services/corrections.py`).
- **`UserProfile`** — une seule ligne en pratique (app mono-utilisateur) : le texte extrait du CV importé, réutilisé pour générer des CV/lettres adaptés.

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

Depuis le journal des emails (`GET /emails/log`), tout email non rattaché à une fiche peut être transformé en candidature via `POST /emails/{id}/create-application` (ou en lot via `POST /emails/bulk-create-applications`) : réutilise ce qui a déjà été extrait, retente l'extraction (IA si disponible à ce moment-là) si l'entreprise ou le poste manquent encore, et rattache à une candidature existante plutôt que de créer un doublon si l'entreprise correspond déjà à une fiche récente.

### Corriger et améliorer l'extraction (`POST /emails/{id}/correct`)

L'extraction (mots-clés comme IA) n'est pas parfaite — en particulier sur des plateformes comme LinkedIn ou Indeed, où le nom de l'expéditeur (la plateforme) n'est pas celui de l'entreprise qui recrute. Quand un email a une entreprise, un poste ou une localisation erronés :

1. La correction est appliquée immédiatement à l'email dans le journal, et répercutée sur la candidature liée si elle n'a pas déjà divergé (ex : modifiée différemment à la main entre-temps).
2. Elle est mémorisée dans `ExtractionCorrection`.
3. Les corrections les plus récentes (`services/corrections.py`, 6 par défaut) sont réinjectées comme exemples concrets dans le prompt système envoyé à Ollama à chaque appel de `classify_with_ai` — pas de ré-entraînement, juste de l'apprentissage en contexte, qui aide l'IA à généraliser le raisonnement ("préférer l'entreprise mentionnée dans le texte à celle de la plateforme") plutôt qu'à mémoriser un cas précis.

## CV, lettres de motivation et candidature spontanée

`services/cv_extraction.py` lit le texte d'un CV `.pdf` (`pypdf`) ou `.docx` (`python-docx`, y compris le contenu des tableaux — souvent utilisés pour la mise en page d'un CV) et le stocke dans `UserProfile` via `routes/profile.py`. Le texte reste éditable directement (utile si l'extraction automatique n'est pas parfaite).

`services/document_generator.py` appelle Ollama (même mécanisme que `ai_classifier.py`) pour :
- rédiger une **lettre de motivation** adaptée à une candidature (texte simple) ;
- adapter un **CV** au poste visé — réponse structurée en JSON (nom, accroche, résumé, sections avec items/puces), pour permettre une mise en page propre ;
- suggérer des **entreprises à cibler** en candidature spontanée à partir d'un secteur ;
- rédiger un message de **candidature spontanée** pour une entreprise donnée.

Consigne stricte dans tous les prompts : ne jamais inventer d'expérience, de compétence ou de diplôme absent du CV fourni. Pour les suggestions d'entreprises, avertissement explicite qu'Ollama n'a pas accès à internet — les résultats viennent uniquement de ses connaissances d'entraînement (potentiellement datées ou partiellement inventées), à vérifier avant tout contact.

`services/pdf_generator.py` met en page le texte/JSON généré en PDF via `reportlab` (aucune dépendance système requise, contrairement à des alternatives comme weasyprint — fonctionne à l'identique sous Windows/Mac/Linux avec un simple `pip install`).

## Endpoints

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Statut de l'API |
| GET/POST | `/applications` | Lister / créer des candidatures |
| GET/PUT/DELETE | `/applications/{id}` | Détail / modification / suppression |
| GET | `/applications/export` | Export CSV de toutes les candidatures (`;` comme séparateur, BOM UTF-8 pour Excel) |
| POST/DELETE | `/applications/{id}/snooze` | Reporter (`{"days": N}`) / annuler le report du rappel de relance |
| GET | `/applications/duplicates` | Candidatures potentiellement en double, groupées par entreprise |
| POST | `/applications/merge` | Fusionner des candidatures en double dans une seule |
| GET | `/applications/response-metrics` | Dates de première réponse/entretien par candidature |
| GET/POST | `/applications/{id}/history` | Historique des interactions |
| DELETE | `/history/{id}` | Supprimer une entrée d'historique |
| POST | `/emails/sync` | Lancer une synchronisation (`days`, `reset` en query params) |
| GET | `/emails/log` | Journal des emails traités — recherche et filtres (`search`, `account`, `event_type`, `has_application`, `date_from`, `date_to`), pagination (`limit`, `offset`) |
| POST | `/emails/{id}/create-application` | Créer/rattacher rapidement une fiche candidature à partir d'un email du journal |
| POST | `/emails/bulk-create-applications` | Idem, pour plusieurs emails sélectionnés d'un coup (`email_ids: [...]`) |
| POST | `/emails/{id}/correct` | Corriger l'entreprise/le poste/la localisation détectés (alimente l'IA pour les prochaines synchros) |
| GET | `/reminders` | Candidatures à relancer + infos manquantes (param : `stale_days`, défaut 7) |
| GET/POST/PUT/DELETE | `/profile/cv` | Consulter / importer (`.pdf`/`.docx`) / corriger le texte / supprimer le CV |
| POST | `/applications/{id}/generate-cover-letter` | Lettre de motivation adaptée (PDF) |
| POST | `/applications/{id}/generate-cv` | CV adapté (PDF) |
| POST | `/spontaneous/suggestions` | Suggérer des entreprises à cibler (`{sector, location?}`) |
| POST | `/spontaneous/generate-letter` | Message de candidature spontanée (PDF) (`{company, context?, extra_instructions?}`) |

## Points d'attention

- Un verrou (`threading.Lock`) empêche de lancer deux synchronisations en parallèle (`409` sinon).
- `Base.metadata.create_all()` crée les tables au démarrage si elles n'existent pas, et `run_lightweight_migrations()` ajoute automatiquement les colonnes manquantes sur une base SQLite existante (pas de système de migration type Alembic, mais pas besoin d'intervention manuelle non plus).
- CORS n'autorise actuellement que `localhost:3000` / `127.0.0.1:3000`.
- Le corps des emails n'est pas stocké en base (seulement sujet, expéditeur, date) — la re-détection à la demande (`create-application`) ne peut donc se baser que sur le sujet, moins riche qu'au moment du scan initial.
