"""Seed stages, resource list, and master checklist.

Floor plan geometry (rooms/walls/features) is intentionally left empty here —
it gets populated from the actual hand-drawn scan once it's available, via a
separate import step, so we never guess real dimensions.
"""

from .database import Base, SessionLocal, engine
from . import models

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ---------- Stages ----------
if not db.query(models.Stage).count():
    db.add_all(
        [
            models.Stage(key="current", label="Current (unfinished)", space="combined", sort_order=0),
            models.Stage(key="redesign", label="Redesign (staged)", space="combined", sort_order=1),
        ]
    )
    db.commit()

# ---------- Resources ----------
if not db.query(models.Resource).count():
    resources = [
        # Electrical
        ("electrical", "New electric sub panel", "1", "panel", "basement", "needed",
         "Sized for basement + garage circuits (lighting, laundry, bathroom GFCI, studio power, sub panel feed from main)."),
        ("electrical", "Circuit wiring (Romex, various gauge)", "TBD", "rolls", "both", "needed",
         "Qty depends on final circuit count once electrician does load calc."),
        ("electrical", "Recessed/surface lighting fixtures", "TBD", "ea", "both", "needed", "Per finished room."),
        ("electrical", "GFCI outlets (bathroom, laundry, utility)", "4+", "ea", "basement", "needed", ""),
        ("electrical", "Dedicated studio power circuits", "2-3", "circuits", "garage", "needed",
         "Music studio (garage half): isolated/clean power runs recommended."),

        # Plumbing
        ("plumbing", "Upflush / macerating (pump-up) toilet system", "1", "kit", "basement", "needed",
         "For new bathroom where existing laundry room is."),
        ("plumbing", "Bathroom fixtures (sink, toilet surround, shower/tub if planned)", "1 set", "set", "basement", "needed", ""),
        ("plumbing", "Laundry supply/drain lines + washer box", "1", "kit", "basement", "needed",
         "New laundry location: closet under the stairs."),
        ("plumbing", "Water filtration system components", "existing/TBD", "-", "garage", "needed",
         "Stays in storage half of garage; confirm if relocating or reconnecting."),

        # Egress / windows / doors
        ("openings", "Egress window + window well kit", "1", "kit", "basement", "needed",
         "Code-required for basement living space; confirm size with Town of Newburgh code."),
        ("openings", "Double windows (garage front wall)", "1 pair", "ea", "garage", "needed", ""),
        ("openings", "Solid wood exterior door (garage front wall)", "1", "ea", "garage", "needed",
         "Replaces garage door opening."),
        ("openings", "Garage door removal / opening infill framing", "1", "job", "garage", "needed", ""),

        # Framing
        ("framing", "Framing lumber (2x4 walls)", "104", "studs (2x4x8)", "both", "needed",
         "~57 linear ft of new interior walls at 8ft height, 16\" o.c. + plates, +15% waste. "
         "Includes garage dividing wall, bathroom, laundry, utility room."),
        ("framing", "Pressure-treated bottom plates", "9", "2x4x8 boards", "both", "needed", "Slab contact, new wall runs."),
        ("framing", "Ceiling/joist blocking as needed", "TBD", "board ft", "basement", "needed", ""),

        # Insulation / drywall
        ("insulation", "Spray foam (rim joists) — IN PROGRESS", "-", "-", "basement", "in_progress", "Today's task."),
        ("insulation", "Batt insulation (basement + garage walls)", "1585", "sq ft", "both", "needed",
         "Exterior-facing wall area, R-13/R-15 kraft-faced batts."),
        ("insulation", "Ceiling insulation (band + basement)", "750", "sq ft", "basement", "needed",
         "Garage ceiling already done."),
        ("drywall", "Drywall sheets (walls)", "86", "sheets (4x8)", "both", "needed",
         "~2,499 sq ft (perimeter one side + both faces of new interior walls) + 10% waste."),
        ("drywall", "Drywall sheets (ceilings)", "26", "sheets (4x8)", "basement", "needed",
         "~750 sq ft (band + basement), garage ceiling already done, + 10% waste."),
        ("drywall", "Drywall install/finish labor (tape, mud, sand)", "-", "job", "both", "needed", ""),

        # Flooring
        ("flooring", "2\" raised subfloor system (garage)", "477", "sq ft", "garage", "needed",
         "Panels/DriCore-style raised floor over slab, garage floor area."),
        ("flooring", "Finished flooring (basement living areas)", "710", "sq ft", "basement", "needed", ""),
        ("flooring", "Finished flooring (garage, over raised floor)", "477", "sq ft", "garage", "needed", ""),
        ("flooring", "Bathroom/laundry water-resistant flooring", "130", "sq ft", "basement", "needed", ""),

        # Waterproofing (today's task)
        ("waterproofing", "Drylok masonry waterproofing paint — IN PROGRESS", "6", "5-gal pails", "basement", "in_progress",
         "Today's task: walls. ~1,585 sq ft, 2 coats, ~100 sq ft/gal/coat."),

        # Built-ins / furnishing
        ("built-ins", "Built-in shelving (largest wall)", "1 run", "job", "basement", "needed", ""),
        ("built-ins", "Kid play zone materials (flooring pad, storage)", "TBD", "-", "basement", "needed", ""),
        ("furnishing", "Family sofa", "1", "ea", "basement", "needed", ""),
        ("furnishing", "Sleeper sofa (guests)", "1", "ea", "basement", "needed", ""),

        # Studio / storage half (both in the garage)
        ("studio", "Acoustic treatment (garage music studio half)", "TBD", "-", "garage", "needed", ""),
        ("studio", "Garage dividing wall (storage/filtration vs. studio)", "1", "wall", "garage", "needed",
         "On the pole/beam line, 12' from west wall. Also carries sound isolation — consider double-stud or resilient channel."),
        ("storage", "Shelving/racking (storage half)", "TBD", "-", "garage", "needed", ""),
    ]
    for i, (category, name, qty, unit, space, status, notes) in enumerate(resources):
        db.add(
            models.Resource(
                category=category, name=name, quantity=qty, unit=unit,
                space=space, status=status, notes=notes, sort_order=i,
            )
        )
    db.commit()

