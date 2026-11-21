"""Seed initial labor and resource rows for the Budget tab.

Re-runnable: clears its own rows by a recognizable marker before re-adding.
"""

from .database import Base, SessionLocal, engine
from . import models

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Electrician — flat fee for permitting/approvals, not hourly.
db.query(models.LaborEntry).filter(models.LaborEntry.person == "Adam").delete()
db.add(models.LaborEntry(
    person="Adam", flat_fee=2800, date=None, task="Permitting & electrical approvals",
    notes="Electrician handling permitting and approvals for the renovation.",
))

# Mini-split system — purchased as one 3-zone system, not split per-zone since
# no per-zone cost breakdown was given.
existing = db.query(models.Resource).filter(models.Resource.name.like("Mini-split%")).first()
if not existing:
    db.add(models.Resource(
        category="hvac",
        name="Mini-split 3-zone system (9k studio / 18k basement / 24k upstairs)",
        quantity="1", unit="system", space="both", status="installed",
        notes="9,000 BTU in the Music Studio, 18,000 BTU in the basement Living/Family Room, "
              "24,000 BTU upstairs (outside this app's modeled footprint).",
        actual_cost=9000, actual_vendor="", purchased_at=None,
    ))

db.commit()
db.close()
print("Budget seed data added.")
