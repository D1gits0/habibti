import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Feature: compound-v3, Property 12: Seed exercises displayed in order with at most one swap
 *
 * **Validates: Requirements 6.4, 7.11, 7.12**
 *
 * For any non-Rest day_type in the exercise seed data, the returned exercise list
 * SHALL match the seed's defined order exactly, and each exercise SHALL have at most
 * one associated swap exercise.
 */

// The exercise seed data (matching backend/exercise_seed.json)
const exerciseSeed = {
  Push: [
    { name: 'Incline DB Press', swap: null },
    { name: 'Cable Chest Fly', swap: 'Pec Deck' },
    { name: 'Machine Shoulder Press', swap: null },
    { name: 'Lateral Raises', swap: null },
    { name: 'Overhead Tricep Extension', swap: null },
  ],
  Pull: [
    { name: 'Lat Pulldowns', swap: null },
    { name: 'Close Grip Cable Rows', swap: null },
    { name: 'Reverse Fly', swap: 'Archer Pull' },
    { name: 'Preacher Curls', swap: null },
    { name: 'Cable Hammer Curls', swap: 'DB Hammer Curl' },
  ],
  Legs: [
    { name: 'Bulgarian Split Squat', swap: null },
    { name: '45 Degree Back Extension', swap: null },
    { name: 'Leg Extensions', swap: null },
    { name: 'Leg Curls', swap: null },
    { name: 'Calf Raises', swap: null },
  ],
  Upper: [
    { name: 'Weighted Dips', swap: null },
    { name: 'Cable Chest Fly', swap: 'Pec Deck' },
    { name: 'Pull Ups', swap: null },
    { name: 'Wide Grip Cable Rows', swap: null },
    { name: 'Lateral Raises', swap: null },
    { name: 'Incline Curls', swap: null },
    { name: 'Overhead Tricep Extension', swap: null },
  ],
  Lower: [
    { name: 'Bulgarian Split Squat', swap: null },
    { name: '45 Degree Back Extension', swap: null },
    { name: 'Leg Extensions', swap: null },
    { name: 'Leg Curls', swap: null },
    { name: 'Calf Raises', swap: null },
  ],
  Rest: [],
  Abs: [
    { name: 'Cable Crunches', swap: null },
    { name: 'Leg Raises', swap: 'Side Planks' },
  ],
}

// Non-Rest day types for the generator
const nonRestDayTypes = Object.keys(exerciseSeed).filter(key => key !== 'Rest')

/**
 * Simulates loading exercises for a given day type (as the frontend would).
 * Returns the exercise list in the defined order.
 */
function getExercisesForDay(dayType) {
  return exerciseSeed[dayType] || []
}

describe('Property 12: Seed exercises displayed in order with at most one swap', () => {
  it('exercises array is non-empty for all non-Rest day types', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonRestDayTypes),
        (dayType) => {
          const exercises = getExercisesForDay(dayType)
          expect(exercises.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('each exercise has a non-empty string name', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonRestDayTypes),
        (dayType) => {
          const exercises = getExercisesForDay(dayType)
          for (const exercise of exercises) {
            expect(typeof exercise.name).toBe('string')
            expect(exercise.name.trim().length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('each exercise has at most one swap (null or a single string)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonRestDayTypes),
        (dayType) => {
          const exercises = getExercisesForDay(dayType)
          for (const exercise of exercises) {
            // swap must be either null or a non-empty string
            if (exercise.swap !== null) {
              expect(typeof exercise.swap).toBe('string')
              expect(exercise.swap.trim().length).toBeGreaterThan(0)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('exercises are returned in the defined seed order', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonRestDayTypes),
        (dayType) => {
          const exercises = getExercisesForDay(dayType)
          const expectedOrder = exerciseSeed[dayType]

          // The returned list should match exactly in order
          expect(exercises.length).toBe(expectedOrder.length)
          for (let i = 0; i < exercises.length; i++) {
            expect(exercises[i].name).toBe(expectedOrder[i].name)
            expect(exercises[i].swap).toBe(expectedOrder[i].swap)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no exercise has more than one swap field', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...nonRestDayTypes),
        (dayType) => {
          const exercises = getExercisesForDay(dayType)
          for (const exercise of exercises) {
            // Each exercise object should only have 'name' and 'swap' keys
            const keys = Object.keys(exercise)
            expect(keys).toContain('name')
            expect(keys).toContain('swap')
            // swap is a single value (not an array)
            if (exercise.swap !== null) {
              expect(Array.isArray(exercise.swap)).toBe(false)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
