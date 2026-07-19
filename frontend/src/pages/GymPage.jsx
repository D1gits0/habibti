import { useState, useEffect, useCallback } from 'react'
import { getGymExercises, createLog, getLogs, getGymHistory, upsertLog, updateLog, deleteLog } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import SwapPicker from '../components/SwapPicker'
import OverloadChart from '../components/OverloadChart'
import InlineInput from '../components/InlineInput'
import { computeStreaks } from '../utils/streaks'

const SPLIT_OPTIONS = ['Push', 'Pull', 'Legs', 'Rest', 'Upper', 'Lower']
const MAX_EXERCISES_PER_SESSION = 20

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Muscle group mapping for the exercise history view
const MUSCLE_GROUPS = {
  Chest: ['Incline DB Press', 'Cable Chest Fly', 'Pec Deck', 'Weighted Dips'],
  Back: ['Lat Pulldowns', 'Close Grip Cable Rows', 'Wide Grip Cable Rows', 'Pull Ups', 'Reverse Fly', 'Archer Pull'],
  Shoulders: ['Machine Shoulder Press', 'Lateral Raises'],
  Biceps: ['Preacher Curls', 'Cable Hammer Curls', 'DB Hammer Curl', 'Incline Curls'],
  Triceps: ['Overhead Tricep Extension'],
  Legs: ['Bulgarian Split Squat', '45 Degree Back Extension', 'Leg Extensions', 'Leg Curls', 'Calf Raises'],
  Abs: ['Cable Crunches', 'Leg Raises', 'Side Planks'],
}
const MUSCLE_GROUP_NAMES = Object.keys(MUSCLE_GROUPS)

