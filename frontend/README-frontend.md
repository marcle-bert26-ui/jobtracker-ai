# JobTracker AI — Frontend

Interface web de l'application JobTracker AI.

Le frontend permet de consulter et gérer les candidatures et les différentes fonctionnalités de l'application.

---

## Technologies

* Next.js
* React
* TypeScript
* CSS
* npm

---

## Structure

```text
frontend/
│
├── app/
│   ├── applications/
│   ├── components/
│   ├── duplicates/
│   ├── emails/
│   ├── kanban/
│   ├── profile/
│   ├── reminders/
│   ├── spontaneous/
│   ├── stats/
│   └── page.tsx
│
├── lib/
│   └── api.ts
│
├── package.json
└── ...
```

---

## Installation

Installer les dépendances :

```powershell
npm install
```

---

## Lancement

Depuis le dossier `frontend` :

```powershell
npm run dev
```

Le frontend est disponible localement sur :

```text
http://localhost:3000
```

---

## Connexion au backend

La configuration de l'API est centralisée dans :

```text
lib/api.ts
```

Le frontend détecte automatiquement l'environnement dans lequel il est ouvert.

### Mode local

Lorsque le frontend est ouvert sur :

```text
http://localhost:3000
```

il utilise :

```text
http://127.0.0.1:8000
```

Architecture :

```text
Navigateur
    │
    ▼
localhost:3000
    │
    ▼
127.0.0.1:8000
```

---

### Mode Dev Tunnel

Lorsque le frontend est ouvert via :

```text
https://426bxhwg-3000.uks1.devtunnels.ms
```

il détecte automatiquement le suffixe :

```text
-3000
```

et construit l'URL du backend :

```text
https://426bxhwg-8000.uks1.devtunnels.ms
```

Architecture :

```text
Navigateur distant
        │
        ▼
Dev Tunnel :3000
        │
        ▼
Frontend Next.js
        │
        ▼
Dev Tunnel :8000
        │
        ▼
Backend FastAPI
```

---

## Configuration API

Le fichier :

```text
lib/api.ts
```

centralise l'accès au backend.

Exemple de logique :

```text
localhost / 127.0.0.1
        ↓
http://127.0.0.1:8000

xxxx-3000.uks1.devtunnels.ms
        ↓
xxxx-8000.uks1.devtunnels.ms
```

Cette architecture évite d'avoir une URL d'API différente dans chaque page.

---

## Pages principales

L'application contient notamment les fonctionnalités suivantes :

```text
/
├── Tableau de bord
├── Candidatures
├── Kanban
├── Emails
├── Relances
├── Statistiques
├── Candidatures spontanées
├── Doublons
├── Profil
└── Documents
```

---

## Backend Status

Le composant :

```text
app/components/BackendStatus.tsx
```

permet de vérifier si le backend est disponible.

Il utilise l'endpoint :

```text
/health
```

Si le backend est indisponible, l'application peut utiliser le protocole Windows :

```text
jobtracker://start
```

pour demander son redémarrage.

---

## Dev Tunnel

Le frontend est exposé sur le port :

```text
3000
```

Tunnel :

```text
jobtracker-ai.uks1
```

URL publique actuelle :

```text
https://426bxhwg-3000.uks1.devtunnels.ms
```

Lancement du tunnel depuis Windows :

```powershell
C:\Users\marcl\devtunnel.exe host jobtracker-ai
```

Le tunnel doit exposer simultanément les ports :

```text
3000
8000
```

---

## Développement

Lancer le frontend :

```powershell
npm run dev
```

Puis ouvrir :

```text
http://localhost:3000
```

Les modifications du code sont automatiquement prises en compte par Next.js en mode développement.

---

## Vérification de la connexion API

Vérifier d'abord le backend :

```text
http://127.0.0.1:8000/health
```

Puis ouvrir le frontend :

```text
http://localhost:3000
```

Pour tester l'accès distant :

```text
https://426bxhwg-3000.uks1.devtunnels.ms
```

---

## Problèmes fréquents

### Erreur CORS

Vérifier que l'URL du frontend est présente dans :

```text
backend/main.py
```

Exemple :

```python
"https://426bxhwg-3000.uks1.devtunnels.ms"
```

---

### Le frontend affiche une erreur réseau

Vérifier :

1. que le backend est démarré ;
2. que le port `8000` est accessible ;
3. que le Dev Tunnel est actif ;
4. que `lib/api.ts` contient la bonne configuration.

---

### Le tunnel ne fonctionne pas

Vérifier que Dev Tunnel est connecté :

```powershell
C:\Users\marcl\devtunnel.exe list
```

Puis relancer :

```powershell
C:\Users\marcl\devtunnel.exe host jobtracker-ai
```

---

## Build de production

Pour générer une version de production :

```powershell
npm run build
```

Puis :

```powershell
npm start
```

> Le fonctionnement actuel du projet est principalement prévu pour le développement et l'utilisation personnelle avec `npm run dev`.
