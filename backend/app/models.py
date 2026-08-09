from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship

from .database import Base


class Stage(Base):
    """A version of the floor plan: e.g. 'current' or 'redesign'."""

    __tablename__ = "stages"

    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True)  # "current" | "redesign"
    label = Column(String)
    space = Column(String)  # "garage" | "basement"
    sort_order = Column(Integer, default=0)

    rooms = relationship("Room", back_populates="stage", cascade="all, delete-orphan")
    walls = relationship("Wall", back_populates="stage", cascade="all, delete-orphan")
    features = relationship("Feature", back_populates="stage", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True)
    stage_id = Column(Integer, ForeignKey("stages.id"))
    name = Column(String)
    x = Column(Float)  # inches, origin top-left of space
    y = Column(Float)
    width = Column(Float)
    height = Column(Float)
    color = Column(String, default="#e8e2d4")
    notes = Column(Text, default="")

    stage = relationship("Stage", back_populates="rooms")


class Wall(Base):
    __tablename__ = "walls"

    id = Column(Integer, primary_key=True)
    stage_id = Column(Integer, ForeignKey("stages.id"))
    x1 = Column(Float)
    y1 = Column(Float)
    x2 = Column(Float)
    y2 = Column(Float)
    thickness_in = Column(Float, default=4.5)
    wall_type = Column(String, default="existing")  # existing | new | removed
    notes = Column(Text, default="")

    stage = relationship("Stage", back_populates="walls")
    openings = relationship("Opening", back_populates="wall", cascade="all, delete-orphan")


class Opening(Base):
    __tablename__ = "openings"

    id = Column(Integer, primary_key=True)
    wall_id = Column(Integer, ForeignKey("walls.id"))
    type = Column(String)  # door | window | garage_door | egress_window
    offset_in = Column(Float)  # distance from wall start (x1,y1) to opening start
    width_in = Column(Float)
    notes = Column(Text, default="")

    wall = relationship("Wall", back_populates="openings")


class Feature(Base):
    """Point/area features: pole, beam, water heater, sofa, shelving run, etc."""

    __tablename__ = "features"

    id = Column(Integer, primary_key=True)
    stage_id = Column(Integer, ForeignKey("stages.id"))
    room_name = Column(String, nullable=True)
    type = Column(String)
    x = Column(Float)
    y = Column(Float)
    width = Column(Float, default=0)
    height = Column(Float, default=0)
    rotation = Column(Float, default=0)
    label = Column(String, default="")

    stage = relationship("Stage", back_populates="features")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True)
    category = Column(String)  # electrical | plumbing | framing | drywall | insulation | flooring | fixtures | etc
    name = Column(String)
    quantity = Column(String, default="")
    unit = Column(String, default="")
    space = Column(String, default="")  # garage | basement | both
    status = Column(String, default="needed")  # needed | ordered | on_site | installed
    notes = Column(Text, default="")
    sort_order = Column(Integer, default=0)

    # Actual purchase, once bought — distinct from the researched price_options estimates below.
    actual_cost = Column(Float, nullable=True)
    actual_vendor = Column(String, nullable=True)
    purchased_at = Column(String, nullable=True)  # free-text date, e.g. "2026-08-10"

    price_options = relationship("PriceOption", back_populates="resource", cascade="all, delete-orphan")


class PriceOption(Base):
    """A researched purchase option for a Resource: one vendor's product + price + link."""

    __tablename__ = "price_options"

    id = Column(Integer, primary_key=True)
    resource_id = Column(Integer, ForeignKey("resources.id"))
    vendor = Column(String)  # "Home Depot" | "Lowe's" | "Amazon" | "Window Well Supply Co." | etc
    product_name = Column(String)
    price = Column(Float)
    unit = Column(String, default="each")  # each | per sheet | per roll | per box | per 250ft roll | ...
    url = Column(String, default="")
    notes = Column(Text, default="")
    sort_order = Column(Integer, default=0)

    resource = relationship("Resource", back_populates="price_options")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True)
    phase = Column(String)  # e.g. "Approvals", "Demo & Prep", "Rough-In", "Framing", ...
    category = Column(String, default="")
    title = Column(String)
    description = Column(Text, default="")
    status = Column(String, default="not_started")  # not_started | in_progress | blocked | done
    depends_on = Column(String, default="")  # comma-separated ChecklistItem ids
    sort_order = Column(Integer, default=0)
