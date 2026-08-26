# Lanceur JobTracker AI (Windows)

Ce dossier permet de créer une icône sur le Bureau qui démarre automatiquement le backend et le frontend, puis ouvre l'application dans le navigateur.

## Installation (une seule fois)

1. **Vérifie que le projet est bien installé** (voir le README principal) :
   - `backend/.venv` doit exister (environnement virtuel Python avec les dépendances installées)
   - `frontend/node_modules` doit exister (`npm install` déjà lancé)

2. **Double-clique sur `creer_raccourci_bureau.vbs`**.
   Deux icônes apparaissent alors sur ton Bureau :
   - **"JobTracker AI"** — pour lancer l'application
   - **"Arreter JobTracker AI"** — pour tout fermer proprement

3. **Double-clique sur `enregistrer_protocole.vbs`** (une seule fois aussi).
   Ça permet au bouton "Backend hors ligne" dans l'appli (en bas à droite
   de chaque page) de relancer automatiquement le backend en un clic,
   sans avoir à rouvrir l'icône du Bureau à la main.

C'est tout — ces étapes ne sont à faire qu'une seule fois.

## Utilisation au quotidien

Double-clique sur l'icône **JobTracker AI** sur le Bureau :
- une fenêtre noire démarre le backend (FastAPI)
- une autre fenêtre noire démarre le frontend (Next.js)
- après quelques secondes, ton navigateur s'ouvre automatiquement sur `http://localhost:3000`

## Relancer le backend depuis l'appli

Si le badge en bas à droite affiche **"Backend hors ligne"**, tu peux
cliquer dessus pour relancer automatiquement le backend, sans passer par
le Bureau. Ton navigateur affichera probablement une petite fenêtre de
confirmation la première fois ("Ouvrir JobTracker AI ?") — c'est normal,
accepte-la.

Ça ne fonctionne que si tu as fait l'étape 3 de l'installation
(`enregistrer_protocole.vbs`) au moins une fois.

## Arrêter l'application

Deux façons de faire, au choix :
- Double-clique sur l'icône **Arreter JobTracker AI** sur le Bureau (ferme tout automatiquement).
- Ou ferme manuellement les deux fenêtres noires ("JobTracker - Backend" et "JobTracker - Frontend").

## Fichiers de ce dossier

| Fichier | Rôle |
|---|---|
| `start_jobtracker.bat` | Script lancé par le raccourci de démarrage : lance backend + frontend + navigateur |
| `stop_jobtracker.bat` | Script lancé par le raccourci d'arrêt : ferme backend + frontend |
| `restart_backend.bat` | Relance uniquement le backend (utilisé par le protocole `jobtracker://`) |
| `creer_raccourci_bureau.vbs` | À exécuter une fois pour créer les deux icônes sur le Bureau |
| `enregistrer_protocole.vbs` | À exécuter une fois pour activer le bouton "relancer" dans l'appli |
| `jobtracker.ico` | Icône utilisée par les raccourcis |

## En cas de problème

- Si une fenêtre affiche une erreur `venv introuvable` ou `node_modules introuvable`, retourne voir la section Installation du [README principal](../README.md).
- Si le navigateur s'ouvre trop tôt (page blanche ou erreur de connexion), attends quelques secondes et rafraîchis — le frontend peut mettre un peu plus de temps à démarrer la première fois.
