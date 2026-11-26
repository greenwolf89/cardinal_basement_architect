import { memo, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Circle, Text, Group, Transformer } from "react-konva";
import { api } from "../api";
import { formatFeetInches, formatDims } from "../format";
import RoomHoverCard from "./RoomHoverCard";
import LayoutPresets from "./LayoutPresets";

const FEATURE_COLORS = {
  pole: "#8a5a2b",
  note: "#999",
  shelving: "#7a6a53",
  boiler: "#b23b3b",
  wall_pump: "#b23b3b",
  water_heater: "#b23b3b",
  plumbing: "#3b7bb2",
  appliance: "#3b7bb2",
  egress_window: "#2f9e44",
  built_in_shelving: "#7a6a53",
  kid_zone: "#e8a33d",
  sofa: "#6c5ce7",
  sleeper_sofa: "#6c5ce7",
  toilet: "#3b7bb2",
  sink: "#3b7bb2",
  water_filtration: "#3b7bb2",
  electric_panel: "#d9822b",
  acoustic_treatment: "#9b59b6",
  shower: "#5fb3c9",
  mini_split: "#2f9e44",
  heated_bench: "#e8e2d8",
  kurna_basin: "#c9a876",
  mirror: "#aad4e8",
};

const PALETTE = [
  { type: "sofa", label: "Sofa", w: 80, h: 34 },
  { type: "sleeper_sofa", label: "Sleeper Sofa", w: 78, h: 34 },
  { type: "built_in_shelving", label: "Built-in Shelving", w: 60, h: 12 },
  { type: "kid_zone", label: "Kid Play Zone", w: 70, h: 70 },
  { type: "toilet", label: "Toilet", w: 16, h: 20 },
  { type: "sink", label: "Sink", w: 20, h: 15 },
  { type: "shower", label: "Walk-in Shower", w: 40, h: 32 },
  { type: "heated_bench", label: "Heated Bench", w: 72, h: 18 },
  { type: "kurna_basin", label: "Kurna Basin", w: 12, h: 12 },
  { type: "mirror", label: "Mirror", w: 20, h: 3 },
  { type: "appliance", label: "Washer/Dryer", w: 30, h: 20 },
  { type: "water_filtration", label: "Water Filtration", w: 20, h: 20 },
  { type: "shelving", label: "Storage Racking", w: 15, h: 60 },
  { type: "electric_panel", label: "Electric Sub Panel", w: 15, h: 20 },
  { type: "acoustic_treatment", label: "Acoustic Panel", w: 40, h: 8 },
  { type: "boiler", label: "Boiler", w: 20, h: 20 },
  { type: "mini_split", label: "Mini-split", w: 14, h: 6 },
];

const MARGIN_LEFT = 64;
const MARGIN_TOP = 44;
const PAD_RIGHT = 130;
const PAD_BOTTOM = 40;
const TITLE_H = 34;

