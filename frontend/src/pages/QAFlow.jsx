import { useState, useRef, useEffect } from 'react'
import { createLog, getTodaySchedule } from '../api'

const MAX_EXERCISES = 20
const EXERCISE_CONSTRAINTS = {
  name: { maxLength: 50 },
  weight: { min: 0, max: 2000 },
  reps: { min: 1, max: 100 },
  sets: { min: 1, max: 50 },
}

const DAY_TYPE_OPTIONS = ['Pull', 'Push', 'Legs', 'Upper', 'Lower']

const EMPTY_EXERCISE_FORM = { name: '', weight: '', reps: '', sets: '' }

const STEPS = [
  {
    key: 'sleep_quality',
    label: 'Sleep Quality',
    question: 'How would you rate your sleep quality?',
    type: 'number',
    min: 1,
    max: 10,
    placeholder: '1-10',
    unit: '/ 10',
  },
  {
    key: 'water_oz',
    label: 'Water Intake',
    question: 'How much water did you drink today?',
    type: 'number',
    min: 0,
    max: 300,
    placeholder: '0-300',
    unit: 'oz',
  },
  {
    key: 'protein_g',
    label: 'Protein Intake',
    question: 'How much protein did you consume today?',
    type: 'number',
    min: 0,
    max: 1000,
    placeholder: '0-1000',
    unit: 'g',
  },
  {
    key: 'gym_attendance',
    label: 'Gym',
    question: 'Did you go to the gym today?',
    type: 'boolean',
  },
  {
    key: 'gym_exercises',
    label: 'Exercises',
    question: 'Log your exercises',
    type: 'exercises',
  },
  {
    key: 'review',
    label: 'Review',
    question: 'Review your entries',
    type: 'review',
  },
]

