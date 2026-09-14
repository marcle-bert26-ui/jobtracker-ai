# JobTracker AI — Backend

Backend de l'application JobTracker AI.

Le backend fournit une API REST permettant au frontend de gérer les candidatures, emails, documents, rappels, historique et profil utilisateur.

---

## Technologies

* Python
* FastAPI
* Uvicorn
* SQLAlchemy
* SQLite
* Microsoft Graph
* Ollama
* Python-dotenv

---

## Structure

```text
backend/
│
├── main.py
├── database.py
├── graph_auth.py
├── models/
├── routes/
├── services/
├── requirements.txt
├── .env
└── ...
```

---

## Installation

Créer l'environnement virtuel :

```powershell
python -m venv .venv
```

Activer l'environnement :

```powershell
.\.venv\Scripts\activate
```

Installer les dépendances :

```powershell
pip install -r requirements.txt
```

---

## Variables d'environnement

Le backend utilise un fichier :

```text
.env
```

Les informations sensibles doivent rester dans ce fichier et ne doivent pas être publiées dans Git.

Le fichier `.env` peut notamment contenir les paramètres nécessaires à :

* Microsoft Graph ;
* l'authentification ;
* Ollama ;
* la configuration de l'application.

---

## Lancement

Depuis le dossier `backend` :

```powershell
.\.venv\Scripts\activate
uvicorn main:app --reload
```

Le serveur démarre sur :

```text
http://127.0.0.1:8000
```

---

## Vérification du serveur

Endpoint :

```text
GET /health
```

URL :

```text
http://127.0.0.1:8000/health
```

Réponse :

```json
{
  "status": "ok",
  "application": "JobTracker AI",
  "version": "0.4.0"
}
```

---

## API

Les routes sont organisées par fonctionnalité :

```text
routes/
├── applications.py
├── documents.py
├── emails.py
├── history.py
├── profile.py
└── reminders.py
```

Le fichier `main.py` enregistre les différents routers.

---

## Base de données

La gestion de la base de données est réalisée avec SQLAlchemy.

Fichiers principaux :

```text
database.py
models/
```

Au démarrage, le backend effectue notamment :

```python
Base.metadata.create_all(bind=engine)
```

ainsi que les migrations légères prévues par :

```python
run_lightweight_migrations()
```

---

## CORS

Le backend autorise le frontend local et le frontend exposé par Dev Tunnel.

Configuration actuelle :

```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://426bxhwg-3000.uks1.devtunnels.ms",
]
```

Si l'URL publique du frontend change, cette liste doit être adaptée.

---

## Dev Tunnel

Le backend est exposé sur le port :

```text
8000
```

Le tunnel persistant utilisé par le projet est :

```text
jobtracker-ai.uks1
```

Lancement :

```powershell
C:\Users\marcl\devtunnel.exe host jobtracker-ai
```

Le backend est alors accessible publiquement via :

```text
https://426bxhwg-8000.uks1.devtunnels.ms
```

Endpoint de contrôle :

```text
https://426bxhwg-8000.uks1.devtunnels.ms/health
```

---

## Redémarrage

Le script :

```text
launcher/restart_backend.bat
```

permet de redémarrer le backend.

Le frontend peut également déclencher le protocole Windows :

```text
jobtracker://start
```

afin de demander le redémarrage du backend.

---

## Développement

Pour développer le backend :

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn main:app --reload
```

L'option `--reload` permet à Uvicorn de redémarrer automatiquement le serveur lorsqu'un fichier Python est modifié.

---

## Sécurité

Ne jamais publier :

```text
.env
```

ou des secrets d'authentification.

Le Dev Tunnel est actuellement configuré avec :

```text
--allow-anonymous
```

L'API peut donc être atteignable depuis Internet lorsque le tunnel est actif.

Cette configuration est adaptée à un usage personnel / développement, mais ne doit pas être considérée comme une configuration de production sécurisée sans mécanisme d'authentification et de protection supplémentaire.