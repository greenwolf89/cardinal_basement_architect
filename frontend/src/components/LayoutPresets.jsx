import { useEffect, useState } from "react";
import { api } from "../api";

// Saved furniture-layout snapshots for a stage ("Setup A" vs "Setup B") —
// shown in both the 2D and 3D views since a preset is stage-wide data, not
// tied to which view you're looking at it from.
export default function LayoutPresets({ stageId, onLoaded }) {
  const [presets, setPresets] = useState([]);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState(null);

  const reload = () => {
    if (stageId) api.getPresets(stageId).then(setPresets);
  };

  useEffect(() => { reload(); }, [stageId]);

  const save = async () => {
    if (!newName.trim()) return;
    const created = await api.createPreset(stageId, newName.trim());
    setPresets((ps) => [...ps, created]);
    setNewName("");
  };

  const load = async (id) => {
    setBusyId(id);
    await api.loadPreset(id);
    setBusyId(null);
    onLoaded?.();
  };

  const update = async (id) => {
    setBusyId(id);
    const updated = await api.patchPreset(id, { resave: true });
    setPresets((ps) => ps.map((p) => (p.id === id ? updated : p)));
    setBusyId(null);
  };

  const rename = async (id, name) => {
    if (!name.trim()) return;
    const updated = await api.patchPreset(id, { name: name.trim() });
    setPresets((ps) => ps.map((p) => (p.id === id ? updated : p)));
  };

  const remove = async (id) => {
    await api.deletePreset(id);
    setPresets((ps) => ps.filter((p) => p.id !== id));
  };

  return (
    <div className="layout-presets">
      <h3>Layout Presets</h3>
      {presets.length === 0 && <p className="editor-hint">No saved setups yet for this stage.</p>}
      {presets.map((p) => (
        <div key={p.id} className="preset-row">
          <input type="text" defaultValue={p.name} className="preset-name-input"
            onBlur={(e) => e.target.value !== p.name && rename(p.id, e.target.value)} />
          <button className="preset-btn" disabled={busyId === p.id} onClick={() => load(p.id)}>Load</button>
          <button className="preset-btn" disabled={busyId === p.id} onClick={() => update(p.id)}>Update</button>
          <button className="edit-link" onClick={() => remove(p.id)}>delete</button>
        </div>
      ))}
      <div className="preset-row">
        <input type="text" placeholder="New setup name" value={newName}
          onChange={(e) => setNewName(e.target.value)} className="preset-name-input" />
        <button className="preset-btn" onClick={save}>Save current</button>
      </div>
    </div>
  );
}
