/**
 * Compute the set of day numbers (1-31) that have at least one gym log entry
 * within the specified month and year.
 *
 * @param {Array<{date: string, category: string}>} logs - Array of log entries with date (YYYY-MM-DD) and category fields
 * @param {number} month - Month number (1-12)
 * @param {number} year - Full year (e.g. 2024)
 * @returns {number[]} Sorted array of unique day numbers that have gym entries in the given month/year
 */
export function computeGymDays(logs, month, year) {
  const days = new Set()

  for (const log of logs) {
    if (log.category !== 'gym') continue

    // Parse the date string (expected YYYY-MM-DD format)
    const parts = log.date.split('-')
    if (parts.length !== 3) continue

    const logYear = parseInt(parts[0], 10)
    const logMonth = parseInt(parts[1], 10)
    const logDay = parseInt(parts[2], 10)

    if (logYear === year && logMonth === month) {
      days.add(logDay)
    }
  }

  return [...days].sort((a, b) => a - b)
}
