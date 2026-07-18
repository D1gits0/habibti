/**
 * Filters log entries by a time range relative to the current date.
 *
 * @param {Array<{date: string}>} entries - Array of entries with ISO date strings (YYYY-MM-DD)
 * @param {'1m' | '3m' | '6m' | 'YTD'} range - Time range filter
 * @param {Date} [now] - Optional reference date (defaults to current date)
 * @returns {Array<{date: string}>} Filtered entries within the time range
 */
export function filterByTimeRange(entries, range, now = new Date()) {
  let start
  if (range === '1m') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  } else if (range === '3m') {
    start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  } else if (range === '6m') {
    start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  } else {
    // YTD
    start = new Date(now.getFullYear(), 0, 1)
  }
  const startStr = start.toISOString().split('T')[0]
  return entries.filter((e) => e.date >= startStr)
}
