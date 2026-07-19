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

// Subtasks
export const getSubtasks = (threadId) => request(`/threads/${threadId}/subtasks`);
export const createSubtask = (threadId, data) =>
  request(`/threads/${threadId}/subtasks`, { method: 'POST', body: JSON.stringify(data) });
export const updateSubtask = (subtaskId, data) =>
  request(`/subtasks/${subtaskId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSubtask = (subtaskId) =>
  request(`/subtasks/${subtaskId}`, { method: 'DELETE' });
export const reorderSubtasks = (threadId, data) =>
  request(`/threads/${threadId}/subtasks/reorder`, { method: 'PUT', body: JSON.stringify(data) });

// Upsert log (create if no entry exists for date+metric+category, update if it does)
export async function upsertLog({ date, metric, category, value }) {
  // Check if an entry already exists for this date, metric, and category
  const existing = await getLogs({ category, metric, date_from: date, date_to: date });
  const match = existing.find(
    (log) => log.date === date && log.metric === metric && log.category === category
  );
  if (match) {
    return updateLog(match.id, { value });
  } else {
    return createLog({ date, category, metric, value });
  }
}

// Schedule
export const getTodaySchedule = () => request('/schedule/today');

// Gym
export const getGymExercises = (dayType) => request(`/gym/exercises${dayType ? `/${dayType}` : ''}`);
export const getGymHistory = (exerciseName, range = '3m') => request(`/gym/history/${encodeURIComponent(exerciseName)}?range=${range}`);

// Deadlines
export const getDeadlines = (params = {}) => {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  return request(`/deadlines${qs ? `?${qs}` : ''}`);
};
export const createDeadline = (data) =>
  request('/deadlines', { method: 'POST', body: JSON.stringify(data) });
export const updateDeadline = (id, data) =>
  request(`/deadlines/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteDeadline = (id) =>
  request(`/deadlines/${id}`, { method: 'DELETE' });

// Calendar
export const getCalendarEvents = (dateFrom, dateTo) =>
  request(`/calendar/events?date_from=${dateFrom}&date_to=${dateTo}`);

// Push Notifications
export const getVapidKey = () => request('/push/vapid-key');
export const subscribePush = (subscription) =>
  request('/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) });
export const unsubscribePush = (subscription) =>
  request('/push/unsubscribe', { method: 'DELETE', body: JSON.stringify(subscription) });
