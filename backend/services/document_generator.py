"""
Génération de contenu via l'IA locale (Ollama) à partir du profil
(CV importé) de l'utilisateur :
- lettre de motivation adaptée à une candidature
- CV adapté (contenu réorganisé/mis en avant selon le poste visé)
- suggestions d'entreprises à cibler en candidature spontanée
- message de candidature spontanée pour une entreprise donnée

Tout repose sur le même modèle Ollama que la classification des emails
(voir ai_classifier.py) — aucun appel réseau externe, aucun coût.

Important : Ollama n'a pas accès à internet. Les suggestions d'entreprises
viennent uniquement de ce que le modèle a appris pendant son entraînement
(potentiellement daté, incomplet ou partiellement halluciné) — jamais
d'une recherche en direct. Les textes générés sont systématiquement des
brouillons à relire avant envoi.
"""

import json
import os

import requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

# Générer un CV/une lettre est une tâche plus longue qu'une simple
# classification d'email — on laisse largement plus de temps à Ollama.
GENERATION_TIMEOUT = 120

# Une lettre de motivation ou de candidature spontanée doit tenir sur une
# page : au-delà, ça n'est plus lu. On le demande explicitement au modèle
# ET on applique un garde-fou technique si jamais il dépasse quand même.
MAX_LETTER_WORDS = 380


class GenerationError(Exception):
    """Levée quand Ollama est indisponible ou renvoie une réponse invalide."""


def _enforce_max_length(text: str, max_words: int = MAX_LETTER_WORDS) -> str:
    """
    Garde-fou appliqué après la génération : si le modèle n'a pas respecté
    la consigne de longueur, on coupe proprement au paragraphe le plus
    proche de la limite plutôt qu'en plein milieu d'une phrase — tout en
    gardant systématiquement le dernier paragraphe (formule de politesse),
    pour ne jamais renvoyer une lettre qui s'arrête brutalement.
    """
    words = text.split()

    if len(words) <= max_words:
        return text.strip()

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    if len(paragraphs) <= 1:
        return " ".join(words[:max_words]).strip() + "…"

    closing = paragraphs[-1]
    kept: list[str] = []
    word_count = len(closing.split())

    for paragraph in paragraphs[:-1]:
        paragraph_words = len(paragraph.split())
        if word_count + paragraph_words > max_words:
            break
        kept.append(paragraph)
        word_count += paragraph_words

    kept.append(closing)

    return "\n\n".join(kept)


def _chat(system_prompt: str, user_content: str, expect_json: bool = False):
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                "stream": False,
                **({"format": "json"} if expect_json else {}),
            },
            timeout=GENERATION_TIMEOUT,
        )
        response.raise_for_status()
    except requests.exceptions.ConnectionError as exc:
        raise GenerationError(
            f"Impossible de contacter Ollama sur {OLLAMA_URL} — vérifie "
            "qu'il tourne bien (`ollama serve`)."
        ) from exc
    except requests.exceptions.Timeout as exc:
        raise GenerationError(
            f"Ollama a mis plus de {GENERATION_TIMEOUT}s à répondre — "
            f"modèle '{OLLAMA_MODEL}' trop lent ou machine surchargée."
        ) from exc
    except requests.exceptions.RequestException as exc:
        raise GenerationError(f"Erreur en contactant Ollama : {exc}") from exc

    try:
        content = response.json()["message"]["content"]
    except (KeyError, ValueError) as exc:
        raise GenerationError("Réponse inattendue de la part d'Ollama.") from exc

    if expect_json:
        try:
            return json.loads(content)
        except ValueError as exc:
            raise GenerationError(
                "Ollama n'a pas renvoyé un JSON valide — réessaie, ou "
                "change de modèle si le problème persiste."
            ) from exc

    return content.strip()


