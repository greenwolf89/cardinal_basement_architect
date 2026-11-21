"""Populate the 'redesign' stage: staged plan for garage + basement.

Layout:
- GARAGE (front, 24'4.5" wide x 19'7" deep): garage door removed, replaced
  with a wall holding a solid wood door + double windows; 2" raised floor.
  Split by a new wall on the pole/beam line into a Music Studio (east) and
  Storage & Water Filtration (west). Pole sits 12' from the west wall and
  8' from the garage/band division line.
- BAND (transition strip, 3'4" deep): walled-off utility room, bathroom
  (former laundry room, pump-up toilet), closet-under-steps left at its full
  original footprint, platform/hallway through to the garage.
- The Bathroom is deepened to extend the same total depth as the new Laundry
  Room addition below it; a new Laundry Room sits beside it (outside the
  closet-under-steps footprint, not inside it), sharing one continuous new
  south wall with the deepened Bathroom. Entry is a door into the Bathroom
  from the band, then a second door from the Bathroom into the Laundry Room.
- BASEMENT (rear, 24'4.5" wide x 27'5" deep): Living / Family Room — built-in
  shelving on the east wall (longest unbroken wall), kid play zone in the
  back corner, family sofa + sleeper sofa, egress window on the west wall.
"""

from .database import Base, SessionLocal, engine
from . import models

Base.metadata.create_all(bind=engine)

db = SessionLocal()

stage = db.query(models.Stage).filter(models.Stage.key == "redesign").first()
if not stage:
    raise SystemExit("Run seed.py first to create the 'redesign' stage.")

db.query(models.Room).filter(models.Room.stage_id == stage.id).delete()
db.query(models.Wall).filter(models.Wall.stage_id == stage.id).delete()
db.query(models.Feature).filter(models.Feature.stage_id == stage.id).delete()
db.commit()

FULL_W = 292.5  # 24'4.5"
GARAGE_D = 235  # 19'7"
BAND_D = 40  # 3'4"
BASEMENT_D = 329  # 27'5"
TOTAL_D = GARAGE_D + BAND_D + BASEMENT_D
BAND_Y = GARAGE_D
BASEMENT_Y = GARAGE_D + BAND_D
DIVIDER_X = 144  # pole: 12' from west wall
LAUNDRY_Y = BASEMENT_Y  # laundry addition sits at the very front of the basement
LAUNDRY_D = 50

# ---------------- Rooms ----------------
rooms = [
    ("Storage & Water Filtration", 0, 0, DIVIDER_X, GARAGE_D, "#e6e6da",
     "Water filtration system + shelving/racking."),
    ("Music Studio", DIVIDER_X, 0, FULL_W - DIVIDER_X, GARAGE_D, "#e0d8e8",
     "Acoustic treatment on walls."),
    ("Utility Room", 0, BAND_Y, 51, BAND_D + LAUNDRY_D, "#dfe3e6",
     "Deepened to match the bathroom/laundry — extends down to the same south wall. "
     "Boiler, wall pump, water heater. Double door in from the Bathroom."),
    ("Bathroom", 51, BAND_Y, 95, BAND_D + LAUNDRY_D, "#e3ecec",
     "Deepened to match the Laundry Room beside it. Pump-up (macerating) toilet + sink. "
     "Door in from the Living/Family Room; a second door leads to the Laundry Room."),
    ("Closet Under Steps", 146, BAND_Y, 114, BAND_D, "#efe9df",
     "Stair storage — unchanged footprint."),
    ("Platform / Hallway", 260, BAND_Y, 32.5, BAND_D, "#f2f2e9",
     "Connects band to garage; floor leveled to 2\" raised floor."),
    ("Living / Family Room", 0, BASEMENT_Y, FULL_W, BASEMENT_D, "#f4ecd8",
     "Built-in shelving, kid play zone, family + sleeper sofa. Egress window on west wall."),
    ("Laundry Room", 146, LAUNDRY_Y, 114, LAUNDRY_D, "#eaf0e6",
     "New addition beside the (deepened) bathroom, outside the closet-under-steps footprint. "
     "Washer/dryer. Reached via a door from the Bathroom."),
]
for name, x, y, w, h, color, notes in rooms:
    db.add(models.Room(stage_id=stage.id, name=name, x=x, y=y, width=w, height=h, color=color, notes=notes))

# ---------------- Walls ----------------
def wall(x1, y1, x2, y2, wall_type="existing", notes=""):
    w = models.Wall(stage_id=stage.id, x1=x1, y1=y1, x2=x2, y2=y2, wall_type=wall_type, notes=notes)
    db.add(w)
    db.flush()
    return w

# Perimeter
front_wall = wall(0, 0, FULL_W, 0, notes="Garage door removed. New wall: solid wood door + double windows.")
wall(FULL_W, 0, FULL_W, TOTAL_D)
wall(FULL_W, TOTAL_D, 0, TOTAL_D)
west_wall = wall(0, TOTAL_D, 0, 0, notes="Egress window on Living/Family Room portion of this wall.")

# Band interior walls
utility_bath_wall = wall(51, BAND_Y, 51, BAND_Y + BAND_D, "new", "Utility room wall — double door for access.")
closet_bathroom_wall = wall(146, BAND_Y, 146, BAND_Y + BAND_D, "existing",
                             "Closet-under-steps (stairs landing) / Bathroom wall — has a door.")
wall(260, BAND_Y, 260, BAND_Y + BAND_D, "existing")

band_north_wall = wall(0, BAND_Y, FULL_W, BAND_Y, "existing")
closet_laundry_wall = wall(146, BAND_Y + BAND_D, 260, BAND_Y + BAND_D, "existing",
                            "Closet-under-steps (stairs landing) / Laundry Room wall — has a door.")
