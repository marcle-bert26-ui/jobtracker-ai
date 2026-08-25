import email
import imaplib
import os
import re
from datetime import datetime, timedelta
from email.header import decode_header
from email.utils import parsedate_to_datetime
from urllib.parse import quote

import requests

from graph_auth import get_access_token
from models import Application, InteractionHistory, ProcessedEmail, SyncState
from services.ai_classifier import classify_with_ai, is_available as ai_is_available

# --------------------------------------------------------------------------
# CONFIGURATION DES COMPTES
# --------------------------------------------------------------------------

ACCOUNTS = {
    "outlook": {
        "protocol": "graph",
    },
    "outlook_school": {
        "protocol": "graph",
    },
    "yahoo": {
        "protocol": "imap",
        "email_env": "YAHOO_EMAIL",
        "password_env": "YAHOO_APP_PASSWORD",
        "imap_server": "imap.mail.yahoo.com",
        "imap_port": 993,
    },
    "gmail": {
        "protocol": "imap",
        "email_env": "GMAIL_EMAIL",
        "password_env": "GMAIL_APP_PASSWORD",
        "imap_server": "imap.gmail.com",
        "imap_port": 993,
    },
}

DEFAULT_LOOKBACK_DAYS = 14
GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"

# --------------------------------------------------------------------------
# MOTS-CLÉS DE CLASSIFICATION (FR / EN)
# --------------------------------------------------------------------------

KEYWORDS_JOB_RELATED = [
    "candidature", "candidat", "offre d'emploi", "offre emploi",
    "recrutement", "recruteur", "entretien", "curriculum vitae",
    "processus de recrutement", "profil recruteur",
    "application", "career", "recruiting",
    "recruiter", "interview", "hiring", "resume",
    "talent acquisition", "hr team", "ressources humaines",
    "embauche",
]

# Emails qui contiennent souvent des mots-clés "candidature" mais qui ne
# concernent PAS un vrai suivi de candidature déjà engagée : alertes /
# recommandations d'offres, ou documents administratifs sans rapport
# (bulletin de paie...). Vérifiés en priorité, avant tout le reste.
KEYWORDS_ALWAYS_IGNORE = [
    "correspondent à votre profil", "recommandé pour vous",
    "offres similaires recommandées", "pourraient vous intéresser",
    "job alert", "jobs recommended for you", "based on your profile",
    "nouveaux postes correspondent", "offres d'emploi similaires",
    "new jobs that match", "we found jobs for you",
    "recommended for you based on", "emplois susceptibles de",
    "bulletin de paie", "fiche de paie", "payslip", "bulletin de salaire",
]

ALWAYS_IGNORE_PATTERNS = [
    re.compile(r"\d+\s+nouveaux?\s+postes?", re.IGNORECASE),
    re.compile(r"\d+\s+new\s+jobs?", re.IGNORECASE),
]

KEYWORDS_NEW_APPLICATION = [
    "nous avons bien reçu votre candidature", "candidature a été reçue",
    "confirmation de candidature", "merci pour votre candidature",
    "votre candidature a bien été", "accusé de réception",
    "we received your application", "application has been received",
    "thank you for applying", "thank you for your application",
    "application confirmation", "we've received your application",
    "your application was sent",
]

KEYWORDS_INTERVIEW = [
    "entretien", "rendez-vous téléphonique", "échange téléphonique",
    "planifier un appel", "disponibilités", "convier",
    "vous convier", "prise de rendez-vous", "visioconférence",
    "interview", "schedule a call", "phone screen", "meet with",
    "would like to speak", "let's talk", "book a time",
    "invite you", "next steps", "screening call",
]

KEYWORDS_NEGATIVE = [
    "malheureusement", "ne donnerons pas suite", "non retenue",
    "n'a pas été retenue", "autre candidat", "nous ne pourrons pas",
    "ne pas donner suite", "candidature n'a pas été", "refus",
    "unfortunately", "not selected", "not moving forward",
    "other candidates", "decided not to proceed", "regret to inform",
    "will not be moving forward", "pursue other candidates",
]

KEYWORDS_POSITIVE = [
    "offre d'embauche", "avons le plaisir de vous proposer",
    "nous sommes heureux de vous offrir", "félicitations",
    "proposition d'embauche", "contrat de travail",
    "pleased to offer", "pleased to inform", "job offer",
    "congratulations", "we would like to offer", "offer letter",
]

