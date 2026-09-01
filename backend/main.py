from dotenv import load_dotenv

# IMPORTANT : le .env doit être chargé avant tout import qui en dépend
# (routes -> services -> ai_classifier lit OLLAMA_MODEL dès son import).
# Si load_dotenv() est appelé après ces imports, les valeurs du .env
# n'existent pas encore et les valeurs par défaut sont figées en mémoire
# pour toute la durée du programme, peu importe ce que contient le .env.
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine, run_lightweight_migrations
from routes.applications import router as applications_router
from routes.emails import router as emails_router
from routes.history import router as history_router
from routes.reminders import router as reminders_router

import models

Base.metadata.create_all(bind=engine)
run_lightweight_migrations()

app = FastAPI(
    title="JobTracker AI API",
    description="Backend de gestion et de suivi des candidatures",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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