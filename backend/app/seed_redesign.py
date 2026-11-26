"""Populate the 'redesign' stage: staged plan for garage + basement.

Layout:
- GARAGE (front, 24'4.5" wide x 19'7" deep): garage door removed, replaced
  with a wall holding a solid wood door + double windows; 2" raised floor.
  Split by a new wall on the pole/beam line into a Music Studio (east) and
  Storage & Water Filtration (west). Pole sits 12' from the west wall and
  8' from the garage/band division line.
- BAND (transition strip): a 4'x10' Utility Room (boiler, airflow via a
  cedar folding door) beside an 8'x10' Moroccan Hammam bathroom — both
  extend 10' off the garage/band wall, well past the old 3'4" band depth.
  The bathroom is split into a Dry Zone (toilet, floating vanity + sink,
  mirror — nearest the entry on the south wall) and a Wet Hammam Zone
  (shower, heated marble bench, kurna basin — against the north wall),
  separated by a Moorish arch + steam glass partition. East of that, the
  rest of the band (what used to be a walled-off storage nook under the
  stairs plus the garage-access platform) is now one open Hallway / Stair
  Landing with no interior walls — it leads straight down into the
  Living/Family Room and up the stairs to the main house.
- BASEMENT (rear, 24'4.5" wide x 27'5" deep): Living / Family Room — built-in
  shelving on the east wall (longest unbroken wall), kid play zone in the
  back corner, family sofa + sleeper sofa, egress window on the west wall,
  mini-split (18,000 BTU). Laundry has moved upstairs — no laundry room or
  appliance feature in this stage anymore.
"""

from .database import Base, SessionLocal, engine
from . import models

Base.metadata.create_all(bind=engine)

db = SessionLocal()

stage = db.query(models.Stage).filter(models.Stage.key == "redesign").first()
if not stage:
    raise SystemExit("Run seed.py first to create the 'redesign' stage.")

# Openings have to be deleted explicitly first — a bulk Query.delete() on Wall
# bypasses the ORM-level delete-orphan cascade, so without this their Opening
# rows would be orphaned (and silently reattach to whatever wall ID gets
# reused next time this script runs).
old_wall_ids = [w.id for w in db.query(models.Wall).filter(models.Wall.stage_id == stage.id)]
db.query(models.Opening).filter(models.Opening.wall_id.in_(old_wall_ids)).delete(synchronize_session=False)
db.query(models.Room).filter(models.Room.stage_id == stage.id).delete()
db.query(models.Wall).filter(models.Wall.stage_id == stage.id).delete()
db.query(models.Feature).filter(models.Feature.stage_id == stage.id).delete()
db.commit()

FULL_W = 292.5  # 24'4.5"
GARAGE_D = 235  # 19'7"
BAND_D = 40  # 3'4" — depth of the open hallway/landing strip only
BASEMENT_D = 329  # 27'5"
TOTAL_D = GARAGE_D + BAND_D + BASEMENT_D
BAND_Y = GARAGE_D
BASEMENT_Y = GARAGE_D + BAND_D
DIVIDER_X = 144  # pole: 12' from west wall

UTILITY_W = 48  # 4'
BATHROOM_W = 96  # 8'
BATH_UTIL_W = UTILITY_W + BATHROOM_W  # 144" — lines up with the hallway starting here
BATH_UTIL_DEPTH = 120  # 10' off the garage/band wall
BATH_UTIL_BOTTOM = BAND_Y + BATH_UTIL_DEPTH  # 355
WET_ZONE_DEPTH = 48  # 4' — per the Hammam plan: Rear Wet Hammam & Daily Shower Zone
DRY_ZONE_Y = BAND_Y + WET_ZONE_DEPTH  # 283 — Dry Zone starts here, runs to BATH_UTIL_BOTTOM (6')