GENERIC_DOMAINS = {
    "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "yahoo.fr",
    "icloud.com", "outlook.fr",
    "linkedin.com", "indeed.com", "indeedemail.com", "myworkday.com",
    "greenhouse.io", "lever.co", "smartrecruiters.com", "icims.com",
    "successfactors.com", "taleo.net", "jobvite.com", "welcometothejungle.com",
    "hellowork.com", "notifications.linkedin.com", "email.indeed.com",
    "message.linkedin.com",
}

# Sur les plateformes génériques (LinkedIn, HelloWork, Indeed...), le vrai
# nom de l'entreprise n'apparaît jamais dans l'expéditeur — seulement dans
# le sujet ou le corps du mail. Ces motifs couvrent les formulations les
# plus courantes utilisées par ces plateformes.
COMPANY_TEXT_PATTERNS = [
    # "Votre candidature chez TRIGO", "... chez NIPRO Corporation - Grenoble"
    re.compile(r"\bchez\s+([^\-\|\n]{2,60}?)(?:\s*[\-\|]|\s*$)", re.IGNORECASE),
    # "Votre candidature a été vue par ALCANDRE", "reçue par XYZ"
    re.compile(
        r"\b(?:vue|reçue?|consultée?)\s+par\s+([^\.\n]{2,60}?)(?:[\.\n]|$)",
        re.IGNORECASE,
    ),
    # "Marc, votre candidature a été envoyée à Groupe SII" (Indeed)
    re.compile(
        r"\benvoyée?\s+(?:à|a)\s+([^\.\n]{2,60}?)(?:[\.\n]|$)",
        re.IGNORECASE,
    ),
    # "candidature transmise auprès de XYZ"
    re.compile(
        r"\bauprès de\s+([^\.\n]{2,60}?)(?:[\.\n]|$)",
        re.IGNORECASE,
    ),
    # "Artelia - Suivi de votre candidature"
    re.compile(
        r"^[\s\u200b]*([^\-\|:\n]{2,60}?)\s*[\-\|:]\s*Suivi de (?:votre|la) candidature",
        re.IGNORECASE,
    ),
    # "l'équipe de recrutement de ALCANDRE" (souvent dans le corps du mail)
    re.compile(
        r"équipe de recrutement de\s+([^\.\n]{2,60}?)(?:[\.\n]|$)",
        re.IGNORECASE,
    ),
]

# Mots trop génériques pour être un nom d'entreprise valable — si une
# extraction ne renvoie que ça, on considère qu'elle a échoué.
COMPANY_NOISE_WORDS = {
    "vous", "nous", "votre profil", "cette entreprise", "l'entreprise",
    "ce poste", "un poste",
}


def extract_company_from_text(subject, body):
    """
    Cherche le nom de l'entreprise dans le sujet, puis dans le début du
    corps du mail, via des motifs typiques des plateformes d'emploi.
    Retourne None si rien de fiable n'est trouvé.
    """
    subject = subject or ""
    body_excerpt = (body or "")[:1000]

    for source in (subject, body_excerpt):
        for pattern in COMPANY_TEXT_PATTERNS:
            match = pattern.search(source)
            if not match:
                continue

            candidate = match.group(1).strip(" \u200b'\"“”·,.")

            if not candidate or candidate.lower() in COMPANY_NOISE_WORDS:
                continue

            if len(candidate) < 2 or len(candidate) > 60:
                continue

            return candidate

    return None


# --------------------------------------------------------------------------
# UTILITAIRES COMMUNS
# --------------------------------------------------------------------------

def _decode(value):
    if not value:
        return ""

    decoded_parts = decode_header(value)
    result = ""

    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            result += part.decode(encoding or "utf-8", errors="ignore")
        else:
            result += part

    return result.strip()


def _extract_sender_email(raw_from):
    match = re.search(r"[\w\.\-+]+@[\w\.\-]+", raw_from)
    return match.group(0).lower() if match else raw_from.lower()


def _extract_sender_name(raw_from):
    return raw_from.split("<")[0].strip().strip('"')


