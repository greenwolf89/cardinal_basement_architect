import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDims } from "../format";

// Curated paint palettes — a few swatches per named group, switchable so the
// user isn't stuck scrolling one giant swatch wall to find a color family.
const PAINT_PALETTES = {
  Neutral: ["#f5f1e8", "#e8e2d4", "#d9d2c3", "#c9c4ba", "#b8b2a4"],
  Warm: ["#f2e4d0", "#e3c9a0", "#d8a878", "#c97b4a", "#a85c3a"],
  Cool: ["#e3eef2", "#bcd8e3", "#8fb8c9", "#5f93a8", "#3a6b80"],
  Bold: ["#2e8b6e", "#1f7a5c", "#9b59b6", "#6c5ce7", "#b23b3b"],
  Pastel: ["#f7e0e6", "#e0ecf7", "#e8f2e0", "#f7efe0", "#ece0f7"],
};

export default function RoomDetailPanel({ room, features, onClose, onSaved }) {
  const [progressPct, setProgressPct] = useState(room.progress_pct || 0);
  const [statusLabel, setStatusLabel] = useState(room.status_label || "");
  const [progressNote, setProgressNote] = useState(room.progress_note || "");
  const [activePalette, setActivePalette] = useState("Neutral");
  const [resources, setResources] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [labor, setLabor] = useState([]);
  const paintColor = room.paint_color || "#f2efe6";

  useEffect(() => {
    setProgressPct(room.progress_pct || 0);
    setStatusLabel(room.status_label || "");
    setProgressNote(room.progress_note || "");
    Promise.all([api.getResources(), api.getChecklist(), api.getLabor()]).then(([r, c, l]) => {
      setResources(r.filter((x) => x.room_name === room.name));
      setChecklist(c.filter((x) => x.room_name === room.name));
      setLabor(l.filter((x) => x.room_name === room.name));
    });
  }, [room.id, room.name]);

  const save = async (patch) => {
    await api.patchRoom(room.id, patch);
    onSaved?.({ ...room, ...patch });
  };

  return (
    <div className="room-detail-overlay" onClick={onClose}>
      <div className="room-detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="room-detail-header">
          <h3>{room.name}</h3>
          <button className="room-detail-close" onClick={onClose}>&times;</button>
        </div>
        <p className="room-detail-dims">{formatDims(room.width, room.height)}</p>

        <div className="room-detail-progress">
          <label>
            Status
            <input type="text" value={statusLabel}
              onChange={(e) => setStatusLabel(e.target.value)}
              onBlur={() => save({ status_label: statusLabel })} />
          </label>
          <label>
            Progress %
            <input type="number" min="0" max="100" value={progressPct}
              onChange={(e) => setProgressPct(e.target.value)}
              onBlur={() => save({ progress_pct: parseInt(progressPct, 10) || 0 })} />
          </label>
          <label>
            Notes
            <textarea value={progressNote} rows={2}
              onChange={(e) => setProgressNote(e.target.value)}
              onBlur={() => save({ progress_note: progressNote })} />
          </label>
        </div>

        <div className="room-detail-section">
          <h4>Wall Paint</h4>
          <div className="paint-palette-tabs">
            {Object.keys(PAINT_PALETTES).map((name) => (
              <button key={name} className={activePalette === name ? "active" : ""}
                onClick={() => setActivePalette(name)}>{name}</button>
            ))}
          </div>
          <div className="paint-swatch-row">
            {PAINT_PALETTES[activePalette].map((hex) => (
              <button key={hex} className={`paint-swatch${paintColor.toLowerCase() === hex ? " selected" : ""}`}
                style={{ background: hex }} title={hex} onClick={() => save({ paint_color: hex })} />
            ))}
          </div>
        </div>

        {features.length > 0 && (
          <div className="room-detail-section">
            <h4>Furniture / fixtures</h4>
            <ul>{features.map((f) => <li key={f.id}>{f.label || f.type}</li>)}</ul>
          </div>
        )}
        {resources.length > 0 && (
          <div className="room-detail-section">
            <h4>Resources</h4>
            <ul>{resources.map((r) => (
              <li key={r.id}>{r.name} — <span className={`status status-${r.status}`}>{r.status.replace("_", " ")}</span></li>
            ))}</ul>
          </div>
        )}
        {labor.length > 0 && (
          <div className="room-detail-section">
            <h4>Labor</h4>
            <ul>{labor.map((l) => <li key={l.id}>{l.person} — {l.task}</li>)}</ul>
          </div>
        )}
        {checklist.length > 0 && (
          <div className="room-detail-section">
            <h4>Checklist</h4>
            <ul>{checklist.map((c) => <li key={c.id}>{c.title} — {c.status.replace("_", " ")}</li>)}</ul>
          </div>
        )}
        {features.length === 0 && resources.length === 0 && labor.length === 0 && checklist.length === 0 && (
          <p className="editor-hint">Nothing tagged to this room yet.</p>
        )}
      </div>
    </div>
  );
}
