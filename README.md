# JobTracker AI

Application personnelle de gestion et de suivi des candidatures.

JobTracker AI permet de centraliser les candidatures, suivre leur avancement, gérer les échanges avec les recruteurs, organiser les relances et exploiter des fonctionnalités d'assistance par intelligence artificielle.

---

## Architecture

L'application est composée de trois éléments principaux :

```text
                    INTERNET
                       │
                       ▼
        ┌──────────────────────────────┐
        │       Dev Tunnel             │
        │  jobtracker-ai.uks1          │
        └──────────────┬───────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
       Frontend :3000      Backend :8000
              │                 │
              └────────┬────────┘
                       ▼
                  Base de données
```

### Frontend

* Next.js
* React
* TypeScript
* Interface utilisateur de JobTracker AI
* Port local : `3000`

### Backend

* Python
* FastAPI
* Uvicorn
* SQLAlchemy
* Base de données locale
* Port local : `8000`

### Accès distant

L'accès distant est assuré par Microsoft Dev Tunnels.

Tunnel persistant :

```text
jobtracker-ai.uks1
```

URL publique actuelle :

```text
https://426bxhwg-3000.uks1.devtunnels.ms
```

API publique :

```text
https://426bxhwg-8000.uks1.devtunnels.ms
```

> L'URL publique est associée au tunnel persistant. Elle peut néanmoins changer si le tunnel est recréé ou si son expiration nécessite une nouvelle configuration.

---

## Structure du projet

```text
jobtracker-ai/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── graph_auth.py
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   │   └── api.ts
│   ├── package.json
│   └── ...
│
└── launcher/
    ├── start_jobtracker.bat
    ├── stop_jobtracker.bat
    ├── restart_backend.bat
    ├── run_backend.bat
    ├── enregistrer_protocole.vbs
    ├── creer_raccourci_bureau.vbs
    └── ...
```

---

## Lancement

### Lancement manuel

#### Backend

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn main:app --reload
```

Le backend est alors disponible sur :

```text
http://127.0.0.1:8000
```

Test de fonctionnement :

```text
http://127.0.0.1:8000/health
```

Réponse attendue :

```json
{
  "status": "ok",
  "application": "JobTracker AI",
  "version": "0.4.0"
}
```

#### Frontend

Dans un autre terminal :

```powershell
cd frontend
npm run dev
```

Le frontend est disponible sur :

```text
http://localhost:3000
```

---

## Lancement automatique

Le dossier `launcher` contient les scripts permettant de lancer l'ensemble de l'application.

Le lancement complet doit démarrer :

1. le backend ;
2. le frontend ;
3. le Dev Tunnel ;
4. puis ouvrir JobTracker AI.

Le tunnel est lancé avec :

```powershell
C:\Users\marcl\devtunnel.exe host jobtracker-ai
```

Le chemin peut également être construit avec :

```bat
%USERPROFILE%\devtunnel.exe
```

---

## Configuration de l'API

La configuration de l'API frontend est centralisée dans :

```text
frontend/lib/api.ts
```

Le frontend détecte automatiquement son environnement.

### Utilisation locale

```text
http://localhost:3000
        ↓
http://127.0.0.1:8000
```

### Utilisation via Dev Tunnel

```text
https://426bxhwg-3000.uks1.devtunnels.ms
        ↓
https://426bxhwg-8000.uks1.devtunnels.ms
```

Il n'est donc normalement pas nécessaire de modifier chaque page du frontend lorsque l'application passe du mode local au mode distant.

---

## CORS

Le backend autorise les origines locales et l'origine publique du frontend.

Exemple :

```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://426bxhwg-3000.uks1.devtunnels.ms",
]
```

Si l'URL publique du tunnel change, cette configuration doit être mise à jour.

---

## Dev Tunnel

Le tunnel utilisé par JobTracker AI est un tunnel persistant.

Création :

```powershell
.\devtunnel.exe create jobtracker-ai --allow-anonymous
```

Hébergement :

```powershell
.\devtunnel.exe host jobtracker-ai
```

Les ports utilisés sont :

```text
3000 → Frontend
8000 → Backend
```

Le tunnel doit être actif pour permettre l'accès à l'application depuis Internet.

### Vérifier les tunnels

```powershell
.\devtunnel.exe list
```

### Vérifier les ports

```powershell
.\devtunnel.exe port list jobtracker-ai
```

---

## Authentification Dev Tunnel

La connexion au compte Microsoft est effectuée avec :

```powershell
.\devtunnel.exe user login
```

Le tunnel a été configuré avec un accès anonyme :

```text
Anonymous [connect]
```

Cela permet à un navigateur externe d'accéder au frontend sans authentification Dev Tunnel.

> Attention : un tunnel anonyme rend les services exposés accessibles depuis Internet. Les données et routes de l'application doivent donc être correctement protégées.

---

## Dépannage

### Le frontend ne communique plus avec le backend

Vérifier :

```text
http://127.0.0.1:8000/health
```

Si cette URL fonctionne, vérifier ensuite l'URL publique du backend.

---

### Erreur CORS

Vérifier `backend/main.py`.

L'origine du frontend doit correspondre exactement à l'URL utilisée dans le navigateur.

Exemple :

```text
https://426bxhwg-3000.uks1.devtunnels.ms
```

---

### Le frontend fonctionne mais l'API ne répond pas

Vérifier que les deux services sont lancés :

```text
Frontend → :3000
Backend  → :8000
```

Puis vérifier que le Dev Tunnel expose bien les deux ports.

---

### Le backend est arrêté

Utiliser :

```text
launcher/restart_backend.bat
```

Le mécanisme `jobtracker://` permet également au frontend de demander le redémarrage du backend.

---

## Technologies

* Python
* FastAPI
* Uvicorn
* SQLAlchemy
* Next.js
* React
* TypeScript
* Microsoft Graph
* Ollama / IA
* SQLite
* Microsoft Dev Tunnels

---

## Objectif du projet

JobTracker AI a pour objectif de fournir un outil personnel permettant de :

* centraliser les candidatures ;
* suivre les différentes étapes d'un recrutement ;
* gérer les contacts recruteurs ;
* organiser les relances ;
* centraliser les documents ;
* suivre les emails ;
* analyser les candidatures ;
* visualiser les statistiques ;
* automatiser certaines tâches répétitives.

Le projet est conçu pour fonctionner principalement sur un PC personnel avec possibilité d'accès distant via Dev Tunnel.
