from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import SessionLocal
from models import UserProfile
from schemas import ProfileResponse, ProfileUpdateRequest
from services.cv_extraction import (
    EmptyCvText,
    SUPPORTED_EXTENSIONS,
    UnsupportedCvFormat,
    extract_cv_text,
)

router = APIRouter(
    prefix="/profile",
    tags=["Profil"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def _get_or_create_profile(db: Session) -> UserProfile:
    # Table volontairement mono-ligne : l'app est mono-utilisateur, pas
    # besoin de gérer plusieurs profils.
    profile = db.query(UserProfile).first()

    if profile is None:
        profile = UserProfile()
        db.add(profile)
        db.flush()

    return profile


@router.get("/cv", response_model=ProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()

    if profile is None or not profile.cv_text:
        return ProfileResponse(has_cv=False)

    return ProfileResponse(
        has_cv=True,
        filename=profile.filename,
        cv_text=profile.cv_text,
        uploaded_at=profile.uploaded_at,
    )


@router.post("/cv", response_model=ProfileResponse)
async def upload_cv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not (file.filename or "").lower().endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail="Format non supporté — envoie un fichier .pdf ou .docx.",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Le fichier est vide.")

    try:
        cv_text = extract_cv_text(file.filename, file_bytes)
    except UnsupportedCvFormat as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except EmptyCvText as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    profile = _get_or_create_profile(db)
    profile.filename = file.filename
    profile.cv_text = cv_text
    profile.uploaded_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    return ProfileResponse(
        has_cv=True,
        filename=profile.filename,
        cv_text=profile.cv_text,
        uploaded_at=profile.uploaded_at,
    )


@router.put("/cv", response_model=ProfileResponse)
def update_cv_text(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Corrige à la main le texte du CV (utile quand l'extraction depuis le
    PDF/Word d'origine n'est pas parfaite, ou pour coller directement un
    CV sans passer par un fichier).
    """
    cv_text = payload.cv_text.strip()

    if not cv_text:
        raise HTTPException(status_code=400, detail="Le texte du CV ne peut pas être vide.")

    profile = _get_or_create_profile(db)
    profile.cv_text = cv_text
    profile.uploaded_at = datetime.utcnow()
    if not profile.filename:
        profile.filename = "Saisi manuellement"
    db.commit()
    db.refresh(profile)

    return ProfileResponse(
        has_cv=True,
        filename=profile.filename,
        cv_text=profile.cv_text,
        uploaded_at=profile.uploaded_at,
    )


@router.delete("/cv", response_model=ProfileResponse)
def delete_cv(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()

    if profile is not None:
        profile.filename = None
        profile.cv_text = None
        profile.uploaded_at = None
        db.commit()

    return ProfileResponse(has_cv=False)
