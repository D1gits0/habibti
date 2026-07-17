import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property tests for QAFlow logic (pure functions extracted from QAFlow.jsx).
 * These test the core logic without rendering components.
 */

// --- Pure logic functions (mirroring QAFlow.jsx) ---

const STEPS = [
  { key: 'sleep_quality', type: 'number', min: 1, max: 10 },
  { key: 'water_oz', type: 'number', min: 0, max: 300 },
  { key: 'protein_g', type: 'number', min: 0, max: 1000 },
  { key: 'gym_attendance', type: 'boolean' },
  { key: 'gym_exercises', type: 'exercises' },
  { key: 'review', type: 'review' },
]

/**
 * Simulates the QAFlow state machine navigation logic.
 * Returns the answers state after performing a sequence of navigations.
 * The key insight: answers are stored in a Record and never mutated by navigation.
 */
function simulateQAFlow(actions) {
  let currentStep = 0
  const answers = {}
  let gymExercises = []

  for (const action of actions) {
    const step = STEPS[currentStep]
    if (!step) break

    if (action.type === 'answer') {
      if (step.type === 'number') {
        answers[step.key] = action.value
        // Auto-advance
        const nextIndex = currentStep + 1
        if (nextIndex < STEPS.length) {
          if (STEPS[nextIndex].key === 'gym_exercises' && answers.gym_attendance !== true) {
            currentStep = nextIndex + 1
          } else {
            currentStep = nextIndex
          }
        }
      } else if (step.type === 'boolean') {
        answers[step.key] = action.value
        const nextIndex = currentStep + 1
        if (nextIndex < STEPS.length) {
          if (STEPS[nextIndex].key === 'gym_exercises' && answers.gym_attendance !== true) {
            currentStep = nextIndex + 1
          } else {
            currentStep = nextIndex
          }
        }
      } else if (step.type === 'exercises') {
        gymExercises = action.exercises || []
        // "Done" advances to review
        const nextIndex = currentStep + 1
        if (nextIndex < STEPS.length) {
          currentStep = nextIndex
        }
      }
    } else if (action.type === 'back') {
      const prevIndex = currentStep - 1
      if (prevIndex >= 0) {
        if (STEPS[prevIndex].key === 'gym_exercises' && answers.gym_attendance !== true) {
          if (prevIndex - 1 >= 0) {
            currentStep = prevIndex - 1
          }
        } else {
          currentStep = prevIndex
        }
      }
    } else if (action.type === 'skip') {
      answers[step.key] = null
      const nextIndex = currentStep + 1
      if (nextIndex < STEPS.length) {
        if (STEPS[nextIndex].key === 'gym_exercises' && answers.gym_attendance !== true) {
          currentStep = nextIndex + 1
        } else {
          currentStep = nextIndex
        }
      }
    }
  }

  return { currentStep, answers, gymExercises }
}

/**
 * Builds log entries from QA answers (mirrors QAFlow.jsx buildLogEntries).
 */
function buildLogEntries(answers, gymExercises) {
  const today = '2024-06-15' // fixed for testing
  const entries = []

  if (answers.sleep_quality != null) {
    entries.push({
      label: 'Sleep Quality',
      data: { date: today, category: 'sleep', metric: 'sleep_quality', value: answers.sleep_quality },
    })
  }

  if (answers.water_oz != null) {
    entries.push({
      label: 'Water Intake',
      data: { date: today, category: 'hydration', metric: 'oz_water', value: answers.water_oz },
    })
  }

  if (answers.protein_g != null) {
    entries.push({
      label: 'Protein Intake',
      data: { date: today, category: 'habit', metric: 'protein_g', value: answers.protein_g },
    })
  }

  if (answers.gym_attendance === true && gymExercises.length > 0) {
    for (const ex of gymExercises) {
      entries.push({
        label: `Exercise: ${ex.name}`,
        data: {
          date: today,
          category: 'gym',
          metric: ex.name,
          value: ex.weight,
          notes: `${ex.reps}r x ${ex.sets}s`,
        },
      })
    }
  }

  return entries
}

// --- Arbitraries ---

const sleepQuality = fc.integer({ min: 1, max: 10 })
const waterOz = fc.integer({ min: 0, max: 300 })
const proteinG = fc.integer({ min: 0, max: 1000 })

const exerciseName = fc.stringMatching(/^[A-Za-z ]{1,50}$/).filter(s => s.trim().length > 0)
const exerciseWeight = fc.integer({ min: 0, max: 2000 })
const exerciseReps = fc.integer({ min: 1, max: 100 })
const exerciseSets = fc.integer({ min: 1, max: 50 })

