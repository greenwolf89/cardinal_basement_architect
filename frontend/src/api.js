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
};
