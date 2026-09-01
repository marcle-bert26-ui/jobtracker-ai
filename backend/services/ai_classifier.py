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
{"is_job_related": true ou false, "event_type": "nouvelle_candidature" ou "entretien" ou "reponse_positive" ou "reponse_negative" ou "email_recu" ou "ignore", "company": "nom de l'entreprise ou null", "position": "intitulé du poste ou null", "location": "localisation du poste ou null"}

Règles pour "location" :
- Indique la ville (et le pays si mentionné et non évident) du poste, ex : "Paris", "Lyon", "Bordeaux, France".
- Si l'email indique explicitement du télétravail total, réponds "Télétravail".
- Si l'email mentionne un mode hybride avec une ville, réponds par exemple "Paris (hybride)".
- Si aucune localisation n'est mentionnée dans l'email, réponds null. Ne devine jamais une ville à partir du nom de l'entreprise ou du domaine de l'expéditeur.

Règles :
- "nouvelle_candidature" : confirme la réception d'une candidature déjà envoyée par l'utilisateur.
  Cela inclut les accusés de réception automatiques (Workday, Greenhouse, Lever...) même si le
  texte mentionne, au conditionnel ou au futur, qu'un entretien pourra suivre plus tard
  ("nous vous contacterons pour un entretien si votre profil correspond", "we will contact you
  for an interview if..."). Une simple mention future/hypothétique d'entretien dans un mail de
  confirmation ne doit JAMAIS faire basculer la catégorie en "entretien".
- "entretien" : le mail propose ou confirme une date/créneau concret d'entretien, d'appel ou
  d'échange RH (ex : "Êtes-vous disponible mardi à 14h ?", "voici le lien de visioconférence").
  Si le mail est avant tout un accusé de réception de candidature, classe-le en
  "nouvelle_candidature" même s'il évoque un entretien à venir.
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
        if response.status_code != 200:
            print(
                f"[ollama] {OLLAMA_URL}/api/tags a répondu "
                f"{response.status_code} — Ollama semble mal configuré."
            )
            return False
        return True
    except requests.exceptions.ConnectionError:
        print(
            f"[ollama] Connexion refusée sur {OLLAMA_URL} — "
            f"Ollama n'est probablement pas lancé."
        )
        return False
    except requests.exceptions.Timeout:
        print(f"[ollama] Timeout (2s) en contactant {OLLAMA_URL}.")
        return False
    except Exception as e:
        print(f"[ollama] Erreur inattendue au ping ({type(e).__name__}) : {e}")
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
    except requests.exceptions.Timeout:
        print(
            f"[ollama] Timeout (90s dépassées) pour le modèle "
            f"'{OLLAMA_MODEL}' — trop lent ou machine surchargée."
        )
        return None
    except requests.exceptions.ConnectionError:
        print(
            f"[ollama] Connexion perdue avec {OLLAMA_URL} pendant "
            f"la requête — Ollama a-t-il crashé ou été arrêté ?"
        )
        return None
    except Exception as e:
        print(f"[ollama] Erreur réseau inattendue ({type(e).__name__}) : {e}")
        return None

    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError:
        # Cas fréquent : modèle non téléchargé -> 404 avec un message
        # explicite d'Ollama ("model 'xxx' not found, try pulling it").
        print(
            f"[ollama] Erreur HTTP {response.status_code} : "
            f"{response.text[:300]}"
        )
        return None

    try:
        raw_content = response.json()["message"]["content"]
    except (KeyError, ValueError) as e:
        print(
            f"[ollama] Réponse Ollama mal formée (pas de "
            f"message.content) : {e} — corps brut : {response.text[:300]!r}"
        )
        return None

    try:
        parsed = json.loads(raw_content)
    except json.JSONDecodeError:
        print(
            f"[ollama] Le modèle n'a pas renvoyé de JSON valide "
            f"malgré 'format: json' : {raw_content[:300]!r}"
        )
        return None

    if "event_type" not in parsed:
        print(f"[ollama] JSON valide mais sans clé 'event_type' : {parsed}")
        return None

    return parsed
