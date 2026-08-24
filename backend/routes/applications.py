from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Application
from schemas import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
)

router = APIRouter(
    prefix="/applications",
    tags=["Applications"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.post(
    "/",
    response_model=ApplicationResponse,
    status_code=201,
)
def create_application(
    application: ApplicationCreate,
    db: Session = Depends(get_db),
):
    new_application = Application(
        **application.model_dump()
    )

    db.add(new_application)
    db.commit()
    db.refresh(new_application)

    return new_application


@router.get(
    "/",
    response_model=list[ApplicationResponse],
)
def get_applications(
    db: Session = Depends(get_db),
):
    return db.query(Application).order_by(
        Application.created_at.desc()
    ).all()


@router.get(
    "/{application_id}",
    response_model=ApplicationResponse,
)
def get_application(
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

    return application

@router.put(
    "/{application_id}",
    response_model=ApplicationResponse,
)
def update_application(
    application_id: int,
    application_update: ApplicationUpdate,
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

    update_data = application_update.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)

    return application

@router.delete(
    "/{application_id}",
    status_code=204,
)
def delete_application(
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

    db.delete(application)
    db.commit()