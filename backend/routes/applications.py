import csv
import io
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Application, InteractionHistory, ProcessedEmail
from schemas import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
    DuplicateGroup,
    DuplicatesResponse,
    MergeRequest,
    MergeResult,
    ResponseMetricsResponse,
    SnoozeRequest,
)
from services.matching import (
    field_relation,
    normalize_company,
    normalize_location,
    normalize_position,
)
from services.stats import compute_response_metrics

router = APIRouter(
    prefix="/applications",
    tags=["Applications"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@router.get(
    "/response-metrics",
    response_model=ResponseMetricsResponse,
)
def get_response_metrics(db: Session = Depends(get_db)):
    """
    Une ligne par candidature : date de candidature, date de première
    réponse (entretien, offre, acceptation ou refus), date de premier
    entretien. Sert de base au calcul du taux de réponse et des délais
    moyens sur la page Statistiques.
    """
    return ResponseMetricsResponse(items=compute_response_metrics(db))


@router.get(
    "/duplicates",
    response_model=DuplicatesResponse,
)
def get_duplicate_applications(db: Session = Depends(get_db)):
    """
    Regroupe les candidatures qui se ressemblent : même entreprise, même
    poste et même ville une fois normalisés (formes juridiques, casse et
    accents ignorés). Deux candidatures ne sont un doublon "exact" que si
    ces trois éléments concordent strictement (ou ne sont pas renseignés
    d'un côté ou de l'autre). Dès que le poste et/ou la ville ne sont que
    proches (fautes de frappe, intitulés voisins...) sans être identiques,
    le groupe est marqué "probable" : il apparaît quand même ici pour
    vérification, mais n'est JAMAIS fusionné automatiquement — la
    sélection à fusionner n'est pas pré-cochée côté interface, c'est à
    l'utilisateur de trancher à la main.
    """
    applications = (
        db.query(Application).order_by(Application.created_at.asc()).all()
    )

    normalized = [
        (
            normalize_company(application.company),
            normalize_position(application.position),
            normalize_location(application.location),
        )
        for application in applications
    ]

    n = len(applications)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        root_i, root_j = find(i), find(j)
        if root_i != root_j:
            parent[root_i] = root_j

    # Pour chaque paire jugée compatible, on retient si elle est "exacte"
    # (poste et ville identiques ou inconnus des deux côtés) ou seulement
    # "probable" (au moins un champ proche mais pas identique).
    pair_is_exact: dict[tuple[int, int], bool] = {}

    for i in range(n):
        company_i, position_i, location_i = normalized[i]

        if not company_i:
            continue

        for j in range(i + 1, n):
            company_j, position_j, location_j = normalized[j]

            if not company_j:
                continue

            company_relation = field_relation(company_i, company_j)

            # Des entreprises clairement différentes ne sont jamais des
            # doublons, quels que soient le poste et la ville.
            if company_relation not in ("exact", "close"):
                continue

            position_relation = field_relation(position_i, position_j)

            if position_relation == "different":
                continue

            location_relation = field_relation(location_i, location_j)

            if location_relation == "different":
                continue

            union(i, j)

            pair_is_exact[(i, j)] = (
                company_relation == "exact"
                and position_relation in ("exact", "unknown")
                and location_relation in ("exact", "unknown")
            )

    clusters: dict[int, list[int]] = {}
    for index in range(n):
        clusters.setdefault(find(index), []).append(index)

    duplicate_groups: list[DuplicateGroup] = []

    for indices in clusters.values():
        if len(indices) < 2:
            continue

        # Le groupe n'est "exacte" que si TOUTES les paires qui le
        # composent le sont — sinon (y compris une paire jamais comparée
        # directement, reliée seulement via un tiers) on reste prudent et
        # on marque le groupe "probable".
        is_exact_group = True
        for a in indices:
            for b in indices:
                if a < b and not pair_is_exact.get((a, b), False):
                    is_exact_group = False

        apps = [applications[i] for i in indices]
        key = normalize_company(apps[0].company) or f"groupe-{indices[0]}"

        duplicate_groups.append(
            DuplicateGroup(
                key=key,
                match_type="exacte" if is_exact_group else "probable",
                applications=apps,
            )
        )

    duplicate_groups.sort(key=lambda group: group.applications[0].created_at)

    return DuplicatesResponse(groups=duplicate_groups)


@router.post(
    "/merge",
    response_model=MergeResult,
)
def merge_applications(payload: MergeRequest, db: Session = Depends(get_db)):
    """
    Fusionne une ou plusieurs candidatures (`merge_ids`) dans une seule
    candidature à conserver (`keep_id`) : tout l'historique et tous les
    emails déjà rattachés aux doublons sont déplacés vers la candidature
    conservée, puis les doublons sont supprimés.
    """
    if not payload.merge_ids:
        raise HTTPException(
            status_code=400,
            detail="Aucune candidature à fusionner n'a été fournie.",
        )

    if payload.keep_id in payload.merge_ids:
        raise HTTPException(
            status_code=400,
            detail=(
                "La candidature à conserver ne peut pas aussi figurer "
                "dans la liste des candidatures à fusionner."
            ),
        )

    keep_application = (
        db.query(Application).filter(Application.id == payload.keep_id).first()
    )

    if keep_application is None:
        raise HTTPException(
            status_code=404, detail="Candidature à conserver introuvable."
        )

    merge_ids = set(payload.merge_ids)
    duplicates = (
        db.query(Application).filter(Application.id.in_(merge_ids)).all()
    )

    if len(duplicates) != len(merge_ids):
        raise HTTPException(
            status_code=404,
            detail="Une ou plusieurs candidatures à fusionner sont introuvables.",
        )

    for duplicate in duplicates:
        db.query(InteractionHistory).filter(
            InteractionHistory.application_id == duplicate.id
        ).update({InteractionHistory.application_id: keep_application.id})

        db.query(ProcessedEmail).filter(
            ProcessedEmail.application_id == duplicate.id
        ).update({ProcessedEmail.application_id: keep_application.id})

        db.delete(duplicate)

    db.commit()

    return MergeResult(kept_id=keep_application.id, merged_count=len(duplicates))


@router.post(
    "/",
    response_model=ApplicationResponse,
    status_code=201,
)
def create_application(
    application: ApplicationCreate,
    db: Session = Depends(get_db),
):
    new_application = Application(
        **application.model_dump()
    )

    db.add(new_application)
    db.commit()
    db.refresh(new_application)

    return new_application


@router.get(
    "/",
    response_model=list[ApplicationResponse],
)
def get_applications(
    db: Session = Depends(get_db),
):
    return db.query(Application).order_by(
        Application.created_at.desc()
    ).all()


_EXPORT_COLUMNS = [
    ("company", "Entreprise"),
    ("position", "Poste"),
    ("location", "Localisation"),
    ("status", "Statut"),
    ("application_date", "Date de candidature"),
    ("source", "Source"),
    ("job_url", "Lien de l'offre"),
    ("recruiter", "Recruteur"),
    ("recruiter_email", "Email du recruteur"),
    ("salary", "Salaire"),
    ("notes", "Notes"),
    ("created_at", "Créée le"),
]


@router.get("/export")
def export_applications(db: Session = Depends(get_db)):
    """
    Exporte toutes les candidatures au format CSV (compatible Excel/Google
    Sheets), pour sauvegarde ou partage — tout est en local dans ce projet,
    sans sauvegarde cloud automatique.
    """
    applications = db.query(Application).order_by(
        Application.created_at.desc()
    ).all()

    buffer = io.StringIO()
    # BOM UTF-8 : sans lui, Excel sous Windows affiche mal les accents.
    buffer.write("\ufeff")

    writer = csv.writer(buffer, delimiter=";")
    writer.writerow([label for _, label in _EXPORT_COLUMNS])

    for application in applications:
        row = []
        for field, _ in _EXPORT_COLUMNS:
            value = getattr(application, field)
            if isinstance(value, datetime):
                value = value.strftime("%d/%m/%Y")
            row.append(value if value is not None else "")
        writer.writerow(row)

    filename = f"candidatures_{datetime.utcnow().strftime('%Y-%m-%d')}.csv"

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{application_id}",
    response_model=ApplicationResponse,
)
def get_application(
    application_id: int,
    db: Session = Depends(get_db),
):
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Candidature introuvable",
        )

    return application

