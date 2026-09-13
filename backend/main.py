from dotenv import load_dotenv

# IMPORTANT : le .env doit être chargé avant tout import qui en dépend
# (routes -> services -> ai_classifier lit OLLAMA_MODEL dès son import).
load_dotenv()

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine, run_lightweight_migrations
from routes.applications import router as applications_router
from routes.documents import router as documents_router
from routes.emails import router as emails_router
from routes.history import router as history_router
from routes.profile import router as profile_router
from routes.reminders import router as reminders_router

import models


Base.metadata.create_all(bind=engine)
run_lightweight_migrations()


app = FastAPI(
    title="JobTracker AI API",
    description="Backend de gestion et de suivi des candidatures",
    version="0.4.0",
)


# ============================================================
# CORS
# ============================================================

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://bfljc775-3000.uks1.devtunnels.ms",
)
print("FRONTEND_URL =", FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Utilisation locale
        "http://localhost:3000",
        "http://127.0.0.1:3000",

        # Microsoft Dev Tunnel
        "https://bfljc775-3000.uks1.devtunnels.ms",

        # Valeur provenant du .env si elle existe
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Routes
# ============================================================

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "application": "JobTracker AI",
        "version": "0.4.0",
    }


app.include_router(applications_router)
app.include_router(history_router)
app.include_router(emails_router)
app.include_router(reminders_router)
app.include_router(profile_router)
app.include_router(documents_router)