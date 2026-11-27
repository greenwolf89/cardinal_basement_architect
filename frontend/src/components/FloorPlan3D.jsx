import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Text, Environment, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ACESFilmicToneMapping, DoubleSide, Plane, Quaternion, Vector2, Vector3 } from "three";
import { api } from "../api";
import RoomHoverCard from "./RoomHoverCard";
import LayoutPresets from "./LayoutPresets";
import RoomRenderPanel from "./RoomRenderPanel";

// Reusable PBR material presets, keyed by material family — the single lever
// that makes the low-poly geometry actually look like brass/glass/marble/tile
// instead of flat-colored boxes. `physical` ones use MeshPhysicalMaterial for
// clearcoat (glazed tile, polished stone) or real glass transmission;
// everything else is a tuned MeshStandardMaterial.
const MAT = {
  brass: { metalness: 1, roughness: 0.32, color: "#b08d57" },
  chrome: { metalness: 1, roughness: 0.18, color: "#d6dadd" },
  glass: { physical: true, transmission: 0.92, roughness: 0.05, thickness: 0.08, ior: 1.45, transparent: true, opacity: 0.4, color: "#eaf6f2" },
  porcelain: { physical: true, clearcoat: 0.9, clearcoatRoughness: 0.08, roughness: 0.15, color: "#f5f3ee" },
  marble: { physical: true, clearcoat: 0.6, clearcoatRoughness: 0.25, roughness: 0.3, color: "#f1ede6" },
  zellige: { physical: true, clearcoat: 0.85, clearcoatRoughness: 0.12, roughness: 0.28, color: "#1f7a5c" },
  tadelakt: { roughness: 0.78, color: "#d8c6a0" },
  cedar: { roughness: 0.55, color: "#8a5a3a" },
  concrete: { roughness: 0.92, color: "#c9c4ba" },
  fabric: { roughness: 0.88 },
  wood: { roughness: 0.5, color: "#7a5a3a" },
};

function Mat({ kind, color, ...rest }) {
  const m = MAT[kind] || {};
  const finalColor = color || m.color || "#888";
  if (m.physical) {
    return (
      <meshPhysicalMaterial color={finalColor} roughness={m.roughness} metalness={m.metalness || 0}
        clearcoat={m.clearcoat} clearcoatRoughness={m.clearcoatRoughness}
        transmission={m.transmission} thickness={m.thickness} ior={m.ior}
        transparent={m.transparent} opacity={m.opacity ?? 1}
        // Transmission materials (glass) are invisible from their back face by
        // default — fine for a pane only ever seen from one side, wrong for
        // anything viewable from outside the building or either side of a
        // partition, where it rendered as a flat black gap instead of glass.
        side={DoubleSide} {...rest} />
    );
  }
  return <meshStandardMaterial color={finalColor} roughness={m.roughness ?? 0.6} metalness={m.metalness ?? 0} {...rest} />;
}

// Per-room floor finish — keyword-matched against the room name so new rooms
// get a sensible default without needing an explicit material field.
function floorMaterialFor(room) {
  const name = room.name.toLowerCase();
  if (name.includes("wet hammam") || name.includes("shower")) return { kind: "zellige" };
  if (name.includes("dry zone") || name.includes("bathroom")) return { kind: "tadelakt", color: "#e3d2ad" };
  if (name.includes("utility") || name.includes("storage") || name.includes("garage")) return { kind: "concrete" };
  if (name.includes("studio")) return { kind: "wood", color: "#6b4a30" };
  return { kind: "wood", color: room.color };
}

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

const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const GRID_FT = 3 / 12; // 3" grid snap, matching the 2D editor

// Lives inside <Canvas> (needs camera/raycaster from useThree) and drives the
// direct click-and-drag-to-move interaction — replacing the old
// grab-the-gizmo-arrow translate flow, which was the main source of "hard to
// drag" complaints. Pointer-down on a furniture piece (in Move mode) seeds
// `dragStateRef`; this component tracks window-level pointermove/up so the
// drag keeps working even once the cursor leaves the piece's own screen
// footprint, mutating the object's position imperatively (no React re-render
// mid-drag, same perf pattern as the door-swing animations) with a live grid
// snap, and reports the final position back via `onDragEnd` on release.
function DragController({ groupRefs, dragStateRef, setOrbitEnabled, onDragEnd, wallSegments }) {
  const { camera, raycaster, gl } = useThree();

  useEffect(() => {
    const groundPoint = (clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const pt = new Vector3();
      return raycaster.ray.intersectPlane(GROUND_PLANE, pt) ? pt : null;
    };

    const handleMove = (e) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 4) drag.moved = true;
      if (!drag.moved) return;
      const pt = groundPoint(e.clientX, e.clientY);
      if (!pt) return;
      const ref = groupRefs.current[drag.id];
      if (!ref?.current) return;
      const snappedXFt = Math.round((pt.x + drag.offsetX) / GRID_FT) * GRID_FT;
      const snappedZFt = Math.round((pt.z + drag.offsetZ) / GRID_FT) * GRID_FT;
      // Collision/snap math happens in inches (matching wall coordinates).
      const { x, z } = clampToWalls(snappedXFt * 12, snappedZFt * 12, drag.wIn, drag.hIn, wallSegments);
      ref.current.position.x = x / 12;
      ref.current.position.z = z / 12;
    };

    const handleUp = () => {
      const drag = dragStateRef.current;
      setOrbitEnabled(true);
      if (drag?.moved) onDragEnd(drag.id);
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [camera, raycaster, gl, groupRefs, dragStateRef, onDragEnd, setOrbitEnabled, wallSegments]);

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
  heated_bench: "#e8e2d8",
  kurna_basin: "#c9a876",
  mirror: "#aad4e8",
  projection_screen: "#e8e6e0",
  sectional_sofa: "#5b4bd6",
  projector: "#2b2b2b",
};

const PALETTE = [
  { type: "sofa", label: "Sofa", w: 80, h: 34 },
  { type: "sleeper_sofa", label: "Sleeper Sofa", w: 78, h: 34 },
  { type: "sectional_sofa", label: "Sectional Sofa", w: 100, h: 40 },
  { type: "built_in_shelving", label: "Built-in Shelving", w: 60, h: 12 },
  { type: "kid_zone", label: "Kid Play Zone (Loft)", w: 72, h: 96 },
  { type: "projection_screen", label: "Projection Screen", w: 80, h: 6 },
  { type: "projector", label: "Ceiling Projector", w: 14, h: 10 },
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

const CEILING_H = 8; // ft
const BEAM_BOTTOM = 7; // ft — clearance under the beam that bisects the house
const IN = (inches) => inches / 12; // inches -> feet

// Wall/furniture collision treats everything as axis-aligned, so a piece
// rotated to roughly face east/west needs its stored width/height swapped to
// get a true world-aligned half-extent. A 20deg tolerance (not an exact-90
// check) because free-rotated furniture from dragging the TransformControls
// gizmo lands at angles like 272 or 358, not a clean 270 or 0 — those are
// still clearly "facing sideways" for collision purposes, not "facing
// forward," and should be swapped the same as an exact 90/270.
function isRot90(rotation) {
  return Math.abs(((rotation || 0) % 180) - 90) < 20;
}

function findRoomObjAt(rooms, x, y) {
  return rooms.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) || null;
}

