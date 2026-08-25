import json
import os

import requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

SYSTEM_PROMPT = """Tu es un classifieur d'emails pour un outil de suivi de candidatures d'emploi.
Analyse l'email fourni et détermine s'il concerne une candidature à un poste que l'utilisateur
a déjà soumise (pas une offre d'emploi non sollicitée, pas une newsletter, pas une alerte
d'offres génériques).

Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, au format exact :
{"is_job_related": true ou false, "event_type": "nouvelle_candidature" ou "entretien" ou "reponse_positive" ou "reponse_negative" ou "email_recu" ou "ignore", "company": "nom de l'entreprise ou null", "position": "intitulé du poste ou null"}

Règles :
- "nouvelle_candidature" : confirme la réception d'une candidature déjà envoyée par l'utilisateur.
- "entretien" : invitation à un entretien, un appel, un échange RH.
- "reponse_positive" : offre d'embauche, proposition de contrat.
- "reponse_negative" : refus, rejet de candidature.
- "email_recu" : lié au recrutement mais dans aucune catégorie ci-dessus.
- "ignore" : non lié à une candidature déjà engagée. Exemples à toujours
  classer "ignore" : newsletters, alertes/recommandations d'offres génériques
  ("5 nouveaux postes correspondent à votre profil", "offres similaires
  recommandées"), spam, documents administratifs (fiche/bulletin de paie),
  autre.

Si is_job_related est false, event_type doit être "ignore"."""


def is_available() -> bool:
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        return response.status_code == 200
    except Exception:
        return False


def classify_with_ai(subject, sender_email, sender_name, body):
    """
    Retourne un dict {is_job_related, event_type, company, position}
    ou None si Ollama n'est pas disponible / la réponse est invalide
    (l'appelant se rabat alors sur les règles-clés).
    """
    # Les emails de plateformes (LinkedIn, HelloWork...) commencent souvent
    # par du texte de navigation/menu sans intérêt avant le vrai contenu —
    # on laisse une marge large pour ne pas couper l'info utile.
    truncated_body = (body or "")[:6000]

    user_content = (
        f"Expéditeur : {sender_name} <{sender_email}>\n"
        f"Sujet : {subject}\n\n"
        f"Corps de l'email :\n{truncated_body}"
    )

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                "format": "json",
                "stream": False,
                "options": {
                    "temperature": 0,
                    # Par défaut, Ollama utilise une fenêtre de contexte
                    # réduite (souvent 2048 tokens) quel que soit le modèle,
                    # ce qui peut tronquer silencieusement le prompt système
                    # et une partie du mail. On force une fenêtre plus large
                    # pour être sûr que tout le texte envoyé est bien pris
                    # en compte.
                    "num_ctx": 8192,
                },
            },
            timeout=90,
        )

        response.raise_for_status()
        raw_content = response.json()["message"]["content"]

        parsed = json.loads(raw_content)

        if "event_type" not in parsed:
            return None

        return parsed

    except Exception:
        return None
