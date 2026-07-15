const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Threads
export const getThreads = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/threads${qs ? `?${qs}` : ''}`);
};
export const createThread = (data) =>
  request('/threads', { method: 'POST', body: JSON.stringify(data) });
export const updateThread = (id, data) =>
  request(`/threads/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteThread = (id) =>
  request(`/threads/${id}`, { method: 'DELETE' });

// Logs
export const getLogs = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString();
  return request(`/logs${qs ? `?${qs}` : ''}`);
};
export const createLog = (data) =>
  request('/logs', { method: 'POST', body: JSON.stringify(data) });
export const updateLog = (id, data) =>
  request(`/logs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteLog = (id) =>
  request(`/logs/${id}`, { method: 'DELETE' });