export default function QAFlow() {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [gymExercises, setGymExercises] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState([])
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [exerciseForm, setExerciseForm] = useState(EMPTY_EXERCISE_FORM)
  const [exerciseErrors, setExerciseErrors] = useState({})
  const autoAdvanceTimerRef = useRef(null)

  // Split-awareness state
  const [expectedDayType, setExpectedDayType] = useState(null)
  const [selectedDayType, setSelectedDayType] = useState(null)
  const [dayTypeStep, setDayTypeStep] = useState('loading') // 'loading' | 'suggest' | 'override' | 'done'
  const [scheduleConfigured, setScheduleConfigured] = useState(null) // null = unknown, true/false

  const step = STEPS[currentStep]

  // Cleanup auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
      }
    }
  }, [])

  // Fetch today's schedule when user reaches the gym_exercises step
  useEffect(() => {
    if (step.key === 'gym_exercises' && scheduleConfigured === null) {
      setDayTypeStep('loading')
      getTodaySchedule()
        .then((data) => {
          if (!data || data.configured === false) {
            setScheduleConfigured(false)
            setDayTypeStep('done')
          } else {
            setScheduleConfigured(true)
            setExpectedDayType(data.day_type)
            setDayTypeStep('suggest')
          }
        })
        .catch(() => {
          // If schedule fetch fails, skip suggestion
          setScheduleConfigured(false)
          setDayTypeStep('done')
        })
    }
  }, [currentStep])

  function setAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  function goToStep(index) {
    if (index >= 0 && index < STEPS.length) {
      setCurrentStep(index)
      // Pre-fill input if revisiting a numeric step
      const targetStep = STEPS[index]
      if (targetStep.type === 'number' && answers[targetStep.key] != null) {
        setInputValue(String(answers[targetStep.key]))
      } else {
        setInputValue('')
      }
    }
  }

  function handleNext() {
    const nextIndex = currentStep + 1
    if (nextIndex < STEPS.length) {
      // Skip gym_exercises if gym_attendance is not Yes
      if (STEPS[nextIndex].key === 'gym_exercises' && answers.gym_attendance !== true) {
        goToStep(nextIndex + 1)
      } else {
        goToStep(nextIndex)
      }
    }
  }

  function handleBack() {
    const prevIndex = currentStep - 1
    if (prevIndex >= 0) {
      // Skip gym_exercises going back if gym_attendance is not Yes
      if (STEPS[prevIndex].key === 'gym_exercises' && answers.gym_attendance !== true) {
        goToStep(prevIndex - 1)
      } else {
        goToStep(prevIndex)
      }
    }
  }

  function handleSkip() {
    setAnswer(step.key, null)
    handleNext()
  }

  function handleNumericConfirm() {
    const val = parseInt(inputValue, 10)
    if (!isNaN(val) && val >= step.min && val <= step.max) {
      setAnswer(step.key, val)
      setInputValue('')
      // Auto-advance after 300ms per Requirement 1.3
      autoAdvanceTimerRef.current = setTimeout(() => {
        handleNext()
      }, 300)
    }
  }

  function handleBooleanAnswer(value) {
    setAnswer(step.key, value)
    // Auto-advance after 300ms per Requirement 1.3
    autoAdvanceTimerRef.current = setTimeout(() => {
      handleNext()
    }, 300)
  }

  function validateExerciseForm() {
    const errs = {}
    const { name, weight, reps, sets } = exerciseForm

    // Name validation
    const trimmedName = name.trim()
    if (!trimmedName) {
      errs.name = 'Name is required'
    } else if (trimmedName.length > EXERCISE_CONSTRAINTS.name.maxLength) {
      errs.name = `Max ${EXERCISE_CONSTRAINTS.name.maxLength} characters`
    }

    // Weight validation
    const weightNum = parseFloat(weight)
    if (weight === '' || isNaN(weightNum)) {
      errs.weight = 'Required'
    } else if (weightNum < EXERCISE_CONSTRAINTS.weight.min || weightNum > EXERCISE_CONSTRAINTS.weight.max) {
      errs.weight = `${EXERCISE_CONSTRAINTS.weight.min}-${EXERCISE_CONSTRAINTS.weight.max}`
    }

    // Reps validation
    const repsNum = parseInt(reps, 10)
    if (reps === '' || isNaN(repsNum)) {
      errs.reps = 'Required'
    } else if (repsNum < EXERCISE_CONSTRAINTS.reps.min || repsNum > EXERCISE_CONSTRAINTS.reps.max) {
      errs.reps = `${EXERCISE_CONSTRAINTS.reps.min}-${EXERCISE_CONSTRAINTS.reps.max}`
    }

    // Sets validation
    const setsNum = parseInt(sets, 10)
    if (sets === '' || isNaN(setsNum)) {
      errs.sets = 'Required'
    } else if (setsNum < EXERCISE_CONSTRAINTS.sets.min || setsNum > EXERCISE_CONSTRAINTS.sets.max) {
      errs.sets = `${EXERCISE_CONSTRAINTS.sets.min}-${EXERCISE_CONSTRAINTS.sets.max}`
    }

    return errs
  }

  function handleAddExercise() {
    const errs = validateExerciseForm()
    setExerciseErrors(errs)

    if (Object.keys(errs).length > 0) return
    if (gymExercises.length >= MAX_EXERCISES) return

    const newExercise = {
      name: exerciseForm.name.trim(),
      weight: parseFloat(exerciseForm.weight),
      reps: parseInt(exerciseForm.reps, 10),
      sets: parseInt(exerciseForm.sets, 10),
    }

    setGymExercises((prev) => [...prev, newExercise])
    setExerciseForm(EMPTY_EXERCISE_FORM)
    setExerciseErrors({})
  }

  function handleConfirmDayType() {
    setSelectedDayType(expectedDayType)
    setDayTypeStep('done')
  }

  function handleOverrideDayType() {
    setDayTypeStep('override')
  }

  function handleSelectDayType(dayType) {
    setSelectedDayType(dayType)
    setDayTypeStep('done')
  }

  function buildLogEntries() {
    const today = new Date().toISOString().split('T')[0]
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
        let notes = `${ex.reps}r x ${ex.sets}s`

        // Add mismatch note when Day_Type was overridden, unless exercise is Abs (Req 5.3, 5.4, 5.7)
        const isAbs = ex.name.trim().toLowerCase().startsWith('abs')
        const hasMismatch =
          scheduleConfigured &&
          expectedDayType &&
          selectedDayType &&
          selectedDayType !== expectedDayType &&
          !isAbs

        if (hasMismatch) {
          notes = `${notes} [expected: ${expectedDayType}]`
        }

        entries.push({
          label: `Exercise: ${ex.name}`,
          data: {
            date: today,
            category: 'gym',
            metric: ex.name,
            value: ex.weight,
            notes,
          },
        })
      }
    }

    return entries
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setErrors([])
    setSubmitSuccess(false)

    const entries = buildLogEntries()
    const failed = []

    for (const entry of entries) {
      try {
        await createLog(entry.data)
      } catch (err) {
        failed.push(entry.label)
      }
    }

    setIsSubmitting(false)

    if (failed.length === 0) {
      setSubmitSuccess(true)
    } else {
      setErrors(failed.map((label) => `Failed to save: ${label}`))
    }
  }

  function renderStepContent() {
    switch (step.type) {
      case 'number':
        return (
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={step.min}
                max={step.max}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleNumericConfirm()
                  }
                }}
                placeholder={step.placeholder}
                autoFocus
                className="w-32 bg-charcoal border border-charcoal-lighter rounded px-4 py-3 text-center text-lg font-body text-text-primary placeholder-text-muted focus:outline-none focus:border-text-secondary transition-colors"
              />
              {step.unit && (
                <span className="text-text-secondary font-body text-sm">{step.unit}</span>
              )}
            </div>
            <button
              onClick={handleNumericConfirm}
              disabled={!inputValue}
              className="bg-charcoal-lighter border border-charcoal-lighter text-text-primary px-6 py-2 rounded text-sm font-body hover:bg-charcoal-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </div>
        )

      case 'boolean':
        return (
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => handleBooleanAnswer(true)}
              className={`px-8 py-3 rounded text-sm font-body border transition-colors ${
                answers[step.key] === true
                  ? 'bg-charcoal-lighter border-text-secondary text-text-primary'
                  : 'border-charcoal-lighter text-text-secondary hover:border-text-secondary hover:text-text-primary'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => handleBooleanAnswer(false)}
              className={`px-8 py-3 rounded text-sm font-body border transition-colors ${
                answers[step.key] === false
                  ? 'bg-charcoal-lighter border-text-secondary text-text-primary'
                  : 'border-charcoal-lighter text-text-secondary hover:border-text-secondary hover:text-text-primary'
              }`}
            >
              No
            </button>
          </div>
        )

      case 'exercises':
        return (
          <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
            {/* Day_Type selection sub-step */}
            {scheduleConfigured && dayTypeStep === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <span className="text-text-muted font-body text-sm">Loading schedule...</span>
              </div>
            )}

            {scheduleConfigured && dayTypeStep === 'suggest' && expectedDayType === 'Rest' && (
              <div className="bg-charcoal-light border border-charcoal-lighter rounded p-4 flex flex-col gap-3">
                <p className="text-text-primary font-body text-sm text-center">
                  Today is a <span className="text-text-secondary font-semibold">Rest</span> day
                </p>
                <p className="text-text-muted font-body text-xs text-center">
                  Want to log exercises with a different split?
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {DAY_TYPE_OPTIONS.map((dt) => (
                    <button
                      key={dt}
                      onClick={() => handleSelectDayType(dt)}
                      className="px-4 py-2 rounded text-sm font-body border border-charcoal-lighter text-text-secondary hover:border-text-secondary hover:text-text-primary transition-colors"
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {scheduleConfigured && dayTypeStep === 'suggest' && expectedDayType !== 'Rest' && (
              <div className="bg-charcoal-light border border-charcoal-lighter rounded p-4 flex flex-col gap-3">
                <p className="text-text-primary font-body text-sm text-center">
                  Today's split: <span className="text-text-secondary font-semibold">{expectedDayType}</span>
                </p>
                <div className="flex gap-3 justify-center mt-1">
                  <button
                    onClick={handleConfirmDayType}
                    className="px-5 py-2 rounded text-sm font-body border border-text-secondary text-text-primary hover:bg-charcoal-lighter transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={handleOverrideDayType}
                    className="px-5 py-2 rounded text-sm font-body border border-charcoal-lighter text-text-secondary hover:border-text-secondary hover:text-text-primary transition-colors"
                  >
                    Override
                  </button>
                </div>
              </div>
            )}

            {scheduleConfigured && dayTypeStep === 'override' && (
              <div className="bg-charcoal-light border border-charcoal-lighter rounded p-4 flex flex-col gap-3">
                <p className="text-text-muted font-body text-xs text-center">
                  Select a different split:
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {DAY_TYPE_OPTIONS.filter((dt) => dt !== expectedDayType).map((dt) => (
                    <button
                      key={dt}
                      onClick={() => handleSelectDayType(dt)}
                      className="px-4 py-2 rounded text-sm font-body border border-charcoal-lighter text-text-secondary hover:border-text-secondary hover:text-text-primary transition-colors"
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show selected day type badge when confirmed */}
            {dayTypeStep === 'done' && selectedDayType && (
              <div className="flex items-center justify-center gap-2 py-1">
                <span className="text-text-muted font-body text-xs">Split:</span>
                <span className="text-text-secondary font-body text-sm font-semibold">{selectedDayType}</span>
              </div>
            )}

            {/* Exercise logging - only show when Day_Type step is done (or schedule not configured) */}
            {(dayTypeStep === 'done' || scheduleConfigured === false) && (
              <>
                {/* List of added exercises */}
                {gymExercises.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {gymExercises.map((ex, idx) => (
                      <div
                        key={idx}
                        className="bg-charcoal-light border border-charcoal-lighter rounded p-2 flex items-center justify-between"
                      >
                        <div className="flex flex-col">
                          <span className="text-text-primary text-sm font-body">{ex.name}</span>
                          <span className="text-text-muted text-xs font-body">
                            {ex.weight} lbs · {ex.reps}r × {ex.sets}s
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setGymExercises((prev) => prev.filter((_, i) => i !== idx))
                          }}
                          className="text-text-muted hover:text-red-400 text-xs font-body transition-colors ml-2"
                          aria-label={`Remove ${ex.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add exercise form (only if under max) */}
                {gymExercises.length < MAX_EXERCISES ? (
                  <div className="flex flex-col gap-3 border border-charcoal-lighter rounded p-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-text-secondary text-xs font-body">Exercise Name</label>
                      <input
                        type="text"
                        maxLength={EXERCISE_CONSTRAINTS.name.maxLength}
                        value={exerciseForm.name}
                        onChange={(e) => setExerciseForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Bench Press"
                        className="bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm font-body text-text-primary placeholder-text-muted focus:outline-none focus:border-text-secondary transition-colors"
                      />
                      {exerciseErrors.name && (
                        <span className="text-red-400 text-xs font-body">{exerciseErrors.name}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-text-secondary text-xs font-body">Weight (lbs)</label>
                        <input
                          type="number"
                          min={EXERCISE_CONSTRAINTS.weight.min}
                          max={EXERCISE_CONSTRAINTS.weight.max}
                          value={exerciseForm.weight}
                          onChange={(e) => setExerciseForm((f) => ({ ...f, weight: e.target.value }))}
                          placeholder="0-2000"
                          className="bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm font-body text-text-primary placeholder-text-muted focus:outline-none focus:border-text-secondary transition-colors"
                        />
                        {exerciseErrors.weight && (
                          <span className="text-red-400 text-xs font-body">{exerciseErrors.weight}</span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-text-secondary text-xs font-body">Reps</label>
                        <input
                          type="number"
                          min={EXERCISE_CONSTRAINTS.reps.min}
                          max={EXERCISE_CONSTRAINTS.reps.max}
                          value={exerciseForm.reps}
                          onChange={(e) => setExerciseForm((f) => ({ ...f, reps: e.target.value }))}
                          placeholder="1-100"
                          className="bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm font-body text-text-primary placeholder-text-muted focus:outline-none focus:border-text-secondary transition-colors"
                        />
                        {exerciseErrors.reps && (
                          <span className="text-red-400 text-xs font-body">{exerciseErrors.reps}</span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-text-secondary text-xs font-body">Sets</label>
                        <input
                          type="number"
                          min={EXERCISE_CONSTRAINTS.sets.min}
                          max={EXERCISE_CONSTRAINTS.sets.max}
                          value={exerciseForm.sets}
                          onChange={(e) => setExerciseForm((f) => ({ ...f, sets: e.target.value }))}
                          placeholder="1-50"
                          className="bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm font-body text-text-primary placeholder-text-muted focus:outline-none focus:border-text-secondary transition-colors"
                        />
                        {exerciseErrors.sets && (
                          <span className="text-red-400 text-xs font-body">{exerciseErrors.sets}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={handleAddExercise}
                      className="bg-charcoal-lighter border border-charcoal-lighter text-text-primary px-4 py-2 rounded text-sm font-body hover:bg-charcoal-light transition-colors mt-1"
                    >
                      + Add Exercise
                    </button>
                  </div>
                ) : (
                  <p className="text-text-muted text-xs font-body text-center">
                    Maximum of {MAX_EXERCISES} exercises reached.
                  </p>
                )}

                {/* Counter and Done button */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-text-muted text-xs font-body">
                    {gymExercises.length} / {MAX_EXERCISES} exercises
                  </span>
                  <button
                    onClick={handleNext}
                    className="bg-charcoal-lighter border border-charcoal-lighter text-text-primary px-6 py-2 rounded text-sm font-body hover:bg-charcoal-light transition-colors"
                  >
                    Done →
                  </button>
                </div>
              </>
            )}
          </div>
        )

      case 'review':
        return (
          <div className="w-full max-w-sm mx-auto">
            {submitSuccess ? (
              <div className="bg-charcoal-light border border-charcoal-lighter rounded p-4 text-center">
                <p className="text-text-primary font-body text-sm">All entries saved successfully.</p>
              </div>
            ) : (
              <>
                <div className="bg-charcoal-light border border-charcoal-lighter rounded p-4 flex flex-col gap-3">
                  {STEPS.filter((s) => s.type !== 'review' && s.type !== 'exercises').map((s) => {
                    const val = answers[s.key]
                    return (
                      <div key={s.key} className="flex items-center justify-between">
                        <span className="text-text-secondary font-body text-sm">{s.label}</span>
                        <span className="text-text-primary font-body text-sm">
                          {val == null
                            ? '—'
                            : s.type === 'boolean'
                            ? val ? 'Yes' : 'No'
                            : `${val}${s.unit ? ` ${s.unit}` : ''}`}
                        </span>
                      </div>
                    )
                  })}
                  {answers.gym_attendance === true && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary font-body text-sm">Exercises</span>
                      <span className="text-text-primary font-body text-sm">
                        {gymExercises.length} logged
                      </span>
                    </div>
                  )}
                </div>
                {errors.length > 0 && (
                  <div className="mt-4 bg-charcoal-light border border-red-400/30 rounded p-3">
                    <p className="text-red-400 font-body text-xs font-semibold mb-1">Some entries failed to save:</p>
                    {errors.map((err, i) => (
                      <p key={i} className="text-red-400 font-body text-xs">{err}</p>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="mt-4 w-full bg-charcoal-lighter border border-charcoal-lighter text-text-primary px-6 py-3 rounded text-sm font-body hover:bg-charcoal-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : errors.length > 0 ? 'Retry' : 'Submit'}
                </button>
              </>
            )}
          </div>
        )

      default:
        return null
    }
  }

  // Progress indicator
  const totalSteps = STEPS.length
  const progressPercent = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className="max-w-md mx-auto md:mt-16 flex flex-col min-h-[calc(100vh-8rem)] md:min-h-0">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-1 bg-charcoal-lighter rounded-full overflow-hidden">
          <div
            className="h-full bg-text-secondary rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-text-muted font-body text-xs">
            {currentStep + 1} / {totalSteps}
          </span>
          <span className="text-text-muted font-body text-xs">{step.label}</span>
        </div>
      </div>

      {/* Question area - centered on mobile for one-question-per-screen feel */}
      <div className="flex-1 flex flex-col items-center justify-center py-8">
        <h2 className="text-text-primary font-body text-base md:text-lg text-center mb-8">
          {step.question}
        </h2>
        {renderStepContent()}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between py-4 border-t border-charcoal-lighter">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className="text-text-secondary font-body text-sm hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        {step.type !== 'review' && step.type !== 'boolean' && (
          <button
            onClick={handleSkip}
            className="text-text-muted font-body text-sm hover:text-text-secondary transition-colors"
          >
            Skip →
          </button>
        )}
      </div>
    </div>
  )
}
