import { useState, useEffect } from 'react'
import { getScheduleConfig, updateScheduleConfig, getWeekSchedule, shiftSchedule } from '../api'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function WeekCalendar({ days, title }) {
  if (!days || days.length === 0) return null
  const today = new Date().toISOString().split('T')[0]
  return (
    <div>
      {title && <h2 className="font-body text-text-primary text-xs mb-3">{title}</h2>}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const d = new Date(day.date + 'T00:00:00')
          const dayLabel = DAY_LABELS[d.getDay()]
          const isToday = day.date === today
          const isRest = day.day_type === 'Rest'
          return (
            <div
              key={day.date}
              className={`flex flex-col items-center p-2 rounded-lg border transition-colors ${
                isToday ? 'border-accent/60 bg-accent/10' : 'border-charcoal-lighter bg-charcoal-light'
              }`}
            >
              <span className="text-text-muted text-[9px] font-body">{dayLabel}</span>
              <span className={`text-xs font-body mt-0.5 ${isToday ? 'text-accent' : 'text-text-secondary'}`}>
                {day.date.slice(5)}
              </span>
              <span className={`text-[10px] font-body font-semibold mt-1 px-1.5 py-0.5 rounded ${
                isRest ? 'text-text-muted bg-charcoal' : isToday ? 'text-accent bg-accent/10' : 'text-text-primary bg-charcoal-lighter'
              }`}>
                {day.day_type}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Settings() {
  const [splitCycle, setSplitCycle] = useState([])
  const [cycleStartDate, setCycleStartDate] = useState(null)
  const [weekPreview, setWeekPreview] = useState([])
  const [editingDate, setEditingDate] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [shiftDate, setShiftDate] = useState('')
  const [shiftError, setShiftError] = useState(null)
  const [shifting, setShifting] = useState(false)
  const [shiftResult, setShiftResult] = useState(null)

  useEffect(() => { loadConfig() }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      const config = await getScheduleConfig()
      setSplitCycle(config.split_cycle || [])
      setCycleStartDate(config.cycle_start_date || null)
      if (config.cycle_start_date) await loadWeekPreview()
    } catch (err) {
      setError('Failed to load schedule configuration.')
    } finally {
      setLoading(false)
    }
  }

  async function loadWeekPreview() {
    try {
      const week = await getWeekSchedule()
      setWeekPreview(Array.isArray(week) ? week : (week.days || []))
    } catch (err) {
      setWeekPreview([])
    }
  }

  function validateDate(dateStr) {
    if (!dateStr) return 'Please enter a date.'
    const date = new Date(dateStr + 'T00:00:00')
    if (isNaN(date.getTime())) return 'Invalid date format.'
    const today = new Date(); today.setHours(0,0,0,0)
    const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000)
    if (diffDays < -30) return 'Date must be within 30 days in the past.'
    if (diffDays > 30) return 'Date must be within 30 days in the future.'
    return null
  }

  async function handleSave() {
    setError(null)
    const ve = validateDate(editingDate)
    if (ve) { setError(ve); return }
    try {
      setSaving(true)
      await updateScheduleConfig({ cycle_start_date: editingDate })
      setCycleStartDate(editingDate)
      setEditingDate('')
      await loadWeekPreview()
    } catch (err) { setError('Failed to save.') }
    finally { setSaving(false) }
  }

  async function handleShift() {
    setShiftError(null); setShiftResult(null)
    if (!shiftDate) { setShiftError('Please select a date.'); return }
    const selected = new Date(shiftDate + 'T00:00:00')
    if (isNaN(selected.getTime())) { setShiftError('Invalid date.'); return }
    const today = new Date(); today.setHours(0,0,0,0)
    if (selected <= today) { setShiftError('Only future dates may be marked unavailable.'); return }
    try {
      setShifting(true)
      const result = await shiftSchedule({ unavailable_date: shiftDate })
      setShiftResult(result)
      setCycleStartDate(result.new_cycle_start_date)
      setShiftDate('')
      await loadWeekPreview()
    } catch (err) { setShiftError(err.message || 'Failed to shift.') }
    finally { setShifting(false) }
  }

  if (loading) return (
    <div className="md:mt-12">
      <h1 className="font-body text-text-primary text-sm md:text-base mb-4">Settings</h1>
      <p className="text-text-secondary text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="md:mt-12">
      <h1 className="font-body text-text-primary text-sm md:text-base mb-4">Settings</h1>

      {weekPreview.length > 0 && (
        <section className="mb-6">
          <WeekCalendar days={weekPreview} title="This Week" />
        </section>
      )}

      <section className="mb-6">
        <h2 className="font-body text-text-primary text-xs mb-3">Cycle Start Date</h2>
        <div className="panel p-4">
          <div className="mb-3">
            <span className="text-text-secondary text-xs">Current: </span>
            <span className="text-text-primary text-sm">{cycleStartDate || 'Not configured'}</span>
          </div>
          {!cycleStartDate && <p className="text-text-secondary text-xs mb-3">Set a start date to activate your split schedule.</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="date" value={editingDate} onChange={(e) => { setEditingDate(e.target.value); setError(null) }}
              className="bg-charcoal border border-charcoal-lighter rounded px-3 py-1.5 text-xs text-text-primary font-body focus:outline-none focus:border-text-secondary" />
            <button onClick={handleSave} disabled={saving || !editingDate}
              className="px-4 py-1.5 rounded text-xs font-body bg-charcoal-lighter text-text-primary hover:bg-charcoal-lighter/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-body text-text-primary text-xs mb-3">Schedule Shift</h2>
        <div className="panel p-4">
          <p className="text-text-secondary text-xs mb-3">Mark a future day as unavailable to shift your schedule forward.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="date" value={shiftDate} onChange={(e) => { setShiftDate(e.target.value); setShiftError(null); setShiftResult(null) }}
              className="bg-charcoal border border-charcoal-lighter rounded px-3 py-1.5 text-xs text-text-primary font-body focus:outline-none focus:border-text-secondary" />
            <button onClick={handleShift} disabled={shifting || !shiftDate}
              className="px-4 py-1.5 rounded text-xs font-body bg-charcoal-lighter text-text-primary hover:bg-charcoal-lighter/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {shifting ? 'Shifting...' : 'Mark Unavailable'}
            </button>
          </div>
          {shiftError && <p className="mt-2 text-red-400 text-xs">{shiftError}</p>}
          {shiftResult && (
            <div className="mt-4">
              <p className="text-text-secondary text-xs mb-3">
                Schedule updated. {shiftResult.absorbed_rest ? 'A rest day was absorbed.' : 'All subsequent days shifted forward by one.'}
              </p>
              <WeekCalendar days={shiftResult.week_schedule} />
            </div>
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-body text-text-primary text-xs mb-3">Split Cycle</h2>
        <div className="panel p-3">
          <div className="flex flex-wrap gap-2">
            {splitCycle.map((day) => (
              <div key={day.day_index} className="flex items-center gap-1.5 text-xs font-body">
                <span className="text-text-muted w-4">{day.day_index}</span>
                <span className={`px-2 py-0.5 rounded ${day.day_type === 'Rest' ? 'text-text-muted bg-charcoal' : 'text-text-primary bg-charcoal-lighter'}`}>
                  {day.day_type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
