import { useEffect, useState } from "react";
import { api } from "../api";

// Quick-pick prefills for people known to be working on the project — just a
// frontend convenience, not stored data (their actual rate/hours per entry
// still come from the form each time).
const KNOWN_PEOPLE = [
  { person: "Steve", rate_per_hour: 50 },
  { person: "Roman", rate_per_hour: 30 },
  { person: "Adam", flat_fee: 2800 },
];

function fmtMoney(n) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function laborCost(entry) {
  if (entry.flat_fee != null) return entry.flat_fee;
  if (entry.rate_per_hour != null && entry.hours != null) return entry.rate_per_hour * entry.hours;
  return 0;
}

function LaborForm({ onSave, onCancel }) {
  const [person, setPerson] = useState("");
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("");
  const [flatFee, setFlatFee] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [task, setTask] = useState("");
  const [roomName, setRoomName] = useState("");

  const applyPreset = (p) => {
    setPerson(p.person);
    setRate(p.rate_per_hour ?? "");
    setFlatFee(p.flat_fee ?? "");
  };

  return (
    <div className="purchase-form labor-form">
      <div className="labor-form-presets">
        {KNOWN_PEOPLE.map((p) => (
          <button key={p.person} type="button" className="preset-btn" onClick={() => applyPreset(p)}>
            {p.person}
          </button>
        ))}
      </div>
      <input type="text" placeholder="Person" value={person} onChange={(e) => setPerson(e.target.value)} />
      <input type="number" step="0.01" placeholder="Rate/hr" value={rate} onChange={(e) => setRate(e.target.value)} />
      <input type="number" step="0.25" placeholder="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
      <input type="number" step="0.01" placeholder="Flat fee" value={flatFee} onChange={(e) => setFlatFee(e.target.value)} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input type="text" placeholder="Task" value={task} onChange={(e) => setTask(e.target.value)} />
      <input type="text" placeholder="Room (optional)" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
      <button className="save-btn" onClick={() => onSave({
        person,
        rate_per_hour: rate === "" ? null : parseFloat(rate),
        hours: hours === "" ? null : parseFloat(hours),
        flat_fee: flatFee === "" ? null : parseFloat(flatFee),
        date, task, room_name: roomName || null,
      })}>Save</button>
      <button className="cancel-btn" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const cells = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else cur += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function guessColumn(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand));
    if (idx !== -1) return idx;
  }
  return -1;
}

