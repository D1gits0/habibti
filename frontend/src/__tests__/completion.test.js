import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { computeCompletionPercentage } from '../utils/completion.js'

/**
 * Feature: compound-v3, Property 7: Completion percentage calculation
 *
 * **Validates: Requirements 4.10, 4.13**
 *
 * For any set of subtasks (across all nesting levels) belonging to a project,
 * the Completion_Percentage SHALL equal floor(count(done=true) / count(total) * 100).
 * When total is 0, the result SHALL be 0.
 */
describe('Property 7: Completion percentage calculation', () => {
  it('equals floor(doneCount / total * 100) for any array of done-states', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }),
        (doneStates) => {
          const result = computeCompletionPercentage(doneStates)
          const total = doneStates.length
          const doneCount = doneStates.filter(Boolean).length
          const expected = Math.floor((doneCount / total) * 100)

          expect(result).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns 0 when the subtask list is empty (total is 0)', () => {
    fc.assert(
      fc.property(
        fc.constant([]),
        (doneStates) => {
          const result = computeCompletionPercentage(doneStates)
          expect(result).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('result is always an integer between 0 and 100 inclusive', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 0, maxLength: 100 }),
        (doneStates) => {
          const result = computeCompletionPercentage(doneStates)

          expect(Number.isInteger(result)).toBe(true)
          expect(result).toBeGreaterThanOrEqual(0)
          expect(result).toBeLessThanOrEqual(100)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns 100 if and only if all subtasks are done (non-empty list)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }),
        (doneStates) => {
          const result = computeCompletionPercentage(doneStates)
          const allDone = doneStates.every(Boolean)

          if (allDone) {
            expect(result).toBe(100)
          } else {
            expect(result).toBeLessThan(100)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns 0 if and only if no subtasks are done (non-empty list)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }),
        (doneStates) => {
          const result = computeCompletionPercentage(doneStates)
          const noneDone = doneStates.every(s => !s)

          if (noneDone) {
            expect(result).toBe(0)
          } else {
            expect(result).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