def generate_cover_letter(
    cv_text: str, company: str, position: str, extra_instructions: str | None = None
) -> str:
    system_prompt = (
        "Tu rédiges des lettres de motivation en français, professionnelles, "
        "concrètes et sincères — jamais génériques ni ronflantes. Tu t'appuies "
        "STRICTEMENT sur les expériences, compétences et formations "
        "réellement présentes dans le CV fourni : n'invente aucune "
        "expérience, aucun diplôme, aucune compétence qui n'y figure pas. "
        "Structure : formule d'accroche, 2-3 paragraphes reliant le profil "
        "au poste visé, formule de politesse. Vouvoiement. Ne mets ni "
        "coordonnées ni date en en-tête (juste le corps de la lettre) — "
        "elles seront ajoutées séparément. IMPORTANT : la lettre doit tenir "
        f"sur une seule page, {MAX_LETTER_WORDS} mots maximum au total — "
        "sois concis, va à l'essentiel. Réponds uniquement avec le texte "
        "de la lettre, sans commentaire ni balise Markdown."
    )

    user_content = (
        f"Poste visé : {position}\n"
        f"Entreprise : {company}\n"
        + (f"Consignes supplémentaires : {extra_instructions}\n" if extra_instructions else "")
        + f"\nCV :\n{cv_text[:6000]}"
    )

    return _enforce_max_length(_chat(system_prompt, user_content))


def normalize_cv_data(raw: object) -> dict:
    """
    L'IA renvoie un JSON censé suivre un schéma précis, mais rien ne
    garantit qu'elle s'y tienne à la lettre (ex : "bullets" renvoyé comme
    une simple chaîne au lieu d'une liste, une section qui n'est pas un
    objet...). Sans ce nettoyage, une déviation mineure du modèle fait
    planter la mise en page PDF (`pdf_generator.generate_cv_pdf`) au lieu
    de simplement dégrader un peu le rendu. On force donc une forme
    toujours exploitable, quoi que le modèle ait réellement renvoyé.
    """
    if not isinstance(raw, dict):
        raw = {}

    def _as_str(value) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return str(value).strip() or None

    def _as_bullets(value) -> list[str]:
        if isinstance(value, list):
            return [b.strip() for b in (_as_str(item) for item in value) if b]
        text = _as_str(value)
        return [text] if text else []

    sections = []
    raw_sections = raw.get("sections")

    if isinstance(raw_sections, list):
        for raw_section in raw_sections:
            if not isinstance(raw_section, dict):
                continue

            title = _as_str(raw_section.get("title"))
            raw_items = raw_section.get("items")
            items = []

            if isinstance(raw_items, list):
                for raw_item in raw_items:
                    if not isinstance(raw_item, dict):
                        continue

                    heading = _as_str(raw_item.get("heading"))
                    bullets = _as_bullets(raw_item.get("bullets"))

                    if heading or bullets:
                        items.append({"heading": heading, "bullets": bullets})

            if title and items:
                sections.append({"title": title, "items": items})

    return {
        "full_name": _as_str(raw.get("full_name")),
        "headline": _as_str(raw.get("headline")),
        "summary": _as_str(raw.get("summary")),
        "sections": sections,
    }


