import { Fragment, useEffect, useState } from "react";
import { api } from "../api";

const STATUS_OPTIONS = ["needed", "ordered", "on_site", "installed", "in_progress"];

function parseQty(quantity) {
  const n = parseFloat(String(quantity).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function priceRange(priceOptions) {
  if (!priceOptions || priceOptions.length === 0) return null;
  const prices = priceOptions.map((p) => p.price);
  return { low: Math.min(...prices), high: Math.max(...prices) };
}

function fmtMoney(n) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function EstimateCell({ resource }) {
  const range = priceRange(resource.price_options);
  if (!range) return <span className="est-none">—</span>;
  const qty = parseQty(resource.quantity);
  if (qty && qty > 0) {
    const low = range.low * qty, high = range.high * qty;
    return <span className="est-range">{fmtMoney(low)}{high !== low ? `–${fmtMoney(high)}` : ""}</span>;
  }
  return <span className="est-range">{fmtMoney(range.low)}{range.high !== range.low ? `–${fmtMoney(range.high)}` : ""} <span className="est-perunit">/ {resource.price_options[0].unit}</span></span>;
}

function PurchaseForm({ resource, onSave, onCancel }) {
  const [cost, setCost] = useState(resource.actual_cost ?? "");
  const [vendor, setVendor] = useState(resource.actual_vendor ?? (resource.price_options[0]?.vendor || ""));
  const [date, setDate] = useState(resource.purchased_at ?? new Date().toISOString().slice(0, 10));

  return (
    <div className="purchase-form">
      <input type="number" step="0.01" placeholder="Cost paid" value={cost}
        onChange={(e) => setCost(e.target.value)} />
      <input type="text" placeholder="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button className="save-btn" onClick={() => onSave({ actual_cost: parseFloat(cost) || 0, actual_vendor: vendor, purchased_at: date })}>
        Save
      </button>
      <button className="cancel-btn" onClick={onCancel}>Cancel</button>
    </div>
  );
}

export default function ResourceList() {
  const [resources, setResources] = useState([]);
  const [filterSpace, setFilterSpace] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);

  useEffect(() => {
    api.getResources().then(setResources);
  }, []);

  const updateStatus = async (id, status) => {
    setResources((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    await api.patchResource(id, { status });
  };

  const savePurchase = async (id, patch) => {
    setResources((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, status: "on_site" } : r)));
    await api.patchResource(id, { ...patch, status: "on_site" });
    setEditingPurchaseId(null);
  };

  const clearPurchase = async (id) => {
    const patch = { actual_cost: null, actual_vendor: null, purchased_at: null };
    setResources((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await api.patchResource(id, patch);
  };

  const filtered = resources.filter((r) => filterSpace === "all" || r.space === filterSpace || r.space === "both");
  const byCategory = {};
  for (const r of filtered) {
    (byCategory[r.category] ||= []).push(r);
  }

  let estLow = 0, estHigh = 0, actualSpent = 0, purchasedCount = 0;
  for (const r of resources) {
    const range = priceRange(r.price_options);
    if (range) {
      const qty = parseQty(r.quantity) || 1;
      estLow += range.low * qty;
      estHigh += range.high * qty;
    }
    if (r.actual_cost != null) {
      actualSpent += r.actual_cost;
      purchasedCount += 1;
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Resource List</h2>
        <select value={filterSpace} onChange={(e) => setFilterSpace(e.target.value)}>
          <option value="all">All spaces</option>
          <option value="garage">Garage</option>
          <option value="basement">Basement</option>
        </select>
      </div>

      <div className="cost-summary">
        <div className="cost-summary-item">
          <span className="cost-summary-label">Estimated material cost</span>
          <span className="cost-summary-value">{fmtMoney(estLow)} – {fmtMoney(estHigh)}</span>
        </div>
        <div className="cost-summary-item">
          <span className="cost-summary-label">Actual spent so far</span>
          <span className="cost-summary-value actual">{fmtMoney(actualSpent)} <span className="cost-summary-sub">({purchasedCount} purchased)</span></span>
        </div>
      </div>

      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category} className="category-block">
          <h3>{category}</h3>
          <table>
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Space</th><th>Status</th><th>Est. cost</th><th>Actual</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td>
                      {r.price_options?.length > 0 ? (
                        <button className="link-toggle" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                          {r.name} {expandedId === r.id ? "▾" : "▸"}
                        </button>
                      ) : r.name}
                    </td>
                    <td>{r.quantity}{r.unit ? ` ${r.unit}` : ""}</td>
                    <td>{r.space}</td>
                    <td>
                      <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)}
                        className={`status status-${r.status}`}>
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                    </td>
                    <td><EstimateCell resource={r} /></td>
                    <td>
                      {editingPurchaseId === r.id ? null : r.actual_cost != null ? (
                        <span className="actual-cost">
                          {fmtMoney(r.actual_cost)}{r.actual_vendor ? ` (${r.actual_vendor})` : ""}
                          <button className="edit-link" onClick={() => setEditingPurchaseId(r.id)}>edit</button>
                          <button className="edit-link" onClick={() => clearPurchase(r.id)}>clear</button>
                        </span>
                      ) : (
                        <button className="record-btn" onClick={() => setEditingPurchaseId(r.id)}>Record purchase</button>
                      )}
                    </td>
                    <td className="notes-cell">{r.notes}</td>
                  </tr>
                  {editingPurchaseId === r.id && (
                    <tr key={`${r.id}-purchase`}>
                      <td colSpan={7}>
                        <PurchaseForm resource={r} onSave={(patch) => savePurchase(r.id, patch)} onCancel={() => setEditingPurchaseId(null)} />
                      </td>
                    </tr>
                  )}
                  {expandedId === r.id && r.price_options?.length > 0 && (
                    <tr key={`${r.id}-options`}>
                      <td colSpan={7}>
                        <table className="price-options-table">
                          <thead>
                            <tr><th>Vendor</th><th>Product</th><th>Price</th><th></th></tr>
                          </thead>
                          <tbody>
                            {r.price_options.map((p) => (
                              <tr key={p.id}>
                                <td>{p.vendor}</td>
                                <td>{p.product_name}{p.notes ? <span className="po-notes"> — {p.notes}</span> : null}</td>
                                <td>{fmtMoney(p.price)} / {p.unit}</td>
                                <td>
                                  {p.url ? (
                                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="buy-link">Order →</a>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
