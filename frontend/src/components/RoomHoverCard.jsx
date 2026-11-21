import { formatDims } from "../format";

export default function RoomHoverCard({ room, x, y }) {
  if (!room) return null;
  return (
    <div className="room-hover-card" style={{ left: x, top: y }}>
      <strong>{room.name}</strong>
      <div>{formatDims(room.width, room.height)}</div>
      {(room.status_label || room.progress_pct > 0) && (
        <div className="room-hover-status">
          {room.status_label || "In progress"}{room.progress_pct ? ` — ${room.progress_pct}%` : ""}
        </div>
      )}
    </div>
  );
}
