import threading

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import ProcessedEmail
from schemas import AccountSyncResult, ProcessedEmailResponse, SyncResult
from services.email_sync import sync_all_accounts

router = APIRouter(
    prefix="/emails",
    tags=["Emails"],
)

_sync_lock = threading.Lock()


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
    response_model=list[ProcessedEmailResponse],
)
def get_email_log(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    return (
        db.query(ProcessedEmail)
        .order_by(ProcessedEmail.created_at.desc())
        .limit(limit)
        .all()
    )
