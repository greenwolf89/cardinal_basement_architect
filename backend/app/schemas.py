from typing import Optional

from pydantic import BaseModel, ConfigDict


class OpeningBase(BaseModel):
    type: str
    offset_in: float
    width_in: float
    notes: str = ""


class OpeningCreate(OpeningBase):
    wall_id: int


class OpeningUpdate(BaseModel):
    type: Optional[str] = None
    offset_in: Optional[float] = None
    width_in: Optional[float] = None
    notes: Optional[str] = None


class OpeningOut(OpeningBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    wall_id: int


class WallBase(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    thickness_in: float = 4.5
    wall_type: str = "existing"
    build_status: str = "planned"
    notes: str = ""


class WallCreate(WallBase):
    stage_id: int


class WallOut(WallBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stage_id: int
    openings: list[OpeningOut] = []


class RoomBase(BaseModel):
    name: str
    x: float
    y: float
    width: float
    height: float
    color: str = "#e8e2d4"
    paint_color: str = "#f2efe6"
    notes: str = ""
    progress_pct: int = 0
    status_label: str = ""
    progress_note: str = ""


class RoomCreate(RoomBase):
    stage_id: int


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    color: Optional[str] = None
    paint_color: Optional[str] = None
    notes: Optional[str] = None
    progress_pct: Optional[int] = None
    status_label: Optional[str] = None
    progress_note: Optional[str] = None


class RoomOut(RoomBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stage_id: int


class FeatureBase(BaseModel):
    room_name: Optional[str] = None
    type: str
    x: float
    y: float
    width: float = 0
    height: float = 0
    rotation: float = 0
    label: str = ""


class FeatureCreate(FeatureBase):
    stage_id: int


class FeatureUpdate(BaseModel):
    room_name: Optional[str] = None
    type: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    rotation: Optional[float] = None
    label: Optional[str] = None


class FeatureOut(FeatureBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stage_id: int


class StageBase(BaseModel):
    key: str
    label: str
    space: str
    sort_order: int = 0


class StageCreate(StageBase):
    pass


class StageOut(StageBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class StageDetail(StageOut):
    rooms: list[RoomOut] = []
    walls: list[WallOut] = []
    features: list[FeatureOut] = []


class PriceOptionBase(BaseModel):
    vendor: str
    product_name: str
    price: float
    unit: str = "each"
    url: str = ""
    notes: str = ""
    sort_order: int = 0


class PriceOptionCreate(PriceOptionBase):
    resource_id: int


class PriceOptionOut(PriceOptionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    resource_id: int


class ResourceBase(BaseModel):
    category: str
    name: str
    quantity: str = ""
    unit: str = ""
    space: str = ""
    room_name: Optional[str] = None
    status: str = "needed"
    notes: str = ""
    sort_order: int = 0


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    quantity: Optional[str] = None
    unit: Optional[str] = None
    space: Optional[str] = None
    room_name: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None
    actual_cost: Optional[float] = None
    actual_vendor: Optional[str] = None
    purchased_at: Optional[str] = None


class ResourceOut(ResourceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    actual_cost: Optional[float] = None
    actual_vendor: Optional[str] = None
    purchased_at: Optional[str] = None
    price_options: list[PriceOptionOut] = []


class ChecklistItemBase(BaseModel):
    phase: str
    category: str = ""
    title: str
    description: str = ""
    status: str = "not_started"
    depends_on: str = ""
    room_name: Optional[str] = None
    sort_order: int = 0


class ChecklistItemCreate(ChecklistItemBase):
    pass


class ChecklistItemUpdate(BaseModel):
    phase: Optional[str] = None
    category: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    depends_on: Optional[str] = None
    room_name: Optional[str] = None
    sort_order: Optional[int] = None


class ChecklistItemOut(ChecklistItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class LaborEntryBase(BaseModel):
    person: str
    rate_per_hour: Optional[float] = None
    hours: Optional[float] = None
    flat_fee: Optional[float] = None
    date: Optional[str] = None
    task: str = ""
    room_name: Optional[str] = None
    notes: str = ""


class LaborEntryCreate(LaborEntryBase):
    pass


class LaborEntryUpdate(BaseModel):
    person: Optional[str] = None
    rate_per_hour: Optional[float] = None
    hours: Optional[float] = None
    flat_fee: Optional[float] = None
    date: Optional[str] = None
    task: Optional[str] = None
    room_name: Optional[str] = None
    notes: Optional[str] = None


class LaborEntryOut(LaborEntryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class BankTransactionBase(BaseModel):
    date: Optional[str] = None
    description: str = ""
    amount: float
    category: Optional[str] = None
    source: str = ""
    room_name: Optional[str] = None
    resource_id: Optional[int] = None
    notes: str = ""


class BankTransactionCreate(BankTransactionBase):
    pass


class BankTransactionUpdate(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    source: Optional[str] = None
    room_name: Optional[str] = None
    resource_id: Optional[int] = None
    notes: Optional[str] = None


class BankTransactionOut(BankTransactionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class LayoutPresetCreate(BaseModel):
    stage_id: int
    name: str


class LayoutPresetUpdate(BaseModel):
    name: Optional[str] = None
    resave: bool = False  # if true, overwrite features_json with the stage's current features


class LayoutPresetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stage_id: int
    name: str
    created_at: Optional[str] = None
