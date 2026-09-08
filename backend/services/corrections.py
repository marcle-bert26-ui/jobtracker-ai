"""
Corrections apportées à la main par l'utilisateur sur ce que la détection
(IA ou mots-clés) avait trouvé pour un email — entreprise, poste et/ou
localisation.

Objectif : réinjecter ces corrections comme exemples concrets dans le
prompt de l'IA (`services/ai_classifier.py`) pour l'aider à mieux
extraire ces informations sur les emails suivants. Ce n'est pas du
ré-entraînement — juste des exemples réels en contexte, qui coûtent
quelques lignes de prompt et n'ont pas besoin d'infrastructure ML.
"""

from sqlalchemy.orm import Session

from models import ExtractionCorrection

# Nombre d'exemples de corrections réinjectés dans le prompt IA à chaque
# appel. Volontairement petit : plus de contexte = plus de tokens et de
# latence, sans forcément plus de valeur au-delà d'une poignée d'exemples
# variés et récents.
MAX_CORRECTION_EXAMPLES = 6


def record_correction(
    db: Session,
    *,
    sender: str,
    subject: str | None,
    original_company: str | None,
    original_position: str | None,
    original_location: str | None,
    corrected_company: str | None,
    corrected_position: str | None,
    corrected_location: str | None,
) -> ExtractionCorrection:
    correction = ExtractionCorrection(
        sender=sender,
        subject=subject,
        original_company=original_company,
        original_position=original_position,
        original_location=original_location,
        corrected_company=corrected_company,
        corrected_position=corrected_position,
        corrected_location=corrected_location,
    )
    db.add(correction)
    db.flush()

    return correction


def get_recent_correction_examples(
    db: Session, limit: int = MAX_CORRECTION_EXAMPLES
) -> list[dict]:
    """
    Renvoie les corrections les plus récentes, formatées pour être
    injectées telles quelles dans le prompt de classification IA.
    """
    corrections = (
        db.query(ExtractionCorrection)
        .order_by(ExtractionCorrection.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "subject": correction.subject,
            "sender": correction.sender,
            "company": correction.corrected_company,
            "position": correction.corrected_position,
            "location": correction.corrected_location,
        }
        for correction in corrections
    ]
