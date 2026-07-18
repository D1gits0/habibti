import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { filterByTimeRange } from '../utils/timeRange.js'

/**
 * Feature: compound-v3, Property 13: Overload chart time range filter
 *
 * **Validates: Requirements 8.5**
 *
 * For any set of log entries for a given exercise and any selected time range
 * (1m, 3m, 6m, YTD), all data points displayed in the Overload_Chart SHALL have
 * dates within the selected time range, and no log entries within the range SHALL
 * be omitted.
 */

/**
 * Generator: produces a random YYYY-MM-DD date string within approximately 2 years
 * from a fixed reference point using integer-based generation to avoid invalid dates.
 */
const dateArb = fc.integer({ min: 0, max: 730 }).map((daysOffset) => {
  const base = new Date(2024, 0, 1)
  base.setDate(base.getDate() + daysOffset)
  return base.toISOString().split('T')[0]
})

const entryArb = dateArb.map((date) => ({ date, value: 100 }))

const entriesArb = fc.array(entryArb, { minLength: 0, maxLength: 50 })

const rangeArb = fc.constantFrom('1m', '3m', '6m', 'YTD')

/**
 * Helper: compute the start date string for a given range and reference date,
 * mirroring the production logic.
 */
function computeStartStr(range, now) {
  let start
  if (range === '1m') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  } else if (range === '3m') {
    start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  } else if (range === '6m') {
    start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  } else {
    start = new Date(now.getFullYear(), 0, 1)
  }
  return start.toISOString().split('T')[0]
}

describe('Property 13: Overload chart time range filter', () => {
  // Use a fixed reference date for deterministic testing
  const now = new Date(2025, 5, 15) // June 15, 2025

  it('all returned entries have dates within the selected time range', () => {
    fc.assert(
      fc.property(entriesArb, rangeArb, (entries, range) => {
        const result = filterByTimeRange(entries, range, now)
        const startStr = computeStartStr(range, now)

        for (const entry of result) {
          expect(entry.date >= startStr).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('no entries within the range are excluded from the result', () => {
    fc.assert(
      fc.property(entriesArb, rangeArb, (entries, range) => {
        const result = filterByTimeRange(entries, range, now)
        const startStr = computeStartStr(range, now)

        // Every entry in the original set that is within range must appear in result
        const inRangeEntries = entries.filter((e) => e.date >= startStr)
        expect(result.length).toBe(inRangeEntries.length)

        for (const entry of inRangeEntries) {
          expect(result).toContainEqual(entry)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('entries outside the range are excluded from the result', () => {
    fc.assert(
      fc.property(entriesArb, rangeArb, (entries, range) => {
        const result = filterByTimeRange(entries, range, now)
        const startStr = computeStartStr(range, now)

        // No entry in result should be before the start date
        for (const entry of result) {
          expect(entry.date < startStr).toBe(false)
        }

        // Entries before the start date must NOT appear in the result
        const outOfRangeEntries = entries.filter((e) => e.date < startStr)
        for (const entry of outOfRangeEntries) {
          expect(result).not.toContainEqual(entry)
        }
      }),
      { numRuns: 100 }
    )
  })
})
