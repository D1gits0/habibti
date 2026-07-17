const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
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

// Natural Language
export const parseNaturalLanguage = (data) =>
  request('/nl/parse', { method: 'POST', body: JSON.stringify(data) });

// Schedule
export const getTodaySchedule = () => request('/schedule/today');
export const getWeekSchedule = (startDate) =>
  request(`/schedule/week${startDate ? `?start_date=${startDate}` : ''}`);
export const getScheduleConfig = () => request('/schedule/config');
export const updateScheduleConfig = (data) =>
  request('/schedule/config', { method: 'PUT', body: JSON.stringify(data) });
export const shiftSchedule = (data) =>
  request('/schedule/shift', { method: 'POST', body: JSON.stringify(data) });
