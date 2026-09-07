"""
Calcul des métriques de délai de réponse par candidature, à partir de son
historique d'interactions. Volontairement renvoyé au niveau "une ligne par
candidature" plutôt que pré-agrégé : le frontend reste libre de calculer
taux, moyennes, médianes, et de regrouper par mois/année comme il le fait
déjà pour les autres graphiques, sans dupliquer cette logique des deux
côtés.
"""

from sqlalchemy.orm import Session, joinedload

from models import Application

# Types d'entrée d'historique qui signalent qu'une réponse a été reçue
# (au-delà du simple envoi de la candidature ou d'une relance de notre
# côté). "Réponse reçue" est le libellé utilisé aussi bien pour une
# réponse positive que négative détectée automatiquement par email (voir
# EVENT_TYPE_LABELS dans services/email_sync.py) — sans lui, les réponses
# détectées par email ne seraient jamais comptées comme une réponse ici.
RESPONSE_HISTORY_TYPES = {
    "Entretien", "Réponse reçue", "Offre reçue", "Acceptée", "Refusée",
}
INTERVIEW_HISTORY_TYPE = "Entretien"


def compute_response_metrics(db: Session) -> list[dict]:
    applications = (
        db.query(Application).options(joinedload(Application.history)).all()
    )

    metrics = []

    for application in applications:
        sorted_history = sorted(application.history, key=lambda entry: entry.date)

        first_response = next(
            (
                entry.date
                for entry in sorted_history
                if entry.type in RESPONSE_HISTORY_TYPES
            ),
            None,
        )
        first_interview = next(
            (
                entry.date
                for entry in sorted_history
                if entry.type == INTERVIEW_HISTORY_TYPE
            ),
            None,
        )

        metrics.append(
            {
                "application_id": application.id,
                "company": application.company,
                "application_date": application.application_date
                or application.created_at,
                "first_response_date": first_response,
                "first_interview_date": first_interview,
            }
        )

    return metrics
