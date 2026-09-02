import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import SessionLocal
from models import ProcessedEmail
from schemas import AccountSyncResult, EmailLogResponse, SyncResult
from services.email_sync import sync_all_accounts

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
