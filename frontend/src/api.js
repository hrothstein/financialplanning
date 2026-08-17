/**
 * Tiny fetch wrapper for the Financial Planning REST API.
 *
 * Uses relative URLs (`/api/v1/...`) so it works both in dev (Vite proxies to
 * :3003) and in production (Express serves this SPA from the same origin).
 */

const BASE = '/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  getPortfolioOverview: () => request('/portfolio/overview'),

  listClients: (params = '') => request(`/clients${params}`),
  getClient: (id) => request(`/clients/${id}`),
  getClientSummary: (id) => request(`/clients/${id}/summary`),
  getNetWorth: (id) => request(`/clients/${id}/net-worth`),
  listAssets: (id) => request(`/clients/${id}/assets`),

  listGoals: (params = '') => request(`/goals${params}`),
  getGoal: (id) => request(`/goals/${id}`),
  getProjection: (id) => request(`/goals/${id}/projection`),
  getMonteCarlo: (id, q = '') => request(`/goals/${id}/monte-carlo${q}`),

  listPlans: (params = '') => request(`/plans${params}`),
  getPlan: (id) => request(`/plans/${id}`),
  getPlanSummary: (id) => request(`/plans/${id}/summary`),
  getPlanMonteCarlo: (id, q = '') => request(`/plans/${id}/monte-carlo${q}`),

  reset: () => request('/demo/reset', { method: 'POST' }),
};
