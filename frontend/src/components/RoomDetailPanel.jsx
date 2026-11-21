import { useEffect, useState } from "react";
import { api } from "../api";
import { formatDims } from "../format";

export default function RoomDetailPanel({ room, features, onClose, onSaved }) {
  const [progressPct, setProgressPct] = useState(room.progress_pct || 0);
  const [statusLabel, setStatusLabel] = useState(room.status_label || "");
  const [progressNote, setProgressNote] = useState(room.progress_note || "");
  const [resources, setResources] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [labor, setLabor] = useState([]);

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