def _strip_html(html_text):
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html_text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _contains_any(text, keywords):
    lowered = text.lower()
    return any(
        re.search(rf"\b{re.escape(keyword.lower())}\b", lowered)
        for keyword in keywords
    )


def _is_always_ignore(full_text):
    if _contains_any(full_text, KEYWORDS_ALWAYS_IGNORE):
        return True
    return any(pattern.search(full_text) for pattern in ALWAYS_IGNORE_PATTERNS)


def classify_email(subject, body):
    full_text = f"{subject}\n{body}"

    if _is_always_ignore(full_text):
        return "ignore"

    if not _contains_any(full_text, KEYWORDS_JOB_RELATED):
        return "ignore"

    if _contains_any(full_text, KEYWORDS_NEGATIVE):
        return "reponse_negative"

    if _contains_any(full_text, KEYWORDS_POSITIVE):
        return "reponse_positive"

    if _contains_any(full_text, KEYWORDS_INTERVIEW):
        return "entretien"

    if _contains_any(full_text, KEYWORDS_NEW_APPLICATION):
        return "nouvelle_candidature"

    return "email_recu"


def extract_company(sender_email, sender_name, subject="", body=""):
    domain = sender_email.split("@")[-1].lower() if "@" in sender_email else ""
    root_domain = ".".join(domain.split(".")[-2:]) if domain else ""
    is_generic = bool(domain) and (
        root_domain in GENERIC_DOMAINS or domain in GENERIC_DOMAINS
    )

    if domain and not is_generic:
        company_guess = domain.split(".")[0]
        return company_guess.replace("-", " ").capitalize()

    # Domaine générique (plateforme d'emploi) : le nom de l'entreprise n'est
    # pas dans l'expéditeur — on essaie de le repérer dans le sujet/corps.
    from_text = extract_company_from_text(subject, body)
    if from_text:
        return from_text

    if sender_name:
        cleaned = re.sub(
            r"\b(rh|recrutement|recruiting|talent|careers?|hr|team|no-?reply)\b",
            "",
            sender_name,
            flags=re.IGNORECASE,
        ).strip(" -|,")
        return cleaned or sender_name

    return "Entreprise inconnue"


