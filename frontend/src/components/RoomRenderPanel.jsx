import { useState } from "react";
import { api } from "../api";

// Turns the current 3D view into a photorealistic render via OpenAI's
// image-edit API (server-side key) — the screenshot is sent as a reference
// image so the result respects the actual layout, not just a text guess.
// Lives next to the 3D canvas (not in RoomDetailPanel) since it needs direct
// access to the WebGL canvas to capture the screenshot.
export default function RoomRenderPanel({ stage, glRef }) {
  const [roomId, setRoomId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);

  const generate = async () => {
    if (!roomId || !glRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const dataUrl = glRef.current.domElement.toDataURL("image/png");
      const res = await api.generateRoomRender(Number(roomId), dataUrl, instructions);
      setResultUrl(`data:image/png;base64,${res.image_base64}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!stage) return null;

  return (
    <div className="room-render-panel">
      <h3>Photo Render</h3>
      <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
        <option value="">Choose a room…</option>
        {stage.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <input type="text" className="preset-name-input" placeholder="Style notes (optional)"
        value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      <button className="palette-rotate" disabled={!roomId || loading} onClick={generate}>
        {loading ? "Generating… (~20s)" : "Generate Photo Render"}
      </button>
      <p className="editor-hint">Orbit/zoom to frame the room first — the render follows this exact view. Each click calls a paid OpenAI API.</p>
      {error && <p className="render-error">{error}</p>}

      {resultUrl && (
        <div className="room-detail-overlay" onClick={() => setResultUrl(null)}>
          <div className="render-result-panel" onClick={(e) => e.stopPropagation()}>
            <div className="room-detail-header">
              <h3>Photo Render</h3>
              <button className="room-detail-close" onClick={() => setResultUrl(null)}>&times;</button>
            </div>
            <img src={resultUrl} alt="Photorealistic room render" />
            <a href={resultUrl} download="room-render.png" className="export-btn">Download</a>
          </div>
        </div>
      )}
    </div>
  );
}
