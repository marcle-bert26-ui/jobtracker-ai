from datetime import datetime

from pydantic import BaseModel


class ApplicationCreate(BaseModel):
    company: str
    position: str
    location: str | None = None
    source: str | None = None
    job_url: str | None = None
    application_date: datetime | None = None
    status: str = "Candidature envoyée"
    recruiter: str | None = None
    recruiter_email: str | None = None
    salary: str | None = None
    notes: str | None = None


class ApplicationResponse(ApplicationCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationUpdate(BaseModel):
    company: str | None = None
    position: str | None = None
    location: str | None = None
    source: str | None = None
    job_url: str | None = None
    application_date: datetime | None = None
    status: str | None = None
    recruiter: str | None = None
    recruiter_email: str | None = None
    salary: str | None = None
    notes: str | None = None


class InteractionHistoryCreate(BaseModel):
    type: str
    date: datetime | None = None
    note: str | None = None


class InteractionHistoryResponse(BaseModel):
    id: int
    application_id: int
    type: str
    date: datetime
    note: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessedEmailResponse(BaseModel):
    id: int
    account: str
    sender: str
    subject: str | None = None
    received_at: datetime | None = None
    event_type: str
    application_id: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AccountSyncResult(BaseModel):
    account: str
    configured: bool
    scanned: int = 0
    new_applications: int = 0
    updated_applications: int = 0
    ignored: int = 0
    error: str | None = None


class SyncResult(BaseModel):
    results: list[AccountSyncResult]