function findRoomAt(rooms, x, y) {
  return findRoomObjAt(rooms, x, y)?.name || null;
}

// Keyword hints for where a palette item should land when first added — without
// this, every new piece defaulted to stage.rooms[0] (whichever room happens to
// be first), which is how a sofa/projection screen ended up seeded into the
// Storage & Water Filtration room instead of the Living/Family Room.
const DEFAULT_ROOM_HINTS = {
  sofa: ["living", "family"], sleeper_sofa: ["living", "family"], sectional_sofa: ["living", "family"],
  projection_screen: ["living", "family"], projector: ["living", "family"],
  built_in_shelving: ["living", "family"], kid_zone: ["living", "family"], mini_split: ["living", "family"],
  toilet: ["dry zone"], sink: ["dry zone"], mirror: ["dry zone"],
  shower: ["wet hammam"], heated_bench: ["wet hammam"], kurna_basin: ["wet hammam"],
  boiler: ["utility"], appliance: ["utility"],
  water_filtration: ["storage"], shelving: ["storage"], electric_panel: ["storage"],
  acoustic_treatment: ["studio"],
};

function pickDefaultRoom(rooms, type) {
  for (const hint of DEFAULT_ROOM_HINTS[type] || []) {
    const match = rooms.find((r) => r.name.toLowerCase().includes(hint));
    if (match) return match;
  }
  return rooms[0];
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

// Flattens every wall's solid (post-opening-gap) segments into a simple list
// for drag collision — doorway/window gaps are intentionally excluded so you
// can still carry furniture through an opening, only solid wall blocks it.
function collectSolidWallSegments(walls) {
  const out = [];
  for (const wall of walls || []) {
    const thickness = wall.thickness_in || 4.5;
    for (const seg of wallSegments(wall)) {
      const horizontal = seg.y1 === seg.y2;
      if (horizontal) {
        out.push({ horizontal: true, x1: seg.x1, x2: seg.x2, y: seg.y1, thickness });
      } else {
        out.push({ horizontal: false, y1: seg.y1, y2: seg.y2, x: seg.x1, thickness });
      }
    }
  }
  return out;
}

const WALL_SNAP_IN = 8; // inches — how close before furniture snaps flush against a wall
const CLICK_SLOP_PX = 6; // pixels — pointerdown/up closer than this counts as a click, not a drag/orbit

// Clamps a candidate center position (inches, plan space) so the furniture's
// axis-aligned footprint can't pass through any solid wall segment, and snaps
// flush against one once within WALL_SNAP_IN. Stateless — which side counts
// as "inside" is decided fresh each call from the CURRENT proposed position
// (nearest side wins), not from where the object was a frame ago. An earlier
// version tracked a "previous side" across frames so a wall couldn't be
// crossed by one big jump, but that meant any object that ever ended up on
// the wrong side of a wall (a fast drag, or just being placed there) got
// permanently stuck — every later drag re-derived "inside" from that same
// bad side and pushed it right back. This version can't get stuck: a piece
// sitting on the "wrong" side is simply snapped to the nearest face of that
// side instead, and remains fully draggable back across next time it's
// within the wall's own thickness, which is the one case that still can't be
// told apart from "approaching from the other side."
function clampToWalls(xIn, zIn, wIn, hIn, segments) {
  let x = xIn, z = zIn;
  const halfW = wIn / 2, halfH = hIn / 2;
  for (const seg of segments) {
    const ht = seg.thickness / 2;
    if (seg.horizontal) {
      const segX0 = Math.min(seg.x1, seg.x2), segX1 = Math.max(seg.x1, seg.x2);
      if (x + halfW < segX0 || x - halfW > segX1) continue;
      if (z + halfH < seg.y - ht - WALL_SNAP_IN || z - halfH > seg.y + ht + WALL_SNAP_IN) continue;
      const northLimit = seg.y - ht - halfH, southLimit = seg.y + ht + halfH;
      z = Math.abs(z - northLimit) <= Math.abs(z - southLimit) ? northLimit : southLimit;
    } else {
      const segY0 = Math.min(seg.y1, seg.y2), segY1 = Math.max(seg.y1, seg.y2);
      if (z + halfH < segY0 || z - halfH > segY1) continue;
      if (x + halfW < seg.x - ht - WALL_SNAP_IN || x - halfW > seg.x + ht + WALL_SNAP_IN) continue;
      const westLimit = seg.x - ht - halfW, eastLimit = seg.x + ht + halfW;
      x = Math.abs(x - westLimit) <= Math.abs(x - eastLimit) ? westLimit : eastLimit;
    }
  }
  return { x, z };
}

// Converts a wall segment (thin, axis-aligned, with thickness) into a plain
// axis-aligned box in inches — used by the walk-mode player collider, which
// (unlike furniture dragging) can approach a wall from any angle, so a
// closest-point circle-vs-box check is more robust than the nearest-side
// snap above.
function wallBoxFor(seg) {
  const ht = seg.thickness / 2;
  if (seg.horizontal) {
    return { x0: Math.min(seg.x1, seg.x2), x1: Math.max(seg.x1, seg.x2), z0: seg.y - ht, z1: seg.y + ht };
  }
  return { x0: seg.x - ht, x1: seg.x + ht, z0: Math.min(seg.y1, seg.y2), z1: Math.max(seg.y1, seg.y2) };
}

// Pushes a circle (the walking player, in inches) out of any box it's
// penetrating, along the shortest escape vector. Used for both walls and
// furniture in walk mode.
function resolveCircleVsBoxes(x, z, radius, boxes) {
  for (const b of boxes) {
    const closestX = Math.max(b.x0, Math.min(x, b.x1));
    const closestZ = Math.max(b.z0, Math.min(z, b.z1));
    const dx = x - closestX, dz = z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const push = radius - dist;
      x += (dx / dist) * push;
      z += (dz / dist) * push;
    }
  }
  return { x, z };
}

const WALK_SPEED_FTPS = 9; // ft/sec
const WALK_RADIUS_IN = 10; // inches — player collision radius
const EYE_HEIGHT_FT = 5.5; // a 6ft person's eyes sit at roughly 93% of height
const LOOK_SENSITIVITY = 0.0045;
// The orbit camera uses a 45deg FOV, which reads as a telephoto/zoomed-in
// view up close — fine from a distance orbiting overhead, but claustrophobic
// and "too zoomed" when standing inside a room at eye height. ~75deg is much
// closer to ordinary human vision.
const WALK_FOV = 75;