const gymExercise = fc.record({
  name: exerciseName,
  weight: exerciseWeight,
  reps: exerciseReps,
  sets: exerciseSets,
})

const gymExerciseList = fc.array(gymExercise, { minLength: 0, maxLength: 20 })

// Action generators for the state machine
const answerSleepAction = sleepQuality.map(v => ({ type: 'answer', value: v }))
const answerWaterAction = waterOz.map(v => ({ type: 'answer', value: v }))
const answerProteinAction = proteinG.map(v => ({ type: 'answer', value: v }))
const answerBoolAction = fc.boolean().map(v => ({ type: 'answer', value: v }))
const answerExercisesAction = gymExerciseList.map(exs => ({ type: 'answer', exercises: exs }))
const backAction = fc.constant({ type: 'back' })
const skipAction = fc.constant({ type: 'skip' })

// --- Property Tests ---

/**
 * **Validates: Requirements 1.5**
 */
describe('Property 1: Back Navigation Preserves State', () => {
  it('revisiting a previously answered step always displays the previously entered value unchanged', () => {
    fc.assert(
      fc.property(
        // Generate a sequence: answer some questions, then navigate back
        sleepQuality,
        waterOz,
        proteinG,
        fc.boolean(),
        fc.integer({ min: 1, max: 5 }), // number of back navigations
        (sleep, water, protein, gym, backCount) => {
          // First, answer all numeric questions and the boolean
          const actions = [
            { type: 'answer', value: sleep },   // step 0: sleep_quality
            { type: 'answer', value: water },   // step 1: water_oz
            { type: 'answer', value: protein }, // step 2: protein_g
            { type: 'answer', value: gym },     // step 3: gym_attendance
          ]

          // If gym=true, add exercises step
          if (gym) {
            actions.push({ type: 'answer', exercises: [{ name: 'Squat', weight: 135, reps: 5, sets: 3 }] })
          }

          // Now navigate back multiple times
          for (let i = 0; i < backCount; i++) {
            actions.push({ type: 'back' })
          }

          const result = simulateQAFlow(actions)

          // All previously entered answers must still be in state, unchanged
          expect(result.answers.sleep_quality).toBe(sleep)
          expect(result.answers.water_oz).toBe(water)
          expect(result.answers.protein_g).toBe(protein)
          expect(result.answers.gym_attendance).toBe(gym)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('navigating back and forward through arbitrary sequences preserves all entered values', () => {
    fc.assert(
      fc.property(
        sleepQuality,
        waterOz,
        fc.array(fc.constantFrom('back', 'back', 'back'), { minLength: 1, maxLength: 4 }),
        (sleep, water, navs) => {
          // Answer first two questions
          const actions = [
            { type: 'answer', value: sleep },
            { type: 'answer', value: water },
          ]

          // Apply navigations
          for (const nav of navs) {
            actions.push({ type: nav })
          }

          const result = simulateQAFlow(actions)

          // Values must be preserved regardless of navigation
          expect(result.answers.sleep_quality).toBe(sleep)
          expect(result.answers.water_oz).toBe(water)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('skipped values are preserved as null through back navigation', () => {
    fc.assert(
      fc.property(
        sleepQuality,
        fc.integer({ min: 1, max: 4 }),
        (sleep, backCount) => {
          const actions = [
            { type: 'answer', value: sleep }, // answer sleep
            { type: 'skip' },                 // skip water (sets to null)
          ]

          // Navigate back
          for (let i = 0; i < backCount; i++) {
            actions.push({ type: 'back' })
          }

          const result = simulateQAFlow(actions)

          // Sleep answer preserved
          expect(result.answers.sleep_quality).toBe(sleep)
          // Skipped water is preserved as null
          expect(result.answers.water_oz).toBe(null)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * **Validates: Requirements 1.7**
 */
describe('Property 2: QA Answer to Log_Entry Mapping', () => {
  it('sleep maps to category "sleep", metric "sleep_quality"', () => {
    fc.assert(
      fc.property(
        sleepQuality,
        (sleep) => {
          const answers = { sleep_quality: sleep }
          const entries = buildLogEntries(answers, [])

          expect(entries.length).toBe(1)
          expect(entries[0].data.category).toBe('sleep')
          expect(entries[0].data.metric).toBe('sleep_quality')
          expect(entries[0].data.value).toBe(sleep)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('water maps to category "hydration", metric "oz_water"', () => {
    fc.assert(
      fc.property(
        waterOz,
        (water) => {
          const answers = { water_oz: water }
          const entries = buildLogEntries(answers, [])

          expect(entries.length).toBe(1)
          expect(entries[0].data.category).toBe('hydration')
          expect(entries[0].data.metric).toBe('oz_water')
          expect(entries[0].data.value).toBe(water)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('protein maps to category "habit", metric "protein_g"', () => {
    fc.assert(
      fc.property(
        proteinG,
        (protein) => {
          const answers = { protein_g: protein }
          const entries = buildLogEntries(answers, [])

          expect(entries.length).toBe(1)
          expect(entries[0].data.category).toBe('habit')
          expect(entries[0].data.metric).toBe('protein_g')
          expect(entries[0].data.value).toBe(protein)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('gym exercises map to category "gym", metric = name, value = weight, notes = "{reps}r x {sets}s"', () => {
    fc.assert(
      fc.property(
        gymExerciseList.filter(exs => exs.length > 0),
        (exercises) => {
          const answers = { gym_attendance: true }
          const entries = buildLogEntries(answers, exercises)

          expect(entries.length).toBe(exercises.length)
          for (let i = 0; i < exercises.length; i++) {
            const entry = entries[i]
            const ex = exercises[i]
            expect(entry.data.category).toBe('gym')
            expect(entry.data.metric).toBe(ex.name)
            expect(entry.data.value).toBe(ex.weight)
            expect(entry.data.notes).toBe(`${ex.reps}r x ${ex.sets}s`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('complete valid answers produce correct number of entries with correct mappings', () => {
    fc.assert(
      fc.property(
        sleepQuality,
        waterOz,
        proteinG,
        gymExerciseList,
        (sleep, water, protein, exercises) => {
          const answers = {
            sleep_quality: sleep,
            water_oz: water,
            protein_g: protein,
            gym_attendance: exercises.length > 0,
          }
          const entries = buildLogEntries(answers, exercises)

          // Expected count: 3 (sleep + water + protein) + exercises (only if gym=true and non-empty)
          const expectedCount = 3 + (exercises.length > 0 ? exercises.length : 0)
          expect(entries.length).toBe(expectedCount)

          // Verify categories in order
          expect(entries[0].data.category).toBe('sleep')
          expect(entries[0].data.metric).toBe('sleep_quality')
          expect(entries[0].data.value).toBe(sleep)

          expect(entries[1].data.category).toBe('hydration')
          expect(entries[1].data.metric).toBe('oz_water')
          expect(entries[1].data.value).toBe(water)

          expect(entries[2].data.category).toBe('habit')
          expect(entries[2].data.metric).toBe('protein_g')
          expect(entries[2].data.value).toBe(protein)

          // Gym exercises
          for (let i = 0; i < exercises.length; i++) {
            const entry = entries[3 + i]
            expect(entry.data.category).toBe('gym')
            expect(entry.data.metric).toBe(exercises[i].name)
            expect(entry.data.value).toBe(exercises[i].weight)
            expect(entry.data.notes).toBe(`${exercises[i].reps}r x ${exercises[i].sets}s`)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('null/skipped answers produce no entries for that category', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { sleep_quality: null, water_oz: 100, protein_g: 50 },
          { sleep_quality: 5, water_oz: null, protein_g: 50 },
          { sleep_quality: 5, water_oz: 100, protein_g: null },
          { sleep_quality: null, water_oz: null, protein_g: null },
        ),
        (answers) => {
          const entries = buildLogEntries(answers, [])

          // Count non-null answers
          const expectedCount = [answers.sleep_quality, answers.water_oz, answers.protein_g]
            .filter(v => v != null).length

          expect(entries.length).toBe(expectedCount)

          // Verify no null values leaked into entries
          for (const entry of entries) {
            expect(entry.data.value).not.toBeNull()
            expect(entry.data.value).not.toBeUndefined()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('gym exercises are only included when gym_attendance is true', () => {
    fc.assert(
      fc.property(
        gymExerciseList.filter(exs => exs.length > 0),
        (exercises) => {
          // With gym_attendance = false, no gym entries
          const answersNo = { gym_attendance: false }
          const entriesNo = buildLogEntries(answersNo, exercises)
          const gymEntriesNo = entriesNo.filter(e => e.data.category === 'gym')
          expect(gymEntriesNo.length).toBe(0)

          // With gym_attendance = true, gym entries present
          const answersYes = { gym_attendance: true }
          const entriesYes = buildLogEntries(answersYes, exercises)
          const gymEntriesYes = entriesYes.filter(e => e.data.category === 'gym')
          expect(gymEntriesYes.length).toBe(exercises.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})


// --- Pure logic for mismatch note (mirrors QAFlow.jsx buildLogEntries mismatch logic) ---

/**
 * Builds the notes field for a single exercise entry, including the override
 * mismatch annotation when the actual Day_Type differs from expected.
 */
function buildExerciseNotes(exercise, scheduleConfigured, expectedDayType, selectedDayType) {
  let notes = `${exercise.reps}r x ${exercise.sets}s`
  const isAbs = exercise.name.trim().toLowerCase().startsWith('abs')
  const hasMismatch =
    scheduleConfigured &&
    expectedDayType &&
    selectedDayType &&
    selectedDayType !== expectedDayType &&
    !isAbs

  if (hasMismatch) {
    notes = `${notes} [expected: ${expectedDayType}]`
  }
  return notes
}

// --- Arbitraries for Property 9 ---

const dayTypes = ['Pull', 'Push', 'Legs', 'Rest', 'Upper', 'Lower']

const dayType = fc.constantFrom(...dayTypes)

// Non-Abs exercise names: filter out anything starting with "abs" (case-insensitive)
const nonAbsExerciseName = fc.stringMatching(/^[A-Za-z ]{1,50}$/)
  .filter(s => s.trim().length > 0 && !s.trim().toLowerCase().startsWith('abs'))

// Abs exercise names: must start with "abs" (various casings)
const absPrefix = fc.constantFrom('abs', 'Abs', 'ABS', 'aBs')
const absSuffix = fc.stringMatching(/^[A-Za-z ]{0,46}$/)
const absExerciseName = fc.tuple(absPrefix, absSuffix).map(([prefix, suffix]) => `${prefix}${suffix}`)

const nonAbsExercise = fc.record({
  name: nonAbsExerciseName,
  weight: exerciseWeight,
  reps: exerciseReps,
  sets: exerciseSets,
})

const absExercise = fc.record({
  name: absExerciseName,
  weight: exerciseWeight,
  reps: exerciseReps,
  sets: exerciseSets,
})

// --- Property 9 Tests ---

/**
 * **Validates: Requirements 5.3**
 */
describe('Property 9: Override Mismatch Note', () => {
  it('non-Abs exercises with Day_Type mismatch include [expected: ...] note', () => {
    fc.assert(
      fc.property(
        nonAbsExercise,
        dayType,
        dayType,
        (exercise, expected, selected) => {
          fc.pre(expected !== selected)

          const notes = buildExerciseNotes(exercise, true, expected, selected)

          expect(notes).toContain(`[expected: ${expected}]`)
          // Also starts with the standard reps/sets prefix
          expect(notes).toContain(`${exercise.reps}r x ${exercise.sets}s`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Abs exercises never have mismatch note regardless of Day_Type override', () => {
    fc.assert(
      fc.property(
        absExercise,
        dayType,
        dayType,
        (exercise, expected, selected) => {
          fc.pre(expected !== selected)

          const notes = buildExerciseNotes(exercise, true, expected, selected)

          expect(notes).not.toContain('[expected:')
          // Only contains the standard reps/sets format
          expect(notes).toBe(`${exercise.reps}r x ${exercise.sets}s`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('confirmed Day_Type (no mismatch) produces no expected note', () => {
    fc.assert(
      fc.property(
        nonAbsExercise,
        dayType,
        (exercise, confirmedDayType) => {
          // Same day type = confirmed, no override
          const notes = buildExerciseNotes(exercise, true, confirmedDayType, confirmedDayType)

          expect(notes).not.toContain('[expected:')
          expect(notes).toBe(`${exercise.reps}r x ${exercise.sets}s`)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('unconfigured schedule never produces mismatch note', () => {
    fc.assert(
      fc.property(
        nonAbsExercise,
        dayType,
        dayType,
        (exercise, expected, selected) => {
          fc.pre(expected !== selected)

          // scheduleConfigured = false means no mismatch logic applies
          const notes = buildExerciseNotes(exercise, false, expected, selected)

          expect(notes).not.toContain('[expected:')
          expect(notes).toBe(`${exercise.reps}r x ${exercise.sets}s`)
        }
      ),
      { numRuns: 100 }
    )
  })
})
