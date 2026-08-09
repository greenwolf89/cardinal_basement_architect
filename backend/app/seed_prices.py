"""Seed PriceOption rows: real researched pricing + order links per Resource.

Prices gathered live from homedepot.com, lowes.com, amazon.com, and
windowwellsupply.com in August 2026 (zip 12550 / Newburgh, NY where store-priced).
Where a resource's `quantity` is a usable number, PriceOption.price is stored
PER UNIT of the resource's own `unit` so the UI can multiply qty x price into
a total estimate. Where quantity is "TBD", price is still per-unit for reference.
"""

from .database import Base, SessionLocal, engine
from . import models

Base.metadata.create_all(bind=engine)

db = SessionLocal()

db.query(models.PriceOption).delete()
db.commit()


def price(resource_name, vendor, product_name, unit_price, unit, url, notes=""):
    resource = db.query(models.Resource).filter(models.Resource.name == resource_name).first()
    if not resource:
        print(f"WARNING: no resource named {resource_name!r}, skipping")
        return
    db.add(models.PriceOption(
        resource_id=resource.id, vendor=vendor, product_name=product_name,
        price=unit_price, unit=unit, url=url, notes=notes,
    ))


# ---------------- Electrical ----------------

price("New electric sub panel", "Home Depot",
      "Square D Homeline 125A 20-Space 40-Circuit Indoor Main Lug Load Center (HOM2040L125PC)",
      67.98, "each", "https://www.homedepot.com/p/Square-D-Homeline-125-Amp-20-Space-40-Circuit-Indoor-Main-Lug-Plug-On-Neutral-Load-Center-with-Cover-HOM2040L125PC/204836356",
      "Budget-friendly line.")
price("New electric sub panel", "Home Depot",
      "Eaton BR 125A 24-Space 48-Circuit Indoor Main Lug Loadcenter (BRP24L125)",
      93.00, "each", "https://www.homedepot.com/p/Eaton-BR-125-Amp-24-Space-48-Circuit-Indoor-Main-Lug-Loadcenter-with-Cover-BRP24L125-BRP24L125/334668655")

price("Circuit wiring (Romex, various gauge)", "Home Depot",
      "Southwire 250ft 12/2 Solid Romex SIMpull NM-B W/G Wire",
      182.18, "250ft roll", "https://homedepot.com/p/Southwire-250-ft-12-2-Solid-Romex-SIMpull-CU-NM-B-W-G-Wire-28828269/202019375",
      "Most general circuits.")
price("Circuit wiring (Romex, various gauge)", "Lowe's",
      "Southwire Romex SIMpull 250ft 12/2 NM-B W/G",
      170.05, "250ft roll", "https://www.lowes.com/pd/Southwire-Romex-SIMpull-250-ft-12-2-Non-Metallic-Wire-By-the-Roll/1193433")
price("Circuit wiring (Romex, various gauge)", "Home Depot",
      "Southwire 250ft 14/2 Romex SIMpull Solid NM-B W/G Wire",
      109.61, "250ft roll", "https://www.homedepot.com/p/Southwire-250-ft-14-2-Solid-Romex-SIMpull-CU-NM-B-W-G-Wire-28827455/100010980",
      "Lighter-duty circuits (lighting).")

price("Recessed/surface lighting fixtures", "Home Depot",
      "HALO LT 5/6in Integrated LED Recessed Retrofit Module, 4-Pack",
      6.48, "fixture", "https://www.homedepot.com/p/HALO-LT-5-6-in-Integrated-LED-Recessed-Light-Trim-Retrofit-Module-with-Baffle-Trim-5CCT-750lm-4-Pack-LT56079FS1EWHR4PK/326552789")
price("Recessed/surface lighting fixtures", "Amazon",
      "Amico 6in 5CCT LED Recessed Ceiling Light w/ Junction Box, 12-Pack",
      4.75, "fixture", "https://www.amazon.com/Amico-Ultra-Thin-Selectable-Downlight-Brightness/dp/B0919MHMJX")
price("Recessed/surface lighting fixtures", "Home Depot",
      "HALO RL56 5/6in Recessed LED Retrofit Module, Selectable CCT",
      9.99, "fixture", "https://www.homedepot.com/p/HALO-RL56-Series-5-6-inch-recessed-LED-retrofit-module-Selectable-CCT-Integrated-LED-Matte-White-600-Lumens-RL56069FSD2W1EWH/324803607")

price("GFCI outlets (bathroom, laundry, utility)", "Home Depot",
      "Leviton 20A SmartlockPro Slim GFCI Outlet, 4-Pack",
      14.73, "each", "https://www.homedepot.com/p/Leviton-20-Amp-125-Volt-Duplex-Self-Test-Slim-GFCI-Outlet-White-4-Pack-GFNT2-4W-M42-GFNT2-04W/305340194")
price("GFCI outlets (bathroom, laundry, utility)", "Home Depot",
      "Leviton 20A SmartlockPro Slim GFCI Outlet, single",
      23.48, "each", "https://www.homedepot.com/p/Leviton-20-Amp-Self-Test-SmartlockPro-Slim-Duplex-GFCI-Outlet-White-R12-GFNT2-0RW/205996739")

price("Dedicated studio power circuits", "Home Depot",
      "Square D Homeline 20A Single-Pole Breaker, 8-Pack",
      5.98, "breaker", "https://www.homedepot.com/p/Square-D-Homeline-20-Amp-Single-Pole-Circuit-Breaker-8-Pack-HOM120CP8/305300942",
      "Panel-matched to Homeline sub panel option.")
price("Dedicated studio power circuits", "Home Depot",
      "Square D Homeline 20A Single-Pole Breaker, single",
      6.98, "breaker", "https://www.homedepot.com/p/Square-D-Homeline-20-Amp-Single-Pole-Circuit-Breaker-HOM120CP/100045009")

# ---------------- Plumbing ----------------

price("Upflush / macerating (pump-up) toilet system", "Amazon",
      "750W Macerating Toilet System, 4-Inlet (budget alternative)",
      699.99, "each", "https://www.amazon.com/s?k=750W+macerating+toilet+system+4-inlet")
price("Upflush / macerating (pump-up) toilet system", "Lowe's",
      "SANIFLO Sani Access 2 Elongated Toilet + Macerating Pump, 12in Rough-In",
      1294.73, "each", "https://www.lowes.com/pd/SANIFLO-SANIACCESS2-1-El-CH/5005321465")
price("Upflush / macerating (pump-up) toilet system", "Amazon",
      "Saniflo SaniPLUS Macerating Upflush Toilet Kit, Standard Bowl",
      1396.05, "each", "https://www.amazon.com/Saniflo-SaniPLUS-Macerating-Upflush-Standard/dp/B009R95NIE")
price("Upflush / macerating (pump-up) toilet system", "Amazon",
      "Saniflo Sanibest Pro Macerating Upflush Toilet Kit, Elongated Bowl (heavy-duty)",
      1590.97, "each", "https://www.amazon.com/Saniflo-Sanibest-Pro-Macerating-Elongated/dp/B009SFZ2Q0")

price("Bathroom fixtures (sink, toilet surround, shower/tub if planned)", "Amazon",
      "24in bathroom vanity + sink + faucet combo (budget)",
      154.00, "set", "https://www.amazon.com/s?k=24+inch+bathroom+vanity+with+sink+and+faucet",
      "Vanity/sink only, no shower.")
price("Bathroom fixtures (sink, toilet surround, shower/tub if planned)", "Lowe's",
      "Style Selections Dolton 24in Vanity + Engineered Marble Top + Mirror",
      374.00, "set", "https://www.lowes.com/pd/Style-Selections-Dolton-24-in-Natural-Oak-Undermount-Single-Sink-Bathroom-Vanity-With-White-Engineered-Stone-Top-Mirror-Included/5001781607",
      "Vanity/sink only, no shower.")
price("Bathroom fixtures (sink, toilet surround, shower/tub if planned)", "Home Depot",
      "Home Decorators Doveton 24in Vanity + Engineered Marble Top",
      379.00, "set", "https://www.homedepot.com/p/Home-Decorators-Collection-Doveton-24-in-Single-Sink-Freestanding-White-Bath-Vanity-with-White-Engineered-Marble-Top-Assembled-Doveton-24W/324252515",
      "Vanity/sink only, no shower.")
price("Bathroom fixtures (sink, toilet surround, shower/tub if planned)", "Lowe's",
      "DreamLine QWALL-5 32x32 Alcove Shower Kit (base + wall + hardware)",
      807.49, "set", "https://www.lowes.com/pd/DreamLine-QWALL-5-White-2-Piece-Alcove-Shower-Kit-Common-32-in-x-32-in-Actual-32-in-x-32-in/50075705",
      "Shower/tub add-on, separate from vanity.")

price("Laundry supply/drain lines + washer box", "Home Depot",
      "Oatey Quadtro Copper Sweat Washing Machine Valve Outlet Box",
      35.34, "kit", "https://www.homedepot.com/p/Oatey-Quadtro-1-2-in-Copper-Sweat-x-3-4-in-MHT-Washing-Machine-Valves-w-Outlet-Box-and-1-4-Turn-Brass-Screw-On-Ball-Valves-1000001530/205062252")
price("Laundry supply/drain lines + washer box", "Home Depot",
      "Oatey Quadtro Push Connect Washing Machine Valve Outlet Box",
      43.00, "kit", "https://www.homedepot.com/p/Oatey-Quadtro-1-2-in-Push-Connect-x-3-4-in-MHT-Washing-Machine-Valves-1-4-Turn-with-Plastic-Outlet-Box-1000001524/317846265")
price("Laundry supply/drain lines + washer box", "Home Depot",
      "Oatey Quadtro PEX Outlet Box w/ Water Hammer Arrestor",
      66.99, "kit", "https://www.homedepot.com/p/Oatey-Quadtro-1-2-in-PEX-x-3-4-in-MHT-Washing-Machine-Valves-1-4-Turn-with-Outlet-Box-and-Water-Hammer-Arrestor-38586/320641697")

# ---------------- Openings ----------------

price("Egress window + window well kit", "Window Well Supply Co.",
      "Rockwell Egress Window Well Kit (well + window, complete)",
      2998.00, "kit", "https://windowwellsupply.com/product/rockwell-egress-window-well-kit/",
      "Complete combo, cheapest configuration.")
price("Egress window + window well kit", "Window Well Supply Co.",
      "Stonewell Egress Kit (HDPE well w/ built-in steps + window)",
      3298.00, "kit", "https://windowwellsupply.com/product/stonewell-egress-kit/",
      "Complete combo, built-in steps.")
price("Egress window + window well kit", "Home Depot",
      "TAFCO 30x60 Vinyl Casement Window + Shape Products Steel Window Well (bought separately)",
      544.27, "kit", "https://www.homedepot.com/p/TAFCO-WINDOWS-30-in-x-60-in-White-Double-Pane-Insulated-Glass-Left-Hand-Hinged-Vinyl-Casement-Window-with-Screen-VCAR3060/203426841",
      "DIY route: window $205.90 + steel well $338.37. More labor, much cheaper.")

price("Double windows (garage front wall)", "Lowe's",
      "JELD-WEN V-2500 29.5x40 Vinyl New Construction Window, pair",
      456.46, "pair", "https://www.lowes.com/search?searchTerm=JELD-WEN%20V-2500%20vinyl%20window",
      "$228.23 each x2. Search link — agent found this on a results page, not a direct product URL.")
price("Double windows (garage front wall)", "Lowe's",
      "United Window & Door PRO Series 35.75x37.5 Vinyl Double Hung, pair",
      518.00, "pair", "https://www.lowes.com/pd/United-Window-Door-Brickmould-Vinyl-Replacement-White-Double-Hung-Window-Rough-Opening-36-in-x-38-in-Actual-35-75-in-x-37-5-in/1003017174",
      "$259.00 each x2.")
price("Double windows (garage front wall)", "Lowe's",
      "RELIABILT 3201 Series 35.75x37.5 Vinyl Double Hung, pair",
      547.20, "pair", "https://www.lowes.com/pd/ReliaBilt-3201-Vinyl-Replacement-White-Exterior-Double-Hung-Window-Rough-Opening-36-in-x-37-75-in-Actual-35-75-in-x-37-5-in/3688038",
      "$273.60 each x2.")

price("Solid wood exterior door (garage front wall)", "Lowe's",
      "Greatview Doors 36x80 Wood Craftsman Unfinished Solid Core Front Door",
      1155.75, "each", "https://www.lowes.com/search?searchTerm=36%20inch%20solid%20wood%20exterior%20prehung%20door",
      "Plain, no glass. Search link — agent found this on a results page, not a direct product URL.")
price("Solid wood exterior door (garage front wall)", "Lowe's",
      "Greatview Doors 36x80 Wood 3/4 Lite Knotty Alder Unfinished Solid Core Front Door",
      1347.43, "each", "https://www.lowes.com/pd/Greatview-Doors-36-in-x-80-in-Wood-3-4-Lite-Left-Hand-Inswing-Knotty-Alder-Unfinished-Single-Front-Door-Solid-Core/5014500957",
      "With 3/4 glass lite.")
price("Solid wood exterior door (garage front wall)", "Lowe's",
      "Greatview Doors 36x80 Wood Craftsman Mahogany Stained Solid Core Front Door",
      1899.00, "each", "https://www.lowes.com/search?searchTerm=36%20inch%20solid%20wood%20exterior%20prehung%20door",
      "Premium, pre-stained. Search link — agent found this on a results page, not a direct product URL.")

# ---------------- Framing ----------------

price("Framing lumber (2x4 walls)", "Home Depot",
      "2x4x8 #2 Standard Grade SPF Precut Stud",
      4.42, "stud", "https://www.homedepot.com/p/2-in-x-4-in-x-92-5-8-in-2-Standard-Grade-SPF-Stud-230893/321711376")
price("Framing lumber (2x4 walls)", "Lowe's",
      "2x4x8 Kiln-Dried Whitewood #2 Prime Stud (buy 50+ bulk price)",
      3.56, "stud", "https://www.lowes.com/pd/2-in-x-4-in-x-8-ft-Whitewood-Pre-Cut-Stud-Common-1-5-in-x-3-5-in-Actual/1000525943",
      "Bulk price at 50+ pieces.")
price("Framing lumber (2x4 walls)", "Lowe's",
      "2x4x8 Kiln-Dried Douglas Fir #2 Stud (buy 100+ bulk price)",
      3.10, "stud", "https://www.lowes.com/pd/2-in-x-4-in-x-8-ft-Stud-Douglas-Fir-Pre-Cut-Stud-Common-1-5-in-x-3-5-in-Actual/1000028843",
      "Bulk price at 100+ pieces.")

price("Pressure-treated bottom plates", "Lowe's",
      "Severe Weather 2x4x8 #2 Prime SYP Ground Contact PT",
      4.08, "board", "https://www.lowes.com/pd/Severe-Weather-2-4-8-TC-TREATED-2-PRIME/5014119401")
price("Pressure-treated bottom plates", "Home Depot",
      "2x4x8 #2 Ground Contact PT Southern Yellow Pine",
      4.88, "board", "https://www.homedepot.com/p/2-in-x-4-in-x-8-ft-2-Ground-Contact-Pressure-Treated-Southern-Yellow-Pine-Lumber-106147/206970948")
price("Pressure-treated bottom plates", "Home Depot",
      "WeatherShield 2x4x8 #2 Prime Ground Contact PT Southern Yellow Pine",
      5.18, "board", "https://www.homedepot.com/p/WeatherShield-2-in-x-4-in-x-8-ft-2-Prime-Ground-Contact-Pressure-Treated-Southern-Yellow-Pine-Lumber-291224/301836994")

# ---------------- Insulation / Drywall ----------------

price("Batt insulation (basement + garage walls)", "Lowe's",
      "Johns Manville R-15 Wall Kraft-Faced Batt (buy 15+ bulk price)",
      0.65, "sq ft", "https://www.lowes.com/pd/R-15-Wall-Kraft-faced-Fiberglass-Batt-Insulation-67-81-sq-ft-15-in-W-x-93-in-L/3012185",
      "$44.12/bag, 67.81 sq ft/bag, bulk at 15+.")
price("Batt insulation (basement + garage walls)", "Home Depot",
      "Knauf R-13 Kraft-Faced Batt, precut for 2x4 wall",
      0.85, "sq ft", "https://www.homedepot.com/p/Knauf-Insulation-R13-Kraft-Faced-15-in-x-93-in-Precut-Fiberglass-Insulation-Batts-for-2x4-Wall-Sound-Reducing-and-USA-Made-1-Bag-505912-817235/303648160",
      "$99.00/bag, 116 sq ft/bag.")
price("Batt insulation (basement + garage walls)", "Lowe's",
      "Owens Corning R-15 Wall Kraft-Faced Batt (buy 15+ bulk price)",
      0.86, "sq ft", "https://www.lowes.com/pd/Owens-Corning-R-15-Wall-67-813-sq-ft-Kraft-Faced-Fiberglass-Batt-Insulation/1000511119",
      "$58.01/bag, 67.8 sq ft/bag, bulk at 15+.")

price("Ceiling insulation (band + basement)", "Home Depot",
      "Knauf R-30 Unfaced Roll (buy 15+ bulk price)",
      1.33, "sq ft", "https://www.homedepot.com/b/Building-Materials-Insulation-Fiberglass-Insulation/R13/Batt/N-5yc1vZbay7Z1z0utp9Z1z18jv3",
      "$36.52/roll, 27.5 sq ft/roll, bulk at 15+.")
price("Ceiling insulation (band + basement)", "Home Depot",
      "Owens Corning R-30 Unfaced Roll (buy 15+ bulk price)",
      1.33, "sq ft", "https://www.homedepot.com/p/Owens-Corning-R-30-Unfaced-Fiberglass-Insulation-Roll-15-in-x-25-ft-1-Roll-RU70/202585906",
      "$41.54/roll, 31.25 sq ft/roll, bulk at 15+.")

price("Drywall sheets (walls)", "Lowe's",
      "CertainTeed 1/2x4x8 Regular Drywall Panel",
      13.28, "sheet", "https://www.lowes.com/pd/CertainTeed-Common-1-2-in-x-4-ft-x-8-ft-Actual-0-5-in-x-4-ft-x-8-ft-Drywall-Panel/1002992798")
price("Drywall sheets (walls)", "Home Depot",
      "USG Sheetrock UltraLight 1/2x4x8 Panel (buy 34+ bulk price)",
      14.43, "sheet", "https://www.homedepot.com/p/USG-Sheetrock-Brand-1-2-in-x-4-ft-x-8-ft-USG-Sheetrock-Brand-UltraLight-Drywall-Panels-14113411708/202530243",
      "Bulk at 34+.")
price("Drywall sheets (walls)", "Home Depot",
      "USG Sheetrock UltraLight Mold Tough 1/2x4x8 Panel",
      22.38, "sheet", "https://www.homedepot.com/p/USG-Sheetrock-Brand-1-2-in-x-4-ft-x-8-ft-UltraLight-Mold-Tough-Drywall-14302111708/203768542",
      "Moisture/mold resistant, for bathroom/laundry.")

price("Drywall sheets (ceilings)", "Lowe's",
      "CertainTeed 1/2x4x8 Regular Drywall Panel",
      13.28, "sheet", "https://www.lowes.com/pd/CertainTeed-Common-1-2-in-x-4-ft-x-8-ft-Actual-0-5-in-x-4-ft-x-8-ft-Drywall-Panel/1002992798")
price("Drywall sheets (ceilings)", "Home Depot",
      "USG Sheetrock UltraLight 1/2x4x8 Panel",
      16.98, "sheet", "https://www.homedepot.com/p/USG-Sheetrock-Brand-1-2-in-x-4-ft-x-8-ft-USG-Sheetrock-Brand-UltraLight-Drywall-Panels-14113411708/202530243")

price("Drylok masonry waterproofing paint — IN PROGRESS", "Home Depot",
      "DRYLOK Original 5-gal White Flat Latex Waterproofer",
      169.00, "5-gal pail", "https://www.homedepot.com/p/DRYLOK-Original-5-gal-White-Flat-Latex-Interior-Exterior-Basement-and-Masonry-Waterproofer-832399/100204228")
price("Drylok masonry waterproofing paint — IN PROGRESS", "Lowe's",
      "DRYLOK Extreme White Flat Solid Latex Mildew-Resistant Waterproofer",
      209.00, "5-gal pail", "https://www.lowes.com/pd/DRYLOK-Extreme-White-Flat-Solid-Latex-Mildew-Resistant-Interior-Exterior-Waterproofer-5-gallon/5016179553",
      "Premium, mildew-resistant.")

# ---------------- Flooring ----------------

price("2\" raised subfloor system (garage)", "Lowe's",
      "DRIcore Subfloor Membrane Panel, 23.25x23.25in",
      1.86, "sq ft", "https://www.lowes.com/pd/DRIcore-Subfloor-membrane-panel-23-25-inch-x-23-25-inch/5019104613")
price("2\" raised subfloor system (garage)", "Home Depot",
      "DRICORE Subfloor Membrane Panel, 3/4in x 2ft x 2ft OSB",
      2.00, "sq ft", "https://www.homedepot.com/p/DRICORE-Subfloor-Membrane-Panel-3-4-in-x-2-ft-x-2-ft-Oriented-Strand-Board-FG10006/202268752")
price("2\" raised subfloor system (garage)", "Home Depot",
      "DRICORE 1in x 2ft x 2ft OSB Project Panel",
      2.50, "sq ft", "https://www.homedepot.com/p/DRICORE-1-in-x-2-ft-x-2-ft-OSB-Project-Panel-1-Pack-FG10049/329317526")

price("Finished flooring (basement living areas)", "Lowe's",
      "Style Selections Slate Oak 6-mil Waterproof Interlocking LVP",
      1.89, "sq ft", "https://www.lowes.com/pd/Style-Selections-Light-Grey-Wide-Thick-Waterproof-Interlocking-Luxury-22-17-Sq-ft/5001998697")
price("Finished flooring (basement living areas)", "Home Depot",
      "Lifeproof Sterling Oak 22 MIL Click Lock Waterproof LVP (est., not live-confirmed)",
      2.98, "sq ft", "https://www.homedepot.com/p/Lifeproof-Sterling-Oak-22-MIL-x-8-7-in-W-x-48-in-L-Click-Lock-Waterproof-Luxury-Vinyl-Plank-Flooring-20-1-sqft-case-I966106LP/309083456",
      "Price estimated from cached listing — verify before ordering.")
price("Finished flooring (basement living areas)", "Amazon",
      "Allure Wide Plank Luxury Vinyl Flooring, 9x48in, 7mm Click-Lock",
      3.91, "sq ft", "https://www.amazon.com/Gingermisu-Flooring-Installation-Waterproof-20-06sqft/dp/B0FWD97YW4")

price("Finished flooring (garage, over raised floor)", "Lowe's",
      "Style Selections Slate Oak 6-mil Waterproof Interlocking LVP",
      1.89, "sq ft", "https://www.lowes.com/pd/Style-Selections-Light-Grey-Wide-Thick-Waterproof-Interlocking-Luxury-22-17-Sq-ft/5001998697")
price("Finished flooring (garage, over raised floor)", "Home Depot",
      "Lifeproof Sterling Oak 22 MIL Click Lock Waterproof LVP (est., not live-confirmed)",
      2.98, "sq ft", "https://www.homedepot.com/p/Lifeproof-Sterling-Oak-22-MIL-x-8-7-in-W-x-48-in-L-Click-Lock-Waterproof-Luxury-Vinyl-Plank-Flooring-20-1-sqft-case-I966106LP/309083456",
      "Price estimated from cached listing — verify before ordering.")
price("Finished flooring (garage, over raised floor)", "Amazon",
      "Allure Wide Plank Luxury Vinyl Flooring, 9x48in, 7mm Click-Lock",
      3.91, "sq ft", "https://www.amazon.com/Gingermisu-Flooring-Installation-Waterproof-20-06sqft/dp/B0FWD97YW4")

price("Bathroom/laundry water-resistant flooring", "Amazon",
      "MULGREAT Peel-and-Stick Waterproof Vinyl Floor Tile",
      1.48, "sq ft", "https://www.amazon.com/dp/B0G4QJDL18")
price("Bathroom/laundry water-resistant flooring", "Home Depot",
      "Waterproof vinyl tile, various (est. range, not live-confirmed)",
      2.39, "sq ft", "https://www.homedepot.com/b/Flooring-Vinyl-Flooring-Vinyl-Tile-Flooring/Waterproof/N-5yc1vZaq27Z1z1bmdp",
      "Estimated midpoint of ~$1.49-3.29/sqft — verify before ordering.")
price("Bathroom/laundry water-resistant flooring", "Lowe's",
      "SMARTCORE Ultra by COREtec Tivoli Travertine 12-mil Waterproof Stone-Look LVT",
      3.99, "sq ft", "https://www.lowes.com/pd/SMARTCORE-Ultra-8-Piece-11-97-in-x-23-62-in-Tivoli-Travertine-Luxury-Vinyl-Plank-Flooring/1000779124")

db.commit()
db.close()
print("Price options seeded.")