# ---------------- Rooms ----------------
rooms = [
    ("Storage & Water Filtration", 0, 0, DIVIDER_X, GARAGE_D, "#e6e6da",
     "Water filtration system + shelving/racking."),
    ("Music Studio", DIVIDER_X, 0, FULL_W - DIVIDER_X, GARAGE_D, "#e0d8e8",
     "Acoustic treatment on walls.",
     20, "Framing", "Garage divider wall framed (6\" stud wall)."),
    ("Utility Room", 0, BAND_Y, UTILITY_W, BATH_UTIL_DEPTH, "#dfe3e6",
     "4'x10'. Boiler. Cedar louvered bifold door into the Bathroom gives it airflow."),
    ("Wet Hammam Zone", UTILITY_W, BAND_Y, BATHROOM_W, WET_ZONE_DEPTH, "#2e8b6e",
     "4'x8' steam shower + hammam. Emerald zellige walls, heated marble bench, hand-carved "
     "marble kurna basin. Separated from the Dry Zone by a Moorish arch + steam glass partition."),
    ("Dry Zone", UTILITY_W, DRY_ZONE_Y, BATHROOM_W, BATH_UTIL_BOTTOM - DRY_ZONE_Y, "#ddc9a3",
     "6'x8' — wall-hung toilet, floating carved cedar vanity with brass vessel sink, arched "
     "Moroccan mirror. Sand Tadelakt plaster walls over Moroccan mosaic floor tile. "
     "Door in from the Living/Family Room."),
    ("Hallway / Stair Landing", BATH_UTIL_W, BAND_Y, FULL_W - BATH_UTIL_W, BAND_D, "#f2f2e9",
     "Open — no interior walls. Connects the garage door, the stairs up to the main house, "
     "and the Living/Family Room below. Used to be split into a storage closet and a platform."),
    ("Living / Family Room", 0, BASEMENT_Y, FULL_W, BASEMENT_D, "#f4ecd8",
     "Built-in shelving, kid play zone, family + sleeper sofa, mini-split (18,000 BTU). "
     "Egress window on west wall.",
     15, "Framing", "Two of three exterior walls framed (east + west, basement portion); "
     "back wall still open."),
]
for row in rooms:
    name, x, y, w, h, color, notes = row[:7]
    progress_pct, status_label, progress_note = (row[7], row[8], row[9]) if len(row) > 7 else (0, "", "")
    db.add(models.Room(stage_id=stage.id, name=name, x=x, y=y, width=w, height=h, color=color, notes=notes,
                        progress_pct=progress_pct, status_label=status_label, progress_note=progress_note))

# ---------------- Walls ----------------
def wall(x1, y1, x2, y2, wall_type="existing", notes="", build_status="planned"):
    w = models.Wall(stage_id=stage.id, x1=x1, y1=y1, x2=x2, y2=y2, wall_type=wall_type, notes=notes,
                     build_status=build_status)
    db.add(w)
    db.flush()
    return w

# Perimeter — west and east walls are split at the basement boundary so framing
# progress (item 12: two of the three basement exterior walls, the longer two,
# are already framed) can be marked on just the basement portion, not the
# garage/band portion of the same wall line.
front_wall = wall(0, 0, FULL_W, 0, notes="Garage door removed. New wall: solid wood door + double windows.")
wall(FULL_W, BASEMENT_Y, FULL_W, 0, notes="East wall — garage + band portion.")
east_wall_basement = wall(FULL_W, TOTAL_D, FULL_W, BASEMENT_Y, build_status="framed",
                           notes="East wall — basement portion. Framed.")
back_wall = wall(FULL_W, TOTAL_D, 0, TOTAL_D, notes="Back wall — not yet framed.")
wall(0, BASEMENT_Y, 0, 0, notes="West wall — garage + band portion.")
west_wall = wall(0, TOTAL_D, 0, BASEMENT_Y, build_status="framed",
                  notes="West wall — basement portion. Framed. Egress window on this segment.")

# Band interior walls — Utility Room / Bathroom block, 10' deep off the garage/band wall.
utility_bath_wall = wall(UTILITY_W, BAND_Y, UTILITY_W, BATH_UTIL_BOTTOM, "new",
                          "Utility Room / Bathroom wall — cedar louvered bifold door for boiler airflow.")
bath_util_east_wall = wall(BATH_UTIL_W, BAND_Y, BATH_UTIL_W, BATH_UTIL_BOTTOM, "new",
                            "Bathroom / Hallway wall.")
bath_util_south_wall = wall(0, BATH_UTIL_BOTTOM, BATH_UTIL_W, BATH_UTIL_BOTTOM, "new",
                             "Shared south wall for the Utility Room + Bathroom block. "
                             "Door into the Dry Zone from the Living/Family Room.")
dry_wet_divider = wall(UTILITY_W, DRY_ZONE_Y, BATH_UTIL_W, DRY_ZONE_Y, "new",
                       "Moorish arch framed down to ~82\"-84\" with a 3/8\" frameless tempered "
                       "steam glass partition (two fixed panels + hinged door) between the Dry "
                       "Zone and the Wet Hammam Zone.")

band_north_wall = wall(0, BAND_Y, FULL_W, BAND_Y, "existing")
# No walls at all east of x=144 in the band, and no wall at y=275 anywhere — the old
# storage-closet-under-the-stairs and garage-access platform are now one open
# Hallway / Stair Landing, leading straight through to the Living/Family Room.

# Garage dividing wall — framed now (item 12): 6" stud wall on the pole/beam line.
divider_wall = wall(DIVIDER_X, 0, DIVIDER_X, GARAGE_D, "new", build_status="framed",
     notes="On the pole/beam line: 12' from west wall, 8' from the garage/band division. "
     "Separates Music Studio from Storage & Water Filtration. Framed as a 6\" stud wall; "
     "has a door near the back.")
