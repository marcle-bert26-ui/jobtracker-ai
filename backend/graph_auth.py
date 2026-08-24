import os

import msal

CLIENT_ID = os.getenv("MS_CLIENT_ID")

# "common" autorise à la fois les comptes personnels (outlook.com/hotmail)
# et les comptes d'organisation (scolaire/pro) avec la même app.
AUTHORITY = "https://login.microsoftonline.com/common"

SCOPES = ["Mail.Read", "User.Read"]

TOKEN_CACHE_DIR = os.path.join(os.path.dirname(__file__), "token_cache")


def _cache_path(account_key: str) -> str:
    os.makedirs(TOKEN_CACHE_DIR, exist_ok=True)
    return os.path.join(TOKEN_CACHE_DIR, f"{account_key}.bin")


def _load_cache(account_key: str) -> msal.SerializableTokenCache:
    cache = msal.SerializableTokenCache()
    path = _cache_path(account_key)

    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as file:
            cache.deserialize(file.read())

    return cache


def _save_cache(account_key: str, cache: msal.SerializableTokenCache) -> None:
    if cache.has_state_changed:
        with open(_cache_path(account_key), "w", encoding="utf-8") as file:
            file.write(cache.serialize())


def _build_app(account_key: str):
    cache = _load_cache(account_key)
    app = msal.PublicClientApplication(
        CLIENT_ID,
        authority=AUTHORITY,
        token_cache=cache,
    )
    return app, cache


def get_access_token(account_key: str) -> str | None:
    """
    Retourne un access token valide en le renouvelant silencieusement
    depuis le cache, ou None si le compte n'a jamais été autorisé
    (il faut alors lancer authorize_outlook.py une fois).
    """
    if not CLIENT_ID:
        return None

    app, cache = _build_app(account_key)
    accounts = app.get_accounts()

    if not accounts:
        return None

    result = app.acquire_token_silent(SCOPES, account=accounts[0])
    _save_cache(account_key, cache)

    if result and "access_token" in result:
        return result["access_token"]

    return None


def device_login(account_key: str) -> None:
    """
    À exécuter manuellement une seule fois par compte :
    python authorize_outlook.py outlook
    python authorize_outlook.py outlook_school
    """
    if not CLIENT_ID:
        raise RuntimeError(
            "MS_CLIENT_ID n'est pas défini dans le fichier .env."
        )

    app, cache = _build_app(account_key)

    flow = app.initiate_device_flow(scopes=SCOPES)

    if "user_code" not in flow:
        raise RuntimeError(
            f"Impossible de démarrer l'authentification : {flow}"
        )

    print("\n" + flow["message"] + "\n")

    result = app.acquire_token_by_device_flow(flow)
    _save_cache(account_key, cache)

    if "access_token" not in result:
        raise RuntimeError(
            "Échec de l'authentification : "
            f"{result.get('error_description', result)}"
        )

    print(f"✅ Compte « {account_key} » autorisé avec succès.\n")
