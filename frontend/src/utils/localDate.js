/**
 * Get today's date as a YYYY-MM-DD string in the user's local timezone.
 * This avoids the UTC timezone bug where toISOString() can shift the date.
 */
export function localToday() {
  const d = new Date()
  return formatLocalDate(d)
}

/**
 * Format a Date object as YYYY-MM-DD in the user's local timezone.
 */
export function formatLocalDate(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
