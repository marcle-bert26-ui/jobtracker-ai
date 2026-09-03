import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Application, InteractionHistory, ProcessedEmail
from schemas import (
    AccountSyncResult,
    EmailLogResponse,
    QuickApplicationResult,
    SyncResult,
)
from services.ai_classifier import classify_with_ai, is_available as ai_is_available
from services.email_sync import (
    extract_company,
    extract_position,
    find_matching_application,
    sync_all_accounts,
)

router = APIRouter(
    prefix="/emails",
    tags=["Emails"],
)

_sync_lock = threading.Lock()

MAX_LOG_LIMIT = 500


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.post(
    "/sync",
    response_model=SyncResult,
)
def sync_emails(
    days: int | None = None,
    reset: bool = False,
    db: Session = Depends(get_db),
):
    if not _sync_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=409,
            detail=(
                "Une synchronisation est déjà en cours. "
                "Attends qu'elle se termine avant d'en relancer une."
            ),
        )

    try:
        raw_results = sync_all_accounts(db, days=days, reset=reset)
    finally:
        _sync_lock.release()

    return SyncResult(
        results=[AccountSyncResult(**result) for result in raw_results]
    )


@router.get(
    "/log",
    response_model=EmailLogResponse,
)
def get_email_log(
    search: str | None = None,
    account: str | None = None,
    event_type: str | None = None,
    exclude_ignored: bool = False,
    has_application: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """
    Journal des emails analysés, avec recherche et filtres. Rien n'est
    jamais purgé côté base : tous les emails déjà scannés restent
    consultables ici, `limit`/`offset` ne servent qu'à paginer l'affichage.
    """
    query = db.query(ProcessedEmail)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ProcessedEmail.subject.ilike(pattern),
                ProcessedEmail.sender.ilike(pattern),
                ProcessedEmail.company.ilike(pattern),
                ProcessedEmail.position.ilike(pattern),
            )
        )

    if account:
        query = query.filter(ProcessedEmail.account == account)

    if event_type:
        query = query.filter(ProcessedEmail.event_type == event_type)
    elif exclude_ignored:
        query = query.filter(ProcessedEmail.event_type != "ignore")

    if has_application is not None:
        if has_application:
            query = query.filter(ProcessedEmail.application_id.isnot(None))
        else:
            query = query.filter(ProcessedEmail.application_id.is_(None))

    # Filtré sur la date de réception si connue, sinon sur la date de
    # traitement (certains comptes/emails n'exposent pas toujours une date
    # de réception fiable).
    if date_from:
        query = query.filter(
            or_(
                ProcessedEmail.received_at >= date_from,
                ProcessedEmail.created_at >= date_from,
            )
        )

    if date_to:
        query = query.filter(
            or_(
                ProcessedEmail.received_at <= date_to,
                ProcessedEmail.created_at <= date_to,
            )
        )

    total = query.count()

    items = (
        query.order_by(ProcessedEmail.created_at.desc())
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), MAX_LOG_LIMIT))
        .all()
    )

    return EmailLogResponse(total=total, items=items)


@router.post(
    "/{email_id}/create-application",
    response_model=QuickApplicationResult,
)
def create_application_from_email(
    email_id: int,
    db: Session = Depends(get_db),
):
    """
    Depuis une ligne du journal (typiquement un email ignoré ou non
    rattaché), crée rapidement une fiche candidature à partir de ce que la
    détection a déjà trouvé — en retentant une extraction (IA locale si
    disponible, sinon les règles-clés) sur le sujet quand il manque encore
    l'entreprise ou le poste. Le but n'est pas d'être parfait : juste de
    démarrer la fiche pour que l'utilisateur la complète ensuite à la main.

    Si une candidature existe déjà pour la même entreprise, l'email est
    simplement rattaché à celle-ci plutôt que d'en créer une en double.
    """
    processed_email = (
        db.query(ProcessedEmail).filter(ProcessedEmail.id == email_id).first()
    )

    if processed_email is None:
        raise HTTPException(status_code=404, detail="Email introuvable.")

    if processed_email.application_id is not None:
        # Déjà rattaché à une fiche : on y renvoie plutôt que d'en créer
        # une en double.
        return QuickApplicationResult(
            application_id=processed_email.application_id,
            created=False,
            company=processed_email.company,
            position=processed_email.position,
            location=processed_email.location,
        )

    company = processed_email.company
    position = processed_email.position
    location = processed_email.location
    ai_used = False

    if not company or not position:
        subject = processed_email.subject or ""

        if ai_is_available():
            ai_used = True
            ai_result = classify_with_ai(subject, processed_email.sender, "", "")

            if ai_result:
                company = company or (ai_result.get("company") or "").strip() or None
                position = position or (ai_result.get("position") or "").strip() or None
                location = location or (ai_result.get("location") or "").strip() or None

        if not company:
            company = extract_company(processed_email.sender, "", subject, "")

        if not position:
            position = extract_position(subject)

    existing_application = find_matching_application(db, company) if company else None

    if existing_application is not None:
        db.add(
            InteractionHistory(
                application_id=existing_application.id,
                type="Email reçu",
                date=processed_email.received_at or datetime.utcnow(),
                note=(
                    "Email rattaché manuellement depuis le journal — "
                    f"sujet : « {processed_email.subject} »"
                ),
                email_link=processed_email.email_link,
            )
        )
        processed_email.application_id = existing_application.id
        processed_email.company = company
        processed_email.position = position
        processed_email.location = location
        db.commit()

        return QuickApplicationResult(
            application_id=existing_application.id,
            created=False,
            company=company,
            position=position,
            location=location,
            ai_used=ai_used,
        )

    new_application = Application(
        company=company or "Entreprise inconnue",
        position=position or "Poste non précisé",
        location=location,
        source="Email (créée manuellement depuis le journal)",
        application_date=processed_email.received_at or datetime.utcnow(),
        status="Candidature envoyée",
    )
    db.add(new_application)
    db.flush()

    db.add(
        InteractionHistory(
            application_id=new_application.id,
            type="Candidature envoyée",
            date=processed_email.received_at or datetime.utcnow(),
            note=(
                "Fiche créée manuellement depuis le journal des emails — "
                f"sujet : « {processed_email.subject} »"
            ),
            email_link=processed_email.email_link,
        )
    )

    processed_email.application_id = new_application.id
    processed_email.event_type = "nouvelle_candidature"
    processed_email.company = company
    processed_email.position = position
    processed_email.location = location

    db.commit()
    db.refresh(new_application)

    return QuickApplicationResult(
        application_id=new_application.id,
        created=True,
        company=company,
        position=position,
        location=location,
        ai_used=ai_used,
    )