def generate_tailored_cv(
    cv_text: str, company: str, position: str, extra_instructions: str | None = None
) -> dict:
    system_prompt = (
        "Tu adaptes un CV existant pour un poste précis, en français. "
        "STRICTEMENT à partir du contenu du CV fourni : ne jamais inventer "
        "d'expérience, de compétence, de diplôme ou de date qui n'y figure "
        "pas. Ton travail : réorganiser et reformuler pour mettre en avant "
        "ce qui est pertinent pour CE poste précis, condenser ce qui l'est "
        "moins — pas créer du contenu nouveau.\n\n"
        "Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou "
        "après, au format exact :\n"
        "{\n"
        '  "full_name": "nom complet tel que trouvé dans le CV, ou null",\n'
        '  "headline": "accroche courte (une ligne) adaptée au poste visé",\n'
        '  "summary": "résumé professionnel de 2-3 phrases, adapté au poste",\n'
        '  "sections": [\n'
        "    {\n"
        '      "title": "Expérience professionnelle",\n'
        '      "items": [\n'
        '        {"heading": "Intitulé — Entreprise (dates)", '
        '"bullets": ["réalisation 1", "réalisation 2"]}\n'
        "      ]\n"
        "    },\n"
        '    {"title": "Formation", "items": [{"heading": "...", "bullets": []}]},\n'
        '    {"title": "Compétences", "items": [{"heading": "", '
        '"bullets": ["compétence 1", "compétence 2"]}]}\n'
        "  ]\n"
        "}\n"
        "Adapte les titres de section et leur ordre si le CV d'origine en "
        "suggère d'autres (langues, certifications...) — n'invente pas de "
        "sections vides."
    )

    user_content = (
        f"Poste visé : {position}\n"
        f"Entreprise : {company}\n"
        + (f"Consignes supplémentaires : {extra_instructions}\n" if extra_instructions else "")
        + f"\nCV d'origine :\n{cv_text[:6000]}"
    )

    raw = _chat(system_prompt, user_content, expect_json=True)
    cv_data = normalize_cv_data(raw)

    if not cv_data["sections"] and not cv_data["summary"]:
        # Le JSON était syntaxiquement valide mais vide de tout contenu
        # exploitable une fois nettoyé — plutôt que de renvoyer un CV
        # quasi blanc, on le signale comme un échec de génération pour
        # que l'appelant puisse le faire savoir plutôt que de produire un
        # PDF inutile.
        raise GenerationError(
            "L'IA a renvoyé un CV vide ou dans un format inattendu — réessaie."
        )

    return cv_data


def suggest_target_companies(cv_text: str, sector: str, location: str | None = None) -> list[dict]:
    system_prompt = (
        "Tu aides quelqu'un à identifier des entreprises à cibler pour une "
        "candidature spontanée, en français. IMPORTANT : tu n'as pas accès "
        "à internet — base-toi uniquement sur ce que tu connais du secteur "
        "indiqué. Précise-le implicitement en restant sur des entreprises "
        "reconnues/établies plutôt que d'inventer des noms plausibles mais "
        "incertains. Si tu n'es pas sûr qu'une entreprise existe ou soit "
        "toujours active dans ce secteur, ne la propose pas.\n\n"
        "Réponds UNIQUEMENT avec un objet JSON valide au format exact :\n"
        '{"companies": [{"name": "...", "why": "pourquoi elle correspond '
        'au profil, en une phrase"}]}\n'
        "Propose 5 à 10 entreprises maximum."
    )

    user_content = (
        f"Secteur / type de poste recherché : {sector}\n"
        + (f"Zone géographique souhaitée : {location}\n" if location else "")
        + f"\nProfil (CV) :\n{cv_text[:4000]}"
    )

    result = _chat(system_prompt, user_content, expect_json=True)
    return result.get("companies", []) if isinstance(result, dict) else []


def generate_spontaneous_letter(
    cv_text: str, company: str, context: str | None = None,
    extra_instructions: str | None = None,
) -> str:
    system_prompt = (
        "Tu rédiges des lettres/emails de candidature SPONTANÉE (aucune "
        "offre précise visée) en français, professionnels et concrets. Tu "
        "t'appuies STRICTEMENT sur les expériences et compétences "
        "réellement présentes dans le CV fourni : n'invente rien. "
        "Structure : accroche expliquant l'intérêt pour l'entreprise, lien "
        "entre le profil et ce qu'elle pourrait apporter, ouverture "
        "(disponibilité pour échanger). Vouvoiement, ton direct sans être "
        "familier. IMPORTANT : le message doit tenir sur une seule page, "
        f"{MAX_LETTER_WORDS} mots maximum au total — sois concis, va à "
        "l'essentiel. Réponds uniquement avec le texte, sans commentaire ni "
        "balise Markdown."
    )

    user_content = (
        f"Entreprise ciblée : {company}\n"
        + (f"Contexte / ce qui motive cette candidature : {context}\n" if context else "")
        + (f"Consignes supplémentaires : {extra_instructions}\n" if extra_instructions else "")
        + f"\nCV :\n{cv_text[:6000]}"
    )

    return _enforce_max_length(_chat(system_prompt, user_content))