function findRoomAt(rooms, x, y) {
  const hit = rooms.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
  return hit ? hit.name : null;
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Rooms/walls/openings/ladders/labels only change when the stage data, zoom,
// or orientation change — not on every hover/select state update (which fires
// continuously as the mouse moves over the canvas). Pulling this into its own
// memoized component means those frequent re-renders in the parent skip
// re-diffing ~100 static Konva nodes and only touch the furniture layer.
const StaticPlanLayer = memo(function StaticPlanLayer({ stage, scale, fontScale, landscape, onRoomSelect, setHoveredRoom, setHoverPos }) {
  const maxX = Math.max(...stage.walls.map((w) => Math.max(w.x1, w.x2)), 0);
  const T = (ix, iy) => (landscape ? [iy, maxX - ix] : [ix, iy]);
  const fs = (base) => Math.round(base * fontScale);
  const sp = (base) => base * fontScale;
  const sx_ = (v) => MARGIN_LEFT + v * scale;
  const sy_ = (v) => MARGIN_TOP + TITLE_H + v * scale;
  const pt = (ix, iy) => { const [rx, ry] = T(ix, iy); return { x: sx_(rx), y: sy_(ry) }; };
  const rectScreen = (x, y, w, h) => {
    const corners = [T(x, y), T(x + w, y), T(x, y + h), T(x + w, y + h)];
    const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    return { x: sx_(x0), y: sy_(y0), width: (x1 - x0) * scale, height: (y1 - y0) * scale };
  };

  const roomsByArea = [...stage.rooms].sort((a, b) => b.width * b.height - a.width * a.height);
  const yBoundaries = [...new Set(
    stage.walls.filter((w) => w.y1 === w.y2 && w.x1 !== w.x2).map((w) => w.y1)
  )].sort((a, b) => a - b);
  const depthSegments = yBoundaries
    .map((yb, i) => ({ start: i === 0 ? 0 : yBoundaries[i - 1], end: yb }))
    .filter((s) => s.end !== s.start)
    .map((s) => ({ ...s, label: formatFeetInches(s.end - s.start) }));
  const overallSpan = { start: 0, end: maxX, label: formatFeetInches(maxX) };
  const topLadderSegments = landscape ? depthSegments : [overallSpan];
  const sideLadderSegments = landscape ? [overallSpan] : depthSegments;
  const sideRy = (v) => (landscape ? sy_(maxX - v) : sy_(v));

  return (
    <>
      {/* Top dimension ladder */}
      {topLadderSegments.map((seg, i) => {
        const x1 = sx_(seg.start), x2 = sx_(seg.end);
        const y = MARGIN_TOP + TITLE_H - 10;
        return (
          <Group key={`top-${i}`}>
            <Line points={[x1, y, x2, y]} stroke="#9a9a9a" strokeWidth={1} />
            <Line points={[x1, y - 3, x1, y + 3]} stroke="#9a9a9a" strokeWidth={1} />
            <Line points={[x2, y - 3, x2, y + 3]} stroke="#9a9a9a" strokeWidth={1} />
            <Text x={Math.min(x1, x2)} y={y - sp(16)} width={Math.abs(x2 - x1)} align="center"
              text={seg.label} fontSize={fs(topLadderSegments.length > 1 ? 9 : 11)} fill="#777" />
          </Group>
        );
      })}

      {/* Side dimension ladder */}
      {sideLadderSegments.map((seg, i) => {
        const y1 = sideRy(seg.start), y2 = sideRy(seg.end);
        const ymin = Math.min(y1, y2), ymax = Math.max(y1, y2);
        const x = MARGIN_LEFT - 10;
        return (
          <Group key={`side-${i}`}>
            <Line points={[x, ymin, x, ymax]} stroke="#9a9a9a" strokeWidth={1} />
            <Line points={[x - 3, ymin, x + 3, ymin]} stroke="#9a9a9a" strokeWidth={1} />
            <Line points={[x - 3, ymax, x + 3, ymax]} stroke="#9a9a9a" strokeWidth={1} />
            <Text x={x - sp(42)} y={(ymin + ymax) / 2 - sp(6)} width={sp(30)} align="center"
              text={seg.label} fontSize={fs(10)} fill="#777" />
          </Group>
        );
      })}

      {/* Rooms (painted largest-first so smaller additions layer visibly on top) */}
      {roomsByArea.map((room) => {
        const r = rectScreen(room.x, room.y, room.width, room.height);
        return <Rect key={`r-${room.id}`} x={r.x} y={r.y} width={r.width} height={r.height}
          fill={room.color} stroke="#00000014" strokeWidth={1}
          onClick={() => onRoomSelect?.(room)} onTap={() => onRoomSelect?.(room)}
          onMouseEnter={(e) => {
            setHoveredRoom(room);
            const pos = e.target.getStage().getPointerPosition();
            if (pos) setHoverPos(pos);
          }}
          onMouseMove={(e) => {
            const pos = e.target.getStage().getPointerPosition();
            if (pos) setHoverPos(pos);
          }}
          onMouseLeave={() => setHoveredRoom((r2) => (r2?.id === room.id ? null : r2))} />;
      })}

      {/* Walls — framed walls get a solid "built lumber" tone regardless of
          wall_type, since they're no longer just a plan on paper. */}
      {stage.walls.map((wall) => {
        const p1 = pt(wall.x1, wall.y1), p2 = pt(wall.x2, wall.y2);
        const framed = wall.build_status === "framed" || wall.build_status === "complete";
        const stroke = framed ? "#b08a55" : wall.wall_type === "new" ? "#c0392b" : "#2b2b2b";
        return (
          <Line key={`w-${wall.id}`}
            points={[p1.x, p1.y, p2.x, p2.y]}
            stroke={stroke}
            strokeWidth={Math.max(2, (wall.thickness_in || 4.5) * scale * 0.5)}
            dash={!framed && wall.wall_type === "new" ? [8, 5] : undefined}
            lineCap="square"
          />
        );
      })}

      {/* Openings — offset_in is always measured along the wall starting at (x1,y1),
          in whichever direction the wall was actually drawn toward (x2,y2). The
          resulting rect is computed in plan space, then mapped to screen once. */}
      {stage.walls.flatMap((wall) => (wall.openings || []).map((op) => {
        const horizontal = wall.y1 === wall.y2;
        const isDoor = op.type === "door" || op.type === "garage_door";
        const color = op.type === "folding_door" ? "#e8d9b8"
          : op.type === "arch_glass" ? "#bfe8d8"
          : isDoor ? "#ffffff" : "#bfe3ff";
        const thick = Math.max(3 / scale, (wall.thickness_in || 4.5) * 0.6);
        let x, y, w, h;
        if (horizontal) {
          const dir = wall.x2 >= wall.x1 ? 1 : -1;
          const p1v = wall.x1 + dir * op.offset_in;
          const p2v = wall.x1 + dir * (op.offset_in + op.width_in);
          x = Math.min(p1v, p2v);
          y = wall.y1 - thick / 2;
          w = Math.abs(p2v - p1v);
          h = thick;
        } else {
          const dir = wall.y2 >= wall.y1 ? 1 : -1;
          const p1v = wall.y1 + dir * op.offset_in;
          const p2v = wall.y1 + dir * (op.offset_in + op.width_in);
          x = wall.x1 - thick / 2;
          y = Math.min(p1v, p2v);
          w = thick;
          h = Math.abs(p2v - p1v);
        }
        const r = rectScreen(x, y, w, h);
        return <Rect key={`op-${op.id}`} x={r.x} y={r.y} width={r.width} height={r.height}
          fill={color} stroke="#666" strokeWidth={0.6} />;
      }))}

      {/* Room labels, centered within the room — if a smaller room visually overlaps
          part of this room (e.g. a deepened side room painted on top), center within
          whatever's left of this room's own footprint instead. */}
      {stage.rooms.map((room, i) => {
        const r = rectScreen(room.x, room.y, room.width, room.height);
        const compact = r.width < 92 || r.height < 38;
        const cornerX = room.x + 2, cornerY = room.y + 2;
        const covering = stage.rooms.find((rm) =>
          rm.id !== room.id && rm.width * rm.height < room.width * room.height &&
          rm.x <= cornerX && rm.x + rm.width >= cornerX && rm.y <= cornerY && rm.y + rm.height > cornerY
        );
        let box = r;
        if (covering) {
          const adjY = Math.max(room.y, covering.y + covering.height);
          const adjH = Math.max(1, room.y + room.height - adjY);
          box = rectScreen(room.x, adjY, room.width, adjH);
        }
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const textW = Math.max(40, Math.min(box.width - 10, 160));
        const r7 = sp(7);
        return (
          <Group key={`lbl-${room.id}`} listening={false}>
            {compact ? (
              <>
                <Circle x={cx} y={cy} radius={r7} fill="#fff" stroke="#8a5a2b" strokeWidth={1} />
                <Text x={cx - sp(6)} y={cy - sp(5)} width={sp(12)} align="center" text={`${i + 1}`}
                  fontSize={fs(9)} fontStyle="700" fill="#8a5a2b" />
              </>
            ) : (
              <>
                <Circle x={cx} y={cy - sp(12)} radius={r7} fill="#fff" stroke="#8a5a2b" strokeWidth={1} />
                <Text x={cx - sp(6)} y={cy - sp(17)} width={sp(12)} align="center" text={`${i + 1}`}
                  fontSize={fs(9)} fontStyle="700" fill="#8a5a2b" />
                <Text x={cx - textW / 2} y={cy - sp(2)} width={textW} align="center" text={room.name}
                  fontSize={fs(12)} fontStyle="600" fill="#292929" wrap="none" ellipsis />
                <Text x={cx - textW / 2} y={cy + sp(12)} width={textW} align="center"
                  text={formatDims(room.width, room.height)}
                  fontSize={fs(10)} fill="#888" wrap="none" ellipsis />
              </>
            )}
          </Group>
        );
      })}
    </>
  );
});

export default function FloorPlanEditor({ stage, stageId, stageLabel, onFeaturesChanged, onRoomSelect }) {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const furnitureLayerRef = useRef(null);
  const shapeRefs = useRef({});
  const trRef = useRef(null);
  const [containerW, setContainerW] = useState(900);
  const [containerH, setContainerH] = useState(700);
  const [viewMode, setViewMode] = useState("fit"); // "fit" (no scroll) | "expanded" (scrollable, bigger detail)
  const [orientation, setOrientation] = useState("portrait"); // "portrait" | "landscape"
  const [features, setFeatures] = useState(stage?.features || []);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [showFurniture, setShowFurniture] = useState(true);
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  useEffect(() => { setFeatures(stage?.features || []); setSelectedId(null); }, [stage]);

  // Attach the resize/rotate Transformer to whichever shape is currently selected.
  // Deliberately not keyed on `features` — the node's live drag/transform state
  // lives in Konva itself, not in that array, so reattaching on every commit
  // (which gives `features` a new reference) only produced a visible snap
  // right after releasing a drag, with no actual benefit.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? shapeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, showFurniture]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect?.width) setContainerW(Math.max(360, rect.width));
      if (rect?.height) setContainerH(Math.max(280, rect.height));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  if (!stage) return null;

  const maxX = Math.max(...stage.walls.map((w) => Math.max(w.x1, w.x2)), 0);
  const maxY = Math.max(...stage.walls.map((w) => Math.max(w.y1, w.y2)), 0);
  const landscape = orientation === "landscape";
  const displayRot = landscape ? 90 : 0;

  // Rotation-aware coordinate system: T maps raw plan-space (ix,iy) to rotated
  // plan-space (pre-scale). In landscape this is a 90deg clockwise rotation of
  // the whole plan so the long (depth) axis runs across the screen horizontally.
  const T = (ix, iy) => (landscape ? [iy, maxX - ix] : [ix, iy]);
  const Tinv = (rx, ry) => (landscape ? [maxX - ry, rx] : [rx, ry]);
  const planW = landscape ? maxY : maxX;
  const planH = landscape ? maxX : maxY;

  const availW = containerW - MARGIN_LEFT - PAD_RIGHT;
  const availH = containerH - MARGIN_TOP - TITLE_H - PAD_BOTTOM;
  // "fit": scale so the whole plan is visible with no scrolling, however the box is sized.
  // "expanded": scale to fill the box's width for a bigger, more precise editing view (scrolls).
  const scale = viewMode === "fit"
    ? Math.max(0.3, Math.min(availW / (planW || 1), availH / (planH || 1)))
    : Math.min(4, Math.max(1.6, availW / (planW || 1)));

  // Labels/annotations scale proportionally with the plan itself, so text stays the same
  // visual size relative to the rooms whether you're fit-to-window or zoomed way in.
  const fontScale = Math.max(0.55, Math.min(1.8, scale / 2.4));
  const fs = (base) => Math.round(base * fontScale);
  const sp = (base) => base * fontScale;

  const sx_ = (v) => MARGIN_LEFT + v * scale;
  const sy_ = (v) => MARGIN_TOP + TITLE_H + v * scale;
  // Point transform: plan (ix,iy) -> screen {x,y}.
  const pt = (ix, iy) => { const [rx, ry] = T(ix, iy); return { x: sx_(rx), y: sy_(ry) }; };
  // Rect transform: plan rect (x,y,w,h) -> screen axis-aligned bounding box.
  const rectScreen = (x, y, w, h) => {
    const corners = [T(x, y), T(x + w, y), T(x, y + h), T(x + w, y + h)];
    const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    return { x: sx_(x0), y: sy_(y0), width: (x1 - x0) * scale, height: (y1 - y0) * scale };
  };
  // Inverse: screen pixel -> plan (ix,iy). Used to convert drag/resize positions back.
  const screenToPlan = (spx, spy) => {
    const rx = (spx - MARGIN_LEFT) / scale;
    const ry = (spy - MARGIN_TOP - TITLE_H) / scale;
    const [ix, iy] = Tinv(rx, ry);
    return { x: ix, y: iy };
  };

  const stageW = MARGIN_LEFT + planW * scale + PAD_RIGHT;
  const stageH = MARGIN_TOP + TITLE_H + planH * scale + PAD_BOTTOM;

  const roomsByArea = [...stage.rooms].sort((a, b) => b.width * b.height - a.width * a.height);

  const yBoundaries = [...new Set(
    stage.walls.filter((w) => w.y1 === w.y2 && w.x1 !== w.x2).map((w) => w.y1)
  )].sort((a, b) => a - b);
  const depthSegments = yBoundaries
    .map((yb, i) => ({ start: i === 0 ? 0 : yBoundaries[i - 1], end: yb }))
    .filter((s) => s.end !== s.start)
    .map((s) => ({ ...s, label: formatFeetInches(s.end - s.start) }));
  const overallSpan = { start: 0, end: maxX, label: formatFeetInches(maxX) };
  // Both "depth" (yBoundaries) and "overall width" (maxX) map directly (non-inverted) onto
  // the screen's horizontal axis regardless of orientation, given how T is defined above —
  // only the side (vertical) ladder needs an inversion in landscape mode.
  const topLadderSegments = landscape ? depthSegments : [overallSpan];
  const sideLadderSegments = landscape ? [overallSpan] : depthSegments;
  const sideRy = (v) => (landscape ? sy_(maxX - v) : sy_(v));

  const GRID = 3; // inches — furniture snaps to this grid when dragged
  const MIN_SIZE_IN = 4; // inches — smallest a furniture piece can be resized to

  const commitDrag = async (feature, centerXPx, centerYPx) => {
    const { x: cix, y: ciy } = screenToPlan(centerXPx, centerYPx);
    const xIn = Math.round((cix - feature.width / 2) / GRID) * GRID;
    const yIn = Math.round((ciy - feature.height / 2) / GRID) * GRID;
    const room_name = findRoomAt(stage.rooms, xIn, yIn) || feature.room_name;
    setFeatures((fs) => fs.map((f) => (f.id === feature.id ? { ...f, x: xIn, y: yIn, room_name } : f)));
    await api.patchFeature(feature.id, { x: xIn, y: yIn, room_name });
  };

  // The pole marker's x/y is its own point position (no top-left convention), so its
  // drag conversion skips the width/height centering math the other features use.
  const commitPoleDrag = async (feature, xPx, yPx) => {
    const { x: ix, y: iy } = screenToPlan(xPx, yPx);
    const xIn = Math.round(ix / GRID) * GRID;
    const yIn = Math.round(iy / GRID) * GRID;
    const room_name = findRoomAt(stage.rooms, xIn, yIn) || feature.room_name;
    setFeatures((fs) => fs.map((f) => (f.id === feature.id ? { ...f, x: xIn, y: yIn, room_name } : f)));
    await api.patchFeature(feature.id, { x: xIn, y: yIn, room_name });
  };

  // Resize + rotate via the Transformer handles. Konva reports size changes as a scale
  // factor on the node — bake that into width/height (in inches) and reset scale to 1.
  // The node's rotation includes the display's own orientation offset, so subtract that
  // back out before saving the feature's plan-space rotation.
  const commitTransform = async (feature, node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const widthIn = Math.max(MIN_SIZE_IN, feature.width * scaleX);
    const heightIn = Math.max(MIN_SIZE_IN, feature.height * scaleY);
    let rotation = Math.round(node.rotation() - displayRot) % 360;
    if (rotation < 0) rotation += 360;
    node.scaleX(1);
    node.scaleY(1);
    const { x: cix, y: ciy } = screenToPlan(node.x(), node.y());
    const xIn = cix - widthIn / 2;
    const yIn = ciy - heightIn / 2;
    const room_name = findRoomAt(stage.rooms, xIn, yIn) || feature.room_name;
    const patch = { x: xIn, y: yIn, width: widthIn, height: heightIn, rotation, room_name };
    setFeatures((fs) => fs.map((f) => (f.id === feature.id ? { ...f, ...patch } : f)));
    await api.patchFeature(feature.id, patch);
  };

  // Palette buttons are toggles: one click adds a single instance of that type,
  // clicking again (with one already present) removes it — never stacks duplicates.
  const toggleFeature = async (item) => {
    const existing = features.find((f) => f.type === item.type);
    if (existing) {
      await api.deleteFeature(existing.id);
      setFeatures((fs) => fs.filter((f) => f.id !== existing.id));
      if (selectedId === existing.id) setSelectedId(null);
      onFeaturesChanged?.();
      return;
    }
    const room = stage.rooms[0];
    const x = room ? room.x + 15 : 15;
    const y = room ? room.y + 15 : 15;
    const created = await api.createFeature({
      stage_id: stageId,
      room_name: findRoomAt(stage.rooms, x, y),
      type: item.type,
      x, y, width: item.w, height: item.h, rotation: 0,
      label: item.label,
    });
    setFeatures((fs) => [...fs, created]);
    onFeaturesChanged?.();
  };

  const deleteSelected = async () => {
    if (!selectedId) return;
    await api.deleteFeature(selectedId);
    setFeatures((fs) => fs.filter((f) => f.id !== selectedId));
    setSelectedId(null);
    onFeaturesChanged?.();
  };

  const duplicateSelected = async () => {
    if (!selectedId) return;
    const current = features.find((f) => f.id === selectedId);
    if (!current) return;
    const x = current.x + GRID * 3;
    const y = current.y + GRID * 3;
    const created = await api.createFeature({
      stage_id: stageId,
      room_name: findRoomAt(stage.rooms, x, y) || current.room_name,
      type: current.type,
      x, y, width: current.width, height: current.height, rotation: current.rotation || 0,
      label: current.label,
    });
    setFeatures((fs) => [...fs, created]);
    setSelectedId(created.id);
    onFeaturesChanged?.();
  };

  const rotateSelected = async () => {
    if (!selectedId) return;
    const current = features.find((f) => f.id === selectedId);
    if (!current) return;
    const rotation = ((current.rotation || 0) + 90) % 360;
    setFeatures((fs) => fs.map((f) => (f.id === selectedId ? { ...f, rotation } : f)));
    await api.patchFeature(selectedId, { rotation });
  };

  const exportPng = (withFurniture) => {
    const konvaStage = stageRef.current;
    const furnitureLayer = furnitureLayerRef.current;
    const wasVisible = furnitureLayer.visible();
    furnitureLayer.visible(withFurniture);
    konvaStage.draw();
    const dataUrl = konvaStage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
    furnitureLayer.visible(wasVisible);
    konvaStage.draw();
    const suffix = withFurniture ? "with-furniture" : "blueprint";
    downloadDataUrl(dataUrl, `${(stageLabel || "floor-plan").toLowerCase().replace(/\s+/g, "-")}-${suffix}.png`);
  };

  return (
    <div className="editor-layout">
      <div className="editor-palette">
        <h3>Add to plan</h3>
        {PALETTE.map((item) => {
          const active = features.some((f) => f.type === item.type);
          return (
            <button key={item.type} className={`palette-item${active ? " active" : ""}`}
              onClick={() => toggleFeature(item)}>
              <i style={{ background: FEATURE_COLORS[item.type] }} /> {item.label}
            </button>
          );
        })}
        <button className="palette-delete" disabled={!selectedId} onClick={deleteSelected}>
          Delete selected
        </button>
        <button className="palette-rotate" disabled={!selectedId} onClick={rotateSelected}>
          Rotate 90°
        </button>
        <button className="palette-rotate" disabled={!selectedId} onClick={duplicateSelected}>
          Duplicate
        </button>
        <p className="editor-hint">
          Click an item to add/remove it. Drag to reposition, drag a handle to resize, click to select.
        </p>

        <div className="editor-divider" />

        <div className="view-mode-toggle">
          <button className={viewMode === "fit" ? "active" : ""} onClick={() => setViewMode("fit")}>
            Fit to window
          </button>
          <button className={viewMode === "expanded" ? "active" : ""} onClick={() => setViewMode("expanded")}>
            Zoom / detail
          </button>
        </div>
        <div className="view-mode-toggle">
          <button className={!landscape ? "active" : ""} onClick={() => setOrientation("portrait")}>
            Portrait
          </button>
          <button className={landscape ? "active" : ""} onClick={() => setOrientation("landscape")}>
            Landscape
          </button>
        </div>

        <label className="furniture-toggle">
          <input type="checkbox" checked={showFurniture} onChange={(e) => setShowFurniture(e.target.checked)} />
          Show furniture layer
        </label>
        <button className="export-btn" onClick={() => exportPng(false)}>Export Blueprint (PNG)</button>
        <button className="export-btn" onClick={() => exportPng(true)}>Export with Furniture (PNG)</button>

        <LayoutPresets stageId={stageId} onLoaded={onFeaturesChanged} />
      </div>

      <div className="editor-main">
        <div className={`editor-canvas-wrap view-${viewMode}`} ref={wrapRef}>
          <Stage ref={stageRef} width={stageW} height={stageH}
            onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}>
            <Layer listening={false}>
              <Rect x={0} y={0} width={stageW} height={stageH} fill="#fbfaf7" />
              <Text x={MARGIN_LEFT} y={14} text={(stageLabel || "").toUpperCase()}
                fontSize={15} fontStyle="600" fill="#2b2b2b" letterSpacing={0.5} />
            </Layer>

            <Layer>
              <StaticPlanLayer stage={stage} scale={scale} fontScale={fontScale} landscape={landscape}
                onRoomSelect={onRoomSelect} setHoveredRoom={setHoveredRoom} setHoverPos={setHoverPos} />
            </Layer>

            <Layer ref={furnitureLayerRef} visible={showFurniture}>
              {features.map((f) => {
                if (f.type === "pole") {
                  const p = pt(f.x, f.y);
                  return (
                    <Group key={f.id} x={p.x} y={p.y} draggable
                      onClick={() => setSelectedId(f.id)}
                      onTap={() => setSelectedId(f.id)}
                      onMouseEnter={() => setHoveredId(f.id)}
                      onMouseLeave={() => setHoveredId((id) => (id === f.id ? null : id))}
                      onDragEnd={(e) => commitPoleDrag(f, e.target.x(), e.target.y())}
                    >
                      <Circle radius={5} fill={FEATURE_COLORS[f.type] || "#777"}
                        stroke={selectedId === f.id ? "#000" : "#fff"} strokeWidth={selectedId === f.id ? 1.5 : 0.8} />
                      {hoveredId === f.id && (
                        <Text text={f.label} fontSize={fs(10)} fill="#222" width={110} wrap="none" ellipsis
                          x={sp(6)} y={sp(8)} listening={false} />
                      )}
                    </Group>
                  );
                }
                const wPx = Math.max(6, (f.width || 20) * scale);
                const hPx = Math.max(6, (f.height || 20) * scale);
                const center = pt(f.x + (f.width || 20) / 2, f.y + (f.height || 20) / 2);
                return (
                  <Group key={f.id}>
                    {/* Shape: positioned/rotated/resized around its own center via the Transformer.
                        Rotation combines the feature's own rotation with the display orientation. */}
                    <Rect
                      ref={(node) => { shapeRefs.current[f.id] = node; }}
                      x={center.x} y={center.y}
                      offsetX={wPx / 2} offsetY={hPx / 2}
                      width={wPx} height={hPx}
                      rotation={(f.rotation || 0) + displayRot}
                      draggable
                      onClick={() => setSelectedId(f.id)}
                      onTap={() => setSelectedId(f.id)}
                      onMouseEnter={() => setHoveredId(f.id)}
                      onMouseLeave={() => setHoveredId((id) => (id === f.id ? null : id))}
                      onDragEnd={(e) => commitDrag(f, e.target.x(), e.target.y())}
                      onTransformEnd={(e) => commitTransform(f, e.target)}
                      fill={FEATURE_COLORS[f.type] || "#777"} opacity={0.55}
                      stroke={selectedId === f.id ? "#000" : FEATURE_COLORS[f.type] || "#777"}
                      strokeWidth={selectedId === f.id ? 2 : 1} cornerRadius={2}
                    />
                    {/* Label aligns with the shape's long axis (accounting for its own rotation
                        plus the display orientation); square-ish shapes get a normal label.
                        Only shown on hover to keep the plan uncluttered otherwise. */}
                    {hoveredId === f.id && (() => {
                      const effRot = ((f.rotation || 0) + displayRot) % 360;
                      const swapped = Math.round((((effRot % 180) + 180) % 180) / 90) === 1;
                      // Visual on-screen half-extents, accounting for the shape's actual
                      // displayed rotation — not just its stored (unrotated) width/height.
                      const visW = swapped ? hPx : wPx;
                      const visH = swapped ? wPx : hPx;
                      const tall = swapped ? f.width > f.height * 1.4 : f.height > f.width * 1.4;
                      if (tall) {
                        return (
                          <Text text={f.label || f.type} fontSize={fs(10)} fill="#222"
                            width={Math.max(40, visH - sp(4))} wrap="none" ellipsis
                            rotation={-90}
                            x={center.x + visW / 2 + sp(4)} y={center.y + visH / 2}
                            listening={false} />
                        );
                      }
                      return (
                        <Text text={f.label || f.type} fontSize={fs(10)} fill="#222" width={110} wrap="none" ellipsis
                          x={center.x - visW / 2} y={center.y + visH / 2 + sp(3)} listening={false} />
                      );
                    })()}
                  </Group>
                );
              })}
              <Transformer ref={trRef} rotateEnabled anchorSize={7} borderStroke="#000"
                boundBoxFunc={(oldBox, newBox) => (
                  newBox.width < MIN_SIZE_IN * scale || newBox.height < MIN_SIZE_IN * scale ? oldBox : newBox
                )} />
            </Layer>
          </Stage>
          <RoomHoverCard room={hoveredRoom} x={hoverPos.x + 14} y={hoverPos.y + 14} />
        </div>

        <div className="floorplan-legend">
          <span><i style={{ background: "#2b2b2b" }} /> existing wall</span>
          <span><i style={{ background: "#c0392b" }} /> new wall (planned)</span>
          <span><i style={{ background: "#b08a55" }} /> framed wall</span>
          <span><i style={{ background: "#fff", border: "1px solid #666" }} /> door</span>
          <span><i style={{ background: "#e8d9b8", border: "1px solid #666" }} /> folding door</span>
          <span><i style={{ background: "#bfe8d8", border: "1px solid #666" }} /> arch + steam glass</span>
          <span><i style={{ background: "#bfe3ff", border: "1px solid #666" }} /> window</span>
        </div>

        <div className="room-schedule">
          <h3>Room Schedule</h3>
          <table>
            <thead>
              <tr><th>#</th><th>Room</th><th>Dimensions</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {stage.rooms.map((room, i) => (
                <tr key={room.id}>
                  <td>{i + 1}</td>
                  <td>{room.name}</td>
                  <td>{formatDims(room.width, room.height)}</td>
                  <td className="notes-cell">{room.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
