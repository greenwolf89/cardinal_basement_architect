import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Text } from "@react-three/drei";
import { api } from "../api";
import RoomHoverCard from "./RoomHoverCard";

// Camera prop positioning alone doesn't orient the camera — point it at the
// scene explicitly on mount so there's no blank first frame.
function CameraRig({ target }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, target]);
  return null;
}

const FEATURE_COLORS = {
  pole: "#8a5a2b",
  shelving: "#7a6a53",
  boiler: "#b23b3b",
  wall_pump: "#b23b3b",
  water_heater: "#b23b3b",
  plumbing: "#3b7bb2",
  appliance: "#3b7bb2",
  built_in_shelving: "#7a6a53",
  kid_zone: "#e8a33d",
  sofa: "#6c5ce7",
  sleeper_sofa: "#7c6ce7",
  toilet: "#e9f2fa",
  sink: "#dfe9f2",
  water_filtration: "#3b7bb2",
  electric_panel: "#d9822b",
  acoustic_treatment: "#9b59b6",
  shower: "#5fb3c9",
  mini_split: "#2f9e44",
};

const PALETTE = [
  { type: "sofa", label: "Sofa", w: 80, h: 34 },
  { type: "sleeper_sofa", label: "Sleeper Sofa", w: 78, h: 34 },
  { type: "built_in_shelving", label: "Built-in Shelving", w: 60, h: 12 },
  { type: "kid_zone", label: "Kid Play Zone", w: 70, h: 70 },
  { type: "toilet", label: "Toilet", w: 16, h: 20 },
  { type: "sink", label: "Sink", w: 20, h: 15 },
  { type: "shower", label: "Walk-in Shower", w: 40, h: 32 },
  { type: "appliance", label: "Washer/Dryer", w: 30, h: 20 },
  { type: "water_filtration", label: "Water Filtration", w: 20, h: 20 },
  { type: "shelving", label: "Storage Racking", w: 15, h: 60 },
  { type: "electric_panel", label: "Electric Sub Panel", w: 15, h: 20 },
  { type: "acoustic_treatment", label: "Acoustic Panel", w: 40, h: 8 },
  { type: "boiler", label: "Boiler", w: 20, h: 20 },
  { type: "mini_split", label: "Mini-split", w: 14, h: 6 },
];

const CEILING_H = 8; // ft
const BEAM_BOTTOM = 7; // ft — clearance under the beam that bisects the house
const IN = (inches) => inches / 12; // inches -> feet

function findRoomAt(rooms, x, y) {
  const hit = rooms.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
  return hit ? hit.name : null;
}

// Split a wall into its solid box segments, leaving gaps at each opening.
function wallSegments(wall) {
  const horizontal = wall.y1 === wall.y2;
  const len = horizontal ? Math.abs(wall.x2 - wall.x1) : Math.abs(wall.y2 - wall.y1);
  const dir = horizontal ? (wall.x2 >= wall.x1 ? 1 : -1) : (wall.y2 >= wall.y1 ? 1 : -1);
  const gaps = (wall.openings || [])
    .map((op) => [Math.min(op.offset_in, op.offset_in + op.width_in), Math.max(op.offset_in, op.offset_in + op.width_in)])
    .sort((a, b) => a[0] - b[0]);
  const segments = [];
  let cursor = 0;
  for (const [gs, ge] of gaps) {
    if (gs > cursor) segments.push([cursor, gs]);
    cursor = Math.max(cursor, ge);
  }
  if (cursor < len) segments.push([cursor, len]);
  return segments.map(([s, e]) => {
    if (horizontal) {
      return { x1: wall.x1 + dir * s, y1: wall.y1, x2: wall.x1 + dir * e, y2: wall.y1 };
    }
    return { x1: wall.x1, y1: wall.y1 + dir * s, x2: wall.x1, y2: wall.y1 + dir * e };
  });
}

