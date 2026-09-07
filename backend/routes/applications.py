import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Application, InteractionHistory, ProcessedEmail
from schemas import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
    DuplicateGroup,
    DuplicatesResponse,
    MergeRequest,
    MergeResult,
    ResponseMetricsResponse,
)
from services.stats import compute_response_metrics

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


# Mots à ignorer pour comparer deux noms d'entreprise (formes juridiques,
# trop fréquentes pour être discriminantes).
_COMPANY_NOISE_WORDS = {
    "sarl", "sas", "sasu", "sa", "eurl", "sci", "group", "groupe",
    "inc", "ltd", "llc", "corp", "corporation", "company", "co",
}


def _normalize_company(company: str | None) -> str:
    if not company:
        return ""

    normalized = re.sub(r"[^\w\s]", " ", company.strip().lower())
    words = [w for w in normalized.split() if w and w not in _COMPANY_NOISE_WORDS]

    return " ".join(words)


@router.get(
    "/response-metrics",
    response_model=ResponseMetricsResponse,
)
def get_response_metrics(db: Session = Depends(get_db)):
    """
    Une ligne par candidature : date de candidature, date de première
    réponse (entretien, offre, acceptation ou refus), date de premier
    entretien. Sert de base au calcul du taux de réponse et des délais
    moyens sur la page Statistiques.
    """
    return ResponseMetricsResponse(items=compute_response_metrics(db))


@router.get(
    "/duplicates",
    response_model=DuplicatesResponse,
)
def get_duplicate_applications(db: Session = Depends(get_db)):
    """
    Regroupe les candidatures par nom d'entreprise normalisé (formes
    juridiques et casse ignorées) et ne renvoie que les groupes d'au moins
    deux candidatures — de possibles doublons à vérifier/fusionner à la
    main. On ne fusionne jamais automatiquement : deux candidatures pour
    la même entreprise peuvent tout à fait être légitimes (deux postes
    différents), donc l'utilisateur reste seul juge.
    """
    applications = (
        db.query(Application).order_by(Application.created_at.asc()).all()
    )

    groups: dict[str, list[Application]] = {}

    for application in applications:
        key = _normalize_company(application.company)

        if not key or key == "entreprise inconnue":
            continue

        groups.setdefault(key, []).append(application)

    duplicate_groups = [
        DuplicateGroup(key=key, applications=apps)
        for key, apps in groups.items()
        if len(apps) > 1
    ]

    duplicate_groups.sort(key=lambda group: group.applications[0].created_at)

    return DuplicatesResponse(groups=duplicate_groups)


@router.post(
    "/merge",
    response_model=MergeResult,
)
def merge_applications(payload: MergeRequest, db: Session = Depends(get_db)):
    """
    Fusionne une ou plusieurs candidatures (`merge_ids`) dans une seule
    candidature à conserver (`keep_id`) : tout l'historique et tous les
    emails déjà rattachés aux doublons sont déplacés vers la candidature
    conservée, puis les doublons sont supprimés.
    """
    if not payload.merge_ids:
        raise HTTPException(
            status_code=400,
            detail="Aucune candidature à fusionner n'a été fournie.",
        )

    if payload.keep_id in payload.merge_ids:
        raise HTTPException(
            status_code=400,
            detail=(
                "La candidature à conserver ne peut pas aussi figurer "
                "dans la liste des candidatures à fusionner."
            ),
        )

    keep_application = (
        db.query(Application).filter(Application.id == payload.keep_id).first()
    )

    if keep_application is None:
        raise HTTPException(
            status_code=404, detail="Candidature à conserver introuvable."
        )

    merge_ids = set(payload.merge_ids)
    duplicates = (
        db.query(Application).filter(Application.id.in_(merge_ids)).all()
    )

    if len(duplicates) != len(merge_ids):
        raise HTTPException(
            status_code=404,
            detail="Une ou plusieurs candidatures à fusionner sont introuvables.",
        )

    for duplicate in duplicates:
        db.query(InteractionHistory).filter(
            InteractionHistory.application_id == duplicate.id
        ).update({InteractionHistory.application_id: keep_application.id})

        db.query(ProcessedEmail).filter(
            ProcessedEmail.application_id == duplicate.id
        ).update({ProcessedEmail.application_id: keep_application.id})

        db.delete(duplicate)

    db.commit()

    return MergeResult(kept_id=keep_application.id, merged_count=len(duplicates))


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