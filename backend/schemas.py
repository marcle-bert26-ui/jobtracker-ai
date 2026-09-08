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
    snoozed_until: datetime | None = None

    class Config:
        from_attributes = True


class SnoozeRequest(BaseModel):
    days: int


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
    email_link: str | None = None
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
    company: str | None = None
    position: str | None = None
    location: str | None = None
    application_id: int | None = None
    email_link: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class EmailLogResponse(BaseModel):
    total: int
    items: list[ProcessedEmailResponse]


class ReminderApplication(BaseModel):
    id: int
    company: str
    position: str
    location: str | None = None
    status: str
    job_url: str | None = None
    recruiter: str | None = None
    recruiter_email: str | None = None
    application_date: datetime | None = None
    created_at: datetime
    last_activity_date: datetime
    days_since_last_activity: int
    missing_fields: list[str]
    snoozed_until: datetime | None = None

    class Config:
        from_attributes = True


class RemindersResponse(BaseModel):
    generated_at: datetime
    stale_days: int
    to_relaunch: list[ReminderApplication]
    missing_info: list[ReminderApplication]


class ApplicationResponseMetric(BaseModel):
    application_id: int
    company: str
    application_date: datetime | None = None
    first_response_date: datetime | None = None
    first_interview_date: datetime | None = None


class ResponseMetricsResponse(BaseModel):
    items: list[ApplicationResponseMetric]


class DuplicateGroup(BaseModel):
    key: str
    applications: list[ApplicationResponse]


class DuplicatesResponse(BaseModel):
    groups: list[DuplicateGroup]


class MergeRequest(BaseModel):
    keep_id: int
    merge_ids: list[int]


class MergeResult(BaseModel):
    kept_id: int
    merged_count: int


class CorrectionRequest(BaseModel):
    company: str | None = None
    position: str | None = None
    location: str | None = None


class CorrectionResponse(BaseModel):
    email_id: int
    company: str | None = None
    position: str | None = None
    location: str | None = None
    application_updated: bool = False


class QuickApplicationResult(BaseModel):
    application_id: int
    created: bool
    company: str | None = None
    position: str | None = None
    location: str | None = None
    ai_used: bool = False


class BulkCreateRequest(BaseModel):
    email_ids: list[int]


class BulkCreateItemResult(BaseModel):
    email_id: int
    success: bool
    application_id: int | None = None
    created: bool = False
    error: str | None = None


class BulkCreateResponse(BaseModel):
    results: list[BulkCreateItemResult]


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