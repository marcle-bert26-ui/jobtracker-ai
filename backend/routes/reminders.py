from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from database import SessionLocal
from models import Application
from schemas import RemindersResponse
from services.reminders import (
    CLOSED_STATUSES,
    build_reminder_entry,
)

router = APIRouter(
    tags=["Rappels"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.get(
    "/reminders",
    response_model=RemindersResponse,
)
def get_reminders(
    stale_days: int = Query(
        default=7,
        ge=1,
        description=(
            "Nombre de jours sans activité au-delà duquel une candidature "
            "active est proposée à la relance."
        ),
    ),
    db: Session = Depends(get_db),
):
    """
    Fait le point sur les candidatures qui ont besoin d'attention :
    - `to_relaunch` : candidatures actives (ni refusées, ni acceptées) sans
      aucune activité (candidature, historique, email) depuis `stale_days`
      jours.
    - `missing_info` : candidatures actives auxquelles il manque une
      information importante (lien de l'offre, email du recruteur, date de
      candidature).

    Une même candidature peut apparaître dans les deux listes.
    """
    now = datetime.utcnow()

    applications = (
        db.query(Application)
        .options(joinedload(Application.history))
        .order_by(Application.created_at.desc())
        .all()
    )

    active_applications = [
        application
        for application in applications
        if application.status not in CLOSED_STATUSES
    ]

    entries = [
        build_reminder_entry(application, now)
        for application in active_applications
    ]

    to_relaunch = sorted(
        (
            entry
            for entry in entries
            if entry["days_since_last_activity"] >= stale_days
        ),
        key=lambda entry: entry["days_since_last_activity"],
        reverse=True,
    )

    missing_info = sorted(
        (entry for entry in entries if entry["missing_fields"]),
        key=lambda entry: entry["days_since_last_activity"],
        reverse=True,
    )

    return {
        "generated_at": now,
        "stale_days": stale_days,
        "to_relaunch": to_relaunch,
        "missing_info": missing_info,
    }