# ---------- Master Checklist ----------
if not db.query(models.ChecklistItem).count():
    checklist = [
        # Approvals
        ("Approvals", "permits", "Finalize redesign plan & measurements", "Confirm dimensions from scan/on-site remeasure before submitting.", "in_progress"),
        ("Approvals", "permits", "Submit building plan to Town of Newburgh", "Includes egress window, bathroom addition, electrical sub panel, wall changes.", "not_started"),
        ("Approvals", "permits", "Town of Newburgh plan approval received", "", "not_started"),
        ("Approvals", "electrical", "Electrician review of sub panel + circuit plan", "", "not_started"),
        ("Approvals", "electrical", "Electrical permit approval", "", "not_started"),
        ("Approvals", "plumbing", "Plumbing permit approval (bathroom, laundry, upflush toilet)", "", "not_started"),

        # Prep (current tasks)
        ("Prep & Waterproofing", "waterproofing", "Drylok basement walls", "In progress today.", "in_progress"),
        ("Prep & Waterproofing", "insulation", "Spray foam rim joists", "In progress today.", "in_progress"),
        ("Prep & Waterproofing", "demo", "Remove garage door / prep opening for wall infill", "", "not_started"),
        ("Prep & Waterproofing", "demo", "Demo existing laundry room fixtures (converting to bathroom)", "", "not_started"),
        ("Prep & Waterproofing", "demo", "Clear closet under stairs (new laundry location)", "", "not_started"),

        # Structural / egress
        ("Structural & Egress", "egress", "Cut/frame egress window opening", "Coordinate with foundation contractor.", "not_started"),
        ("Structural & Egress", "egress", "Install egress window + window well", "", "not_started"),
        ("Structural & Egress", "framing", "Frame garage front wall (door + double windows)", "", "not_started"),
        ("Structural & Egress", "framing", "Install solid wood door + double windows in garage wall", "", "not_started"),
        ("Structural & Egress", "framing", "Frame garage dividing wall (storage/filtration vs. studio)", "On the pole/beam line, 12' from west wall.", "not_started"),
        ("Structural & Egress", "framing", "Frame bathroom walls", "", "not_started"),
        ("Structural & Egress", "framing", "Frame new laundry room (under-stairs closet)", "", "not_started"),
        ("Structural & Egress", "framing", "Frame/wall off utility room", "Leave access from bathroom or water heater side.", "not_started"),
        ("Structural & Egress", "flooring", "Install 2\" raised floor system in garage", "", "not_started"),

        # Rough-in
        ("Rough-In", "electrical", "Install new electric sub panel", "", "not_started"),
        ("Rough-In", "electrical", "Rough-in electrical (basement + garage circuits)", "", "not_started"),
        ("Rough-In", "electrical", "Rough-in dedicated studio circuits", "", "not_started"),
        ("Rough-In", "plumbing", "Rough-in bathroom plumbing + upflush toilet system", "", "not_started"),
        ("Rough-In", "plumbing", "Rough-in laundry supply/drain lines", "", "not_started"),
        ("Rough-In", "inspection", "Rough-in inspection (electrical + plumbing)", "", "not_started"),

        # Insulation / drywall
        ("Insulation & Drywall", "insulation", "Insulate remaining basement walls", "", "not_started"),
        ("Insulation & Drywall", "insulation", "Insulate basement ceiling/joists", "", "not_started"),
        ("Insulation & Drywall", "drywall", "Hang drywall — walls (all new rooms)", "", "not_started"),
        ("Insulation & Drywall", "drywall", "Hang drywall — ceilings", "", "not_started"),
        ("Insulation & Drywall", "drywall", "Tape, mud, sand, prime", "", "not_started"),
        ("Insulation & Drywall", "inspection", "Insulation inspection (pre-drywall)", "", "not_started"),

        # Finishes
        ("Finishes", "flooring", "Install finished flooring — basement living areas", "", "not_started"),
        ("Finishes", "flooring", "Install finished flooring — garage (over raised floor)", "", "not_started"),
        ("Finishes", "flooring", "Install water-resistant flooring — bathroom/laundry", "", "not_started"),
        ("Finishes", "bathroom", "Install bathroom fixtures + upflush toilet", "", "not_started"),
        ("Finishes", "laundry", "Install washer/dryer hookups in new laundry room", "", "not_started"),
        ("Finishes", "electrical", "Install light fixtures, switches, outlets", "", "not_started"),
        ("Finishes", "paint", "Paint all new walls/ceilings", "", "not_started"),
        ("Finishes", "trim", "Install trim, baseboards, doors", "", "not_started"),

        # Build-out / furnish
        ("Build-Out & Furnish", "built-ins", "Build built-in shelving (largest wall)", "", "not_started"),
        ("Build-Out & Furnish", "kids", "Set up kid play zone (corner)", "", "not_started"),
        ("Build-Out & Furnish", "living", "Set up family sofa + sleeper sofa area", "", "not_started"),
        ("Build-Out & Furnish", "studio", "Acoustic treatment + studio setup", "", "not_started"),
        ("Build-Out & Furnish", "storage", "Set up storage/racking + reconnect water filtration system", "", "not_started"),

        # Final
        ("Final", "inspection", "Final building inspection", "", "not_started"),
        ("Final", "inspection", "Final electrical inspection", "", "not_started"),
        ("Final", "inspection", "Certificate of occupancy / sign-off (if required)", "", "not_started"),
    ]
    for i, (phase, category, title, description, status) in enumerate(checklist):
        db.add(
            models.ChecklistItem(
                phase=phase, category=category, title=title,
                description=description, status=status, sort_order=i,
            )
        )
    db.commit()

db.close()
print("Seed complete.")
