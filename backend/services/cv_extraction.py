"""
Extraction du texte d'un CV importé (.pdf ou .docx), pour servir de base
à la génération de CV/lettres de motivation adaptés à chaque candidature.

Pas de mise en page conservée — seulement le texte, dans l'ordre où il
apparaît dans le document. L'utilisateur peut relire/corriger le texte
extrait depuis la page "Mon profil" si l'extraction est imparfaite (ce qui
arrive sur des CV très mis en forme, avec colonnes ou tableaux).
"""

import io

from docx import Document
from pypdf import PdfReader

SUPPORTED_EXTENSIONS = (".pdf", ".docx")


class UnsupportedCvFormat(Exception):
    pass


class EmptyCvText(Exception):
    pass


def _extract_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    pages_text = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages_text)


def _extract_from_docx(file_bytes: bytes) -> str:
    document = Document(io.BytesIO(file_bytes))

    parts = [paragraph.text for paragraph in document.paragraphs]

    # Les CV utilisent souvent des tableaux pour la mise en page
    # (colonnes) — sans ça, des pans entiers du CV (souvent les
    # compétences ou l'expérience) seraient perdus.
    for table in document.tables:
        for row in table.rows:
            cells_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells_text:
                parts.append(" | ".join(cells_text))

    return "\n".join(part for part in parts if part.strip())


def extract_cv_text(filename: str, file_bytes: bytes) -> str:
    """
    Renvoie le texte brut extrait du CV. Lève `UnsupportedCvFormat` si
    l'extension n'est pas gérée, `EmptyCvText` si l'extraction n'a rien
    trouvé (PDF scanné en image sans OCR, fichier vide/corrompu...).
    """
    lower_name = (filename or "").lower()

    if lower_name.endswith(".pdf"):
        text = _extract_from_pdf(file_bytes)
    elif lower_name.endswith(".docx"):
        text = _extract_from_docx(file_bytes)
    else:
        raise UnsupportedCvFormat(
            "Format non supporté — envoie un fichier .pdf ou .docx."
        )

    text = text.strip()

    if not text:
        raise EmptyCvText(
            "Aucun texte n'a pu être extrait de ce fichier (peut-être un "
            "PDF scanné/image sans texte sélectionnable — dans ce cas, "
            "colle le contenu de ton CV directement dans le champ texte)."
        )

    return text
