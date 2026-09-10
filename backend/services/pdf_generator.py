"""
Mise en page PDF des documents générés (lettre de motivation, CV adapté)
via reportlab — aucune dépendance système (contrairement à des
alternatives comme weasyprint), fonctionne à l'identique sur
Windows/Mac/Linux avec juste `pip install`.
"""

import io

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

_STYLES = getSampleStyleSheet()

_BODY_STYLE = ParagraphStyle(
    "Body",
    parent=_STYLES["Normal"],
    fontName="Helvetica",
    fontSize=10.5,
    leading=15,
    spaceAfter=10,
)

_TITLE_STYLE = ParagraphStyle(
    "DocTitle",
    parent=_STYLES["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=18,
    spaceAfter=4,
)

_HEADLINE_STYLE = ParagraphStyle(
    "Headline",
    parent=_STYLES["Normal"],
    fontName="Helvetica-Oblique",
    fontSize=11,
    textColor="#475569",
    spaceAfter=14,
)

_SECTION_STYLE = ParagraphStyle(
    "Section",
    parent=_STYLES["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=13,
    textColor="#1d4ed8",
    spaceBefore=14,
    spaceAfter=6,
)

_ITEM_HEADING_STYLE = ParagraphStyle(
    "ItemHeading",
    parent=_STYLES["Normal"],
    fontName="Helvetica-Bold",
    fontSize=10.5,
    spaceAfter=2,
)

_BULLET_STYLE = ParagraphStyle(
    "Bullet",
    parent=_STYLES["Normal"],
    fontName="Helvetica",
    fontSize=10,
    leading=13,
)


def _escape(text: str | None) -> str:
    """reportlab interprète les paragraphes comme du XML léger — il faut
    échapper le texte généré par l'IA avant de l'y injecter."""
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def generate_letter_pdf(text: str, title: str) -> bytes:
    """
    Met en page une lettre (motivation ou candidature spontanée) : un
    titre, puis le texte généré, paragraphe par paragraphe (les sauts de
    ligne doubles du texte source deviennent des paragraphes séparés).
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
        title=title,
    )

    story = [Paragraph(_escape(title), _TITLE_STYLE), Spacer(1, 12)]

    for paragraph in text.split("\n\n"):
        cleaned = paragraph.strip()
        if cleaned:
            story.append(Paragraph(_escape(cleaned), _BODY_STYLE))

    doc.build(story)

    return buffer.getvalue()


def generate_cv_pdf(cv_data: dict) -> bytes:
    """
    Met en page un CV structuré (voir `document_generator.generate_tailored_cv`)
    : nom, accroche, résumé, puis une section par bloc (Expérience,
    Formation, Compétences...) avec des puces par élément.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        leftMargin=2.2 * cm,
        rightMargin=2.2 * cm,
        title=cv_data.get("full_name") or "CV",
    )

    story = []

    full_name = cv_data.get("full_name")
    if full_name:
        story.append(Paragraph(_escape(full_name), _TITLE_STYLE))

    headline = cv_data.get("headline")
    if headline:
        story.append(Paragraph(_escape(headline), _HEADLINE_STYLE))

    summary = cv_data.get("summary")
    if summary:
        story.append(Paragraph(_escape(summary), _BODY_STYLE))

    for section in cv_data.get("sections") or []:
        title = (section or {}).get("title")
        items = (section or {}).get("items") or []

        if not title or not items:
            continue

        story.append(Paragraph(_escape(title), _SECTION_STYLE))

        for item in items:
            heading = (item or {}).get("heading")
            bullets = (item or {}).get("bullets") or []

            if heading:
                story.append(Paragraph(_escape(heading), _ITEM_HEADING_STYLE))

            if bullets:
                story.append(
                    ListFlowable(
                        [
                            ListItem(
                                Paragraph(_escape(bullet), _BULLET_STYLE),
                                spaceAfter=2,
                            )
                            for bullet in bullets
                            if bullet
                        ],
                        bulletType="bullet",
                        start="•",
                        leftIndent=14,
                    )
                )
            story.append(Spacer(1, 6))

    if not story:
        story = [Paragraph("CV vide — rien à afficher.", _BODY_STYLE)]

    doc.build(story)

    return buffer.getvalue()
