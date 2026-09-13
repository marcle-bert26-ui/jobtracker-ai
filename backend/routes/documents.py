import json
import re

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Application, GeneratedDocument, UserProfile
from schemas import (
    GeneratedDocumentInfo,
    GenerationRequest,
    SpontaneousLetterRequest,
    SpontaneousLetterSummary,
    SuggestionsRequest,
)
from services.document_generator import (
    GenerationError,
    generate_cover_letter,
    generate_spontaneous_letter,
    generate_tailored_cv,
    suggest_target_companies,
)
from services.matching import normalize_company
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


def _get_existing_document(
    db: Session, kind: str, application_id: int
) -> GeneratedDocument | None:
    return (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.kind == kind,
            GeneratedDocument.application_id == application_id,
        )
        .order_by(GeneratedDocument.created_at.desc())
        .first()
    )


@router.get(
    "/applications/{application_id}/generate-cover-letter",
    response_model=GeneratedDocumentInfo,
)
def get_cover_letter_status(application_id: int, db: Session = Depends(get_db)):
    """Indique si une lettre a déjà été générée pour cette candidature,
    pour que le front puisse proposer "Ouvrir" plutôt que "Générer"."""
    document = _get_existing_document(db, "cover_letter", application_id)
    return GeneratedDocumentInfo(
        exists=document is not None,
        created_at=document.created_at if document else None,
    )


@router.get(
    "/applications/{application_id}/generate-cv",
    response_model=GeneratedDocumentInfo,
)
def get_cv_status(application_id: int, db: Session = Depends(get_db)):
    document = _get_existing_document(db, "cv", application_id)
    return GeneratedDocumentInfo(
        exists=document is not None,
        created_at=document.created_at if document else None,
    )


@router.post("/applications/{application_id}/generate-cover-letter")
def generate_application_cover_letter(
    application_id: int,
    payload: GenerationRequest,
    db: Session = Depends(get_db),
):
    """
    Renvoie la lettre de motivation pour cette candidature, en PDF.

    Par défaut (`regenerate=False`), si une lettre a déjà été générée pour
    cette candidature, elle est simplement rouverte (aucun nouvel appel à
    l'IA) — on évite ainsi d'obtenir un texte différent à chaque fois
    qu'on veut juste la relire ou la re-télécharger. Passe `regenerate: true`
    pour explicitement en générer une nouvelle qui remplace l'ancienne.

    Brouillon à relire avant envoi : l'IA rédige à partir du CV fourni,
    mais peut se tromper sur la formulation ou l'accroche.
    """
    application = _get_application(db, application_id)

    document = _get_existing_document(db, "cover_letter", application_id)

    if document is not None and not payload.regenerate:
        letter_text = document.text_content
    else:
        cv_text = _get_cv_text(db)

        try:
            letter_text = generate_cover_letter(
                cv_text,
                application.company,
                application.position,
                payload.extra_instructions,
            )
        except GenerationError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        if document is not None:
            document.text_content = letter_text
            document.company = application.company
            document.position = application.position
        else:
            document = GeneratedDocument(
                kind="cover_letter",
                application_id=application_id,
                company=application.company,
                position=application.position,
                text_content=letter_text,
            )
            db.add(document)

        db.commit()

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
    Renvoie le CV adapté pour cette candidature, en PDF — rouvert tel
    quel s'il a déjà été généré (voir `generate_application_cover_letter`
    pour le détail de cette logique), sauf si `regenerate=true`.
    """
    application = _get_application(db, application_id)

    document = _get_existing_document(db, "cv", application_id)

    if document is not None and not payload.regenerate:
        cv_data = json.loads(document.cv_data)
    else:
        cv_text = _get_cv_text(db)

        try:
            cv_data = generate_tailored_cv(
                cv_text,
                application.company,
                application.position,
                payload.extra_instructions,
            )
        except GenerationError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        cv_data_json = json.dumps(cv_data, ensure_ascii=False)

        if document is not None:
            document.cv_data = cv_data_json
            document.company = application.company
            document.position = application.position
        else:
            document = GeneratedDocument(
                kind="cv",
                application_id=application_id,
                company=application.company,
                position=application.position,
                cv_data=cv_data_json,
            )
            db.add(document)

        db.commit()

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


@router.get(
    "/spontaneous/letters",
    response_model=list[SpontaneousLetterSummary],
)
def list_spontaneous_letters(db: Session = Depends(get_db)):
    """Liste les lettres de candidature spontanée déjà générées, pour
    pouvoir en rouvrir une plutôt que d'en régénérer une nouvelle."""
    documents = (
        db.query(GeneratedDocument)
        .filter(GeneratedDocument.kind == "spontaneous_letter")
        .order_by(GeneratedDocument.created_at.desc())
        .all()
    )
    return documents


@router.get("/spontaneous/letters/{document_id}/pdf")
def download_spontaneous_letter(document_id: int, db: Session = Depends(get_db)):
    """Re-télécharge en PDF une lettre de candidature spontanée déjà
    générée, sans repasser par l'IA."""
    document = (
        db.query(GeneratedDocument)
        .filter(
            GeneratedDocument.id == document_id,
            GeneratedDocument.kind == "spontaneous_letter",
        )
        .first()
    )

    if document is None:
        raise HTTPException(status_code=404, detail="Lettre introuvable.")

    pdf_bytes = generate_letter_pdf(
        document.text_content, f"Candidature spontanée — {document.company}"
    )
    filename = f"candidature-spontanee-{_slugify(document.company)}.pdf"

    return _pdf_response(pdf_bytes, filename)


@router.post("/spontaneous/generate-letter")
def generate_spontaneous_application_letter(
    payload: SpontaneousLetterRequest,
    db: Session = Depends(get_db),
):
    """
    Génère (ou rouvre, si elle existe déjà pour cette entreprise et que
    `regenerate` n'est pas demandé) un message de candidature spontanée,
    et le renvoie en PDF.
    """
    company = payload.company.strip()

    if not company:
        raise HTTPException(status_code=400, detail="Indique le nom de l'entreprise ciblée.")

    company_norm = normalize_company(company)

    document = None
    for candidate in (
        db.query(GeneratedDocument)
        .filter(GeneratedDocument.kind == "spontaneous_letter")
        .order_by(GeneratedDocument.created_at.desc())
        .all()
    ):
        if normalize_company(candidate.company) == company_norm:
            document = candidate
            break

    if document is not None and not payload.regenerate:
        letter_text = document.text_content
    else:
        cv_text = _get_cv_text(db)

        try:
            letter_text = generate_spontaneous_letter(
                cv_text, company, payload.context,
                payload.extra_instructions,
            )
        except GenerationError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        if document is not None:
            document.text_content = letter_text
            document.company = company
        else:
            document = GeneratedDocument(
                kind="spontaneous_letter",
                company=company,
                text_content=letter_text,
            )
            db.add(document)

        db.commit()

    pdf_bytes = generate_letter_pdf(
        letter_text, f"Candidature spontanée — {company}"
    )

    filename = f"candidature-spontanee-{_slugify(company)}.pdf"

    return _pdf_response(pdf_bytes, filename)
