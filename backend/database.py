from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./jobtracker.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def run_lightweight_migrations():
    """
    SQLite + Base.metadata.create_all() ne crée que les tables manquantes,
    jamais les colonnes manquantes sur une table déjà existante. On comble
    l'écart ici à la main, sans dépendre d'Alembic, pour les quelques
    colonnes ajoutées après la création initiale de la base.
    """
    inspector = inspect(engine)

    if "processed_emails" not in inspector.get_table_names():
        return  # la table sera créée par create_all(), rien à faire ici

    existing_columns = {
        col["name"] for col in inspector.get_columns("processed_emails")
    }

    if "email_link" not in existing_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE processed_emails ADD COLUMN email_link VARCHAR(1000)"
                )
            )