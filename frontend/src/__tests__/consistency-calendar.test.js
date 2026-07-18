import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { computeGymDays } from '../utils/gymDays.js'

/**
 * Feature: compound-v3, Property 14: Consistency calendar highlights match gym log dates
 *
 * **Validates: Requirements 9.3**
 *
 * For any month and any set of Log_Entries with category "gym", the set of highlighted
 * days in the Consistency_Calendar SHALL equal exactly the set of unique dates within
 * that month that have at least one gym log entry.
 */

// Helper to get days in a month
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

// Generator for a gym log entry with a random date
const gymLogArb = fc.record({
  date: fc.tuple(
    fc.integer({ min: 2020, max: 2025 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }) // Use 28 to avoid invalid day-of-month issues
  ).map(([y, m, d]) => {
    const mm = String(m).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }),
  category: fc.constantFrom('gym', 'habit', 'fitness', 'nutrition'),
  metric: fc.constantFrom('Incline DB Press', 'Lat Pulldowns', 'Bulgarian Split Squat', 'Pull Ups'),
  value: fc.float({ min: 0, max: 500, noNaN: true }),
})

// Generator for target month/year
const monthArb = fc.integer({ min: 1, max: 12 })
const yearArb = fc.integer({ min: 2020, max: 2025 })

describe('Property 14: Consistency calendar highlights match gym log dates', () => {
  it('returned gym days exactly match unique days with gym entries in the target month', () => {
    fc.assert(
      fc.property(
        fc.array(gymLogArb, { minLength: 0, maxLength: 50 }),
        monthArb,
        yearArb,
        (logs, month, year) => {
          const result = computeGymDays(logs, month, year)

          // Compute expected: unique days from logs where category='gym' and date is in month/year
          const expectedDays = new Set()
          for (const log of logs) {
            if (log.category !== 'gym') continue
            const parts = log.date.split('-')
            const logYear = parseInt(parts[0], 10)
            const logMonth = parseInt(parts[1], 10)
            const logDay = parseInt(parts[2], 10)
            if (logYear === year && logMonth === month) {
              expectedDays.add(logDay)
            }
          }

          const expected = [...expectedDays].sort((a, b) => a - b)
          expect(result).toEqual(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no extra days are highlighted (result is subset of actual gym log dates)', () => {
    fc.assert(
      fc.property(
        fc.array(gymLogArb, { minLength: 0, maxLength: 50 }),
        monthArb,
        yearArb,
        (logs, month, year) => {
          const result = computeGymDays(logs, month, year)

          // Every day in the result must correspond to at least one gym log in that month
          for (const day of result) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const hasGymEntry = logs.some(
              (log) => log.category === 'gym' && log.date === dateStr
            )
            expect(hasGymEntry).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no gym days within the month are missed (all gym dates in month appear in result)', () => {
    fc.assert(
      fc.property(
        fc.array(gymLogArb, { minLength: 0, maxLength: 50 }),
        monthArb,
        yearArb,
        (logs, month, year) => {
          const result = computeGymDays(logs, month, year)
          const resultSet = new Set(result)

          // Every gym log in the target month must have its day in the result
          for (const log of logs) {
            if (log.category !== 'gym') continue
            const parts = log.date.split('-')
            const logYear = parseInt(parts[0], 10)
            const logMonth = parseInt(parts[1], 10)
            const logDay = parseInt(parts[2], 10)
            if (logYear === year && logMonth === month) {
              expect(resultSet.has(logDay)).toBe(true)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result contains only valid day numbers for the given month (1 to daysInMonth)', () => {
    fc.assert(
      fc.property(
        fc.array(gymLogArb, { minLength: 0, maxLength: 50 }),
        monthArb,
        yearArb,
        (logs, month, year) => {
          const result = computeGymDays(logs, month, year)
          const maxDay = daysInMonth(year, month)

          for (const day of result) {
            expect(day).toBeGreaterThanOrEqual(1)
            expect(day).toBeLessThanOrEqual(maxDay)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result has no duplicates (each day appears at most once)', () => {
    fc.assert(
      fc.property(
        fc.array(gymLogArb, { minLength: 0, maxLength: 50 }),
        monthArb,
        yearArb,
        (logs, month, year) => {
          const result = computeGymDays(logs, month, year)
          const unique = new Set(result)
          expect(result.length).toBe(unique.size)
        }
      ),
      { numRuns: 100 }
    )
  })
})
