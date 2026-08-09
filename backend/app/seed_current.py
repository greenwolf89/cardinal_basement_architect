"""Populate the 'current' stage geometry from the hand-drawn scan.

Coordinate system: inches, origin (0,0) at the garage's front-left corner,
x increases toward the right (across the 24'4.5" width), y increases going
back through the garage -> transition band -> basement.
"""

from .database import Base, SessionLocal, engine
from . import models

Base.metadata.create_all(bind=engine)

db = SessionLocal()

stage = db.query(models.Stage).filter(models.Stage.key == "current").first()
if not stage:
    raise SystemExit("Run seed.py first to create the 'current' stage.")

# Wipe any prior geometry for this stage so the script is re-runnable.
db.query(models.Room).filter(models.Room.stage_id == stage.id).delete()
db.query(models.Wall).filter(models.Wall.stage_id == stage.id).delete()
db.query(models.Feature).filter(models.Feature.stage_id == stage.id).delete()
db.commit()

FULL_W = 292.5  # 24'4.5"
GARAGE_D = 235  # 19'7"
BAND_D = 40  # 3'4"
BASEMENT_D = 329  # 27'5"
TOTAL_D = GARAGE_D + BAND_D + BASEMENT_D
DIVIDER_X = 144  # pole: 12' from west wall

# ---------------- Rooms ----------------
rooms = [
    ("Garage", 0, 0, FULL_W, GARAGE_D, "#dfe3e6",
     "Garage door 9'5\" wide. Pole 12' from west wall, 8' from garage/band division."),
    ("Utility nook", 0, GARAGE_D, 51, BAND_D, "#e8ded2",
     "Boiler, wall pump, water heater, existing shelves."),
    ("Current laundry room", 51, GARAGE_D, 95, BAND_D, "#e3ecec",
     "Sink/plumbing hookup present."),
    ("Closet under steps", 146, GARAGE_D, 114, BAND_D, "#efe9df",
     "Stairs up to main house. Laundry machines currently here."),
    ("Platform w/ door to garage", 260, GARAGE_D, 32.5, BAND_D, "#f2f2e9",
     "Stairwell bottom platform — egress path to garage."),
    ("Basement", 0, GARAGE_D + BAND_D, FULL_W, BASEMENT_D, "#e8e2d4",
     "Egress window planned on west wall, 10'8\" from the back wall."),
]
for name, x, y, w, h, color, notes in rooms:
    db.add(models.Room(stage_id=stage.id, name=name, x=x, y=y, width=w, height=h, color=color, notes=notes))

# ---------------- Walls (perimeter + band dividers) ----------------
def wall(x1, y1, x2, y2, wall_type="existing", notes=""):
    w = models.Wall(stage_id=stage.id, x1=x1, y1=y1, x2=x2, y2=y2, wall_type=wall_type, notes=notes)
    db.add(w)
    db.flush()
    return w

# Perimeter
wall(0, 0, FULL_W, 0, notes="Front wall: existing side door + garage door opening.")
wall(FULL_W, 0, FULL_W, TOTAL_D, notes="East wall.")
wall(FULL_W, TOTAL_D, 0, TOTAL_D, notes="Back wall.")
wall(0, TOTAL_D, 0, 0, notes="West wall. Egress window planned here.")

# Band dividers (interior, separating utility/laundry/closet/platform)
wall(51, GARAGE_D, 51, GARAGE_D + BAND_D)
wall(146, GARAGE_D, 146, GARAGE_D + BAND_D)
wall(260, GARAGE_D, 260, GARAGE_D + BAND_D)

# Garage/band and band/basement boundary lines
band_garage_wall = wall(0, GARAGE_D, FULL_W, GARAGE_D)
wall(0, GARAGE_D + BAND_D, FULL_W, GARAGE_D + BAND_D)

db.commit()

front_wall = db.query(models.Wall).filter(
    models.Wall.stage_id == stage.id, models.Wall.y1 == 0, models.Wall.y2 == 0
).first()

db.add(models.Opening(wall_id=front_wall.id, type="door", offset_in=12, width_in=32,
                       notes="Existing side door."))
db.add(models.Opening(wall_id=front_wall.id, type="garage_door", offset_in=139, width_in=113,
                       notes="9'5\" garage door — right side of the front wall."))
db.add(models.Opening(wall_id=band_garage_wall.id, type="door", offset_in=265, width_in=25,
                       notes="Platform -> garage door (existing)."))
db.commit()

# ---------------- Features ----------------
def feature(room_name, ftype, x, y, w=0, h=0, label=""):
    db.add(models.Feature(stage_id=stage.id, room_name=room_name, type=ftype, x=x, y=y,
                           width=w, height=h, label=label))

feature("Garage", "pole", DIVIDER_X, GARAGE_D - 96, 6, 6,
        "Pole — 12' from west wall, 8' from garage/band division.")
feature("Garage", "electric_panel", FULL_W - 20, 5, 15, 20, "Existing electric panel.")
feature("Garage", "shelving", 0, 0, 10, 100, "Existing shelves.")
feature("Utility nook", "wall_pump", 4, GARAGE_D + 3, 8, 8, "Wall pump")
feature("Utility nook", "boiler", 15, GARAGE_D + 3, 13, 13, "Boiler")
feature("Utility nook", "water_heater", 31, GARAGE_D + 3, 15, 15, "Water heater")
feature("Current laundry room", "plumbing", 70, GARAGE_D + 5, 0, 0, "Sink/plumbing hookup")
feature("Closet under steps", "appliance", 150, GARAGE_D + 5, 20, 20, "Laundry machines (existing)")
feature("Basement", "egress_window", 0, TOTAL_D - 128, 0, 0, "Planned egress window — 10'8\" from back wall.")

db.commit()
db.close()
print(f"Current-state geometry seeded. Total footprint: {FULL_W/12:.1f}' x {TOTAL_D/12:.1f}'")