// Memoized — walls only change when the stage's own wall data changes, not
// when furniture is dragged elsewhere in the scene. Without this, every
// furniture commit re-rendered every wall and forced R3F to recreate their
// BufferGeometry (changed args array reference) for no actual reason.
const Wall = memo(function Wall({ wall }) {
  const thick = wall.thickness_in || 4.5;
  const framed = wall.build_status === "framed" || wall.build_status === "complete";
  const color = framed ? "#c9a876" : wall.wall_type === "new" ? "#c98a7a" : "#d8d3c7";
  return wallSegments(wall).map((seg, i) => {
    const horizontal = seg.y1 === seg.y2;
    const len = horizontal ? Math.abs(seg.x2 - seg.x1) : Math.abs(seg.y2 - seg.y1);
    if (len <= 0) return null;
    const cx = IN((seg.x1 + seg.x2) / 2), cz = IN((seg.y1 + seg.y2) / 2);
    const w = horizontal ? IN(len) : IN(thick);
    const d = horizontal ? IN(thick) : IN(len);
    return (
      <mesh key={i} position={[cx, CEILING_H / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w, CEILING_H, d]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  });
});

// Static glass pane filling a window/egress-window opening.
const WindowPane = memo(function WindowPane({ wall, opening }) {
  const horizontal = wall.y1 === wall.y2;
  const dir = horizontal ? (wall.x2 >= wall.x1 ? 1 : -1) : (wall.y2 >= wall.y1 ? 1 : -1);
  const start = opening.offset_in, end = opening.offset_in + opening.width_in;
  const mid = (start + end) / 2;
  const px = horizontal ? wall.x1 + dir * mid : wall.x1;
  const pz = horizontal ? wall.y1 : wall.y1 + dir * mid;
  const w = horizontal ? IN(opening.width_in) : IN(wall.thickness_in || 4.5);
  const d = horizontal ? IN(wall.thickness_in || 4.5) : IN(opening.width_in);
  const sillY = 2.2, headY = 6.2;
  return (
    <mesh position={[IN(px), (sillY + headY) / 2, IN(pz)]}>
      <boxGeometry args={[w, headY - sillY, d]} />
      <meshStandardMaterial color="#bfe3ff" opacity={0.45} transparent />
    </mesh>
  );
});

// A door panel hinged at the start of its opening; click to swing it open.
// The hinge group always animates rotation.y from 0 (closed) -> swing angle
// (open); the panel's wall-aligned orientation and offset are baked into the
// panel mesh itself in world-aligned axes, so the closed pose is correct on
// both horizontal and vertical walls (a group-baseline-rotation approach here
// previously got silently overwritten by the animation each frame on vertical
// walls, leaving those doors closed in the wrong pose).
const Door = memo(function Door({ wall, opening, doorId, open, onToggle }) {
  const groupRef = useRef();
  const targetAngle = open ? Math.PI * 0.42 : 0;

  useFrame(() => {
    if (!groupRef.current) return;
    const cur = groupRef.current.rotation.y;
    groupRef.current.rotation.y = cur + (targetAngle - cur) * 0.15;
  });

  const horizontal = wall.y1 === wall.y2;
  const dir = horizontal ? (wall.x2 >= wall.x1 ? 1 : -1) : (wall.y2 >= wall.y1 ? 1 : -1);
  const hingeAlong = opening.offset_in;
  const hx = horizontal ? wall.x1 + dir * hingeAlong : wall.x1;
  const hz = horizontal ? wall.y1 : wall.y1 + dir * hingeAlong;
  const doorH = 6.7, doorW = IN(opening.width_in), doorT = 0.12;
  const dx = horizontal ? dir : 0;
  const dz = horizontal ? 0 : dir;
  const panelRotY = horizontal ? 0 : Math.PI / 2;

  return (
    <group ref={groupRef} position={[IN(hx), 0, IN(hz)]}
      onClick={(e) => { e.stopPropagation(); onToggle(doorId); }}>
      <mesh position={[dx * doorW / 2, doorH / 2, dz * doorW / 2]} rotation={[0, panelRotY, 0]} castShadow>
        <boxGeometry args={[doorW, doorH, doorT]} />
        <meshStandardMaterial color="#8a5a3a" />
      </mesh>
    </group>
  );
});

// A sliding (pocket/bypass) panel — used for wide double-door openings where
// a hinged swing doesn't make sense. Slides along the wall's own direction
// instead of rotating.
const SlidingDoor = memo(function SlidingDoor({ wall, opening, doorId, open, onToggle }) {
  const panelRef = useRef();
  const slideRef = useRef(0);

  const horizontal = wall.y1 === wall.y2;
  const dir = horizontal ? (wall.x2 >= wall.x1 ? 1 : -1) : (wall.y2 >= wall.y1 ? 1 : -1);
  const hingeAlong = opening.offset_in;
  const hx = horizontal ? wall.x1 + dir * hingeAlong : wall.x1;
  const hz = horizontal ? wall.y1 : wall.y1 + dir * hingeAlong;
  const doorH = 6.7, doorW = IN(opening.width_in), doorT = 0.1;
  const dx = horizontal ? dir : 0;
  const dz = horizontal ? 0 : dir;
  const panelRotY = horizontal ? 0 : Math.PI / 2;
  const baseX = IN(hx) + (dx * doorW) / 2;
  const baseZ = IN(hz) + (dz * doorW) / 2;
  // Cap how far the panel retracts — a full doorW+ slide can overshoot past
  // this wall run into whatever room sits beyond it. Cap to a modest fraction
  // of the door width so it visibly opens without leaving its own wall.
  const maxSlide = Math.min(doorW * 0.5, IN(20));

  useFrame(() => {
    const target = open ? maxSlide : 0;
    slideRef.current += (target - slideRef.current) * 0.15;
    if (panelRef.current) {
      panelRef.current.position.set(baseX + dx * slideRef.current, doorH / 2, baseZ + dz * slideRef.current);
    }
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onToggle(doorId); }}>
      <mesh position={[baseX, doorH / 2, baseZ]} visible={false}>
        <boxGeometry args={[horizontal ? doorW : doorT * 6, doorH, horizontal ? doorT * 6 : doorW]} />
      </mesh>
      <mesh ref={panelRef} position={[baseX, doorH / 2, baseZ]} rotation={[0, panelRotY, 0]} castShadow>
        <boxGeometry args={[doorW, doorH, doorT]} />
        <meshStandardMaterial color="#8a5a3a" />
      </mesh>
    </group>
  );
});

// A folding (bifold) door — two half-width leaves hinged at opposite ends of
// the opening, folding inward in a mirrored "V" when open and meeting flush
// in the middle when closed. Used for the Utility Room door (airflow).
const FoldingDoor = memo(function FoldingDoor({ wall, opening, doorId, open, onToggle }) {
  const leafARef = useRef();
  const leafBRef = useRef();
  const targetAngle = open ? Math.PI * 0.42 : 0;

  useFrame(() => {
    if (leafARef.current) {
      const cur = leafARef.current.rotation.y;
      leafARef.current.rotation.y = cur + (targetAngle - cur) * 0.15;
    }
    if (leafBRef.current) {
      const cur = leafBRef.current.rotation.y;
      leafBRef.current.rotation.y = cur + (-targetAngle - cur) * 0.15;
    }
  });

  const horizontal = wall.y1 === wall.y2;
  const dir = horizontal ? (wall.x2 >= wall.x1 ? 1 : -1) : (wall.y2 >= wall.y1 ? 1 : -1);
  const hingeAlong = opening.offset_in;
  const hx = horizontal ? wall.x1 + dir * hingeAlong : wall.x1;
  const hz = horizontal ? wall.y1 : wall.y1 + dir * hingeAlong;
  const doorH = 6.7, doorW = IN(opening.width_in), doorT = 0.1, leafW = doorW / 2;
  const dx = horizontal ? dir : 0;
  const dz = horizontal ? 0 : dir;
  const panelRotY = horizontal ? 0 : Math.PI / 2;
  const endX = hx + (horizontal ? dir * opening.width_in : 0);
  const endZ = horizontal ? hz : hz + dir * opening.width_in;
  const midX = IN((hx + endX) / 2), midZ = IN((hz + endZ) / 2);

  return (
    <group onClick={(e) => { e.stopPropagation(); onToggle(doorId); }}>
      {/* Static hitbox spanning the whole opening — the leaves themselves rotate
          away from this screen position once open, so without this there'd be
          nothing stable left to click to close the door again. */}
      <mesh position={[midX, doorH / 2, midZ]} visible={false}>
        <boxGeometry args={[horizontal ? doorW : doorT * 6, doorH, horizontal ? doorT * 6 : doorW]} />
      </mesh>
      <group ref={leafARef} position={[IN(hx), 0, IN(hz)]}>
        <mesh position={[(dx * leafW) / 2, doorH / 2, (dz * leafW) / 2]} rotation={[0, panelRotY, 0]} castShadow>
          <boxGeometry args={[leafW, doorH, doorT]} />
          <meshStandardMaterial color="#8a5a3a" />
        </mesh>
      </group>
      <group ref={leafBRef} position={[IN(endX), 0, IN(endZ)]}>
        <mesh position={[(-dx * leafW) / 2, doorH / 2, (-dz * leafW) / 2]} rotation={[0, panelRotY, 0]} castShadow>
          <boxGeometry args={[leafW, doorH, doorT]} />
          <meshStandardMaterial color="#8a5a3a" />
        </mesh>
      </group>
    </group>
  );
});

const RoomFloor = memo(function RoomFloor({ room, onPointerMissed, onRoomSelect, onRoomHover, onRoomUnhover }) {
  const w = IN(room.width), d = IN(room.height);
  const cx = IN(room.x) + w / 2, cz = IN(room.y) + d / 2;
  return (
    // Clicking the floor directly (as opposed to missing everything) still
    // needs to clear any selected furniture — onPointerMissed here is the
    // same "deselect" callback the parent already uses for empty clicks.
    <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerMissed={onPointerMissed}
      onClick={(e) => { e.stopPropagation(); onPointerMissed?.(); onRoomSelect?.(room); }}
      onPointerMove={(e) => onRoomHover?.(room, e)}
      onPointerOut={() => onRoomUnhover?.(room)}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={room.color} />
    </mesh>
  );
});

const RoomLabel = memo(function RoomLabel({ room }) {
  const cx = IN(room.x) + IN(room.width) / 2, cz = IN(room.y) + IN(room.height) / 2;
  return (
    <Text position={[cx, 0.05, cz]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.9}
      color="#4a4a4a" anchorX="center" anchorY="middle" maxWidth={IN(room.width) - 1}>
      {room.name}
    </Text>
  );
});

// Structural beam + supporting pole, if the plan has a "pole" feature.
const BeamAndPole = memo(function BeamAndPole({ pole, maxYIn }) {
  if (!pole) return null;
  const x = IN(pole.x);
  return (
    <group>
      <mesh position={[x, BEAM_BOTTOM + 0.4, IN(maxYIn) / 2]} castShadow>
        <boxGeometry args={[0.5, 0.8, IN(maxYIn)]} />
        <meshStandardMaterial color="#6b4a30" />
      </mesh>
      <mesh position={[x, BEAM_BOTTOM / 2, IN(pole.y)]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, BEAM_BOTTOM, 16]} />
        <meshStandardMaterial color="#8a5a2b" />
      </mesh>
    </group>
  );
});

