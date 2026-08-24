from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Application, InteractionHistory
from schemas import InteractionHistoryCreate, InteractionHistoryResponse

router = APIRouter(
    tags=["Historique"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.get(
    "/applications/{application_id}/history",
    response_model=list[InteractionHistoryResponse],
)
def get_history(
    application_id: int,
    db: Session = Depends(get_db),
):
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Candidature introuvable",
        )

    return (
        db.query(InteractionHistory)
        .filter(InteractionHistory.application_id == application_id)
        .order_by(InteractionHistory.date.desc())
        .all()
    )


@router.post(
    "/applications/{application_id}/history",
    response_model=InteractionHistoryResponse,
    status_code=201,
)
def create_history_entry(
    application_id: int,
    entry: InteractionHistoryCreate,
    db: Session = Depends(get_db),
):
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Candidature introuvable",
        )

    data = entry.model_dump()

    if data.get("date") is None:
        data["date"] = datetime.utcnow()

    new_entry = InteractionHistory(
        application_id=application_id,
        **data,
    )

    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    return new_entry


@router.delete(
    "/history/{history_id}",
    status_code=204,
)
def delete_history_entry(
    history_id: int,
    db: Session = Depends(get_db),
):
    entry = db.query(InteractionHistory).filter(
        InteractionHistory.id == history_id
    ).first()

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="Entrée d'historique introuvable",
        )

    db.delete(entry)
    db.commit()