def extract_position(subject):
    cleaned = re.sub(r"^(re|fwd|tr)\s*:\s*", "", subject, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"(votre candidature (pour|au poste de)|application for|your application for)",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip(" -–:")
    return cleaned[:200] if cleaned else "Poste non précisé"


EVENT_TYPE_LABELS = {
    "nouvelle_candidature": "Candidature envoyée",
    "entretien": "Entretien",
    "reponse_negative": "Réponse reçue",
    "reponse_positive": "Réponse reçue",
    "email_recu": "Email reçu",
}

STATUS_PROGRESSION = [
    "Candidature envoyée",
    "En attente",
    "Relance",
    "Entretien",
    "Offre reçue",
    "Acceptée",
]


def _status_for_event(event_type):
    return {
        "nouvelle_candidature": "Candidature envoyée",
        "entretien": "Entretien",
        "reponse_positive": "Offre reçue",
        "reponse_negative": "Refusée",
    }.get(event_type)


def _should_upgrade_status(current_status, new_status):
    if new_status == "Refusée":
        return True

    if current_status not in STATUS_PROGRESSION:
        return True

    if new_status not in STATUS_PROGRESSION:
        return False

    return STATUS_PROGRESSION.index(new_status) > STATUS_PROGRESSION.index(
        current_status
    )


def find_matching_application(db, company):
    if not company or company == "Entreprise inconnue":
        return None

    ninety_days_ago = datetime.utcnow() - timedelta(days=90)

    return (
        db.query(Application)
        .filter(Application.company.ilike(f"%{company}%"))
        .filter(Application.created_at >= ninety_days_ago)
        .order_by(Application.created_at.desc())
        .first()
    )


VALID_EVENT_TYPES = {
    "nouvelle_candidature", "entretien", "reponse_positive",
    "reponse_negative", "email_recu", "ignore",
}


def _classify(subject, sender_email, sender_name, body):
    """
    Retourne (event_type, company, position).
    Essaie d'abord l'IA locale (Ollama) si disponible, sinon se rabat
    sur les règles-clés.
    """
    full_text = f"{subject}\n{body}"

    # Court-circuit : alertes/recommandations d'offres, documents
    # administratifs (fiche de paie...) — jamais un vrai suivi de
    # candidature, inutile de solliciter l'IA pour ça.
    if _is_always_ignore(full_text):
        return "ignore", None, None

    # Pré-filtre rapide (mots-clés) AVANT d'appeler l'IA : si l'email n'a
    # même pas un vague rapport avec le recrutement, inutile de faire
    # patienter tout le scan pour un appel IA (lent) qui dira "ignore" de
    # toute façon — newsletters, promos, réseaux sociaux, etc.
    if not _contains_any(full_text, KEYWORDS_JOB_RELATED):
        return "ignore", None, None

    if ai_is_available():
        ai_result = classify_with_ai(subject, sender_email, sender_name, body)

        if ai_result is not None:
            event_type = ai_result.get("event_type", "ignore")

            if event_type not in VALID_EVENT_TYPES:
                event_type = "ignore"

            company = (ai_result.get("company") or "").strip() or None
            position = (ai_result.get("position") or "").strip() or None

            if event_type != "ignore":
                company = company or extract_company(
                    sender_email, sender_name, subject, body
                )
                position = position or extract_position(subject)

            return event_type, company, position

        print(
            f"[classification] IA indisponible/échec — repli mots-clés "
            f"pour : {subject[:60]!r}"
        )

    # Repli sur les règles-clés (Ollama indisponible ou réponse invalide)
    event_type = classify_email(subject, body)

    if event_type == "ignore":
        return event_type, None, None

    return (
        event_type,
        extract_company(sender_email, sender_name, subject, body),
        extract_position(subject),
    )


def build_email_link(account_key, message_id, subject, graph_weblink=None):
    """
    Construit un lien permettant de rouvrir l'email dans sa boîte mail.
    - Outlook (Graph) : lien officiel fourni par Microsoft (le plus fiable).
    - Gmail : lien de recherche par Message-ID (ouvre l'email exact).
    - Yahoo : Yahoo n'expose pas de lien fiable par Message-ID — on retombe
      sur une recherche par sujet (approximatif, mais mieux que rien).
    """
    if account_key in ("outlook", "outlook_school"):
        return graph_weblink or None

    if account_key == "gmail":
        clean_id = (message_id or "").strip("<>")
        if not clean_id:
            return None
        return f"https://mail.google.com/mail/u/0/#search/rfc822msgid:{quote(clean_id)}"

    if account_key == "yahoo":
        if not subject:
            return None
        return f"https://mail.yahoo.com/n/search/keyword={quote(subject)}"

    return None


def _process_message(db, account_key, message_id, subject, sender_email,
                      sender_name, body, received_at, result,
                      graph_weblink=None):
    """
    Logique de classification + création/mise à jour partagée entre
    IMAP et Microsoft Graph. Modifie `result` en place.
    """
    already_processed = (
        db.query(ProcessedEmail)
        .filter(ProcessedEmail.message_id == message_id)
        .first()
    )

    if already_processed:
        return

    result["scanned"] += 1

    event_type, company, position_hint = _classify(
        subject, sender_email, sender_name, body
    )

    email_link = build_email_link(
        account_key, message_id, subject, graph_weblink=graph_weblink
    )

    processed_entry = ProcessedEmail(
        message_id=message_id,
        account=account_key,
        sender=sender_email,
        subject=subject[:500],
        received_at=received_at,
        event_type=event_type,
        email_link=email_link,
    )

    if event_type == "ignore":
        result["ignored"] += 1
        db.add(processed_entry)
        return

    application = find_matching_application(db, company)

    history_type = EVENT_TYPE_LABELS.get(event_type, "Email reçu")
    new_status = _status_for_event(event_type)

    if application is None:
        if event_type != "nouvelle_candidature":
            result["ignored"] += 1
            db.add(processed_entry)
            return

        application = Application(
            company=company or "Entreprise inconnue",
            position=position_hint or "Poste non précisé",
            source="Email (détection automatique)",
            application_date=received_at or datetime.utcnow(),
            status=new_status or "Candidature envoyée",
        )
        db.add(application)
        db.flush()
        result["new_applications"] += 1
    else:
        if new_status and _should_upgrade_status(application.status, new_status):
            application.status = new_status
        result["updated_applications"] += 1

    db.add(
        InteractionHistory(
            application_id=application.id,
            type=history_type,
            date=received_at or datetime.utcnow(),
            note=f"Détecté automatiquement — sujet : « {subject} »",
        )
    )

    processed_entry.application_id = application.id
    db.add(processed_entry)


# --------------------------------------------------------------------------
# SYNCHRONISATION IMAP (Yahoo, Gmail)
# --------------------------------------------------------------------------

def _get_email_body_imap(msg):
    MIN_USEFUL_LENGTH = 50  # en dessous, on considère le texte brut inutilisable

    plain_text = ""
    html_text = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition") or "")

            if "attachment" in disposition:
                continue

            if content_type == "text/plain" and not plain_text:
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or "utf-8"
                    plain_text = payload.decode(charset, errors="ignore")
                except Exception:
                    pass

            elif content_type == "text/html" and not html_text:
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or "utf-8"
                    html_text = payload.decode(charset, errors="ignore")
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or "utf-8"
            decoded = payload.decode(charset, errors="ignore") if payload else ""
        except Exception:
            decoded = ""

        if msg.get_content_type() == "text/html":
            html_text = decoded
        else:
            plain_text = decoded

    # La version texte brut est souvent quasi vide sur les emails marketing /
    # notifications (LinkedIn, Indeed...), qui ne mettent le vrai contenu que
    # dans le HTML. On se rabat dessus si le texte brut est trop court.
    if len(plain_text.strip()) >= MIN_USEFUL_LENGTH:
        return plain_text

    if html_text:
        stripped = _strip_html(html_text)
        if stripped:
            return stripped

    return plain_text


def sync_account_imap(db, account_key, config, result, days=None, reset=False):
    address = os.getenv(config["email_env"])
    password = os.getenv(config["password_env"])

    result["configured"] = bool(address and password)

    if not address or not password:
        return result

    if reset:
        db.query(ProcessedEmail).filter(
            ProcessedEmail.account == account_key
        ).delete()
        db.query(SyncState).filter(
            SyncState.account == account_key
        ).delete()
        db.commit()

    sync_state = db.query(SyncState).filter(SyncState.account == account_key).first()

    if days is not None:
        since_date = datetime.utcnow() - timedelta(days=days)
    else:
        since_date = (
            sync_state.last_synced_at
            if sync_state and sync_state.last_synced_at
            else datetime.utcnow() - timedelta(days=DEFAULT_LOOKBACK_DAYS)
        )

    try:
        connection = imaplib.IMAP4_SSL(config["imap_server"], config["imap_port"])
        connection.login(address, password)
        connection.select("INBOX")

        search_date = since_date.strftime("%d-%b-%Y")
        status, message_ids = connection.search(None, f'(SINCE "{search_date}")')

        if status != "OK":
            raise RuntimeError("La recherche IMAP a échoué.")

        print(f"[{account_key}] {len(message_ids[0].split())} email(s) à examiner depuis {search_date}")

        message_id_list = message_ids[0].split()
        total = len(message_id_list)

        for index, message_id_raw in enumerate(message_id_list, start=1):
            status, msg_data = connection.fetch(message_id_raw, "(RFC822)")

            if status != "OK" or not msg_data or msg_data[0] is None:
                continue

            msg = email.message_from_bytes(msg_data[0][1])
            message_id = msg.get("Message-ID") or f"{account_key}-{message_id_raw!r}"

            subject = _decode(msg.get("Subject"))
            raw_from = _decode(msg.get("From"))
            sender_email = _extract_sender_email(raw_from)
            sender_name = _extract_sender_name(raw_from)
            body = _get_email_body_imap(msg)

            try:
                received_at = parsedate_to_datetime(msg.get("Date"))
                if received_at and received_at.tzinfo:
                    received_at = received_at.replace(tzinfo=None)
            except Exception:
                received_at = None

            print(
                f"[{account_key}] {index}/{total} — "
                f"{subject[:70] or '(sans objet)'}"
            )

            _process_message(
                db, account_key, message_id, subject, sender_email,
                sender_name, body, received_at, result,
            )

        connection.close()
        connection.logout()

        if sync_state is None:
            sync_state = SyncState(account=account_key)
            db.add(sync_state)

        sync_state.last_synced_at = datetime.utcnow()
        db.commit()

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        result["error"] = str(exc)

    return result


# --------------------------------------------------------------------------
# SYNCHRONISATION MICROSOFT GRAPH (Outlook perso / scolaire, via OAuth)
# --------------------------------------------------------------------------

def sync_account_graph(db, account_key, result, days=None, reset=False):
    token = get_access_token(account_key)

    if not token:
        result["configured"] = False
        result["error"] = (
            "Compte non autorisé. Lance une fois dans le terminal : "
            f"python authorize_outlook.py {account_key}"
        )
        return result

    result["configured"] = True

    if reset:
        db.query(ProcessedEmail).filter(
            ProcessedEmail.account == account_key
        ).delete()
        db.query(SyncState).filter(
            SyncState.account == account_key
        ).delete()
        db.commit()

    sync_state = db.query(SyncState).filter(SyncState.account == account_key).first()

    if days is not None:
        since_date = datetime.utcnow() - timedelta(days=days)
    else:
        since_date = (
            sync_state.last_synced_at
            if sync_state and sync_state.last_synced_at
            else datetime.utcnow() - timedelta(days=DEFAULT_LOOKBACK_DAYS)
        )
    since_iso = since_date.strftime("%Y-%m-%dT%H:%M:%SZ")

    headers = {"Authorization": f"Bearer {token}"}
    url = (
        f"{GRAPH_BASE_URL}/me/mailFolders/Inbox/messages"
        f"?$filter=receivedDateTime ge {since_iso}"
        f"&$select=internetMessageId,subject,from,receivedDateTime,body,webLink"
        f"&$top=50"
        f"&$orderby=receivedDateTime desc"
    )

    try:
        while url:
            response = requests.get(url, headers=headers, timeout=30)

            if response.status_code == 401:
                raise RuntimeError(
                    "Session expirée ou invalide. Relance : "
                    f"python authorize_outlook.py {account_key}"
                )

            response.raise_for_status()
            payload = response.json()
            messages_batch = payload.get("value", [])

            print(f"[{account_key}] {len(messages_batch)} email(s) reçus dans ce lot")

            for batch_index, message in enumerate(messages_batch, start=1):
                message_id = message.get("internetMessageId")

                if not message_id:
                    continue

                subject = message.get("subject") or ""
                sender_info = (message.get("from") or {}).get("emailAddress", {})
                sender_email = (sender_info.get("address") or "").lower()
                sender_name = sender_info.get("name") or ""

                body_data = message.get("body") or {}
                raw_body = body_data.get("content") or ""
                body = (
                    _strip_html(raw_body)
                    if body_data.get("contentType") == "html"
                    else raw_body
                )

                received_at_raw = message.get("receivedDateTime")
                received_at = None

                if received_at_raw:
                    try:
                        received_at = datetime.fromisoformat(
                            received_at_raw.replace("Z", "+00:00")
                        ).replace(tzinfo=None)
                    except Exception:
                        received_at = None

                print(
                    f"[{account_key}] {batch_index}/{len(messages_batch)} — "
                    f"{subject[:70] or '(sans objet)'}"
                )

                _process_message(
                    db, account_key, message_id, subject, sender_email,
                    sender_name, body, received_at, result,
                    graph_weblink=message.get("webLink"),
                )

            url = payload.get("@odata.nextLink")

        if sync_state is None:
            sync_state = SyncState(account=account_key)
            db.add(sync_state)

        sync_state.last_synced_at = datetime.utcnow()
        db.commit()

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        result["error"] = str(exc)

    return result


# --------------------------------------------------------------------------
# POINT D'ENTRÉE
# --------------------------------------------------------------------------

def sync_account(db, account_key, days=None, reset=False):
    config = ACCOUNTS[account_key]

    result = {
        "account": account_key,
        "configured": False,
        "scanned": 0,
        "new_applications": 0,
        "updated_applications": 0,
        "ignored": 0,
        "error": None,
    }

    if config["protocol"] == "graph":
        return sync_account_graph(db, account_key, result, days=days, reset=reset)

    return sync_account_imap(db, account_key, config, result, days=days, reset=reset)


def sync_all_accounts(db, days=None, reset=False):
    return [
        sync_account(db, account_key, days=days, reset=reset)
        for account_key in ACCOUNTS
    ]
