import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# In production this points at a Railway volume mount so the SQLite file
# (and every edit made through the app) survives restarts and redeploys.
DATA_DIR = os.environ.get("DATA_DIR", ".")
DATABASE_URL = f"sqlite:///{DATA_DIR}/basement.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