// First-person walkthrough: click-and-drag to look (same gesture as orbit,
// so it feels like the same tool rather than a different mini-app), WASD/
// arrows to move, Escape (or the Exit button) to leave. An earlier version
// used Pointer Lock (click once to capture the mouse, move freely) — more
// standard for FPS games, but it meant look-around didn't work at all until
// that first click registered, silently failed if the browser denied the
// lock, and behaved nothing like the drag-to-orbit gesture already used
// everywhere else in this view, which read as "rotation doesn't work
// right." Drag-to-look has none of those failure modes. Lives alongside
// OrbitControls rather than replacing it — only one is active at a time,
// chosen by the Orbit/Walk toggle. Movement and collision both work in
// inches (matching wall/feature coordinates), converting to feet only when
// writing to the camera.
function WalkControls({ active, wallBoxes, furnitureBoxes, startPos, onExit }) {
  const { camera, gl } = useThree();
  const yawRef = useRef(startPos.yaw || 0);
  const pitchRef = useRef(0);
  const posRef = useRef({ x: startPos.x, z: startPos.z }); // inches
  const keysRef = useRef({});
  const dragRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    camera.rotation.order = "YXZ";
    posRef.current = { x: startPos.x, z: startPos.z };
    yawRef.current = startPos.yaw || 0;
    pitchRef.current = 0;
    camera.position.set(IN(posRef.current.x), EYE_HEIGHT_FT, IN(posRef.current.z));
    camera.rotation.set(0, yawRef.current, 0);
    const originalFov = camera.fov;
    camera.fov = WALK_FOV;
    camera.updateProjectionMatrix();

    const dom = gl.domElement;
    const onPointerDown = (e) => { dragRef.current = { x: e.clientX, y: e.clientY }; };
    const onPointerMove = (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      dragRef.current = { x: e.clientX, y: e.clientY };
      yawRef.current -= dx * LOOK_SENSITIVITY;
      pitchRef.current = Math.max(-1.3, Math.min(1.3, pitchRef.current - dy * LOOK_SENSITIVITY));
    };
    const onPointerUp = () => { dragRef.current = null; };
    const onKeyDown = (e) => {
      keysRef.current[e.code] = true;
      if (e.code === "Escape") onExit?.();
    };
    const onKeyUp = (e) => { keysRef.current[e.code] = false; };

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      keysRef.current = {};
      dragRef.current = null;
      camera.fov = originalFov;
      camera.updateProjectionMatrix();
    };
  }, [active, camera, gl, startPos, onExit]);

  useFrame((_, delta) => {
    if (!active) return;
    const keys = keysRef.current;
    let fwd = 0, strafe = 0;
    if (keys.KeyW || keys.ArrowUp) fwd += 1;
    if (keys.KeyS || keys.ArrowDown) fwd -= 1;
    if (keys.KeyD || keys.ArrowRight) strafe += 1;
    if (keys.KeyA || keys.ArrowLeft) strafe -= 1;
    if (fwd !== 0 || strafe !== 0) {
      const len = Math.hypot(fwd, strafe);
      fwd /= len; strafe /= len;
      const yaw = yawRef.current;
      const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      const stepFt = WALK_SPEED_FTPS * delta;
      const nxIn = posRef.current.x + (forward.x * fwd + right.x * strafe) * stepFt * 12;
      const nzIn = posRef.current.z + (forward.z * fwd + right.z * strafe) * stepFt * 12;
      posRef.current = resolveCircleVsBoxes(nxIn, nzIn, WALK_RADIUS_IN, wallBoxes.concat(furnitureBoxes));
    }
    camera.position.set(IN(posRef.current.x), EYE_HEIGHT_FT, IN(posRef.current.z));
    camera.rotation.set(pitchRef.current, yawRef.current, 0);
  });

  return null;
}