@router.put(
    "/{application_id}",
    response_model=ApplicationResponse,
)
def update_application(
    application_id: int,
    application_update: ApplicationUpdate,
    db: Session = Depends(get_db),
):
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Candidature introuvable",
        )

    update_data = application_update.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)

    return application

@router.delete(
    "/{application_id}",
    status_code=204,
)
def delete_application(
    application_id: int,
    db: Session = Depends(get_db),
):
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if application is None:
        raise HTTPException(
            status_code=404,
            detail="Candidature introuvable",
        )

    db.delete(application)
    db.commit()


@router.post(
    "/{application_id}/snooze",
    response_model=ApplicationResponse,
)
def snooze_application(
    application_id: int,
    payload: SnoozeRequest,
    db: Session = Depends(get_db),
):
    """
    Reporte le rappel de relance de cette candidature : tant que
    `snoozed_until` n'est pas passé, elle n'apparaît plus dans "à
    relancer" sur /reminders, même si elle dépasse le seuil de jours sans
    activité. N'affecte que les rappels — le statut et le reste de la
    fiche ne changent pas.
    """
    if payload.days <= 0:
        raise HTTPException(
            status_code=400, detail="Le nombre de jours doit être positif."
        )

    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if application is None:
        raise HTTPException(status_code=404, detail="Candidature introuvable")

    application.snoozed_until = datetime.utcnow() + timedelta(days=payload.days)
    db.commit()
    db.refresh(application)

    return application


@router.delete(
    "/{application_id}/snooze",
    response_model=ApplicationResponse,
)
def unsnooze_application(
    application_id: int,
    db: Session = Depends(get_db),
):
    """Annule un report en cours, pour que la candidature réapparaisse
    immédiatement dans les rappels si elle y est éligible."""
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if application is None:
        raise HTTPException(status_code=404, detail="Candidature introuvable")

    application.snoozed_until = None
    db.commit()
    db.refresh(application)

    return application