// Colors for multi-line chart (one color per exercise in a group)
const LINE_COLORS = ['#9ca3af', '#FF4F00', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa']

/**
 * Validate a single exercise entry field set.
 * Returns an object with field-specific error messages (empty string = valid).
 */
function validateExerciseEntry(name, weight, reps, sets) {
  const errors = { name: '', weight: '', reps: '', sets: '' }

  // Name validation
  const trimmedName = (name || '').trim()
  if (trimmedName.length === 0) {
    errors.name = 'Exercise name is required'
  } else if (name.length > 50) {
    errors.name = 'Name must be 50 characters or fewer'
  }

  // Weight validation
  const weightNum = parseFloat(weight)
  if (weight === '' || weight === null || weight === undefined) {
    errors.weight = 'Weight is required'
  } else if (isNaN(weightNum) || !isFinite(weightNum)) {
    errors.weight = 'Must be a valid number'
  } else {
    const minWeight = trimmedName === 'Pull Ups' ? -100 : 0
    if (weightNum < minWeight || weightNum > 2000) {
      errors.weight = trimmedName === 'Pull Ups'
        ? 'Weight must be -100 to 2000'
        : 'Weight must be 0 to 2000'
    } else if (Math.round((weightNum % 0.5) * 100) / 100 !== 0) {
      errors.weight = 'Must be in increments of 0.5'
    }
  }

  // Reps validation
  const repsNum = parseInt(reps, 10)
  if (reps === '' || reps === null || reps === undefined) {
    errors.reps = 'Reps is required'
  } else if (isNaN(repsNum) || !Number.isInteger(repsNum)) {
    errors.reps = 'Must be a whole number'
  } else if (repsNum < 1 || repsNum > 100) {
    errors.reps = 'Reps must be 1 to 100'
  }

  // Sets validation
  const setsNum = parseInt(sets, 10)
  if (sets === '' || sets === null || sets === undefined) {
    errors.sets = 'Sets is required'
  } else if (isNaN(setsNum) || !Number.isInteger(setsNum)) {
    errors.sets = 'Must be a whole number'
  } else if (setsNum < 1 || setsNum > 20) {
    errors.sets = 'Sets must be 1 to 20'
  }

  return errors
}

export default function GymPage() {
  const [selectedSplit, setSelectedSplit] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Exercise logging state: array of { name, weight, reps, flag, errors, saved }
  const [logEntries, setLogEntries] = useState([])
  // Track which slot has the swap picker open
  const [openSwapSlot, setOpenSwapSlot] = useState(null)
  // Swap history per slot (derived from past logs)
  const [swapHistories, setSwapHistories] = useState({})

  // Abs toggle state: null (not prompted yet), 'yes', or 'no'
  const [absToggle, setAbsToggle] = useState(null)
  // Abs exercise entries (same shape as logEntries)
  const [absEntries, setAbsEntries] = useState([])
  // Swap picker open slot for abs
  const [openAbsSwapSlot, setOpenAbsSwapSlot] = useState(null)

  // Overload chart state per exercise: { [exerciseName]: { data, timeRange } }
  const [overloadData, setOverloadData] = useState({})
  // Inline edit state for chart-tap editing
  const [inlineEdit, setInlineEdit] = useState(null) // { exerciseName, date, weight, position }

  // Exercise History viewer state
  const [historyMetrics, setHistoryMetrics] = useState([]) // all gym exercise names from logs
  const [historySelectedGroup, setHistorySelectedGroup] = useState('Chest')
  const [historyTimeRange, setHistoryTimeRange] = useState('3m')
  const [historyData, setHistoryData] = useState({}) // { exerciseName: [entries] }
  const [historyLoading, setHistoryLoading] = useState(false)

  // Recent gym entries for edit/delete
  const [recentGymLogs, setRecentGymLogs] = useState([])
  const [editingLogId, setEditingLogId] = useState(null) // log id being edited
  const [editForm, setEditForm] = useState({ weight: '', reps: '', sets: '', flag: 'none' })
  const [showRecentEntries, setShowRecentEntries] = useState(false)
  const [gymStreaks, setGymStreaks] = useState({ current: 0, best: 0 })

  // Cardio state
  const [showCardio, setShowCardio] = useState(false)
  const [cardioForm, setCardioForm] = useState({ duration: '', distance: '' })
  const [cardioSaving, setCardioSaving] = useState(false)
  const [cardioSaved, setCardioSaved] = useState(false)

  useEffect(() => {
    if (!selectedSplit || selectedSplit === 'Rest') return

    async function fetchExercises() {
      setLoading(true)
      setError(null)
      try {
        const data = await getGymExercises(selectedSplit)
        const exerciseList = data.exercises || []
        setExercises(exerciseList)
        // Initialize log entries from exercise list
        setLogEntries(
          exerciseList.map((ex) => ({
            name: ex.name,
            primaryName: ex.name,
            swap: ex.swap || null,
            weight: '',
            reps: '',
            sets: '',
            flag: 'none', // 'none' | 'failure' | 'dropset'
            errors: { name: '', weight: '', reps: '', sets: '' },
            saved: false,
          }))
        )
      } catch (err) {
        setError('Failed to load exercises. Please try again.')
        setExercises([])
        setLogEntries([])
      } finally {
        setLoading(false)
      }
    }

    fetchExercises()
  }, [selectedSplit])

  // Load swap histories from past logs when split is selected
  useEffect(() => {
    if (!selectedSplit || selectedSplit === 'Rest' || exercises.length === 0) return

    async function fetchSwapHistories() {
      try {
        const logs = await getLogs({ category: 'gym' })
        // Group logged exercises per primary exercise slot by finding entries
        // that aren't the primary exercise name for a given slot
        const histories = {}
        exercises.forEach((ex, idx) => {
          const slotHistory = logs
            .filter((log) => {
              // A swap is an entry that doesn't match the primary but was used in this slot
              // We approximate by finding entries that match known swap names
              return log.metric !== ex.name && log.metric === ex.swap
            })
            .map((log) => log.metric)
          // Deduplicate preserving most-recent-first order
          const unique = [...new Set(slotHistory)]
          histories[idx] = unique
        })
        setSwapHistories(histories)
      } catch {
        // Silently fail - swap history is optional
        setSwapHistories({})
      }
    }

    fetchSwapHistories()
  }, [selectedSplit, exercises])

  // Determine if all primary exercises have been saved (triggers abs toggle)
  // Show abs toggle as soon as the user has selected a non-Rest split and exercises are loaded
  const showAbsToggle =
    selectedSplit && selectedSplit !== 'Rest' && !loading && !error && exercises.length > 0

  // Load overload chart data for all exercises that have been saved
  useEffect(() => {
    const savedExercises = logEntries.filter((e) => e.saved).map((e) => e.name)
    if (savedExercises.length === 0) return

    savedExercises.forEach((name) => {
      if (!overloadData[name]) {
        fetchOverloadData(name, '3m')
      }
    })
  }, [logEntries])

  async function fetchOverloadData(exerciseName, range) {
    try {
      const data = await getGymHistory(exerciseName, range)
      setOverloadData((prev) => ({
        ...prev,
        [exerciseName]: { data: data || [], timeRange: range },
      }))
    } catch {
      setOverloadData((prev) => ({
        ...prev,
        [exerciseName]: { data: [], timeRange: range },
      }))
    }
  }

  function handleOverloadTimeRangeChange(exerciseName, range) {
    fetchOverloadData(exerciseName, range)
  }

  // Exercise History viewer — load all gym metric names on mount
  useEffect(() => {
    async function loadHistoryMetrics() {
      try {
        const gymLogs = await getLogs({ category: 'gym' })
        const metrics = [...new Set(gymLogs.map((l) => l.metric))].sort()
        setHistoryMetrics(metrics)
        // Compute gym streak from unique dates
        const uniqueDates = [...new Set(gymLogs.map((l) => l.date))].sort()
        setGymStreaks(computeStreaks(uniqueDates))
      } catch {
        setHistoryMetrics([])
      }
    }
    loadHistoryMetrics()
  }, [])

  // Load history data for the selected muscle group when group or time range changes
  useEffect(() => {
    if (!historySelectedGroup) return
    const exercisesInGroup = MUSCLE_GROUPS[historySelectedGroup] || []
    // Only load exercises that actually have log data
    const relevant = exercisesInGroup.filter((ex) => historyMetrics.includes(ex))
    if (relevant.length === 0) {
      setHistoryData({})
      return
    }

    async function loadGroupHistory() {
      setHistoryLoading(true)
      try {
        const results = {}
        await Promise.all(
          relevant.map(async (exerciseName) => {
            const data = await getGymHistory(exerciseName, historyTimeRange)
            if (data && data.length > 0) {
              results[exerciseName] = data
            }
          })
        )
        setHistoryData(results)
      } catch {
        setHistoryData({})
      }
      setHistoryLoading(false)
    }
    loadGroupHistory()
  }, [historySelectedGroup, historyTimeRange, historyMetrics])

  // Load recent gym entries (last 7 days) for edit/delete
  useEffect(() => {
    loadRecentGymLogs()
  }, [])

  async function loadRecentGymLogs() {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const y = sevenDaysAgo.getFullYear(), m = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0'), dd = String(sevenDaysAgo.getDate()).padStart(2, '0')
      const data = await getLogs({ category: 'gym', date_from: `${y}-${m}-${dd}` })
      setRecentGymLogs(data.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id))
    } catch {
      setRecentGymLogs([])
    }
  }

  function parseNotesForEdit(notes) {
    if (!notes) return { reps: '', sets: '', flag: 'none' }
    let flag = 'none'
    let rest = notes
    if (notes.includes('|')) {
      const [flagPart, repsPart] = notes.split('|', 2)
      rest = repsPart
      if (flagPart === 'failure:true') flag = 'failure'
      else if (flagPart === 'dropset:true') flag = 'dropset'
    }
    const repsMatch = rest.match(/(\d+)r/)
    const setsMatch = rest.match(/(\d+)s/)
    return { reps: repsMatch ? repsMatch[1] : '', sets: setsMatch ? setsMatch[1] : '', flag }
  }

  function handleEditEntry(log) {
    const { reps, sets, flag } = parseNotesForEdit(log.notes)
    setEditingLogId(log.id)
    setEditForm({ weight: String(log.value), reps, sets, flag })
  }

  async function handleSaveEdit(logId) {
    const weightNum = parseFloat(editForm.weight)
    const repsNum = parseInt(editForm.reps, 10)
    const setsNum = parseInt(editForm.sets, 10)
    if (isNaN(weightNum) || isNaN(repsNum)) return

    const setsStr = !isNaN(setsNum) && setsNum > 0 ? ` x ${setsNum}s` : ''
    let notes = `${repsNum}r${setsStr}`
    if (editForm.flag === 'failure') notes = `failure:true|${repsNum}r${setsStr}`
    else if (editForm.flag === 'dropset') notes = `dropset:true|${repsNum}r${setsStr}`

    try {
      await updateLog(logId, { value: weightNum, notes })
      setEditingLogId(null)
      await loadRecentGymLogs()
    } catch { /* silently fail */ }
  }

  async function handleDeleteEntry(logId) {
    try {
      await deleteLog(logId)
      await loadRecentGymLogs()
    } catch { /* silently fail */ }
  }

  // Handle chart dot click to open InlineInput
  const handleChartDotClick = useCallback((exerciseName) => (dotData) => {
    setInlineEdit({
      exerciseName,
      date: dotData.date,
      weight: dotData.weight,
      position: dotData.position,
    })
  }, [])

  // Handle InlineInput save
  const handleInlineSave = useCallback(async (value) => {
    if (!inlineEdit) return
    const { exerciseName, date } = inlineEdit

    await upsertLog({ date, metric: exerciseName, category: 'gym', value })

    // Dismiss inline input
    setInlineEdit(null)

    // Refresh the chart data for this exercise
    const currentRange = overloadData[exerciseName]?.timeRange || '3m'
    await fetchOverloadData(exerciseName, currentRange)
  }, [inlineEdit, overloadData])

  // Handle InlineInput dismiss
  const handleInlineDismiss = useCallback(() => {
    setInlineEdit(null)
  }, [])

  function handleSplitSelect(split) {
    setSelectedSplit(split)
    setAbsToggle(null)
    setAbsEntries([])
    if (split === 'Rest') {
      setExercises([])
      setLogEntries([])
    }
  }

  function handleEntryChange(index, field, value) {
    setLogEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const updated = { ...entry, [field]: value }
        // Clear the specific field error when user edits
        if (entry.errors[field]) {
          updated.errors = { ...entry.errors, [field]: '' }
        }
        return updated
      })
    )
  }

  function handleFlagToggle(index) {
    setLogEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        // Cycle: none -> failure -> dropset -> none
        const nextFlag =
          entry.flag === 'none' ? 'failure' : entry.flag === 'failure' ? 'dropset' : 'none'
        return { ...entry, flag: nextFlag }
      })
    )
  }

  function handleSwapSelect(index, exerciseName) {
    setLogEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        return { ...entry, name: exerciseName, errors: { ...entry.errors, name: '' } }
      })
    )
    setOpenSwapSlot(null)
  }

  function handleAddExercise() {
    if (logEntries.length >= MAX_EXERCISES_PER_SESSION) return
    setLogEntries((prev) => [
      ...prev,
      {
        name: '',
        primaryName: '',
        swap: null,
        weight: '',
        reps: '',
        sets: '',
        flag: 'none',
        errors: { name: '', weight: '', reps: '', sets: '' },
        saved: false,
      },
    ])
  }

  function handleRemoveExercise(index) {
    setLogEntries((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSaveEntry(index) {
    const entry = logEntries[index]
    const errors = validateExerciseEntry(entry.name, entry.weight, entry.reps, entry.sets)
    const hasErrors = errors.name || errors.weight || errors.reps || errors.sets

    setLogEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, errors } : e))
    )

    if (hasErrors) return

    // Encode notes with sets
    const repsNum = parseInt(entry.reps, 10)
    const setsNum = parseInt(entry.sets, 10)
    let notes = `${repsNum}r x ${setsNum}s`
    if (entry.flag === 'failure') {
      notes = `failure:true|${repsNum}r x ${setsNum}s`
    } else if (entry.flag === 'dropset') {
      notes = `dropset:true|${repsNum}r x ${setsNum}s`
    }

    try {
      const today = localToday()
      await createLog({
        date: today,
        category: 'gym',
        metric: entry.name.trim(),
        value: parseFloat(entry.weight),
        notes,
      })
      setLogEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, saved: true } : e))
      )
    } catch (err) {
      setLogEntries((prev) =>
        prev.map((e, i) =>
          i === index
            ? { ...e, errors: { ...e.errors, name: err.message || 'Save failed' } }
            : e
        )
      )
    }
  }

  // --- Abs Toggle Handlers ---

  function handleAbsYes() {
    setAbsToggle('yes')
    // Initialize abs exercises: Cable Crunches (fixed) + Leg Raises (swappable with Side Planks)
    setAbsEntries([
      {
        name: 'Cable Crunches',
        primaryName: 'Cable Crunches',
        swap: null,
        weight: '',
        reps: '',
        flag: 'none',
        errors: { name: '', weight: '', reps: '' },
        saved: false,
      },
      {
        name: 'Leg Raises',
        primaryName: 'Leg Raises',
        swap: 'Side Planks',
        weight: '',
        reps: '',
        flag: 'none',
        errors: { name: '', weight: '', reps: '' },
        saved: false,
      },
    ])
  }

  function handleAbsNo() {
    setAbsToggle('no')
    setAbsEntries([])
  }

  function handleAbsEntryChange(index, field, value) {
    setAbsEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const updated = { ...entry, [field]: value }
        if (entry.errors[field]) {
          updated.errors = { ...entry.errors, [field]: '' }
        }
        return updated
      })
    )
  }

  function handleAbsFlagToggle(index) {
    setAbsEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const nextFlag =
          entry.flag === 'none' ? 'failure' : entry.flag === 'failure' ? 'dropset' : 'none'
        return { ...entry, flag: nextFlag }
      })
    )
  }

  function handleAbsSwapSelect(index, exerciseName) {
    setAbsEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        return { ...entry, name: exerciseName, errors: { ...entry.errors, name: '' } }
      })
    )
    setOpenAbsSwapSlot(null)
  }

  async function handleSaveAbsEntry(index) {
    const entry = absEntries[index]
    const errors = validateExerciseEntry(entry.name, entry.weight, entry.reps)
    const hasErrors = errors.name || errors.weight || errors.reps

    setAbsEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, errors } : e))
    )

    if (hasErrors) return

    // Encode notes
    const repsNum = parseInt(entry.reps, 10)
    let notes = `${repsNum}r`
    if (entry.flag === 'failure') {
      notes = `failure:true|${repsNum}r`
    } else if (entry.flag === 'dropset') {
      notes = `dropset:true|${repsNum}r`
    }

    try {
      const today = localToday()
      await createLog({
        date: today,
        category: 'gym',
        metric: entry.name.trim(),
        value: parseFloat(entry.weight),
        notes,
      })
      setAbsEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, saved: true } : e))
      )
    } catch (err) {
      setAbsEntries((prev) =>
        prev.map((e, i) =>
          i === index
            ? { ...e, errors: { ...e.errors, name: err.message || 'Save failed' } }
            : e
        )
      )
    }
  }

  // Cardio — save run entry
  async function handleSaveRun() {
    const duration = parseFloat(cardioForm.duration)
    const distance = parseFloat(cardioForm.distance)
    if (isNaN(duration) || duration <= 0) return
    setCardioSaving(true)
    const today = localToday()
    const pace = (duration > 0 && distance > 0) ? (duration / distance).toFixed(2) : null
    const notes = [
      `${duration}min`,
      distance ? `${distance}mi` : null,
      pace ? `pace:${pace}` : null,
    ].filter(Boolean).join(' | ')
    try {
      await createLog({ date: today, category: 'cardio', metric: 'run', value: distance || duration, notes })
      setCardioSaved(true)
      setCardioForm({ duration: '', distance: '' })
      setTimeout(() => setCardioSaved(false), 3000)
    } catch { /* silent */ }
    setCardioSaving(false)
  }

  return (
    <div className="md:mt-12">
      <h1 className="font-body text-text-primary text-xs md:text-sm mb-4">GYM</h1>

      {/* Gym streak banner */}
      {(gymStreaks.current > 0 || gymStreaks.best > 0) && (
        <div className="flex items-center gap-3 mb-4">
          <span className={`font-body text-xs ${gymStreaks.current > 0 ? 'text-accent' : 'text-text-muted'}`}>
            🔥 {gymStreaks.current} day streak
          </span>
          {gymStreaks.best > 0 && (
            <span className="font-body text-[10px] text-text-muted">
              best: {gymStreaks.best}d
            </span>
          )}
        </div>
      )}

      {/* Split Day Type Banner */}
      {selectedSplit && (
        <div className="panel p-3 mb-4 flex items-center justify-between">
          <span className="font-body text-text-primary text-sm">
            Today's Split: <span className="text-accent font-medium">{selectedSplit}</span>
          </span>
          <button
            onClick={() => {
              setSelectedSplit(null)
              setExercises([])
              setLogEntries([])
              setAbsToggle(null)
              setAbsEntries([])
            }}
            className="text-text-secondary text-xs hover:text-text-primary transition-colors"
          >
            Change
          </button>
        </div>
      )}

      {/* Split Selection */}
      {!selectedSplit && (
        <div className="panel p-4 mb-4">
          <p className="font-body text-text-secondary text-xs mb-3">Select today's split:</p>
          <div className="grid grid-cols-3 gap-2">
            {SPLIT_OPTIONS.map((split) => (
              <button
                key={split}
                onClick={() => handleSplitSelect(split)}
                className="panel px-3 py-2 text-sm font-body text-text-primary hover:bg-charcoal-lighter transition-colors text-center"
              >
                {split}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rest Day Confirmation */}
      {selectedSplit === 'Rest' && (
        <div className="panel p-6 text-center">
          <span className="text-2xl mb-2 block">😴</span>
          <p className="font-body text-text-primary text-sm">No exercises required today.</p>
          <p className="font-body text-text-secondary text-xs mt-1">Enjoy your rest day!</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="panel p-6 text-center text-text-secondary text-sm">
          Loading exercises...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="panel p-4 text-center text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Exercise Logging Form */}
      {selectedSplit && selectedSplit !== 'Rest' && !loading && !error && logEntries.length > 0 && (
        <div className="flex flex-col gap-3">
          {logEntries.map((entry, index) => (
            <div
              key={`exercise-${index}`}
              className={`panel p-3 ${entry.saved ? 'border border-green-800/50' : ''}`}
              data-testid={`exercise-row-${index}`}
            >
              {/* Exercise header row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-xs font-body w-5">{index + 1}.</span>
                  <span className="text-text-primary text-sm font-body">
                    {entry.name || '(unnamed)'}
                  </span>
                  {entry.saved && (
                    <span className="text-green-400 text-[10px]">✓ saved</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Swap button - only show for exercises that came from seed */}
                  {entry.primaryName && (
                    <button
                      onClick={() =>
                        setOpenSwapSlot(openSwapSlot === index ? null : index)
                      }
                      className="text-text-secondary text-xs hover:text-accent transition-colors"
                      title="Swap exercise"
                      data-testid={`swap-btn-${index}`}
                    >
                      ↔
                    </button>
                  )}
                  {/* Remove button for manually added exercises */}
                  {!entry.primaryName && (
                    <button
                      onClick={() => handleRemoveExercise(index)}
                      className="text-text-secondary text-xs hover:text-red-400 transition-colors"
                      title="Remove exercise"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Swap Picker */}
              {openSwapSlot === index && (
                <div className="mb-2">
                  <SwapPicker
                    slot={index}
                    primaryExercise={entry.primaryName}
                    swapHistory={swapHistories[index] || []}
                    defaultSwap={entry.swap}
                    onSelect={(name) => handleSwapSelect(index, name)}
                  />
                </div>
              )}

              {/* Logging inputs row */}
              <div className="flex flex-wrap gap-2 items-start">
                {/* Name input - only for manually added exercises */}
                {!entry.primaryName && (
                  <div className="flex flex-col">
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) => handleEntryChange(index, 'name', e.target.value)}
                      placeholder="Exercise name"
                      maxLength={50}
                      className={`bg-charcoal border rounded px-2 py-1 text-xs text-text-primary outline-none transition-colors w-32 ${
                        entry.errors.name ? 'border-red-500' : 'border-charcoal-lighter focus:border-accent'
                      }`}
                      aria-label="Exercise name"
                      data-testid={`exercise-name-${index}`}
                    />
                    {entry.errors.name && (
                      <span className="text-[10px] text-red-400 mt-0.5" data-testid={`error-name-${index}`}>
                        {entry.errors.name}
                      </span>
                    )}
                  </div>
                )}

                {/* Weight input */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.5"
                      value={entry.weight}
                      onChange={(e) => handleEntryChange(index, 'weight', e.target.value)}
                      placeholder="lbs"
                      className={`bg-charcoal border rounded px-2 py-1 text-xs text-text-primary outline-none transition-colors w-20 ${
                        entry.errors.weight ? 'border-red-500' : 'border-charcoal-lighter focus:border-accent'
                      }`}
                      aria-label="Weight in lbs"
                      data-testid={`exercise-weight-${index}`}
                    />
                    <span className="text-text-muted text-[10px]">lbs</span>
                  </div>
                  {entry.errors.weight && (
                    <span className="text-[10px] text-red-400 mt-0.5" data-testid={`error-weight-${index}`}>
                      {entry.errors.weight}
                    </span>
                  )}
                </div>

                {/* Reps input */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="100"
                      value={entry.reps}
                      onChange={(e) => handleEntryChange(index, 'reps', e.target.value)}
                      placeholder="reps"
                      className={`bg-charcoal border rounded px-2 py-1 text-xs text-text-primary outline-none transition-colors w-16 ${
                        entry.errors.reps ? 'border-red-500' : 'border-charcoal-lighter focus:border-accent'
                      }`}
                      aria-label="Number of reps"
                      data-testid={`exercise-reps-${index}`}
                    />
                    <span className="text-text-muted text-[10px]">reps</span>
                  </div>
                  {entry.errors.reps && (
                    <span className="text-[10px] text-red-400 mt-0.5" data-testid={`error-reps-${index}`}>
                      {entry.errors.reps}
                    </span>
                  )}
                </div>

                {/* Sets input */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="20"
                      value={entry.sets}
                      onChange={(e) => handleEntryChange(index, 'sets', e.target.value)}
                      placeholder="sets"
                      className={`bg-charcoal border rounded px-2 py-1 text-xs text-text-primary outline-none transition-colors w-14 ${
                        entry.errors.sets ? 'border-red-500' : 'border-charcoal-lighter focus:border-accent'
                      }`}
                      aria-label="Number of sets"
                      data-testid={`exercise-sets-${index}`}
                    />
                    <span className="text-text-muted text-[10px]">sets</span>
                  </div>
                  {entry.errors.sets && (
                    <span className="text-[10px] text-red-400 mt-0.5" data-testid={`error-sets-${index}`}>
                      {entry.errors.sets}
                    </span>
                  )}
                </div>

                {/* Flag toggle */}
                <button
                  onClick={() => handleFlagToggle(index)}
                  className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                    entry.flag === 'failure'
                      ? 'border-red-500 text-red-400 bg-red-900/20'
                      : entry.flag === 'dropset'
                      ? 'border-yellow-500 text-yellow-400 bg-yellow-900/20'
                      : 'border-charcoal-lighter text-text-muted hover:border-text-secondary'
                  }`}
                  title={
                    entry.flag === 'none'
                      ? 'No flag (click to set failure)'
                      : entry.flag === 'failure'
                      ? 'Failure set (click for drop set)'
                      : 'Drop set (click to clear)'
                  }
                  data-testid={`exercise-flag-${index}`}
                >
                  {entry.flag === 'failure' ? '⚠ Fail' : entry.flag === 'dropset' ? '↓ Drop' : '— Flag'}
                </button>

                {/* Save button */}
                <button
                  onClick={() => handleSaveEntry(index)}
                  disabled={entry.saved}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    entry.saved
                      ? 'bg-green-900/30 text-green-400 border border-green-800/50 cursor-default'
                      : 'bg-charcoal-lighter text-text-primary hover:bg-accent hover:text-white border border-charcoal-lighter'
                  }`}
                  data-testid={`exercise-save-${index}`}
                >
                  {entry.saved ? '✓' : 'Save'}
                </button>
              </div>
            </div>
          ))}

          {/* Add Exercise button */}
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={handleAddExercise}
              disabled={logEntries.length >= MAX_EXERCISES_PER_SESSION}
              className={`text-xs font-body px-3 py-1.5 rounded transition-colors ${
                logEntries.length >= MAX_EXERCISES_PER_SESSION
                  ? 'text-text-muted bg-charcoal-lighter/50 cursor-not-allowed'
                  : 'text-text-primary bg-charcoal-lighter hover:bg-accent hover:text-white'
              }`}
              data-testid="add-exercise-btn"
            >
              + Add Exercise
            </button>
            <span className="text-text-muted text-[10px]">
              {logEntries.length}/{MAX_EXERCISES_PER_SESSION} exercises
            </span>
          </div>

          {/* Max exercises warning */}
          {logEntries.length >= MAX_EXERCISES_PER_SESSION && (
            <p className="text-[10px] text-yellow-400 text-center" data-testid="max-exercises-warning">
              Maximum of 20 exercises per session reached.
            </p>
          )}

          {/* Abs Toggle - shown once exercises are loaded for any non-Rest split */}
          {showAbsToggle && absToggle === null && (
            <div className="panel p-4 mt-4" data-testid="abs-toggle">
              <p className="font-body text-text-primary text-sm mb-3">
                Was today an abs day?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleAbsYes}
                  className="px-4 py-2 text-sm font-body bg-charcoal-lighter text-text-primary rounded hover:bg-accent hover:text-white transition-colors"
                  data-testid="abs-toggle-yes"
                >
                  Yes
                </button>
                <button
                  onClick={handleAbsNo}
                  className="px-4 py-2 text-sm font-body bg-charcoal-lighter text-text-secondary rounded hover:bg-charcoal hover:text-text-primary transition-colors"
                  data-testid="abs-toggle-no"
                >
                  No
                </button>
              </div>
            </div>
          )}

          {/* Abs skipped confirmation */}
          {absToggle === 'no' && (
            <div className="panel p-3 mt-4 text-center" data-testid="abs-skipped">
              <p className="font-body text-text-secondary text-xs">Abs skipped for today.</p>
            </div>
          )}

          {/* Abs Exercise Logging Form */}
          {absToggle === 'yes' && absEntries.length > 0 && (
            <div className="mt-4" data-testid="abs-section">
              <h2 className="font-body text-text-primary text-xs mb-3">ABS</h2>
              <div className="flex flex-col gap-3">
                {absEntries.map((entry, index) => (
                  <div
                    key={`abs-exercise-${index}`}
                    className={`panel p-3 ${entry.saved ? 'border border-green-800/50' : ''}`}
                    data-testid={`abs-row-${index}`}
                  >
                    {/* Abs exercise header row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted text-xs font-body w-5">{index + 1}.</span>
                        <span className="text-text-primary text-sm font-body">
                          {entry.name}
                        </span>
                        {entry.saved && (
                          <span className="text-green-400 text-[10px]">✓ saved</span>
                        )}
                      </div>
                      {/* Swap button - only for second abs exercise (Leg Raises/Side Planks) */}
                      {entry.swap && (
                        <button
                          onClick={() =>
                            setOpenAbsSwapSlot(openAbsSwapSlot === index ? null : index)
                          }
                          className="text-text-secondary text-xs hover:text-accent transition-colors"
                          title="Swap exercise"
                          data-testid={`abs-swap-btn-${index}`}
                        >
                          ↔
                        </button>
                      )}
                    </div>

                    {/* Abs Swap Picker */}
                    {openAbsSwapSlot === index && entry.swap && (
                      <div className="mb-2">
                        <SwapPicker
                          slot={`abs-${index}`}
                          primaryExercise={entry.primaryName}
                          swapHistory={[]}
                          defaultSwap={entry.swap}
                          onSelect={(name) => handleAbsSwapSelect(index, name)}
                        />
                      </div>
                    )}

                    {/* Abs logging inputs row */}
                    <div className="flex flex-wrap gap-2 items-start">
                      {/* Weight input */}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            value={entry.weight}
                            onChange={(e) => handleAbsEntryChange(index, 'weight', e.target.value)}
                            placeholder="lbs"
                            className={`bg-charcoal border rounded px-2 py-1 text-xs text-text-primary outline-none transition-colors w-20 ${
                              entry.errors.weight ? 'border-red-500' : 'border-charcoal-lighter focus:border-accent'
                            }`}
                            aria-label="Weight in lbs"
                            data-testid={`abs-weight-${index}`}
                          />
                          <span className="text-text-muted text-[10px]">lbs</span>
                        </div>
                        {entry.errors.weight && (
                          <span className="text-[10px] text-red-400 mt-0.5" data-testid={`abs-error-weight-${index}`}>
                            {entry.errors.weight}
                          </span>
                        )}
                      </div>

                      {/* Reps input */}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="100"
                            value={entry.reps}
                            onChange={(e) => handleAbsEntryChange(index, 'reps', e.target.value)}
                            placeholder="reps"
                            className={`bg-charcoal border rounded px-2 py-1 text-xs text-text-primary outline-none transition-colors w-16 ${
                              entry.errors.reps ? 'border-red-500' : 'border-charcoal-lighter focus:border-accent'
                            }`}
                            aria-label="Number of reps"
                            data-testid={`abs-reps-${index}`}
                          />
                          <span className="text-text-muted text-[10px]">reps</span>
                        </div>
                        {entry.errors.reps && (
                          <span className="text-[10px] text-red-400 mt-0.5" data-testid={`abs-error-reps-${index}`}>
                            {entry.errors.reps}
                          </span>
                        )}
                      </div>

                      {/* Flag toggle */}
                      <button
                        onClick={() => handleAbsFlagToggle(index)}
                        className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                          entry.flag === 'failure'
                            ? 'border-red-500 text-red-400 bg-red-900/20'
                            : entry.flag === 'dropset'
                            ? 'border-yellow-500 text-yellow-400 bg-yellow-900/20'
                            : 'border-charcoal-lighter text-text-muted hover:border-text-secondary'
                        }`}
                        title={
                          entry.flag === 'none'
                            ? 'No flag (click to set failure)'
                            : entry.flag === 'failure'
                            ? 'Failure set (click for drop set)'
                            : 'Drop set (click to clear)'
                        }
                        data-testid={`abs-flag-${index}`}
                      >
                        {entry.flag === 'failure' ? '⚠ Fail' : entry.flag === 'dropset' ? '↓ Drop' : '— Flag'}
                      </button>

                      {/* Save button */}
                      <button
                        onClick={() => handleSaveAbsEntry(index)}
                        disabled={entry.saved}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          entry.saved
                            ? 'bg-green-900/30 text-green-400 border border-green-800/50 cursor-default'
                            : 'bg-charcoal-lighter text-text-primary hover:bg-accent hover:text-white border border-charcoal-lighter'
                        }`}
                        data-testid={`abs-save-${index}`}
                      >
                        {entry.saved ? '✓' : 'Save'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overload Charts — shown for saved exercises */}
          {logEntries.some((e) => e.saved) && (
            <div className="mt-6" data-testid="overload-charts-section">
              <h2 className="font-body text-text-primary text-xs mb-3">PROGRESSIVE OVERLOAD</h2>
              <div className="flex flex-col gap-4">
                {logEntries
                  .filter((e) => e.saved && overloadData[e.name])
                  .map((entry) => {
                    const chartInfo = overloadData[entry.name]
                    return (
                      <div key={`overload-${entry.name}`} className="panel p-3 relative" data-testid={`overload-chart-${entry.name}`}>
                        <span className="font-body text-[10px] text-text-primary uppercase mb-1 block">
                          {entry.name}
                        </span>
                        <OverloadChart
                          exerciseName={entry.name}
                          data={chartInfo.data}
                          timeRange={chartInfo.timeRange}
                          onTimeRangeChange={(range) => handleOverloadTimeRangeChange(entry.name, range)}
                          onDotClick={handleChartDotClick(entry.name)}
                        />
                        {/* InlineInput overlay for this exercise's chart */}
                        {inlineEdit && inlineEdit.exerciseName === entry.name && (
                          <InlineInput
                            date={inlineEdit.date}
                            metric={inlineEdit.exerciseName}
                            category="gym"
                            existingValue={inlineEdit.weight}
                            position={inlineEdit.position}
                            onSave={handleInlineSave}
                            onDismiss={handleInlineDismiss}
                          />
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cardio Section */}
      <div className="mt-6">
        <button
          onClick={() => setShowCardio(!showCardio)}
          className="flex items-center gap-2 w-full text-left mb-2"
        >
          <span className="font-body text-text-primary text-xs">CARDIO</span>
          <span className="text-text-muted text-xs ml-auto">{showCardio ? '▾' : '▸'}</span>
        </button>
        {showCardio && (
          <div className="panel p-4">
            {/* Run */}
            <div className="mb-4">
              <h3 className="font-body text-text-primary text-[10px] uppercase mb-2">Run</h3>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col">
                  <label className="text-[9px] text-text-muted font-body mb-0.5">Duration (min)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cardioForm.duration}
                    onChange={(e) => setCardioForm((f) => ({ ...f, duration: e.target.value }))}
                    placeholder="30"
                    className="bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs text-text-primary w-20"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[9px] text-text-muted font-body mb-0.5">Distance (mi)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cardioForm.distance}
                    onChange={(e) => setCardioForm((f) => ({ ...f, distance: e.target.value }))}
                    placeholder="3.1"
                    className="bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs text-text-primary w-20"
                  />
                </div>
                {cardioForm.duration && cardioForm.distance && parseFloat(cardioForm.distance) > 0 && (
                  <div className="flex flex-col">
                    <label className="text-[9px] text-text-muted font-body mb-0.5">Pace</label>
                    <span className="text-xs text-accent font-body">
                      {(parseFloat(cardioForm.duration) / parseFloat(cardioForm.distance)).toFixed(1)} min/mi
                    </span>
                  </div>
                )}
                <button
                  onClick={handleSaveRun}
                  disabled={cardioSaving}
                  className="px-3 py-1 text-xs font-body bg-charcoal-lighter text-text-primary rounded hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
                >
                  {cardioSaving ? '...' : cardioSaved ? '✓' : 'Log Run'}
                </button>
              </div>
            </div>
            {/* Swim */}
            <div>
              <h3 className="font-body text-text-primary text-[10px] uppercase mb-2">Swim</h3>
              <p className="text-text-muted text-[10px] font-body">Coming soon</p>
            </div>
          </div>
        )}
      </div>

      {/* Exercise History — by Muscle Group */}
      {historyMetrics.length > 0 && (
        <div className="mt-6" data-testid="exercise-history-section">
          <h2 className="font-body text-text-primary text-xs mb-3">EXERCISE HISTORY</h2>
          <div className="panel p-4">
            {/* Muscle group toggle */}
            <div className="flex flex-wrap gap-1 mb-3">
              {MUSCLE_GROUP_NAMES.map((group) => (
                <button
                  key={group}
                  onClick={() => setHistorySelectedGroup(group)}
                  className={`px-2 py-1 text-[10px] font-body rounded transition-colors ${
                    historySelectedGroup === group
                      ? 'bg-accent text-white'
                      : 'bg-charcoal-lighter text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>

            {/* Time range toggles */}
            <div className="flex gap-1 mb-3">
              {['1m', '3m', '6m', 'ytd'].map((range) => (
                <button
                  key={range}
                  onClick={() => setHistoryTimeRange(range)}
                  className={`px-2 py-0.5 text-[10px] font-body rounded transition-colors ${
                    historyTimeRange === range
                      ? 'bg-charcoal-lighter text-text-primary border border-charcoal-lighter'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {range === 'ytd' ? 'YTD' : range.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Multi-exercise chart for the selected muscle group */}
            {historyLoading ? (
              <div className="h-[150px] flex items-center justify-center text-text-muted text-xs">
                Loading...
              </div>
            ) : Object.keys(historyData).length === 0 ? (
              <div className="h-[120px] flex items-center justify-center text-text-secondary text-xs font-body">
                No data for {historySelectedGroup} in this period
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {Object.keys(historyData).map((name, idx) => (
                    <span key={name} className="flex items-center gap-1 text-[9px] font-body text-text-muted">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }} />
                      {name}
                    </span>
                  ))}
                </div>
                {/* Chart */}
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3a" />
                    <XAxis
                      dataKey="date"
                      type="category"
                      allowDuplicatedCategory={false}
                      stroke="#6b7280"
                      tick={{ fontSize: 9, fill: '#6b7280' }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 9, fill: '#9ca3af' }} width={35} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#242430',
                        border: '1px solid #2e2e3a',
                        borderRadius: '6px',
                        fontSize: '11px',
                      }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    {Object.entries(historyData).map(([name, entries], idx) => (
                      <Line
                        key={name}
                        data={entries.map((e) => ({ date: e.date, [name]: e.value }))}
                        dataKey={name}
                        type="monotone"
                        stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                        name={name}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      )}

      {/* Recent Gym Entries — collapsible */}
      {recentGymLogs.length > 0 && (
        <div className="mt-6" data-testid="recent-gym-entries">
          <button
            onClick={() => setShowRecentEntries(!showRecentEntries)}
            className="flex items-center gap-2 w-full text-left mb-2"
          >
            <span className="font-body text-text-primary text-xs">RECENT ENTRIES</span>
            <span className="text-text-muted text-[10px] font-body">({recentGymLogs.length})</span>
            <span className="text-text-muted text-xs ml-auto">{showRecentEntries ? '▾' : '▸'}</span>
          </button>
          {showRecentEntries && (
          <div className="panel p-3">
            <div className="flex flex-col gap-1">
              {recentGymLogs.map((log) => {
                const isEditing = editingLogId === log.id
                const { reps, sets, flag } = parseNotesForEdit(log.notes)

                return (
                  <div key={log.id} className="border-b border-charcoal-lighter/30 py-2 last:border-0">
                    {isEditing ? (
                      /* Edit form */
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-text-primary text-xs font-body w-28 truncate">{log.metric}</span>
                        <input
                          type="number"
                          step="0.5"
                          value={editForm.weight}
                          onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                          className="bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs text-text-primary w-16"
                          placeholder="lbs"
                        />
                        <input
                          type="number"
                          step="1"
                          value={editForm.reps}
                          onChange={(e) => setEditForm((f) => ({ ...f, reps: e.target.value }))}
                          className="bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs text-text-primary w-14"
                          placeholder="reps"
                        />
                        <input
                          type="number"
                          step="1"
                          value={editForm.sets}
                          onChange={(e) => setEditForm((f) => ({ ...f, sets: e.target.value }))}
                          className="bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs text-text-primary w-14"
                          placeholder="sets"
                        />
                        <button
                          onClick={() => setEditForm((f) => ({
                            ...f,
                            flag: f.flag === 'none' ? 'failure' : f.flag === 'failure' ? 'dropset' : 'none'
                          }))}
                          className={`px-1.5 py-0.5 text-[9px] rounded border ${
                            editForm.flag === 'failure' ? 'border-red-500 text-red-400'
                            : editForm.flag === 'dropset' ? 'border-yellow-500 text-yellow-400'
                            : 'border-charcoal-lighter text-text-muted'
                          }`}
                        >
                          {editForm.flag === 'failure' ? 'Fail' : editForm.flag === 'dropset' ? 'Drop' : '—'}
                        </button>
                        <button
                          onClick={() => handleSaveEdit(log.id)}
                          className="px-2 py-0.5 text-[10px] bg-charcoal-lighter text-text-primary rounded hover:bg-accent hover:text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingLogId(null)}
                          className="text-[10px] text-text-muted hover:text-text-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      /* Display row */
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-text-muted text-[10px] font-body w-16 shrink-0">{log.date.slice(5)}</span>
                          <span className="text-text-primary text-xs font-body truncate">{log.metric}</span>
                          <span className="text-text-secondary text-[10px] font-body shrink-0">
                            {log.value}lbs
                          </span>
                          <span className="text-text-muted text-[10px] font-body shrink-0">
                            {reps}r{sets ? ` x ${sets}s` : ''}
                            {flag !== 'none' && (
                              <span className={flag === 'failure' ? 'text-red-400 ml-1' : 'text-yellow-400 ml-1'}>
                                {flag === 'failure' ? '⚠' : '↓'}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <button
                            onClick={() => handleEditEntry(log)}
                            className="text-[10px] text-text-muted hover:text-accent transition-colors"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(log.id)}
                            className="text-[10px] text-text-muted hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  )
}
