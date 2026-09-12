"""
Logique partagée pour comparer deux candidatures (entreprise, poste,
localisation) et décider :

1. si un email peut être rattaché SANS AMBIGUÏTÉ à une candidature déjà
   existante (auto-attache lors de la synchronisation des emails) ;
2. si deux candidatures existantes se ressemblent assez pour être
   proposées comme doublons potentiels sur la page /duplicates.

Règle centrale voulue par l'utilisateur : deux candidatures ne sont
considérées comme identiques que si l'entreprise, le poste ET la ville
sont les mêmes. Si l'un de ces éléments est seulement "proche" (et pas
strictement identique une fois normalisé), on ne fusionne/attache
JAMAIS automatiquement dans la fiche existante — au pire, ça part dans
la page "Doublons" pour une vérification manuelle.
"""

import re
import unicodedata
from difflib import SequenceMatcher

# Mots à ignorer pour comparer deux noms d'entreprise (formes juridiques,
# trop fréquentes pour être discriminantes).
COMPANY_NOISE_WORDS = {
    "sarl", "sas", "sasu", "sa", "eurl", "sci", "group", "groupe",
    "inc", "ltd", "llc", "corp", "corporation", "company", "co",
}

# Valeurs "placeholder" posées quand rien n'a été détecté — à traiter
# comme une absence d'information (jamais comme une vraie valeur à
# comparer), sinon on comparerait "poste non précisé" à un vrai poste et
# on créerait de faux doublons ou de faux blocages.
UNKNOWN_POSITION_VALUES = {"poste non precise", "poste non précisé"}
UNKNOWN_COMPANY_VALUES = {"entreprise inconnue"}

# Seuil de similarité (0-1, ratio difflib) à partir duquel deux textes
# normalisés sont considérés "proches" sans être identiques. Volontairement
# élevé : on ne veut détecter que de vraies quasi-correspondances (fautes
# de frappe, abréviations), pas des postes/villes vaguement similaires.
CLOSE_SIMILARITY_THRESHOLD = 0.84


def _strip_accents(value: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )


def normalize_text(value: str | None) -> str:
    """Normalisation générique : minuscules, sans accents, sans
    ponctuation, espaces multiples réduits à un seul."""
    if not value:
        return ""

    normalized = _strip_accents(value.strip().lower())
    normalized = re.sub(r"[^\w\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()

    return normalized


def normalize_company(company: str | None) -> str:
    normalized = normalize_text(company)

    if not normalized or normalized in UNKNOWN_COMPANY_VALUES:
        return ""

    words = [w for w in normalized.split() if w and w not in COMPANY_NOISE_WORDS]

    return " ".join(words)


def normalize_position(position: str | None) -> str:
    normalized = normalize_text(position)

    if normalized in UNKNOWN_POSITION_VALUES:
        return ""

    return normalized


def normalize_location(location: str | None) -> str:
    return normalize_text(location)


def text_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0

    return SequenceMatcher(None, a, b).ratio()


def field_relation(a_norm: str, b_norm: str) -> str:
    """
    Compare deux valeurs déjà normalisées et renvoie :
    - "unknown"   : l'une des deux (ou les deux) est vide -> rien à
                    comparer, ne doit jamais bloquer ni jamais prouver
                    une correspondance à lui seul ;
    - "exact"     : strictement identiques une fois normalisées ;
    - "close"     : ressemblantes (inclusion ou similarité élevée) mais
                    pas identiques -> c'est un DOUTE, jamais traité comme
                    une correspondance certaine ;
    - "different" : clairement différentes.
    """
    if not a_norm or not b_norm:
        return "unknown"

    if a_norm == b_norm:
        return "exact"

    if a_norm in b_norm or b_norm in a_norm:
        return "close"

    if text_similarity(a_norm, b_norm) >= CLOSE_SIMILARITY_THRESHOLD:
        return "close"

    return "different"


def find_confident_match(candidates, company, position, location):
    """
    Parmi des candidatures déjà filtrées sur la même entreprise, renvoie
    celle qui correspond SANS AMBIGUÏTÉ à (company, position, location) —
    c'est-à-dire que le poste et la ville sont soit identiques une fois
    normalisés, soit inconnus d'un côté ou de l'autre (rien à contredire).

    Dès qu'un champ est seulement "proche" (`close`) ou clairement
    différent, on considère qu'il y a doute : cette fonction ne renvoie
    JAMAIS cette candidature, pour ne jamais rattacher/mettre à jour une
    fiche existante par erreur. Le nouvel événement doit alors créer sa
    propre fiche (qui pourra apparaître comme doublon potentiel sur la
    page dédiée, à vérifier à la main).
    """
    position_norm = normalize_position(position)
    location_norm = normalize_location(location)

    for candidate in candidates:
        position_relation = field_relation(
            position_norm, normalize_position(candidate.position)
        )
        location_relation = field_relation(
            location_norm, normalize_location(candidate.location)
        )

        if position_relation in ("close", "different"):
            continue

        if location_relation in ("close", "different"):
            continue

        # Ici : poste et ville identiques ou non renseignés des deux
        # côtés -> aucune ambiguïté, on peut rattacher/mettre à jour.
        return candidate

    return None
