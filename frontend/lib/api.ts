/**

* Configuration centralisée de l'API JobTracker.
*
* Le backend utilisé dépend automatiquement de la façon
* dont le frontend est ouvert :
*
* * http://localhost:3000
* -> http://127.0.0.1:8000
*
* * https://xxxx-3000.uks1.devtunnels.ms
* -> https://xxxx-8000.uks1.devtunnels.ms
*
* Aucun changement manuel n'est nécessaire.
  */

const LOCAL_API_URL = "http://127.0.0.1:8000";

const DEFAULT_TUNNEL_API_URL =
"https://bfljc775-8000.uks1.devtunnels.ms";

function getApiUrl(): string {
// Pendant le rendu serveur Next.js, window n'existe pas.
// On utilise donc le backend local par défaut.
if (typeof window === "undefined") {
return LOCAL_API_URL;
}

const hostname = window.location.hostname;

// ============================================================
// MODE LOCAL
// ============================================================

if (
hostname === "localhost" ||
hostname === "127.0.0.1"
) {
return LOCAL_API_URL;
}

// ============================================================
// MODE DEV TUNNEL
// ============================================================

// Exemple :
// bfljc775-3000.uks1.devtunnels.ms
//
// devient :
// bfljc775-8000.uks1.devtunnels.ms

if (hostname.includes("-3000.")) {
return `https://${hostname.replace("-3000.", "-8000.")}`;
}

// ============================================================
// SECURITE / FALLBACK
// ============================================================

return DEFAULT_TUNNEL_API_URL;
}

export const API_URL = getApiUrl();

export default API_URL;