# No wall from x=260 to the east wall here — this is the stairwell up to the
# main house, open from the Platform/Hallway straight through to the Living/
# Family Room below.

# Utility Room and Bathroom both extend down alongside the new Laundry Room addition —
# their shared interior walls continue down to one common new south wall.
wall(51, BAND_Y + BAND_D, 51, LAUNDRY_Y + LAUNDRY_D, "new", "Utility Room / Bathroom wall, lower (new) portion.")
bathroom_laundry_wall = wall(146, BAND_Y + BAND_D, 146, LAUNDRY_Y + LAUNDRY_D, "new",
                              "Bathroom / Laundry Room wall, lower (new) portion — has a door.")
wall(260, LAUNDRY_Y, 260, LAUNDRY_Y + LAUNDRY_D, "new", "East wall of laundry addition.")
laundry_south_wall = wall(0, LAUNDRY_Y + LAUNDRY_D, 260, LAUNDRY_Y + LAUNDRY_D, "new",
                           "Shared outer south wall for the utility room, bathroom, and laundry addition.")

# Garage dividing wall — planned, garage side only, on the pole/beam line
divider_wall = wall(DIVIDER_X, 0, DIVIDER_X, GARAGE_D, "new",
     "On the pole/beam line: 12' from west wall, 8' from the garage/band division. "
     "Separates Music Studio from Storage & Water Filtration. Has a door near the back.")

db.commit()

# ---------------- Openings ----------------
# Studio front wall: window - door - window, roughly centered on the studio's own span
# of the wall (144'-292.5'), not spilling onto the Storage & Water Filtration side.
db.add(models.Opening(wall_id=front_wall.id, type="door", offset_in=12, width_in=32,
                       notes="Existing side door — kept for Storage & Water Filtration access."))
db.add(models.Opening(wall_id=front_wall.id, type="window", offset_in=163, width_in=30,
                       notes="Window, left of the studio door."))
db.add(models.Opening(wall_id=front_wall.id, type="door", offset_in=199, width_in=36,
                       notes="New solid wood exterior door for the Music Studio."))
db.add(models.Opening(wall_id=front_wall.id, type="window", offset_in=241, width_in=30,
                       notes="Window, right of the studio door."))
db.add(models.Opening(wall_id=divider_wall.id, type="door", offset_in=195, width_in=36,
                       notes="Music Studio -> Storage & Water Filtration, near the back (basement) wall."))
db.add(models.Opening(wall_id=west_wall.id, type="egress_window", offset_in=128, width_in=36,
                       notes="10'8\" from the back wall."))
db.add(models.Opening(wall_id=utility_bath_wall.id, type="door", offset_in=6, width_in=60,
                       notes="Double door — Bathroom into Utility Room."))
db.add(models.Opening(wall_id=laundry_south_wall.id, type="door", offset_in=90, width_in=30,
                       notes="Living/Family Room -> Bathroom door."))
db.add(models.Opening(wall_id=bathroom_laundry_wall.id, type="door", offset_in=15, width_in=30,
                       notes="Bathroom -> Laundry Room door."))
db.add(models.Opening(wall_id=band_north_wall.id, type="door", offset_in=265, width_in=25,
                       notes="Platform/Hallway -> garage door."))
db.commit()

# ---------------- Features ----------------
def feature(room_name, ftype, x, y, w=0, h=0, label=""):
    db.add(models.Feature(stage_id=stage.id, room_name=room_name, type=ftype, x=x, y=y,
                           width=w, height=h, label=label))

feature("Storage & Water Filtration", "water_filtration", 15, 15, 20, 20, "Water filtration system")
feature("Storage & Water Filtration", "shelving", 15, 60, 15, 150, "Storage racking")
feature("Storage & Water Filtration", "electric_panel", 5, GARAGE_D - 25, 15, 20, "New electric sub panel")
feature("Storage & Water Filtration", "pole", DIVIDER_X, GARAGE_D - 96, 6, 6,
        "Existing pole — 12' from west wall, 8' from garage/band division. Sets the dividing-wall line.")

# Acoustic panels mounted along the studio's perimeter walls (not floating mid-room)
feature("Music Studio", "acoustic_treatment", DIVIDER_X + 20, 6, FULL_W - DIVIDER_X - 40, 5,
        "Acoustic panel — north wall")
feature("Music Studio", "acoustic_treatment", FULL_W - 11, 30, 5, GARAGE_D - 100,
        "Acoustic panel — east wall")
feature("Music Studio", "acoustic_treatment", DIVIDER_X + 6, 30, 5, GARAGE_D - 100,
        "Acoustic panel — dividing wall side")

feature("Bathroom", "toilet", 60, BAND_Y + 10, 15, 20, "Pump-up (macerating) toilet")
feature("Bathroom", "sink", 100, BAND_Y + 5, 20, 15, "Sink")

feature("Laundry Room", "appliance", 175, LAUNDRY_Y + 12, 30, 20, "Washer/dryer")

feature("Living / Family Room", "built_in_shelving", FULL_W - 14, BASEMENT_Y + 60, 12, 168,
        "Built-in shelving along the east wall (longest unbroken wall).")
feature("Living / Family Room", "kid_zone", 15, BASEMENT_Y + BASEMENT_D - 95, 80, 80, "Kid play zone")
feature("Living / Family Room", "sofa", 100, BASEMENT_Y + 60, 90, 34, "Family sofa")
feature("Living / Family Room", "sleeper_sofa", 100, BASEMENT_Y + 120, 80, 34, "Sleeper sofa (guests)")

db.commit()
db.close()
print("Redesign geometry seeded.")
