import json
import re

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Application, GeneratedDocument, UserProfile
from schemas import (
    GeneratedDocumentInfo,
    GenerationRequest,
    SpontaneousBulkCompaniesRequest,
    SpontaneousCompanyRequest,
    SuggestionsRequest,
)
from services.document_generator import (
    GenerationError,
    generate_cover_letter,
    generate_spontaneous_letter,
    generate_tailored_cv,
    suggest_target_companies,
)
from services.matching import find_confident_match, normalize_company
from services.pdf_generator import generate_cv_pdf, generate_letter_pdf

router = APIRouter(tags=["Documents"])

# Valeur du champ "source" utilisée pour repérer une candidature créée
# depuis la page Candidature spontanée (déjà présente comme option dans
# les formulaires existants) — sert à adapter la génération de lettre.
SPONTANEOUS_SOURCE = "Candidature spontanée"


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


def _find_or_create_spontaneous_application(
    db: Session, company: str, context: str | None = None
) -> tuple[Application, bool]:
    """
    Renvoie la fiche candidature pour cette entreprise, en la créant si
    elle n'existe pas encore. Si une candidature (spontanée ou non) existe
    déjà pour cette entreprise, elle est réutilisée telle quelle plutôt
    que d'en créer une nouvelle en double — voir services/matching.py
    pour la logique de comparaison (aucun poste/ville précis ici, donc
    toute candidature existante pour la même entreprise est considérée
    comme "la même").
    """
    company = (company or "").strip()

    if not company:
        raise HTTPException(status_code=400, detail="Nom d'entreprise vide.")

    company_norm = normalize_company(company)
    candidates = [
        app for app in db.query(Application).all()
        if normalize_company(app.company) == company_norm
    ]
    existing = find_confident_match(candidates, company, None, None)

    if existing is not None:
        return existing, False

    application = Application(
        company=company,
        position="Poste non précisé",
        source=SPONTANEOUS_SOURCE,
        notes=(context or "").strip() or None,
        status="Candidature envoyée",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return application, True


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
    is_spontaneous = application.source == SPONTANEOUS_SOURCE

    document = _get_existing_document(db, "cover_letter", application_id)

    if document is not None and not payload.regenerate:
        letter_text = document.text_content
    else:
        cv_text = _get_cv_text(db)

        try:
            if is_spontaneous:
                # Pas de poste précis à viser : on utilise le générateur
                # dédié aux candidatures spontanées plutôt que de faire
                # écrire à l'IA une lettre "pour le poste de Poste non
                # précisé", qui n'aurait aucun sens.
                letter_text = generate_spontaneous_letter(
                    cv_text,
                    application.company,
                    application.notes,
                    payload.extra_instructions,
                )
            else:
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

    title = (
        f"Candidature spontanée — {application.company}"
        if is_spontaneous
        else f"Lettre de motivation — {application.company}"
    )
    pdf_bytes = generate_letter_pdf(letter_text, title)

    prefix = "candidature-spontanee" if is_spontaneous else "lettre-motivation"
    filename = f"{prefix}-{_slugify(application.company)}.pdf"

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
    partir du profil et d'un secteur indiqué, et crée directement une
    fiche candidature pour chacune (réutilisée si elle existe déjà).

    ATTENTION : l'IA locale n'a pas accès à internet — ces noms
    viennent uniquement de ses connaissances d'entraînement (potentiellement
    datées, incomplètes, voire partiellement inventées). Vérifie toujours
    qu'une entreprise proposée existe bien et recrute avant de la contacter
    (un lien de recherche est fourni côté frontend pour chacune).
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

    results = []
    for entry in companies:
        name = (entry.get("name") or "").strip()

        if not name:
            continue

        why = entry.get("why")
        application, created = _find_or_create_spontaneous_application(
            db, name, why
        )
        results.append(
            {
                "name": application.company,
                "why": why,
                "application_id": application.id,
                "created": created,
            }
        )

    return {"companies": results}


@router.post("/spontaneous/add-company")
def add_spontaneous_company(
    payload: SpontaneousCompanyRequest,
    db: Session = Depends(get_db),
):
    """Crée (ou réutilise) une fiche candidature spontanée pour une
    entreprise choisie manuellement."""
    application, created = _find_or_create_spontaneous_application(
        db, payload.company, payload.context
    )
    return {
        "name": application.company,
        "application_id": application.id,
        "created": created,
    }


@router.post("/spontaneous/add-companies-bulk")
def add_spontaneous_companies_bulk(
    payload: SpontaneousBulkCompaniesRequest,
    db: Session = Depends(get_db),
):
    """Crée (ou réutilise) une fiche candidature spontanée pour chaque
    entreprise d'une liste collée en une fois — une ligne indépendante par
    entreprise, les échecs individuels n'empêchent pas de traiter le reste."""
    results = []

    for raw_name in payload.companies:
        name = (raw_name or "").strip()

        if not name:
            continue

        try:
            application, created = _find_or_create_spontaneous_application(
                db, name, payload.context
            )
            results.append(
                {
                    "name": application.company,
                    "application_id": application.id,
                    "success": True,
                    "error": None,
                }
            )
        except HTTPException as exc:
            results.append(
                {
                    "name": name,
                    "application_id": None,
                    "success": False,
                    "error": str(exc.detail),
                }
            )

    return {"results": results}
