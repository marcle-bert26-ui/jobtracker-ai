import re

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Application, UserProfile
from schemas import GenerationRequest, SpontaneousLetterRequest, SuggestionsRequest
from services.document_generator import (
    GenerationError,
    generate_cover_letter,
    generate_spontaneous_letter,
    generate_tailored_cv,
    suggest_target_companies,
)
from services.pdf_generator import generate_cv_pdf, generate_letter_pdf

router = APIRouter(tags=["Documents"])


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def _get_cv_text(db: Session) -> str:
    profile = db.query(UserProfile).first()

    if profile is None or not profile.cv_text:
        raise HTTPException(
            status_code=400,
            detail=(
                "Aucun CV importé — va d'abord sur la page Profil pour "
                "importer ton CV (.pdf ou .docx)."
            ),
        )

    return profile.cv_text


def _get_application(db: Session, application_id: int) -> Application:
    application = (
        db.query(Application).filter(Application.id == application_id).first()
    )

    if application is None:
        raise HTTPException(status_code=404, detail="Candidature introuvable.")

    return application


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE).strip().lower()
    return re.sub(r"[\s_-]+", "-", slug) or "document"


@router.post("/applications/{application_id}/generate-cover-letter")
def generate_application_cover_letter(
    application_id: int,
    payload: GenerationRequest,
    db: Session = Depends(get_db),
):
    """
    Génère une lettre de motivation adaptée à cette candidature (à partir
    du CV importé sur la page Profil) et la renvoie en PDF.

    Brouillon à relire avant envoi : l'IA rédige à partir du CV fourni,
    mais peut se tromper sur la formulation ou l'accroche.
    """
    cv_text = _get_cv_text(db)
    application = _get_application(db, application_id)

    try:
        letter_text = generate_cover_letter(
            cv_text,
            application.company,
            application.position,
            payload.extra_instructions,
        )
    except GenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    pdf_bytes = generate_letter_pdf(
        letter_text, f"Lettre de motivation — {application.company}"
    )

    filename = f"lettre-motivation-{_slugify(application.company)}.pdf"

    return _pdf_response(pdf_bytes, filename)


@router.post("/applications/{application_id}/generate-cv")
def generate_application_cv(
    application_id: int,
    payload: GenerationRequest,
    db: Session = Depends(get_db),
):
    """
    Génère un CV adapté à cette candidature (contenu réorganisé/mis en
    avant à partir du CV importé — rien n'est inventé) et le renvoie en
    PDF. Brouillon à relire avant envoi.
    """
    cv_text = _get_cv_text(db)
    application = _get_application(db, application_id)

    try:
        cv_data = generate_tailored_cv(
            cv_text,
            application.company,
            application.position,
            payload.extra_instructions,
        )
    except GenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    pdf_bytes = generate_cv_pdf(cv_data)

    filename = f"cv-{_slugify(application.company)}.pdf"

    return _pdf_response(pdf_bytes, filename)


@router.post("/spontaneous/suggestions")
def get_spontaneous_suggestions(
    payload: SuggestionsRequest,
    db: Session = Depends(get_db),
):
    """
    Suggère des entreprises à cibler pour une candidature spontanée, à
    partir du profil et d'un secteur indiqué.

    ATTENTION : l'IA locale n'a pas accès à internet — ces suggestions
    viennent uniquement de ses connaissances d'entraînement (potentiellement
    datées, incomplètes, voire partiellement inventées). Vérifie toujours
    qu'une entreprise proposée existe bien et recrute avant de la contacter.
    """
    cv_text = _get_cv_text(db)

    if not payload.sector.strip():
        raise HTTPException(status_code=400, detail="Indique un secteur ou type de poste.")

    try:
        companies = suggest_target_companies(
            cv_text, payload.sector.strip(), payload.location
        )
    except GenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {"companies": companies}


@router.post("/spontaneous/generate-letter")
def generate_spontaneous_application_letter(
    payload: SpontaneousLetterRequest,
    db: Session = Depends(get_db),
):
    """
    Génère un message de candidature spontanée pour une entreprise donnée
    (à partir du CV importé) et le renvoie en PDF.
    """
    cv_text = _get_cv_text(db)

    if not payload.company.strip():
        raise HTTPException(status_code=400, detail="Indique le nom de l'entreprise ciblée.")

    try:
        letter_text = generate_spontaneous_letter(
            cv_text, payload.company.strip(), payload.context,
            payload.extra_instructions,
        )
    except GenerationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    pdf_bytes = generate_letter_pdf(
        letter_text, f"Candidature spontanée — {payload.company.strip()}"
    )

    filename = f"candidature-spontanee-{_slugify(payload.company.strip())}.pdf"

    return _pdf_response(pdf_bytes, filename)
