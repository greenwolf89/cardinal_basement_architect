import { useEffect, useState } from "react";
import { api } from "../api";

const STATUS_CYCLE = ["not_started", "in_progress", "blocked", "done"];
const STATUS_LABEL = { not_started: "Not started", in_progress: "In progress", blocked: "Blocked", done: "Done" };

export default function Checklist() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.getChecklist().then(setItems);
  }, []);

  const cycleStatus = async (item) => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % STATUS_CYCLE.length];
    setItems((its) => its.map((i) => (i.id === item.id ? { ...i, status: next } : i)));
    await api.patchChecklistItem(item.id, { status: next });
  };

  const byPhase = {};
  for (const item of items) {
    (byPhase[item.phase] ||= []).push(item);
  }

  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Master Checklist</h2>
        <span className="progress">{done} / {total} done</span>
      </div>
      {Object.entries(byPhase).map(([phase, phaseItems]) => (
        <div key={phase} className="category-block">
          <h3>{phase}</h3>
          <ul className="checklist">
            {phaseItems.map((item) => (
              <li key={item.id} className={`status-${item.status}`}>
                <button className="status-toggle" onClick={() => cycleStatus(item)}>
                  {STATUS_LABEL[item.status]}
                </button>
                <div className="checklist-text">
                  <strong>{item.title}</strong>
                  {item.description && <p>{item.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
