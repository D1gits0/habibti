import { useState, useEffect } from 'react'
import { getScheduleConfig, updateScheduleConfig, getWeekSchedule, shiftSchedule } from '../api'

export default function Settings() {
  const [splitCycle, setSplitCycle] = useState([])
  const [cycleStartDate, setCycleStartDate] = useState(null)
  const [weekPreview, setWeekPreview] = useState([])
  const [editingDate, setEditingDate] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Shift operation state
  const [shiftDate, setShiftDate] = useState('')
  const [shiftError, setShiftError] = useState(null)
  const [shifting, setShifting] = useState(false)
  const [shiftResult, setShiftResult] = useState(null)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      const config = await getScheduleConfig()
      setSplitCycle(config.split_cycle || [])
      setCycleStartDate(config.cycle_start_date || null)
      if (config.cycle_start_date) {
        await loadWeekPreview()
      }
    } catch (err) {
      setError('Failed to load schedule configuration.')
    } finally {
      setLoading(false)
    }
  }

  async function loadWeekPreview() {
    try {
      const week = await getWeekSchedule()
      setWeekPreview(week)
    } catch (err) {
      // Non-critical: week preview may fail if not configured
      setWeekPreview([])
    }
  }

  function validateDate(dateStr) {
    if (!dateStr) return 'Please enter a date.'
    const date = new Date(dateStr + 'T00:00:00')
    if (isNaN(date.getTime())) return 'Invalid date format. Use YYYY-MM-DD.'

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffMs = date.getTime() - today.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < -30) return 'Date must be within 30 days in the past.'
    if (diffDays > 30) return 'Date must be within 30 days in the future.'
    return null
  }

  async function handleSave() {
    setError(null)
    const validationError = validateDate(editingDate)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setSaving(true)
      await updateScheduleConfig({ cycle_start_date: editingDate })
      setCycleStartDate(editingDate)
      setEditingDate('')
      await loadWeekPreview()
    } catch (err) {
      setError('Failed to save configuration. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleShift() {
    setShiftError(null)
    setShiftResult(null)

    if (!shiftDate) {
      setShiftError('Please select a date.')
      return
    }

    const selected = new Date(shiftDate + 'T00:00:00')
    if (isNaN(selected.getTime())) {
      setShiftError('Invalid date format.')
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selected <= today) {
      setShiftError('Only future dates may be marked unavailable.')
      return
    }

    try {
      setShifting(true)
      const result = await shiftSchedule({ unavailable_date: shiftDate })
      setShiftResult(result)
      setCycleStartDate(result.new_cycle_start_date)
      setShiftDate('')
      await loadWeekPreview()
    } catch (err) {
      setShiftError(err.message || 'Failed to shift schedule.')
    } finally {
      setShifting(false)
    }
  }

  if (loading) {
    return (
      <div className="md:mt-12">
        <h1 className="font-body text-text-primary text-sm md:text-base mb-4">Settings</h1>
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="md:mt-12">
      <h1 className="font-body text-text-primary text-sm md:text-base mb-4">Settings</h1>

      {/* Split Cycle Table */}
      <section className="mb-6">
        <h2 className="font-body text-text-primary text-xs mb-3">Split Cycle</h2>
        <div className="panel p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-charcoal-lighter">
                  <th className="text-left pb-2 pr-3">Day</th>
                  <th className="text-left pb-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {splitCycle.map((day) => (
                  <tr key={day.day_index} className="border-b border-charcoal-lighter/50">
                    <td className="py-2 pr-3 text-text-secondary text-xs">
                      Day {day.day_index}
                    </td>
                    <td className="py-2 text-text-primary">{day.day_type}</td>
                  </tr>
                ))}
                {splitCycle.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-text-secondary text-xs">
                      No split cycle configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Cycle Start Date Configuration */}
      <section className="mb-6">
        <h2 className="font-body text-text-primary text-xs mb-3">Cycle Start Date</h2>
        <div className="panel p-4">
          <div className="mb-3">
            <span className="text-text-secondary text-xs">Current: </span>
            <span className="text-text-primary text-sm">
              {cycleStartDate || 'Not configured'}
            </span>
          </div>

          {!cycleStartDate && (
            <p className="text-text-secondary text-xs mb-3">
              Set a start date to activate your split schedule.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              value={editingDate}
              onChange={(e) => {
                setEditingDate(e.target.value)
                setError(null)
              }}
              className="bg-charcoal border border-charcoal-lighter rounded px-3 py-1.5 text-xs text-text-primary font-body focus:outline-none focus:border-text-secondary"
            />
            <button
              onClick={handleSave}
              disabled={saving || !editingDate}
              className="px-4 py-1.5 rounded text-xs font-body bg-charcoal-lighter text-text-primary hover:bg-charcoal-lighter/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-red-400 text-xs">{error}</p>
          )}
        </div>
      </section>

      {/* Week Preview */}
      {weekPreview.length > 0 && (
        <section className="mb-6">
          <h2 className="font-body text-text-primary text-xs mb-3">Week Preview</h2>
          <div className="panel p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted text-xs border-b border-charcoal-lighter">
                    <th className="text-left pb-2 pr-3">Date</th>
                    <th className="text-left pb-2">Day Type</th>
                  </tr>
                </thead>
                <tbody>
                  {weekPreview.map((day) => (
                    <tr key={day.date} className="border-b border-charcoal-lighter/50">
                      <td className="py-2 pr-3 text-text-secondary text-xs">{day.date}</td>
                      <td className="py-2 text-text-primary">{day.day_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Schedule Shift */}
      <section className="mb-6">
        <h2 className="font-body text-text-primary text-xs mb-3">Schedule Shift</h2>
        <div className="panel p-4">
          <p className="text-text-secondary text-xs mb-3">
            Mark a future day as unavailable to shift your schedule forward.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => {
                setShiftDate(e.target.value)
                setShiftError(null)
                setShiftResult(null)
              }}
              className="bg-charcoal border border-charcoal-lighter rounded px-3 py-1.5 text-xs text-text-primary font-body focus:outline-none focus:border-text-secondary"
            />
            <button
              onClick={handleShift}
              disabled={shifting || !shiftDate}
              className="px-4 py-1.5 rounded text-xs font-body bg-charcoal-lighter text-text-primary hover:bg-charcoal-lighter/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {shifting ? 'Shifting...' : 'Mark Unavailable'}
            </button>
          </div>

          {shiftError && (
            <p className="mt-2 text-red-400 text-xs">{shiftError}</p>
          )}

          {shiftResult && (
            <div className="mt-4">
              <p className="text-text-secondary text-xs mb-2">
                Schedule updated.{' '}
                {shiftResult.absorbed_rest
                  ? 'A rest day was absorbed — workout days beyond it remain in place.'
                  : 'No rest day was absorbed — all subsequent days shifted forward by one.'}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-muted text-xs border-b border-charcoal-lighter">
                      <th className="text-left pb-2 pr-3">Date</th>
                      <th className="text-left pb-2">Day Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftResult.week_schedule.map((day) => (
                      <tr key={day.date} className="border-b border-charcoal-lighter/50">
                        <td className="py-2 pr-3 text-text-secondary text-xs">{day.date}</td>
                        <td className="py-2 text-text-primary">{day.day_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
