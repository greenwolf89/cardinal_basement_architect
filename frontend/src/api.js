// In production the frontend is served from the same FastAPI app, so a
// relative path (same origin) just works. Local dev overrides this via
// VITE_API_BASE (see .env.development) to hit the standalone uvicorn server.
const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`${options?.method || "GET"} ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  getStage: (key) => request(`/stages/by-key/${key}`),
  getResources: () => request("/resources"),
  patchResource: (id, patch) =>
    request(`/resources/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  getChecklist: () => request("/checklist"),
  patchChecklistItem: (id, patch) =>
    request(`/checklist/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  createFeature: (feature) => request("/features", { method: "POST", body: JSON.stringify(feature) }),
  patchFeature: (id, patch) =>
    request(`/features/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteFeature: (id) => request(`/features/${id}`, { method: "DELETE" }),
  patchRoom: (id, patch) =>
    request(`/rooms/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  getLabor: () => request("/labor"),
  createLabor: (entry) => request("/labor", { method: "POST", body: JSON.stringify(entry) }),
  patchLabor: (id, patch) =>
    request(`/labor/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteLabor: (id) => request(`/labor/${id}`, { method: "DELETE" }),

  getBankTransactions: () => request("/bank-transactions"),
  importBankTransactions: (rows) =>
    request("/bank-transactions/bulk-import", { method: "POST", body: JSON.stringify(rows) }),
  patchBankTransaction: (id, patch) =>
    request(`/bank-transactions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteBankTransaction: (id) => request(`/bank-transactions/${id}`, { method: "DELETE" }),

  getPresets: (stageId) => request(`/presets?stage_id=${stageId}`),
  createPreset: (stageId, name) =>
    request("/presets", { method: "POST", body: JSON.stringify({ stage_id: stageId, name }) }),
  patchPreset: (id, patch) =>
    request(`/presets/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  loadPreset: (id) => request(`/presets/${id}/load`, { method: "POST" }),
  deletePreset: (id) => request(`/presets/${id}`, { method: "DELETE" }),
};
