"""
Calcul des rappels : candidatures à relancer (aucune activité récente) et
candidatures auxquelles il manque des informations importantes.

Reste volontairement simple et sans dépendance externe : tout est calculé
en Python à partir des candidatures + de leur historique, déjà chargés en
mémoire (volumes typiques d'un suivi personnel : quelques dizaines à
quelques centaines de lignes, pas besoin d'optimiser en SQL).
"""

from datetime import datetime

from models import Application

# Statuts considérés comme "clos" : plus besoin de relancer.
CLOSED_STATUSES = {"Refusée", "Acceptée"}

# Champs jugés importants pour bien suivre une candidature, et leur libellé
# affiché côté frontend quand ils sont vides.
MISSING_INFO_FIELDS: list[tuple[str, str]] = [
    ("application_date", "Date de candidature"),
    ("job_url", "Lien de l'offre"),
    ("recruiter_email", "Email du recruteur"),
]


def _is_blank(value) -> bool:
    if value is None:
        return True

    if isinstance(value, str):
        return not value.strip()

    # Champs non-textuels (ex : application_date, un datetime) : la seule
    # notion de "vide" qui s'applique est l'absence de valeur (None),
    # déjà couverte ci-dessus.
    return False


def compute_last_activity(application: Application) -> datetime:
    """
    Dernière date "connue" d'activité sur une candidature : le plus récent
    entre la date de candidature, la création de la fiche et la dernière
    entrée d'historique (relance, réponse, entretien, email reçu...).
    """
    candidates = [application.created_at]

    if application.application_date is not None:
        candidates.append(application.application_date)

    for entry in application.history:
        candidates.append(entry.date)

    return max(candidates)


def compute_missing_fields(application: Application) -> list[str]:
    return [
        label
        for field, label in MISSING_INFO_FIELDS
        if _is_blank(getattr(application, field))
    ]


def build_reminder_entry(application: Application, now: datetime) -> dict:
    last_activity_date = compute_last_activity(application)
    days_since = (now - last_activity_date).days

    return {
        "id": application.id,
        "company": application.company,
        "position": application.position,
        "location": application.location,
        "status": application.status,
        "job_url": application.job_url,
        "recruiter": application.recruiter,
        "recruiter_email": application.recruiter_email,
        "application_date": application.application_date,
        "created_at": application.created_at,
        "last_activity_date": last_activity_date,
        "days_since_last_activity": max(days_since, 0),
        "missing_fields": compute_missing_fields(application),
    }