// Memoized — walls only change when the stage's own wall/room data changes,
// not when furniture is dragged elsewhere in the scene. Without this, every
// furniture commit re-rendered every wall and forced R3F to recreate their
// BufferGeometry (changed args array reference) for no actual reason.
//
// Paint: each wall's two interior-facing sides get the adjacent room's
// `paint_color` (sampled a few inches off the centerline on each side) via a
// 6-entry face-material array on the box — BoxGeometry's default face/group
// order is [+x,-x,+y,-y,+z,-z], so only the two large faces perpendicular to
// the wall's thickness axis carry paint; the other four (top/bottom/end-caps)
// keep the structural color. A wall with no room on a given side (an
// exterior wall) just keeps that side structural too. This is shown
// regardless of build status — it's a design preview, not a progress
// report, so a not-yet-framed wall still shows what its room would look
// like painted.
const Wall = memo(function Wall({ wall, rooms }) {
  const thick = wall.thickness_in || 4.5;
  const framed = wall.build_status === "framed" || wall.build_status === "complete";
  const structColor = framed ? "#c9a876" : wall.wall_type === "new" ? "#c98a7a" : "#d8d3c7";
  return wallSegments(wall).map((seg, i) => {
    const horizontal = seg.y1 === seg.y2;
    const len = horizontal ? Math.abs(seg.x2 - seg.x1) : Math.abs(seg.y2 - seg.y1);
    if (len <= 0) return null;
    const cx = IN((seg.x1 + seg.x2) / 2), cz = IN((seg.y1 + seg.y2) / 2);
    const w = horizontal ? IN(len) : IN(thick);
    const d = horizontal ? IN(thick) : IN(len);

    const off = thick / 2 + 8;
    let posColor, negColor;
    if (horizontal) {
      posColor = findRoomObjAt(rooms, cx * 12, seg.y1 + off)?.paint_color || structColor;
      negColor = findRoomObjAt(rooms, cx * 12, seg.y1 - off)?.paint_color || structColor;
    } else {
      posColor = findRoomObjAt(rooms, seg.x1 + off, cz * 12)?.paint_color || structColor;
      negColor = findRoomObjAt(rooms, seg.x1 - off, cz * 12)?.paint_color || structColor;
    }
    // [+x, -x, +y, -y, +z, -z]
    const faceColors = horizontal
      ? [structColor, structColor, structColor, structColor, posColor, negColor]
      : [posColor, negColor, structColor, structColor, structColor, structColor];

    return (
      <mesh key={i} position={[cx, CEILING_H / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w, CEILING_H, d]} />
        {faceColors.map((c, idx) => (
          <meshStandardMaterial key={idx} attach={`material-${idx}`} color={c}
            roughness={c === structColor ? (framed ? 0.5 : 0.92) : 0.82} />
        ))}
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
const Door = memo(function Door({ wall, opening, doorId, open, onToggle, glass }) {
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
      {glass ? (
        // A full-size glass pane with a thin dark metal frame around the
        // perimeter only — an earlier version used a full-size frame box
        // behind a smaller glass pane, but since both sat at the same depth
        // the (bigger) frame's front face completely covered the glass from
        // every angle, rendering as a plain dark panel.
        <group position={[dx * doorW / 2, 0, dz * doorW / 2]} rotation={[0, panelRotY, 0]}>
          <mesh position={[0, doorH / 2, 0]} castShadow>
            <boxGeometry args={[doorW, doorH, doorT]} />
            <Mat kind="glass" />
          </mesh>
          {[
            [0, doorH - 0.1, doorW, 0.2],
            [0, 0.1, doorW, 0.2],
            [-doorW / 2 + 0.1, doorH / 2, 0.2, doorH],
            [doorW / 2 - 0.1, doorH / 2, 0.2, doorH],
          ].map(([fx, fy, fw, fh], i) => (
            <mesh key={i} position={[fx, fy, 0]} castShadow>
              <boxGeometry args={[fw, fh, doorT * 1.3]} />
              <Mat kind="chrome" color="#3a3a3a" metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ) : (
        <mesh position={[dx * doorW / 2, doorH / 2, dz * doorW / 2]} rotation={[0, panelRotY, 0]} castShadow>
          <boxGeometry args={[doorW, doorH, doorT]} />
          <Mat kind="cedar" />
        </mesh>
      )}
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
      {/* R3F excludes visible=false meshes from raycasting entirely, so this
          has to stay "visible" (just fully transparent) to actually catch
          clicks once the door has retracted away from its closed position. */}
      <mesh position={[baseX, doorH / 2, baseZ]}>
        <boxGeometry args={[horizontal ? doorW : doorT * 6, doorH, horizontal ? doorT * 6 : doorW]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={panelRef} position={[baseX, doorH / 2, baseZ]} rotation={[0, panelRotY, 0]} castShadow>
        <boxGeometry args={[doorW, doorH, doorT]} />
        <Mat kind="cedar" />
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
      <mesh position={[midX, doorH / 2, midZ]}>
        <boxGeometry args={[horizontal ? doorW : doorT * 6, doorH, horizontal ? doorT * 6 : doorW]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={leafARef} position={[IN(hx), 0, IN(hz)]}>
        <mesh position={[(dx * leafW) / 2, doorH / 2, (dz * leafW) / 2]} rotation={[0, panelRotY, 0]} castShadow>
          <boxGeometry args={[leafW, doorH, doorT]} />
          <Mat kind="cedar" />
        </mesh>
      </group>
      <group ref={leafBRef} position={[IN(endX), 0, IN(endZ)]}>
        <mesh position={[(-dx * leafW) / 2, doorH / 2, (-dz * leafW) / 2]} rotation={[0, panelRotY, 0]} castShadow>
          <boxGeometry args={[leafW, doorH, doorT]} />
          <Mat kind="cedar" />
        </mesh>
      </group>
    </group>
  );
});

// The Moorish arch + steam glass partition between the Dry Zone and Wet
// Hammam Zone: two fixed glass panels flanking a hinged glass door, under an
// arched header (a half-cylinder silhouette — the cheap, well-known low-poly
// trick for an arch shape, consistent with the rest of this file's primitive
// furniture). Clicking the hinged section opens/closes it, same as the other
// door types.
const SteamGlassEnclosure = memo(function SteamGlassEnclosure({ wall, opening, doorId, open, onToggle }) {
  const doorRef = useRef();
  const targetAngle = open ? Math.PI * 0.4 : 0;

  useFrame(() => {
    if (!doorRef.current) return;
    const cur = doorRef.current.rotation.y;
    doorRef.current.rotation.y = cur + (targetAngle - cur) * 0.15;
  });

  const horizontal = wall.y1 === wall.y2;
  const dir = horizontal ? (wall.x2 >= wall.x1 ? 1 : -1) : (wall.y2 >= wall.y1 ? 1 : -1);
  const hx = horizontal ? wall.x1 + dir * opening.offset_in : wall.x1;
  const hz = horizontal ? wall.y1 : wall.y1 + dir * opening.offset_in;
  const dx = horizontal ? dir : 0;
  const dz = horizontal ? 0 : dir;
  const panelRotY = horizontal ? 0 : Math.PI / 2;

  const fullW = IN(opening.width_in);
  const thick = IN(wall.thickness_in || 4.5);
  const springline = 6.9; // ft — glass height, below the arched header
  const panelT = 0.06;
  const doorW = Math.min(2.6, fullW * 0.32);
  const fixedW = (fullW - doorW) / 2;
  const doorHingeOffset = fixedW;

  return (
    <group>
      <mesh position={[IN(hx) + (dx * fixedW) / 2, springline / 2, IN(hz) + (dz * fixedW) / 2]}
        rotation={[0, panelRotY, 0]} castShadow>
        <boxGeometry args={[fixedW, springline, panelT]} />
        <Mat kind="glass" />
      </mesh>

      <group ref={doorRef} position={[IN(hx) + dx * doorHingeOffset, 0, IN(hz) + dz * doorHingeOffset]}
        onClick={(e) => { e.stopPropagation(); onToggle(doorId); }}>
        <mesh position={[(dx * doorW) / 2, springline / 2, (dz * doorW) / 2]} rotation={[0, panelRotY, 0]} castShadow>
          <boxGeometry args={[doorW, springline, panelT]} />
          <Mat kind="glass" />
        </mesh>
      </group>

      <mesh position={[IN(hx) + dx * (fixedW + doorW + fixedW / 2), springline / 2, IN(hz) + dz * (fixedW + doorW + fixedW / 2)]}
        rotation={[0, panelRotY, 0]} castShadow>
        <boxGeometry args={[fixedW, springline, panelT]} />
        <Mat kind="glass" />
      </mesh>

      <mesh position={[IN(hx) + (dx * fullW) / 2, springline, IN(hz) + (dz * fullW) / 2]}
        rotation={horizontal ? [Math.PI / 2, 0, 0] : [Math.PI / 2, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[fullW / 2, fullW / 2, thick, 24, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#d8c6a0" roughness={0.85} side={DoubleSide} />
      </mesh>
    </group>
  );
});

const RoomFloor = memo(function RoomFloor({ room, deselect, onRoomSelect, onRoomHover, onRoomUnhover, interactive = true }) {
  const w = IN(room.width), d = IN(room.height);
  const cx = IN(room.x) + w / 2, cz = IN(room.y) + d / 2;
  const floorMat = floorMaterialFor(room);
  const downPos = useRef(null);
  return (
    // Clicking the floor directly (as opposed to missing everything) still
    // needs to clear any selected furniture, so `deselect` is called
    // explicitly in onClick below — NOT via the R3F `onPointerMissed` mesh
    // prop. That prop fires whenever a click doesn't land on THIS specific
    // mesh, even if it legitimately hit something else (like a piece of
    // furniture in front of it) — with one of these on every room floor,
    // clicking furniture triggered a `deselect()` cascade (one per room not
    // hit) immediately after the furniture was selected, wiping the
    // selection out on every single click. `onPointerMissed` belongs on the
    // Canvas itself (fires only on a true scene-wide miss), not per-mesh.
    //
    // R3F's onClick also fires on any pointerdown+pointerup pair that lands
    // on this mesh, with no built-in drag-distance check — so orbiting the
    // camera (which stays over the same large floor the whole time) was
    // ALSO opening this room's detail panel on release. downPos/CLICK_SLOP
    // gates it to genuine clicks, same threshold the furniture drag uses.
    <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow
      onPointerDown={(e) => { if (interactive) downPos.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        const d0 = downPos.current;
        if (d0 && Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > CLICK_SLOP_PX) return;
        deselect?.();
        onRoomSelect?.(room);
      }}
      onPointerMove={(e) => { if (interactive) onRoomHover?.(room, e); }}
      onPointerOut={() => { if (interactive) onRoomUnhover?.(room); }}>
      <planeGeometry args={[w, d]} />
      <Mat kind={floorMat.kind} color={floorMat.color} />
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

// A ceiling-mounted roll-down screen — click toggles it between retracted
// (rolled up into the housing) and deployed (unrolled down toward the
// floor). Deploy state is ephemeral (not persisted), same convention as
// door open/closed state.
function ProjectionScreenMesh({ w, deployed }) {
  const screenRef = useRef();
  const heightRef = useRef(0.001);
  const maxHeight = 5; // ft, fully deployed
  const topY = CEILING_H - 0.4; // just under the ceiling/beam

  useFrame(() => {
    const target = deployed ? maxHeight : 0.001;
    heightRef.current += (target - heightRef.current) * 0.12;
    if (screenRef.current) {
      screenRef.current.scale.y = heightRef.current / maxHeight;
      screenRef.current.position.y = topY - heightRef.current / 2;
    }
  });

  return (
    <group>
      <mesh position={[0, topY + 0.15, 0]} castShadow>
        <boxGeometry args={[w, 0.3, 0.3]} />
        <Mat kind="chrome" color="#3a3a3a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={screenRef} position={[0, topY, 0]}>
        <boxGeometry args={[w * 0.96, maxHeight, 0.03]} />
        <meshStandardMaterial color="#f7f6f2" roughness={0.9} />
      </mesh>
    </group>
  );
}

// Translucent light-cone connecting a "projector" feature to a "projection_screen"
// feature — narrow at the lens, widening to the screen, only shown while the
// screen is deployed. Lives at the top level (not inside FurnitureMesh) since
// it needs both features' positions at once, not just its own.
const ProjectorBeam = memo(function ProjectorBeam({ projector, screen, deployed }) {
  if (!projector || !screen || !deployed) return null;
  const rot = (deg) => (-(deg || 0) * Math.PI) / 180;

  const pw = IN(projector.width || 14), ph = IN(projector.height || 10);
  const pCenter = new Vector3(IN(projector.x) + pw / 2, 6.7, IN(projector.y) + ph / 2);
  const lensLocal = new Vector3(0, -ph * 0.05, ph / 2 + 0.15).applyAxisAngle(new Vector3(0, 1, 0), rot(projector.rotation));
  const lensPos = pCenter.clone().add(lensLocal);

  const sw = IN(screen.width || 80), sh = IN(screen.height || 6);
  const sCenter = new Vector3(IN(screen.x) + sw / 2, CEILING_H - 0.4 - 2.5, IN(screen.y) + sh / 2);
  const faceLocal = new Vector3(0, 0, 0.05).applyAxisAngle(new Vector3(0, 1, 0), rot(screen.rotation));
  const targetPos = sCenter.clone().add(faceLocal);

  const dir = new Vector3().subVectors(lensPos, targetPos);
  const length = dir.length();
  if (length < 0.1) return null;
  const mid = new Vector3().addVectors(lensPos, targetPos).multiplyScalar(0.5);
  const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());

  return (
    <mesh position={mid} quaternion={quat}>
      <coneGeometry args={[Math.min(sw, 10) * 0.42, length, 24, 1, true]} />
      <meshBasicMaterial color="#fff6c8" transparent opacity={0.16} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
});

// Kid play zone — a low-poly corner loft modeled on the Starship-01 plan:
// an elevated deck with bulkhead railings + portholes, a ladder up one
// corner, a slide exiting the opposite side, and a cockpit console. "w" runs
// along the entry/ladder side, "h" along the slide-exit length.
function SpaceshipLoft({ w, h }) {
  const deckY = 40 / 12; // 40" deck elevation, per the plan
  const deckW = w * 0.82, deckD = h * 0.8;
  const deckX = -w * 0.06, deckZ = -h * 0.08; // nudge back/left, leaving ladder + slide clearance
  const railH = 1.5;
  const hullColor = "#d8dde0";
  const slateColor = "#3a4650";

  const portholes = [
    [deckX - deckW / 2, deckY + railH / 2, deckZ],
    [deckX, deckY + railH / 2, deckZ - deckD / 2],
  ];

  return (
    <group>
      {/* Cargo bay mat — the open under-loft reading nook */}
      <mesh position={[0, 0.05, h * 0.12]} receiveShadow>
        <boxGeometry args={[w * 0.85, 0.1, h * 0.55]} />
        <Mat kind="fabric" color="#3b7bb2" />
      </mesh>

      {/* Deck posts */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[deckX + (sx * deckW) / 2.2, deckY / 2, deckZ + (sz * deckD) / 2.2]} castShadow>
          <boxGeometry args={[0.25, deckY, 0.25]} />
          <Mat kind="wood" color="#8a8f94" />
        </mesh>
      ))}

      {/* Loft deck */}
      <mesh position={[deckX, deckY, deckZ]} castShadow receiveShadow>
        <boxGeometry args={[deckW, 0.3, deckD]} />
        <Mat kind="wood" color={hullColor} roughness={0.55} />
      </mesh>

      {/* Bulkhead guardrails around the deck, slatted top rail */}
      <mesh position={[deckX, deckY + railH / 2, deckZ - deckD / 2]} castShadow>
        <boxGeometry args={[deckW, railH, 0.15]} /><Mat kind="wood" color={hullColor} />
      </mesh>
      <mesh position={[deckX - deckW / 2, deckY + railH / 2, deckZ]} castShadow>
        <boxGeometry args={[0.15, railH, deckD]} /><Mat kind="wood" color={hullColor} />
      </mesh>
      <mesh position={[deckX + deckW / 2, deckY + railH / 2, deckZ]} castShadow>
        <boxGeometry args={[0.15, railH, deckD]} /><Mat kind="wood" color={hullColor} />
      </mesh>
      {portholes.map(([px, py, pz], i) => (
        <mesh key={i} position={[px, py, pz]} rotation={[0, i === 0 ? Math.PI / 2 : 0, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.17, 16]} />
          <Mat kind="glass" color="#bfe3ff" />
        </mesh>
      ))}

      {/* Cockpit console on the deck */}
      <mesh position={[deckX, deckY + 1, deckZ - deckD * 0.3]} castShadow>
        <boxGeometry args={[1.4, 1.4, 0.8]} /><Mat kind="chrome" color={slateColor} metalness={0.3} roughness={0.5} />
      </mesh>

      {/* 65° angled ship ladder — front-left corner */}
      {[0, 1, 2, 3, 4].map((i) => {
        const t = i / 4;
        return (
          <mesh key={i} position={[-w / 2 + 0.4, 0.3 + t * (deckY - 0.3), h / 2 - 0.3 - t * 0.6]} castShadow>
            <boxGeometry args={[1.3, 0.15, 0.5]} /><Mat kind="cedar" />
          </mesh>
        );
      })}
      {[-1, 1].map((s, i) => (
        <mesh key={i} position={[-w / 2 + 0.4 + s * 0.6, deckY / 2 + 0.2, h / 2 - 1.2]}
          rotation={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.12, deckY + 0.6, 0.12]} /><Mat kind="cedar" />
        </mesh>
      ))}

      {/* Escape pod wave slide — exits the opposite (right) side, sloping to the floor */}
      <mesh position={[w / 2 - 1.2, deckY / 2 - 0.1, deckZ]} rotation={[0, 0, -0.5]} castShadow>
        <boxGeometry args={[0.1, deckY * 1.25, 1.9]} /><Mat kind="glass" color="#5fb3c9" />
      </mesh>
    </group>
  );
}

// Low-poly, recognizable-silhouette furniture — not photoreal, just "a chair is a chair".
function FurnitureMesh({ type, w, h, deployed }) {
  const color = FEATURE_COLORS[type] || "#888";
  switch (type) {
    case "projection_screen":
      return <ProjectionScreenMesh w={w} deployed={deployed} />;
    case "sofa":
    case "sleeper_sofa":
      return (
        <group>
          <mesh position={[0, 0.7, 0]} castShadow><boxGeometry args={[w, 1.4, h]} /><Mat kind="fabric" color={color} /></mesh>
          <mesh position={[0, 1.5, -h / 2 + IN(4)]} castShadow>
            <boxGeometry args={[w, 1.2, IN(8)]} /><Mat kind="fabric" color={color} />
          </mesh>
        </group>
      );
    case "sectional_sofa": {
      // L-shaped: a main run (same seat+backrest as a plain sofa) plus a
      // chaise section jutting out from one end, perpendicular to the run.
      const chaiseW = h * 0.95, chaiseD = h * 0.9;
      return (
        <group>
          <mesh position={[0, 0.7, 0]} castShadow><boxGeometry args={[w, 1.4, h]} /><Mat kind="fabric" color={color} /></mesh>
          <mesh position={[0, 1.5, -h / 2 + IN(4)]} castShadow>
            <boxGeometry args={[w, 1.2, IN(8)]} /><Mat kind="fabric" color={color} />
          </mesh>
          <mesh position={[w / 2 - chaiseW / 2, 0.65, h / 2 + chaiseD / 2]} castShadow>
            <boxGeometry args={[chaiseW, 1.3, chaiseD]} /><Mat kind="fabric" color={color} />
          </mesh>
        </group>
      );
    }
    case "projector":
      return (
        <group position={[0, 6.7, 0]}>
          <mesh castShadow><boxGeometry args={[w, h * 0.65, h]} /><Mat kind="chrome" color="#2b2b2b" metalness={0.3} roughness={0.5} /></mesh>
          <mesh position={[0, -h * 0.05, h / 2 + 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.22, 0.3, 16]} /><Mat kind="chrome" metalness={0.6} roughness={0.2} />
          </mesh>
        </group>
      );
    case "toilet":
      // Wall-hung — floating off the floor with a concealed in-wall tank, per the Hammam plan.
      return (
        <group position={[0, 1.4, 0]}>
          <mesh position={[0, -0.7, h / 4]} castShadow><boxGeometry args={[w * 0.8, 1.2, h * 0.55]} /><Mat kind="porcelain" /></mesh>
          <mesh position={[0, 0.1, -h / 3]} castShadow><boxGeometry args={[w * 0.7, 1.1, h * 0.3]} /><Mat kind="porcelain" /></mesh>
        </group>
      );
    case "sink":
      // Floating carved cedar vanity + hammered brass vessel sink.
      return (
        <group>
          <mesh position={[0, 2.6, 0]} castShadow><boxGeometry args={[w, 0.2, h]} /><Mat kind="cedar" /></mesh>
          <mesh position={[0, 2.95, 0]} castShadow><cylinderGeometry args={[Math.min(w, h) * 0.38, Math.min(w, h) * 0.42, 0.45, 16]} /><Mat kind="brass" /></mesh>
          <mesh position={[0, 3.6, -h / 2 + 0.1]} castShadow><cylinderGeometry args={[0.04, 0.04, 1.2, 8]} /><Mat kind="brass" /></mesh>
        </group>
      );
    case "mirror":
      return (
        <group position={[0, 5.2, 0]}>
          <mesh castShadow><boxGeometry args={[w, 2.6, 0.08]} /><Mat kind="brass" /></mesh>
          <mesh position={[0, 0, 0.05]}><boxGeometry args={[w * 0.85, 2.3, 0.02]} /><Mat kind="chrome" roughness={0.05} /></mesh>
        </group>
      );
    case "heated_bench":
      return <mesh position={[0, 0.75, 0]} castShadow receiveShadow><boxGeometry args={[w, 1.5, h]} /><Mat kind="marble" /></mesh>;
    case "kurna_basin":
      return (
        <group>
          <mesh position={[0, 1.1, 0]} castShadow><cylinderGeometry args={[Math.min(w, h) / 2, Math.min(w, h) / 2.3, 1.0, 16]} /><Mat kind="marble" color="#ece6da" /></mesh>
          <mesh position={[0, 1.75, 0]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.5, 8]} /><Mat kind="brass" /></mesh>
        </group>
      );
    case "appliance":
      return <mesh position={[0, 1.4, 0]} castShadow><boxGeometry args={[w, 2.8, h]} /><Mat kind="chrome" color={color} metalness={0.3} /></mesh>;
    case "water_filtration":
      return <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[Math.min(w, h) / 2, Math.min(w, h) / 2, 3.2, 16]} /><Mat kind="chrome" color={color} metalness={0.2} /></mesh>;
    case "shelving":
    case "built_in_shelving":
      return (
        <group>
          {[0.3, 2.2, 4.1, 6.0].map((y, i) => (
            <mesh key={i} position={[0, y, 0]} castShadow><boxGeometry args={[w, 0.12, h]} /><Mat kind="wood" color={color} /></mesh>
          ))}
          <mesh position={[-w / 2 + 0.06, 3.2, 0]} castShadow><boxGeometry args={[0.12, 6.4, h]} /><Mat kind="wood" color={color} /></mesh>
          <mesh position={[w / 2 - 0.06, 3.2, 0]} castShadow><boxGeometry args={[0.12, 6.4, h]} /><Mat kind="wood" color={color} /></mesh>
        </group>
      );
    case "kid_zone":
      return <SpaceshipLoft w={w} h={h} />;
    case "electric_panel":
      return <mesh position={[0, 4.5, 0]} castShadow><boxGeometry args={[w, h, 0.2]} /><Mat kind="chrome" color={color} metalness={0.4} /></mesh>;
    case "acoustic_treatment":
      return <mesh position={[0, 4, 0]} castShadow><boxGeometry args={[w, 3.5, h]} /><Mat kind="fabric" color={color} /></mesh>;
    case "boiler":
      return <mesh position={[0, 2.2, 0]} castShadow><cylinderGeometry args={[Math.min(w, h) / 2, Math.min(w, h) / 2, 4.4, 16]} /><Mat kind="chrome" color={color} metalness={0.25} /></mesh>;
    case "shower":
      // Side-wall rain head + handheld wand over a standing zone — no enclosure here;
      // the actual steam glass partition is the room-dividing arch (SteamGlassEnclosure).
      return (
        <group>
          <mesh position={[0, 0.05, 0]} receiveShadow><boxGeometry args={[w, 0.1, h]} /><Mat kind="marble" color="#cfd8dc" /></mesh>
          <mesh position={[-w / 2 + 0.1, 4.2, 0]} castShadow><boxGeometry args={[0.15, 5, 0.15]} /><Mat kind="brass" /></mesh>
          <mesh position={[-w / 2 + 0.1, 6.7, h / 2 - IN(6)]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.1, 20]} /><Mat kind="brass" />
          </mesh>
        </group>
      );
    case "mini_split":
      return (
        <group position={[0, 6.6, 0]}>
          <mesh castShadow><boxGeometry args={[w, h, IN(8)]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
        </group>
      );
    default:
      return <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[w, 1.8, h]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>;
  }
}

// Memoized — dragging one piece of furniture replaces only that feature's
// object in the `features` array (see commitTransform below), so every other
// Furniture instance still receives the exact same `feature` reference and
// can skip re-rendering entirely once `onSelect` is stabilized too.
const Furniture = memo(function Furniture({ feature, selected, onSelect, mode, onDragStart, screenDeployed, onToggleScreen, interactive = true }) {
  const groupRef = useRef();
  const wIn = feature.width || 20, hIn = feature.height || 20;
  const w = IN(wIn), h = IN(hIn);
  const cx = IN(feature.x) + w / 2, cz = IN(feature.y) + h / 2;
  const hitboxH = Math.max(2, Math.min(6.5, IN(Math.max(wIn, hIn))));
  const downPos = useRef(null);
  // Wall collision treats everything as axis-aligned (walls are always
  // horizontal/vertical here), so a 90/270-rotated piece needs its stored
  // width/height swapped before being used as a world-aligned half-extent —
  // otherwise a piece rotated to face east/west got clamped using its
  // unrotated (larger) dimension along the wrong axis, stopping it short of
  // the wall by the difference instead of flush against it.
  const rot90 = isRot90(feature.rotation);
  const wallWIn = rot90 ? hIn : wIn, wallHIn = rot90 ? wIn : hIn;

  return (
    <group ref={groupRef} position={[cx, 0, cz]} rotation={[0, -((feature.rotation || 0) * Math.PI) / 180, 0]}
      onClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        // Same drag-vs-click gate as RoomFloor — without it, dragging the
        // screen to reposition it also toggled its deployed state, since
        // R3F's onClick fires on any pointerdown/up pair regardless of the
        // drag that happened in between.
        const d0 = downPos.current;
        if (d0 && Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > CLICK_SLOP_PX) return;
        if (feature.type === "projection_screen") onToggleScreen(feature.id);
      }}
      onPointerDown={(e) => {
        // In Walk Mode this would otherwise fight with WalkControls' own
        // drag-to-look listener for the same mouse gesture — both reading
        // the same pointer drag at once (one rotating the camera, the other
        // trying to move this piece of furniture) is exactly what made
        // rotation feel "wonky."
        if (!interactive) return;
        e.stopPropagation();
        downPos.current = { x: e.clientX, y: e.clientY };
        onSelect(feature.id, groupRef);
        if (mode === "translate") onDragStart(feature.id, groupRef, e, wallWIn, wallHIn);
      }}>
      {/* Invisible hitbox — taller than the old paper-thin version so steep
          camera angles still land a click on the piece instead of missing it. */}
      <mesh position={[0, hitboxH / 2, 0]}>
        <boxGeometry args={[w, hitboxH, h]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 0.3, h + 0.3]} />
          <meshBasicMaterial color="#ffcc66" opacity={0.35} transparent />
        </mesh>
      )}
      <FurnitureMesh type={feature.type} w={w} h={h} deployed={screenDeployed} />
    </group>
  );
});

export default function FloorPlan3D({ stage, stageId, onFeaturesChanged, onRoomSelect }) {
  const [features, setFeatures] = useState(stage?.features || []);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("translate");
  const [openDoors, setOpenDoors] = useState(new Set());
  const [deployedScreens, setDeployedScreens] = useState(new Set());
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [viewMode, setViewMode] = useState("orbit"); // "orbit" | "walk"
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const groupRefs = useRef({});
  const orbitRef = useRef();
  const glRef = useRef(null);
  const wrapRef = useRef(null);
  const dragStateRef = useRef(null);

  // The 3D view especially (walking around, orienting yourself) benefits from
  // real screen space — fullscreen uses the browser's native Fullscreen API
  // on the canvas wrapper rather than just a bigger fixed height, so it gets
  // the entire display, not just "bigger than before."
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen();
  }, []);

  // Stable across renders (useCallback + functional setState) so the memoized
  // RoomFloor/Door/SlidingDoor/FoldingDoor components below can actually bail
  // out when a sibling piece of furniture moves, instead of re-rendering (and
  // recreating their BufferGeometry) just because these callback props got a
  // new reference.
  const deselect = useCallback(() => setSelectedId(null), []);
  // Stable reference is load-bearing, not just tidiness: WalkControls' setup
  // effect depends on this callback, and an inline arrow function here would
  // be a new reference on every parent re-render (which happens constantly
  // from room-hover tracking alone) — re-running that effect resets the
  // walker's position/orientation back to the start, which is exactly what
  // "the view keeps resetting randomly" was.
  const exitWalkMode = useCallback(() => setViewMode("orbit"), []);
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
  const toggleScreen = useCallback((id) => {
    setDeployedScreens((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  useEffect(() => { setFeatures(stage?.features || []); setSelectedId(null); }, [stage]);

  const maxX = useMemo(() => Math.max(...(stage?.walls || []).map((w) => Math.max(w.x1, w.x2)), 0), [stage]);
  const maxY = useMemo(() => Math.max(...(stage?.walls || []).map((w) => Math.max(w.y1, w.y2)), 0), [stage]);
  const collisionSegments = useMemo(() => collectSolidWallSegments(stage?.walls), [stage]);
  const pole = useMemo(() => (stage?.features || []).find((f) => f.type === "pole"), [stage]);
  const nonPoleFeatures = features.filter((f) => f.type !== "pole");
  const screenFeature = features.find((f) => f.type === "projection_screen");
  const projectorFeature = features.find((f) => f.type === "projector");

  const wallBoxes = useMemo(() => collisionSegments.map(wallBoxFor), [collisionSegments]);
  const furnitureBoxes = useMemo(() => nonPoleFeatures.map((f) => {
    const wIn = f.width || 20, hIn = f.height || 20;
    const rot90 = isRot90(f.rotation);
    const halfW = (rot90 ? hIn : wIn) / 2, halfH = (rot90 ? wIn : hIn) / 2;
    const cx = f.x + (f.width || 20) / 2, cz = f.y + (f.height || 20) / 2;
    return { x0: cx - halfW, x1: cx + halfW, z0: cz - halfH, z1: cz + halfH };
  }), [nonPoleFeatures]);
  // Walk mode starts in the middle of whichever room has the most floor
  // area — guaranteed open space, unlike the building's geometric center
  // (which can land inside a dividing wall).
  const walkStart = useMemo(() => {
    const rooms = stage?.rooms || [];
    const biggest = rooms.reduce((best, r) => (!best || r.width * r.height > best.width * best.height ? r : best), null);
    if (!biggest) return { x: 0, z: 0, yaw: 0 };
    return { x: biggest.x + biggest.width / 2, z: biggest.y + biggest.height / 2, yaw: 0 };
  }, [stage]);

  const doors = useMemo(() => {
    const list = [];
    for (const wall of stage?.walls || []) {
      for (const op of wall.openings || []) {
        if (op.type === "folding_door") {
          list.push({ wall, opening: op, id: op.id, kind: "folding" });
        } else if (op.type === "arch_glass") {
          list.push({ wall, opening: op, id: op.id, kind: "arch_glass" });
        } else if (op.type === "door" || op.type === "garage_door" || op.type === "glass_door") {
          // Wide (double-door) openings slide instead of swinging on a hinge.
          list.push({
            wall, opening: op, id: op.id,
            kind: op.width_in >= 48 ? "sliding" : "hinged",
            glass: op.type === "glass_door",
          });
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

  // Seeds the drag state on pointer-down; DragController (inside the Canvas,
  // where camera/raycaster are available) does the actual tracking and calls
  // commitPosition on release.
  const handleDragStart = useCallback((id, groupRef, e, wIn, hIn) => {
    dragStateRef.current = {
      id,
      startX: e.clientX, startY: e.clientY, moved: false,
      offsetX: groupRef.current.position.x - e.point.x,
      offsetZ: groupRef.current.position.z - e.point.z,
      wIn, hIn,
    };
    setOrbitEnabled(false);
  }, []);

  const commitPosition = async (id) => {
    const ref = groupRefs.current[id];
    const feature = features.find((f) => f.id === id);
    if (!ref?.current || !feature) return;
    const widthIn = feature.width || 20, heightIn = feature.height || 20;
    const xIn = ref.current.position.x * 12 - widthIn / 2;
    const yIn = ref.current.position.z * 12 - heightIn / 2;
    const room_name = findRoomAt(stage.rooms, xIn, yIn) || feature.room_name;
    const patch = { x: xIn, y: yIn, room_name };
    setFeatures((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    await api.patchFeature(id, patch);
  };

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
    const room = pickDefaultRoom(stage.rooms, item.type);
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
        <p className="editor-hint">Click and drag furniture to move it (snaps to a 3" grid, and to nearby walls). Click a door or the projection screen to open/close it.</p>

        <div className="editor-divider" />
        <div className="view-mode-toggle">
          <button className={mode === "translate" ? "active" : ""} onClick={() => setMode("translate")}>Move</button>
          <button className={mode === "rotate" ? "active" : ""} onClick={() => setMode("rotate")}>Rotate</button>
          <button className={mode === "scale" ? "active" : ""} onClick={() => setMode("scale")}>Resize</button>
        </div>
        <p className="editor-hint">Drag to orbit, scroll to zoom, right-drag to pan.</p>

        <div className="editor-divider" />
        <div className="view-mode-toggle">
          <button className={viewMode === "orbit" ? "active" : ""} onClick={() => setViewMode("orbit")}>Orbit View</button>
          <button className={viewMode === "walk" ? "active" : ""} onClick={() => { deselect(); setViewMode("walk"); }}>Walk Mode</button>
        </div>
        {viewMode === "walk" ? (
          <>
            <p className="editor-hint">Drag to look around, WASD or arrow keys to move. Esc or the button below to exit.</p>
            <button className="palette-rotate" onClick={() => setViewMode("orbit")}>Exit Walk Mode</button>
          </>
        ) : (
          <p className="editor-hint">Walk Mode lets you move through the space at eye level instead of orbiting above it.</p>
        )}

        <LayoutPresets stageId={stageId} onLoaded={onFeaturesChanged} />
        <RoomRenderPanel stage={stage} glRef={glRef} />
      </div>

      <div className="editor-main">
        <div className={`editor-canvas-wrap view-fit${isFullscreen ? " is-fullscreen" : ""}`} ref={wrapRef}>
          <button className="fullscreen-btn" onClick={toggleFullscreen}>
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
          <Canvas shadows gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05, preserveDrawingBuffer: true }}
            onCreated={(state) => { glRef.current = state.gl; }}
            onPointerMissed={deselect}
            camera={{ position: [centerX + IN(maxX) * 0.9, IN(maxY) * 0.55, centerZ + IN(maxY) * 0.75], fov: 45 }}>
            <CameraRig target={[centerX, 1.5, centerZ]} />
            {/* Hemisphere fill (sky/ground split) + a tuned directional key light —
                replaces the old flat ambient+single-light pair so surfaces actually
                read as 3D instead of uniformly lit. */}
            <hemisphereLight args={["#cfe3f0", "#786a50", 0.55]} />
            <directionalLight
              position={[centerX + 20, 26, centerZ - 12]} intensity={1.3} castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-IN(maxX)}
              shadow-camera-right={IN(maxX)}
              shadow-camera-top={IN(maxY)}
              shadow-camera-bottom={-IN(maxY)}
              shadow-bias={-0.0004}
            />
            <Environment preset="apartment" environmentIntensity={0.6} />
            <mesh position={[centerX, -0.05, centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[IN(maxX) + 6, IN(maxY) + 6]} />
              <meshStandardMaterial color="#f2efe6" roughness={0.9} />
            </mesh>
            <ContactShadows position={[centerX, 0, centerZ]} opacity={0.45} scale={Math.max(IN(maxX), IN(maxY)) * 2.2}
              blur={2} far={6} resolution={512} />

            {stage.rooms.map((room) => (
              <RoomFloor key={`f-${room.id}`} room={room} deselect={deselect} interactive={viewMode === "orbit"}
                onRoomSelect={onRoomSelect} onRoomHover={handleRoomHover} onRoomUnhover={handleRoomUnhover} />
            ))}
            {stage.rooms.map((room) => <RoomLabel key={`l-${room.id}`} room={room} />)}
            {stage.walls.map((wall) => <Wall key={`w-${wall.id}`} wall={wall} rooms={stage.rooms} />)}
            {doors.map((d) => {
              const DoorComp = d.kind === "folding" ? FoldingDoor
                : d.kind === "arch_glass" ? SteamGlassEnclosure
                : d.kind === "sliding" ? SlidingDoor : Door;
              return (
                <DoorComp key={`d-${d.id}`} wall={d.wall} opening={d.opening} doorId={d.id}
                  open={openDoors.has(d.id)} onToggle={toggleDoor} glass={d.glass} />
              );
            })}
            {windows.map((win) => <WindowPane key={`win-${win.id}`} wall={win.wall} opening={win.opening} />)}
            <BeamAndPole pole={pole} maxYIn={maxY} />
            <ProjectorBeam projector={projectorFeature} screen={screenFeature}
              deployed={!!screenFeature && deployedScreens.has(screenFeature.id)} />

            {nonPoleFeatures.map((f) => (
              <Furniture key={f.id} feature={f} selected={selectedId === f.id} interactive={viewMode === "orbit"}
                onSelect={handleSelect} mode={mode} onDragStart={handleDragStart}
                screenDeployed={deployedScreens.has(f.id)} onToggleScreen={toggleScreen} />
            ))}

            {/* Move is handled entirely by DragController's direct click-and-drag below —
                no gizmo for translate at all, since grabbing its thin arrows was the main
                "hard to drag" complaint. Rotate/resize keep the gizmo (not the pain point). */}
            {selectedId && selectedRef?.current && mode !== "translate" && (
              <TransformControls
                object={selectedRef.current}
                mode={mode}
                showX={mode !== "rotate"}
                showY={mode === "rotate"}
                showZ={mode !== "rotate"}
                onMouseDown={() => setOrbitEnabled(false)}
                onMouseUp={() => { setOrbitEnabled(true); commitTransform(); }}
              />
            )}
            {viewMode === "orbit" && (
              <DragController groupRefs={groupRefs} dragStateRef={dragStateRef}
                setOrbitEnabled={setOrbitEnabled} onDragEnd={commitPosition} wallSegments={collisionSegments} />
            )}

            <OrbitControls ref={orbitRef} enabled={viewMode === "orbit" && orbitEnabled} target={[centerX, 1.5, centerZ]}
              maxPolarAngle={Math.PI / 2.05}
              enableDamping dampingFactor={0.12}
              zoomSpeed={2.2} minDistance={4} maxDistance={Math.max(IN(maxX), IN(maxY)) * 2.5} />
            <WalkControls active={viewMode === "walk"} wallBoxes={wallBoxes} furnitureBoxes={furnitureBoxes}
              startPos={walkStart} onExit={exitWalkMode} />

            {/* Conservative post-processing — bloom makes brass/glass highlights and
                warm lighting pop; no SSAO/DOF, keeping frame cost low. */}
            <EffectComposer multisampling={0}>
              <Bloom luminanceThreshold={0.75} luminanceSmoothing={0.2} intensity={0.35} mipmapBlur />
            </EffectComposer>
          </Canvas>
          <RoomHoverCard room={hoveredRoom} x={hoverPos.x + 14} y={hoverPos.y + 14} />
        </div>
      </div>
    </div>
  );
}
