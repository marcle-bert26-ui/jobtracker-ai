from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    company: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    position: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    location: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    source: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    job_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    application_date: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="Candidature envoyée",
        nullable=False,
    )

    recruiter: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    recruiter_email: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    salary: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    history: Mapped[list["InteractionHistory"]] = relationship(
        "InteractionHistory",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="InteractionHistory.date.desc()",
    )


class InteractionHistory(Base):
    __tablename__ = "interaction_history"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    application_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Ex : "Candidature envoyée", "Relance", "Réponse reçue",
    # "Entretien", "Email reçu", "Note", "Autre"
    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    date: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="history",
    )


class ProcessedEmail(Base):
    __tablename__ = "processed_emails"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    message_id: Mapped[str] = mapped_column(
        String(500),
        unique=True,
        nullable=False,
        index=True,
    )

    account: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    sender: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
    )

    subject: Mapped[str] = mapped_column(
        String(500),
        nullable=True,
    )

    received_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # "nouvelle_candidature", "entretien", "reponse_positive",
    # "reponse_negative", "email_recu", "ignore"
    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    application_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )


class SyncState(Base):
    __tablename__ = "sync_state"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    account: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )