import json
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, SessionLocal, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Basement & Garage Planner")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Stages ----------

@app.get("/stages", response_model=list[schemas.StageOut])
def list_stages(db: Session = Depends(get_db)):
    return db.query(models.Stage).order_by(models.Stage.sort_order).all()


@app.post("/stages", response_model=schemas.StageOut)
def create_stage(stage: schemas.StageCreate, db: Session = Depends(get_db)):
    obj = models.Stage(**stage.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.get("/stages/{stage_id}", response_model=schemas.StageDetail)
def get_stage(stage_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Stage, stage_id)
    if not obj:
        raise HTTPException(404, "Stage not found")
    return obj


@app.get("/stages/by-key/{key}", response_model=schemas.StageDetail)
def get_stage_by_key(key: str, db: Session = Depends(get_db)):
    obj = db.query(models.Stage).filter(models.Stage.key == key).first()
    if not obj:
        raise HTTPException(404, "Stage not found")
    return obj


# ---------- Rooms ----------

@app.post("/rooms", response_model=schemas.RoomOut)
def create_room(room: schemas.RoomCreate, db: Session = Depends(get_db)):
    obj = models.Room(**room.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.put("/rooms/{room_id}", response_model=schemas.RoomOut)
def update_room(room_id: int, room: schemas.RoomBase, db: Session = Depends(get_db)):
    obj = db.get(models.Room, room_id)
    if not obj:
        raise HTTPException(404, "Room not found")
    for k, v in room.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.patch("/rooms/{room_id}", response_model=schemas.RoomOut)
def patch_room(room_id: int, patch: schemas.RoomUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Room, room_id)
    if not obj:
        raise HTTPException(404, "Room not found")
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Room, room_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Walls ----------

@app.post("/walls", response_model=schemas.WallOut)
def create_wall(wall: schemas.WallCreate, db: Session = Depends(get_db)):
    obj = models.Wall(**wall.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.put("/walls/{wall_id}", response_model=schemas.WallOut)
def update_wall(wall_id: int, wall: schemas.WallBase, db: Session = Depends(get_db)):
    obj = db.get(models.Wall, wall_id)
    if not obj:
        raise HTTPException(404, "Wall not found")
    for k, v in wall.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/walls/{wall_id}")
def delete_wall(wall_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Wall, wall_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Openings ----------

@app.post("/openings", response_model=schemas.OpeningOut)
def create_opening(opening: schemas.OpeningCreate, db: Session = Depends(get_db)):
    obj = models.Opening(**opening.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/openings/{opening_id}")
def delete_opening(opening_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Opening, opening_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Features ----------

@app.post("/features", response_model=schemas.FeatureOut)
def create_feature(feature: schemas.FeatureCreate, db: Session = Depends(get_db)):
    obj = models.Feature(**feature.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.patch("/features/{feature_id}", response_model=schemas.FeatureOut)
def update_feature(feature_id: int, patch: schemas.FeatureUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Feature, feature_id)
    if not obj:
        raise HTTPException(404, "Feature not found")
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/features/{feature_id}")
def delete_feature(feature_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Feature, feature_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Resources ----------

@app.get("/resources", response_model=list[schemas.ResourceOut])
def list_resources(db: Session = Depends(get_db)):
    return db.query(models.Resource).order_by(models.Resource.sort_order).all()


@app.post("/resources", response_model=schemas.ResourceOut)
def create_resource(resource: schemas.ResourceCreate, db: Session = Depends(get_db)):
    obj = models.Resource(**resource.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.patch("/resources/{resource_id}", response_model=schemas.ResourceOut)
def update_resource(resource_id: int, patch: schemas.ResourceUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Resource, resource_id)
    if not obj:
        raise HTTPException(404, "Resource not found")
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/resources/{resource_id}")
def delete_resource(resource_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Resource, resource_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Price Options ----------

@app.post("/price-options", response_model=schemas.PriceOptionOut)
def create_price_option(option: schemas.PriceOptionCreate, db: Session = Depends(get_db)):
    obj = models.PriceOption(**option.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/price-options/{option_id}")
def delete_price_option(option_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.PriceOption, option_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Checklist ----------

@app.get("/checklist", response_model=list[schemas.ChecklistItemOut])
def list_checklist(db: Session = Depends(get_db)):
    return db.query(models.ChecklistItem).order_by(models.ChecklistItem.sort_order).all()


@app.post("/checklist", response_model=schemas.ChecklistItemOut)
def create_checklist_item(item: schemas.ChecklistItemCreate, db: Session = Depends(get_db)):
    obj = models.ChecklistItem(**item.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.patch("/checklist/{item_id}", response_model=schemas.ChecklistItemOut)
def update_checklist_item(item_id: int, patch: schemas.ChecklistItemUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.ChecklistItem, item_id)
    if not obj:
        raise HTTPException(404, "Checklist item not found")
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/checklist/{item_id}")
def delete_checklist_item(item_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.ChecklistItem, item_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Labor ----------

@app.get("/labor", response_model=list[schemas.LaborEntryOut])
def list_labor(db: Session = Depends(get_db)):
    return db.query(models.LaborEntry).order_by(models.LaborEntry.id).all()


@app.post("/labor", response_model=schemas.LaborEntryOut)
def create_labor(entry: schemas.LaborEntryCreate, db: Session = Depends(get_db)):
    obj = models.LaborEntry(**entry.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.patch("/labor/{entry_id}", response_model=schemas.LaborEntryOut)
def update_labor(entry_id: int, patch: schemas.LaborEntryUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.LaborEntry, entry_id)
    if not obj:
        raise HTTPException(404, "Labor entry not found")
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/labor/{entry_id}")
def delete_labor(entry_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.LaborEntry, entry_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Bank transactions ----------

@app.get("/bank-transactions", response_model=list[schemas.BankTransactionOut])
def list_bank_transactions(db: Session = Depends(get_db)):
    return db.query(models.BankTransaction).order_by(models.BankTransaction.date.desc()).all()


@app.post("/bank-transactions/bulk-import", response_model=list[schemas.BankTransactionOut])
def bulk_import_bank_transactions(rows: list[schemas.BankTransactionCreate], db: Session = Depends(get_db)):
    objs = [models.BankTransaction(**row.model_dump()) for row in rows]
    db.add_all(objs)
    db.commit()
    for obj in objs:
        db.refresh(obj)
    return objs


@app.patch("/bank-transactions/{tx_id}", response_model=schemas.BankTransactionOut)
def update_bank_transaction(tx_id: int, patch: schemas.BankTransactionUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.BankTransaction, tx_id)
    if not obj:
        raise HTTPException(404, "Bank transaction not found")
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/bank-transactions/{tx_id}")
def delete_bank_transaction(tx_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.BankTransaction, tx_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Layout presets ----------

def _feature_snapshot(db: Session, stage_id: int) -> str:
    features = db.query(models.Feature).filter(
        models.Feature.stage_id == stage_id, models.Feature.type != "pole"
    ).all()
    return json.dumps([
        {
            "room_name": f.room_name, "type": f.type, "x": f.x, "y": f.y,
            "width": f.width, "height": f.height, "rotation": f.rotation, "label": f.label,
        }
        for f in features
    ])


@app.get("/presets", response_model=list[schemas.LayoutPresetOut])
def list_presets(stage_id: int, db: Session = Depends(get_db)):
    return db.query(models.LayoutPreset).filter(models.LayoutPreset.stage_id == stage_id).all()


@app.post("/presets", response_model=schemas.LayoutPresetOut)
def create_preset(preset: schemas.LayoutPresetCreate, db: Session = Depends(get_db)):
    obj = models.LayoutPreset(
        stage_id=preset.stage_id, name=preset.name,
        features_json=_feature_snapshot(db, preset.stage_id),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.patch("/presets/{preset_id}", response_model=schemas.LayoutPresetOut)
def update_preset(preset_id: int, patch: schemas.LayoutPresetUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.LayoutPreset, preset_id)
    if not obj:
        raise HTTPException(404, "Preset not found")
    if patch.name is not None:
        obj.name = patch.name
    if patch.resave:
        obj.features_json = _feature_snapshot(db, obj.stage_id)
    db.commit()
    db.refresh(obj)
    return obj


@app.post("/presets/{preset_id}/load", response_model=list[schemas.FeatureOut])
def load_preset(preset_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.LayoutPreset, preset_id)
    if not obj:
        raise HTTPException(404, "Preset not found")
    db.query(models.Feature).filter(
        models.Feature.stage_id == obj.stage_id, models.Feature.type != "pole"
    ).delete(synchronize_session=False)
    new_features = []
    for item in json.loads(obj.features_json):
        f = models.Feature(stage_id=obj.stage_id, **item)
        db.add(f)
        new_features.append(f)
    db.commit()
    for f in new_features:
        db.refresh(f)
    pole = db.query(models.Feature).filter(
        models.Feature.stage_id == obj.stage_id, models.Feature.type == "pole"
    ).all()
    return new_features + pole


@app.delete("/presets/{preset_id}")
def delete_preset(preset_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.LayoutPreset, preset_id)
    if obj:
        db.delete(obj)
        db.commit()
    return {"ok": True}


# ---------- Static frontend (production) ----------
# Mounted last so it never shadows an API route above — only unmatched paths
# (i.e. the SPA itself and its assets) fall through to here.
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
