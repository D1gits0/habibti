/**
 * Compute current streak and best streak from a sorted array of date strings.
 * Dates should be in YYYY-MM-DD format, sorted ascending.
 *
 * A streak is consecutive days with at least one entry.
 * "Current" streak counts backward from today — if today is missing, the streak is 0.
 *
 * @param {string[]} dates - Sorted unique date strings (ascending)
 * @returns {{ current: number, best: number }}
 */
export function computeStreaks(dates) {
  if (!dates || dates.length === 0) return { current: 0, best: 0 }

  const uniqueDates = [...new Set(dates)].sort()
  const today = new Date().toISOString().split('T')[0]

  // Compute all streaks
  let best = 1
  let currentRun = 1

  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1])
    const curr = new Date(uniqueDates[i])
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      currentRun++
    } else {
      if (currentRun > best) best = currentRun
      currentRun = 1
    }
  }
  if (currentRun > best) best = currentRun

  // Compute current streak (counting back from today or yesterday)
  let current = 0
  const lastDate = uniqueDates[uniqueDates.length - 1]

  // Check if the last logged date is today or yesterday (active streak)
  const lastD = new Date(lastDate)
  const todayD = new Date(today)
  const daysSinceLast = Math.round((todayD - lastD) / (1000 * 60 * 60 * 24))

  if (daysSinceLast > 1) {
    // Streak is broken — last entry is more than 1 day ago
    current = 0
  } else {
    // Count backward from the last logged date
    current = 1
    for (let i = uniqueDates.length - 2; i >= 0; i--) {
      const curr = new Date(uniqueDates[i + 1])
      const prev = new Date(uniqueDates[i])
      const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24))
      if (diff === 1) {
        current++
      } else {
        break
      }
    }
  }

  return { current, best }
}