function BankImport({ onImported }) {
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState({ date: -1, description: -1, amount: -1 });
  const [source, setSource] = useState("");
  const [importing, setImporting] = useState(false);

  const handleFile = async (file) => {
    const text = await file.text();
    const result = parseCsv(text);
    setParsed(result);
    setMapping({
      date: guessColumn(result.headers, ["date"]),
      description: guessColumn(result.headers, ["description", "name", "memo"]),
      amount: guessColumn(result.headers, ["amount"]),
    });
    setSource(file.name.toLowerCase().includes("chase") ? "chase" : file.name.toLowerCase().includes("rocket") ? "rocket_money" : "");
  };

  const ready = mapping.date >= 0 && mapping.description >= 0 && mapping.amount >= 0;

  const doImport = async () => {
    if (!parsed || !ready) return;
    setImporting(true);
    const rows = parsed.rows.map((r) => ({
      date: r[mapping.date] || null,
      description: r[mapping.description] || "",
      amount: parseFloat((r[mapping.amount] || "0").replace(/[$,]/g, "")) || 0,
      source,
    })).filter((r) => r.description);
    await api.importBankTransactions(rows);
    setImporting(false);
    setParsed(null);
    onImported?.();
  };

  return (
    <div className="bank-import">
      <input type="file" accept=".csv" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
      {parsed && (
        <div className="bank-import-preview">
          <p className="editor-hint">
            {parsed.rows.length} rows found. Map columns if the guess below looks wrong, then import.
          </p>
          <div className="column-mapping">
            {["date", "description", "amount"].map((field) => (
              <label key={field}>
                {field}
                <select value={mapping[field]} onChange={(e) => setMapping((m) => ({ ...m, [field]: parseInt(e.target.value, 10) }))}>
                  <option value={-1}>—</option>
                  {parsed.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <table className="price-options-table">
            <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              {parsed.rows.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  <td>{mapping.date >= 0 ? r[mapping.date] : ""}</td>
                  <td>{mapping.description >= 0 ? r[mapping.description] : ""}</td>
                  <td>{mapping.amount >= 0 ? r[mapping.amount] : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="save-btn" disabled={!ready || importing} onClick={doImport}>
            {importing ? "Importing…" : `Import ${parsed.rows.length} rows`}
          </button>
          <button className="cancel-btn" onClick={() => setParsed(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default function Budget() {
  const [resources, setResources] = useState([]);
  const [labor, setLabor] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [addingLabor, setAddingLabor] = useState(false);

  const reload = () => {
    api.getResources().then(setResources);
    api.getLabor().then(setLabor);
    api.getBankTransactions().then(setTransactions);
  };

  useEffect(() => { reload(); }, []);

  const materialsActual = resources.reduce((sum, r) => sum + (r.actual_cost || 0), 0);
  const laborTotal = labor.reduce((sum, l) => sum + laborCost(l), 0);
  const grandTotal = materialsActual + laborTotal;

  const saveLabor = async (patch) => {
    const created = await api.createLabor(patch);
    setLabor((ls) => [...ls, created]);
    setAddingLabor(false);
  };

  const deleteLaborEntry = async (id) => {
    await api.deleteLabor(id);
    setLabor((ls) => ls.filter((l) => l.id !== id));
  };

  const tagTransaction = async (id, patch) => {
    setTransactions((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await api.patchBankTransaction(id, patch);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Budget</h2>
      </div>

      <div className="cost-summary">
        <div className="cost-summary-item">
          <span className="cost-summary-label">Materials actual</span>
          <span className="cost-summary-value actual">{fmtMoney(materialsActual)}</span>
        </div>
        <div className="cost-summary-item">
          <span className="cost-summary-label">Labor total</span>
          <span className="cost-summary-value actual">{fmtMoney(laborTotal)}</span>
        </div>
        <div className="cost-summary-item">
          <span className="cost-summary-label">Grand total spent</span>
          <span className="cost-summary-value">{fmtMoney(grandTotal)}</span>
        </div>
      </div>

      <div className="category-block">
        <h3>Labor</h3>
        <table>
          <thead>
            <tr><th>Person</th><th>Rate/hr</th><th>Hours</th><th>Flat fee</th><th>Cost</th><th>Date</th><th>Task</th><th>Room</th><th></th></tr>
          </thead>
          <tbody>
            {labor.map((l) => (
              <tr key={l.id}>
                <td>{l.person}</td>
                <td>{l.rate_per_hour != null ? fmtMoney(l.rate_per_hour) : "—"}</td>
                <td>{l.hours ?? "—"}</td>
                <td>{l.flat_fee != null ? fmtMoney(l.flat_fee) : "—"}</td>
                <td className="actual-cost">{fmtMoney(laborCost(l))}</td>
                <td>{l.date || "—"}</td>
                <td>{l.task}</td>
                <td>{l.room_name || "—"}</td>
                <td><button className="edit-link" onClick={() => deleteLaborEntry(l.id)}>delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {addingLabor ? (
          <LaborForm onSave={saveLabor} onCancel={() => setAddingLabor(false)} />
        ) : (
          <button className="record-btn" onClick={() => setAddingLabor(true)}>Add labor entry</button>
        )}
      </div>

      <div className="category-block">
        <h3>Bank transactions</h3>
        <p className="editor-hint">
          Export a transaction history from Chase or Rocket Money as a CSV and import it here — nothing ever
          connects live to your bank account, this just reads the file you give it.
        </p>
        <BankImport onImported={reload} />
        {transactions.length > 0 && (
          <table>
            <thead>
              <tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th><th>Room</th></tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.description}</td>
                  <td>{fmtMoney(t.amount)}</td>
                  <td>
                    <input type="text" value={t.category || ""} placeholder="category"
                      onChange={(e) => tagTransaction(t.id, { category: e.target.value })} />
                  </td>
                  <td>
                    <input type="text" value={t.room_name || ""} placeholder="room"
                      onChange={(e) => tagTransaction(t.id, { room_name: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
