/**
 * Compute current streak and best streak from a sorted array of date strings.
 * 
 * @param {string[]} dates - Sorted unique date strings (ascending) of logged workouts
 * @param {Set<string>} [skipDates] - Dates to skip (rest days) — these don't break or count toward streaks
 * @returns {{ current: number, best: number }}
 */
export function computeStreaks(dates, skipDates = new Set()) {
  if (!dates || dates.length === 0) return { current: 0, best: 0 }

  const uniqueDates = [...new Set(dates)].sort()
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Helper: get the next expected workout day (skipping rest days) going backward
  function getPrevWorkoutDate(dateStr) {
    const d = new Date(dateStr)
    d.setDate(d.getDate() - 1)
    // Skip rest days
    let attempts = 0
    while (attempts < 7) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!skipDates.has(ds)) return ds
      d.setDate(d.getDate() - 1)
      attempts++
    }
    return null
  }

  // Compute best streak
  let best = 1
  let currentRun = 1
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1])
    const curr = new Date(uniqueDates[i])
    // Count non-skip days between prev and curr
    let workDaysBetween = 0
    const check = new Date(prev)
    check.setDate(check.getDate() + 1)
    while (check < curr) {
      const cs = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`
      if (!skipDates.has(cs)) workDaysBetween++
      check.setDate(check.getDate() + 1)
    }
    if (workDaysBetween === 0) {
      // Consecutive (only rest days between them)
      currentRun++
    } else {
      if (currentRun > best) best = currentRun
      currentRun = 1
    }
  }
  if (currentRun > best) best = currentRun

  // Compute current streak from today backward
  let current = 0
  const lastDate = uniqueDates[uniqueDates.length - 1]

  // Check if today (or the most recent non-rest day) has a workout
  // Walk backward from today to find the last expected workout day
  let checkDate = today
  let missedWorkoutDays = 0
  while (missedWorkoutDays < 3) {
    if (skipDates.has(checkDate)) {
      // Rest day — skip it
      const d = new Date(checkDate)
      d.setDate(d.getDate() - 1)
      checkDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      continue
    }
    if (uniqueDates.includes(checkDate)) {
      break // Found a logged workout day
    }
    missedWorkoutDays++
    const d = new Date(checkDate)
    d.setDate(d.getDate() - 1)
    checkDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  if (missedWorkoutDays >= 2) {
    current = 0
  } else {
    // Count backward through logged dates, skipping rest days between them
    current = 1
    for (let i = uniqueDates.length - 2; i >= 0; i--) {
      const curr = new Date(uniqueDates[i + 1])
      const prev = new Date(uniqueDates[i])
      let workDaysBetween = 0
      const c = new Date(prev)
      c.setDate(c.getDate() + 1)
      while (c < curr) {
        const cs = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`
        if (!skipDates.has(cs)) workDaysBetween++
        c.setDate(c.getDate() + 1)
      }
      if (workDaysBetween === 0) {
        current++
      } else {
        break
      }
    }
  }

  return { current, best }
}