divider_wall.thickness_in = 6
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
db.add(models.Opening(wall_id=utility_bath_wall.id, type="folding_door", offset_in=45, width_in=30,
                       notes="Cedar louvered bifold door — Bathroom into Utility Room. Airflow for the boiler."))
db.add(models.Opening(wall_id=bath_util_south_wall.id, type="door", offset_in=70, width_in=30,
                       notes="Living/Family Room -> Dry Zone door."))
db.add(models.Opening(wall_id=dry_wet_divider.id, type="arch_glass", offset_in=4, width_in=88,
                       notes="96\"W x 96\"H custom steam glass enclosure: two fixed panels + a "
                       "28\"-32\" hinged door, under a Tadelakt-plastered Moorish arch."))
db.add(models.Opening(wall_id=band_north_wall.id, type="door", offset_in=265, width_in=25,
                       notes="Hallway/Stair Landing -> garage door."))
db.commit()

# ---------------- Features ----------------
def feature(room_name, ftype, x, y, w=0, h=0, label="", rotation=0):
    db.add(models.Feature(stage_id=stage.id, room_name=room_name, type=ftype, x=x, y=y,
                           width=w, height=h, label=label, rotation=rotation))

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
feature("Music Studio", "mini_split", DIVIDER_X + 15, 10, 14, 6, "Mini-split — 9,000 BTU")

feature("Utility Room", "boiler", 10, BAND_Y + 10, 20, 20, "Boiler")

# Wet Hammam Zone (y 235-283): shower against the west wall (shared with Utility),
# heated marble bench + kurna basin against the north (back) wall toward the east end.
feature("Wet Hammam Zone", "shower", UTILITY_W, BAND_Y + 20, 26, 26,
        "Steam shower — 3-way thermostatic valve, ceiling rain head, slide-bar handheld wand")
feature("Wet Hammam Zone", "heated_bench", UTILITY_W + 8, BAND_Y, 72, 18,
        "Heated white marble bench (18\"x72\")")
feature("Wet Hammam Zone", "kurna_basin", UTILITY_W + 82, BAND_Y + 3, 12, 12,
        "Hand-carved marble kurna basin + brass taps + copper tas bowl")

# Dry Zone (y 283-355): wall-hung toilet in the front-right corner (nearest the
# entry/south wall), floating cedar vanity + mirror against the east wall.
feature("Dry Zone", "toilet", UTILITY_W + 70, DRY_ZONE_Y + 42, 18, 22,
        "Wall-hung toilet, concealed in-wall carrier tank")
feature("Dry Zone", "sink", UTILITY_W + 72, DRY_ZONE_Y + 12, 20, 16,
        "42\" floating carved cedar vanity + hammered brass vessel sink")
feature("Dry Zone", "mirror", UTILITY_W + 74, DRY_ZONE_Y + 8, 16, 3,
        "Arched Moroccan mirror + perforated brass sconces")

feature("Living / Family Room", "built_in_shelving", FULL_W - 14, BASEMENT_Y + 60, 12, 168,
        "Built-in shelving along the east wall (longest unbroken wall).")
feature("Living / Family Room", "kid_zone", 15, BASEMENT_Y + BASEMENT_D - 95, 80, 80, "Kid play zone")
feature("Living / Family Room", "mini_split", FULL_W - 30, BASEMENT_Y + 8, 16, 7, "Mini-split — 18,000 BTU")

# Home-theater corner: the projection screen hangs from the structural beam
# (DIVIDER_X=144, which runs the full depth of the building), rotated 90 deg
# so its long edge runs parallel to the beam instead of across it. The
# sectional sits west of the beam facing east toward it, the ceiling
# projector sits between the two throwing its beam east across the room.
# (Rotation convention for this app's furniture meshes: 0=backrest/back faces
# north, 90=east, 180=south, 270=west — i.e. the open/forward side faces the
# opposite compass direction.)
_theater_cz = BASEMENT_Y + 145  # ~145" into the room from the north edge — shared depth for a straight sightline
feature("Living / Family Room", "projection_screen", DIVIDER_X - 40, _theater_cz - 3, 80, 6,
        "Projection screen — mounted to the beam, parallel to it", rotation=90)

feature("Living / Family Room", "sectional_sofa", 35 - 50, _theater_cz - 20, 100, 40,
        "Sectional sofa — faces the beam/projection screen", rotation=270)

feature("Living / Family Room", "projector", 90 - 7, _theater_cz - 5, 14, 10,
        "Ceiling projector — throws toward the beam-mounted screen", rotation=270)

feature("Living / Family Room", "sleeper_sofa", 230, 543, 80, 34, "Sleeper sofa (guests)", rotation=90)

db.commit()
db.close()
print("Redesign geometry seeded.")