// Low-poly, recognizable-silhouette furniture — not photoreal, just "a chair is a chair".
function FurnitureMesh({ type, w, h }) {
  const color = FEATURE_COLORS[type] || "#888";
  switch (type) {
    case "sofa":
    case "sleeper_sofa":
      return (
        <group>
          <mesh position={[0, 0.7, 0]} castShadow><boxGeometry args={[w, 1.4, h]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[0, 1.5, -h / 2 + IN(4)]} castShadow>
            <boxGeometry args={[w, 1.2, IN(8)]} /><meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case "toilet":
      return (
        <group>
          <mesh position={[0, 0.7, h / 4]} castShadow><boxGeometry args={[w * 0.8, 1.4, h * 0.5]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[0, 1.6, -h / 3]} castShadow><boxGeometry args={[w * 0.7, 1.2, h * 0.3]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case "sink":
      return (
        <group>
          <mesh position={[0, 1.4, 0]} castShadow><boxGeometry args={[w, 0.15, h]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[-w / 2 + 0.1, 0.7, -h / 2 + 0.1]} castShadow><boxGeometry args={[0.15, 1.4, 0.15]} /><meshStandardMaterial color="#999" /></mesh>
        </group>
      );
    case "appliance":
      return <mesh position={[0, 1.4, 0]} castShadow><boxGeometry args={[w, 2.8, h]} /><meshStandardMaterial color={color} /></mesh>;
    case "water_filtration":
      return <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[Math.min(w, h) / 2, Math.min(w, h) / 2, 3.2, 16]} /><meshStandardMaterial color={color} /></mesh>;
    case "shelving":
    case "built_in_shelving":
      return (
        <group>
          {[0.3, 2.2, 4.1, 6.0].map((y, i) => (
            <mesh key={i} position={[0, y, 0]} castShadow><boxGeometry args={[w, 0.12, h]} /><meshStandardMaterial color={color} /></mesh>
          ))}
          <mesh position={[-w / 2 + 0.06, 3.2, 0]} castShadow><boxGeometry args={[0.12, 6.4, h]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[w / 2 - 0.06, 3.2, 0]} castShadow><boxGeometry args={[0.12, 6.4, h]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case "kid_zone":
      return (
        <group>
          <mesh position={[0, 0.1, 0]} receiveShadow><boxGeometry args={[w, 0.2, h]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[w / 2 - IN(10), 0.9, h / 2 - IN(10)]} castShadow><boxGeometry args={[IN(18), 1.6, IN(14)]} /><meshStandardMaterial color="#c0392b" /></mesh>
        </group>
      );
    case "electric_panel":
      return <mesh position={[0, 4.5, 0]} castShadow><boxGeometry args={[w, h, 0.2]} /><meshStandardMaterial color={color} /></mesh>;
    case "acoustic_treatment":
      return <mesh position={[0, 4, 0]} castShadow><boxGeometry args={[w, 3.5, h]} /><meshStandardMaterial color={color} opacity={0.85} transparent /></mesh>;
    case "boiler":
      return <mesh position={[0, 2.2, 0]} castShadow><cylinderGeometry args={[Math.min(w, h) / 2, Math.min(w, h) / 2, 4.4, 16]} /><meshStandardMaterial color={color} /></mesh>;
    case "shower":
      return (
        <group>
          <mesh position={[0, 0.05, 0]} receiveShadow><boxGeometry args={[w, 0.1, h]} /><meshStandardMaterial color="#cfd8dc" /></mesh>
          <mesh position={[0, 3.5, 0]} castShadow>
            <boxGeometry args={[w, 7, h]} /><meshStandardMaterial color={color} opacity={0.3} transparent />
          </mesh>
          <mesh position={[0, 6.6, -h / 2 + IN(3)]} castShadow><cylinderGeometry args={[0.15, 0.15, 0.4, 10]} /><meshStandardMaterial color="#999" /></mesh>
        </group>
      );
    case "mini_split":
      return (
        <group position={[0, 6.6, 0]}>
          <mesh castShadow><boxGeometry args={[w, h, IN(8)]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    default:
      return <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[w, 1.8, h]} /><meshStandardMaterial color={color} /></mesh>;
  }
}

// Memoized — dragging one piece of furniture replaces only that feature's
// object in the `features` array (see commitTransform below), so every other
// Furniture instance still receives the exact same `feature` reference and
// can skip re-rendering entirely once `onSelect` is stabilized too.
const Furniture = memo(function Furniture({ feature, selected, onSelect, orbitRef, onCommit }) {
  const groupRef = useRef();
  const wIn = feature.width || 20, hIn = feature.height || 20;
  const w = IN(wIn), h = IN(hIn);
  const cx = IN(feature.x) + w / 2, cz = IN(feature.y) + h / 2;

  return (
    <group ref={groupRef} position={[cx, 0, cz]} rotation={[0, -((feature.rotation || 0) * Math.PI) / 180, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(feature.id, groupRef); }}>
      <mesh visible={false}>
        <boxGeometry args={[w, 0.05, h]} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 0.3, h + 0.3]} />
          <meshBasicMaterial color="#ffcc66" opacity={0.35} transparent />
        </mesh>
      )}
      <FurnitureMesh type={feature.type} w={w} h={h} />
    </group>
  );
});

export default function FloorPlan3D({ stage, stageId, onFeaturesChanged, onRoomSelect }) {
  const [features, setFeatures] = useState(stage?.features || []);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("translate");
  const [openDoors, setOpenDoors] = useState(new Set());
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const groupRefs = useRef({});
  const orbitRef = useRef();
  const wrapRef = useRef(null);

  // Stable across renders (useCallback + functional setState) so the memoized
  // RoomFloor/Door/SlidingDoor/FoldingDoor components below can actually bail
  // out when a sibling piece of furniture moves, instead of re-rendering (and
  // recreating their BufferGeometry) just because these callback props got a
  // new reference.
  const deselect = useCallback(() => setSelectedId(null), []);
  const handleRoomHover = useCallback((room, e) => {
    setHoveredRoom(room);
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);
  const handleRoomUnhover = useCallback((room) => setHoveredRoom((r) => (r?.id === room.id ? null : r)), []);
  const toggleDoor = useCallback((id) => {
    setOpenDoors((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  useEffect(() => { setFeatures(stage?.features || []); setSelectedId(null); }, [stage]);

  const maxX = useMemo(() => Math.max(...(stage?.walls || []).map((w) => Math.max(w.x1, w.x2)), 0), [stage]);
  const maxY = useMemo(() => Math.max(...(stage?.walls || []).map((w) => Math.max(w.y1, w.y2)), 0), [stage]);
  const pole = useMemo(() => (stage?.features || []).find((f) => f.type === "pole"), [stage]);
  const nonPoleFeatures = features.filter((f) => f.type !== "pole");

  const doors = useMemo(() => {
    const list = [];
    for (const wall of stage?.walls || []) {
      for (const op of wall.openings || []) {
        if (op.type === "folding_door") {
          list.push({ wall, opening: op, id: op.id, kind: "folding" });
        } else if (op.type === "door" || op.type === "garage_door") {
          // Wide (double-door) openings slide instead of swinging on a hinge.
          list.push({ wall, opening: op, id: op.id, kind: op.width_in >= 48 ? "sliding" : "hinged" });
        }
      }
    }
    return list;
  }, [stage]);
  const windows = useMemo(() => {
    const list = [];
    for (const wall of stage?.walls || []) {
      for (const op of wall.openings || []) {
        if (op.type === "window" || op.type === "egress_window") list.push({ wall, opening: op, id: op.id });
      }
    }
    return list;
  }, [stage]);

  const handleSelect = useCallback((id, ref) => {
    setSelectedId(id);
    groupRefs.current[id] = ref;
  }, []);

  const commitTransform = async () => {
    const ref = groupRefs.current[selectedId];
    const feature = features.find((f) => f.id === selectedId);
    if (!ref?.current || !feature) return;
    const obj = ref.current;
    const scaleX = obj.scale.x, scaleZ = obj.scale.z;
    const widthIn = Math.max(4, (feature.width || 20) * scaleX);
    const heightIn = Math.max(4, (feature.height || 20) * scaleZ);
    obj.scale.set(1, 1, 1);
    const cx = obj.position.x, cz = obj.position.z;
    const xIn = cx * 12 - widthIn / 2;
    const yIn = cz * 12 - heightIn / 2;
    let rotation = Math.round((-obj.rotation.y * 180) / Math.PI) % 360;
    if (rotation < 0) rotation += 360;
    const room_name = findRoomAt(stage.rooms, xIn, yIn) || feature.room_name;
    const patch = { x: xIn, y: yIn, width: widthIn, height: heightIn, rotation, room_name };
    setFeatures((fs) => fs.map((f) => (f.id === selectedId ? { ...f, ...patch } : f)));
    await api.patchFeature(selectedId, patch);
  };

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
      stage_id: stageId, room_name: findRoomAt(stage.rooms, x, y), type: item.type,
      x, y, width: item.w, height: item.h, rotation: 0, label: item.label,
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
    const cur = features.find((f) => f.id === selectedId);
    if (!cur) return;
    const x = cur.x + 9, y = cur.y + 9;
    const created = await api.createFeature({
      stage_id: stageId, room_name: findRoomAt(stage.rooms, x, y) || cur.room_name, type: cur.type,
      x, y, width: cur.width, height: cur.height, rotation: cur.rotation || 0, label: cur.label,
    });
    setFeatures((fs) => [...fs, created]);
    setSelectedId(created.id);
    onFeaturesChanged?.();
  };

  if (!stage) return null;
  const centerX = IN(maxX) / 2, centerZ = IN(maxY) / 2;
  const selectedRef = selectedId ? groupRefs.current[selectedId] : null;

  return (
    <div className="editor-layout">
      <div className="editor-palette">
        <h3>Add to plan</h3>
        {PALETTE.map((item) => {
          const active = features.some((f) => f.type === item.type);
          return (
            <button key={item.type} className={`palette-item${active ? " active" : ""}`} onClick={() => toggleFeature(item)}>
              <i style={{ background: FEATURE_COLORS[item.type] }} /> {item.label}
            </button>
          );
        })}
        <button className="palette-delete" disabled={!selectedId} onClick={deleteSelected}>Delete selected</button>
        <button className="palette-rotate" disabled={!selectedId} onClick={duplicateSelected}>Duplicate</button>
        <p className="editor-hint">Click furniture to select. Click a door to open/close it.</p>

        <div className="editor-divider" />
        <div className="view-mode-toggle">
          <button className={mode === "translate" ? "active" : ""} onClick={() => setMode("translate")}>Move</button>
          <button className={mode === "rotate" ? "active" : ""} onClick={() => setMode("rotate")}>Rotate</button>
          <button className={mode === "scale" ? "active" : ""} onClick={() => setMode("scale")}>Resize</button>
        </div>
        <p className="editor-hint">Drag to orbit, scroll to zoom, right-drag to pan.</p>
      </div>

      <div className="editor-main">
        <div className="editor-canvas-wrap view-fit" ref={wrapRef}>
          <Canvas shadows camera={{ position: [centerX + IN(maxX) * 0.9, IN(maxY) * 0.55, centerZ + IN(maxY) * 0.75], fov: 45 }}>
            <CameraRig target={[centerX, 1.5, centerZ]} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[centerX + 20, 25, centerZ - 10]} intensity={0.9} castShadow />
            <mesh position={[centerX, -0.05, centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow
              onPointerMissed={deselect}>
              <planeGeometry args={[IN(maxX) + 6, IN(maxY) + 6]} />
              <meshStandardMaterial color="#f2efe6" />
            </mesh>

            {stage.rooms.map((room) => (
              <RoomFloor key={`f-${room.id}`} room={room} onPointerMissed={deselect}
                onRoomSelect={onRoomSelect} onRoomHover={handleRoomHover} onRoomUnhover={handleRoomUnhover} />
            ))}
            {stage.rooms.map((room) => <RoomLabel key={`l-${room.id}`} room={room} />)}
            {stage.walls.map((wall) => <Wall key={`w-${wall.id}`} wall={wall} />)}
            {doors.map((d) => {
              const DoorComp = d.kind === "folding" ? FoldingDoor : d.kind === "sliding" ? SlidingDoor : Door;
              return (
                <DoorComp key={`d-${d.id}`} wall={d.wall} opening={d.opening} doorId={d.id}
                  open={openDoors.has(d.id)} onToggle={toggleDoor} />
              );
            })}
            {windows.map((win) => <WindowPane key={`win-${win.id}`} wall={win.wall} opening={win.opening} />)}
            <BeamAndPole pole={pole} maxYIn={maxY} />

            {nonPoleFeatures.map((f) => (
              <Furniture key={f.id} feature={f} selected={selectedId === f.id}
                onSelect={handleSelect} orbitRef={orbitRef} />
            ))}

            {selectedId && selectedRef?.current && (
              <TransformControls
                object={selectedRef.current}
                mode={mode}
                // translate/scale: constrained to the floor plane (X/Z) — never move or
                // resize vertically. rotate: Y-axis only — furniture only turns, doesn't tip over.
                showX={mode !== "rotate"}
                showY={mode === "rotate"}
                showZ={mode !== "rotate"}
                onMouseDown={() => setOrbitEnabled(false)}
                onMouseUp={() => { setOrbitEnabled(true); commitTransform(); }}
              />
            )}

            <OrbitControls ref={orbitRef} enabled={orbitEnabled} target={[centerX, 1.5, centerZ]}
              maxPolarAngle={Math.PI / 2.05} />
          </Canvas>
          <RoomHoverCard room={hoveredRoom} x={hoverPos.x + 14} y={hoverPos.y + 14} />
        </div>
      </div>
    </div>
  );
}
