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

Le backend est
