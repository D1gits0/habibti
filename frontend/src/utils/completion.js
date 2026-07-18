/**
 * Compute the completion percentage for a list of subtask done-states.
 *
 * Formula: floor(count(done=true) / count(total) * 100)
 * Returns 0 when total is 0.
 *
 * @param {boolean[]} doneStates - Array of boolean values representing subtask completion states
 * @returns {number} Integer percentage (0-100), floored
 */
export function computeCompletionPercentage(doneStates) {
  const total = doneStates.length
  if (total === 0) return 0
  const doneCount = doneStates.filter(Boolean).length
  return Math.floor((doneCount / total) * 100)
}
