import { useState, useEffect, useMemo } from 'react'
import { getCalendarEvents, createDeadline, deleteDeadline, getThreads } from '../api'

const VIEWS = ['Month', 'Week', 'Year']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Distinct project colors for calendar items
const PROJECT_COLORS = [
  '#FF4F00', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa',
  '#f472b6', '#38bdf8', '#4ade80', '#fb923c', '#c084fc',
]
const PERSONAL_COLOR = '#9ca3af'
const CANVAS_COLOR = '#818cf8' // reserved for future

function getProjectColor(projectId, projectColorMap) {
  if (!projectId) return PERSONAL_COLOR
  return projectColorMap[projectId] || PROJECT_COLORS[projectId % PROJECT_COLORS.length]
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay()
}

function formatDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getWeekDates(refDate) {
  const d = new Date(refDate)
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const dates = []
  for (let i = 0; i < 7; i++) {
    const dd = new Date(start)
    dd.setDate(start.getDate() + i)
    dates.push(dd.toISOString().split('T')[0])
  }
  return dates
}

export default function CalendarPage() {
  const [view, setView] = useState('Month')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay()) // Sunday of current week
    return d.toISOString().split('T')[0]
  })
  const [events, setEvents] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ title: '', due_date: '', project_id: '' })
  const [loading, setLoading] = useState(true)

  // Build project color map
  const projectColorMap = useMemo(() => {
    const map = {}
    projects.forEach((p, idx) => {
      map[p.id] = PROJECT_COLORS[idx % PROJECT_COLORS.length]
    })
    return map
  }, [projects])

  // Load projects for color mapping and dropdown
  useEffect(() => {
    getThreads().then(setProjects).catch(() => setProjects([]))
  }, [])

  // Load events when view/month/year/weekStart changes
  useEffect(() => {
    loadEvents()
  }, [view, year, month, weekStartDate])

  async function loadEvents() {
    setLoading(true)
    let dateFrom, dateTo
    if (view === 'Year') {
      dateFrom = `${year}-01-01`
      dateTo = `${year}-12-31`
    } else if (view === 'Week') {
      const dates = getWeekDates(new Date(weekStartDate))
      dateFrom = dates[0]
      dateTo = dates[6]
    } else {
      dateFrom = formatDate(year, month, 1)
      dateTo = formatDate(year, month, getDaysInMonth(year, month))
    }
    try {
      const data = await getCalendarEvents(dateFrom, dateTo)
      setEvents(data || [])
    } catch {
      setEvents([])
    }
    setLoading(false)
  }

  function navigatePrev() {
    if (view === 'Year') {
      setYear((y) => y - 1)
    } else if (view === 'Week') {
      const d = new Date(weekStartDate)
      d.setDate(d.getDate() - 7)
      setWeekStartDate(d.toISOString().split('T')[0])
    } else {
      if (month === 1) { setMonth(12); setYear((y) => y - 1) }
      else setMonth((m) => m - 1)
    }
    setSelectedDay(null)
  }

  function navigateNext() {
    if (view === 'Year') {
      setYear((y) => y + 1)
    } else if (view === 'Week') {
      const d = new Date(weekStartDate)
      d.setDate(d.getDate() + 7)
      setWeekStartDate(d.toISOString().split('T')[0])
    } else {
      if (month === 12) { setMonth(1); setYear((y) => y + 1) }
      else setMonth((m) => m + 1)
    }
    setSelectedDay(null)
  }

  function getEventsForDate(dateStr) {
    return events.filter((e) => e.due_date === dateStr)
  }

  async function handleAddDeadline(e) {
    e.preventDefault()
    if (!addForm.title.trim() || !addForm.due_date) return
    try {
      await createDeadline({
        title: addForm.title.trim(),
        due_date: addForm.due_date,
        source: 'personal',
        project_id: addForm.project_id ? parseInt(addForm.project_id) : null,
      })
      setAddForm({ title: '', due_date: '', project_id: '' })
      setShowAddForm(false)
      await loadEvents()
    } catch { /* silent */ }
  }

  async function handleDeleteEvent(eventId) {
    // Only delete deadlines (not subtasks — those are managed from projects)
    if (!eventId.startsWith('deadline-')) return
    const id = parseInt(eventId.replace('deadline-', ''))
    try {
      await deleteDeadline(id)
      await loadEvents()
    } catch { /* silent */ }
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' })

  // Build month grid cells
  const monthCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfWeek(year, month)
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, key: `empty-${i}` })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `day-${d}` })
    return cells
  }, [year, month])

  // Week view dates
  const weekDates = useMemo(() => {
    return getWeekDates(new Date(weekStartDate))
  }, [weekStartDate])

  return (
    <div className="md:mt-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-body text-text-primary text-xs md:text-sm">CALENDAR</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2 py-0.5 text-[10px] font-body rounded transition-colors ${
                  view === v ? 'bg-accent text-white' : 'bg-charcoal-lighter text-text-muted hover:text-text-secondary'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {/* Add deadline button */}
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddForm({ ...addForm, due_date: selectedDay || todayStr }) }}
            className="px-2 py-0.5 text-[10px] font-body text-accent hover:text-accent/80 transition-colors"
          >
            + Deadline
          </button>
        </div>
      </div>

      {/* Add deadline form */}
      {showAddForm && (
        <form onSubmit={handleAddDeadline} className="panel p-3 mb-4 flex flex-col gap-2">
          <input
            type="text"
            value={addForm.title}
            onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Deadline title..."
            className="bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs text-text-primary font-body focus:outline-none focus:border-accent"
            autoFocus
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={addForm.due_date}
              onChange={(e) => setAddForm((f) => ({ ...f, due_date: e.target.value }))}
              className="bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs text-text-primary font-body focus:outline-none focus:border-accent flex-1"
            />
            <select
              value={addForm.project_id}
              onChange={(e) => setAddForm((f) => ({ ...f, project_id: e.target.value }))}
              className="bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs text-text-secondary font-body flex-1"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1 text-xs font-body bg-charcoal-lighter text-text-primary rounded hover:bg-accent hover:text-white transition-colors">
              Add
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1 text-xs font-body text-text-muted hover:text-text-secondary transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={navigatePrev} className="text-text-muted hover:text-text-primary px-2 py-1 text-sm font-body">←</button>
        <span className="font-body text-text-primary text-xs">
          {view === 'Year' ? year : `${monthName} ${year}`}
        </span>
        <button onClick={navigateNext} className="text-text-muted hover:text-text-primary px-2 py-1 text-sm font-body">→</button>
      </div>

      {loading ? (
        <div className="panel p-6 text-center text-text-muted text-xs">Loading...</div>
      ) : (
        <>
          {/* MONTH VIEW */}
          {view === 'Month' && (
            <div className="panel p-3">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_LABELS.map((l) => (
                  <div key={l} className="text-center text-[9px] text-text-secondary font-body">{l}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((cell) => {
                  if (!cell.day) return <div key={cell.key} className="aspect-square" />
                  const dateStr = formatDate(year, month, cell.day)
                  const dayEvents = getEventsForDate(dateStr)
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDay

                  return (
                    <div
                      key={cell.key}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                      className={`aspect-square flex flex-col items-center justify-start pt-1 rounded cursor-pointer text-[10px] font-body transition-colors
                        ${isToday ? 'ring-1 ring-accent' : ''}
                        ${isSelected ? 'bg-charcoal-lighter' : 'hover:bg-charcoal-lighter/50'}
                      `}
                    >
                      <span className={`${dayEvents.length > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                        {cell.day}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {dayEvents.slice(0, 3).map((ev, i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: getProjectColor(ev.project_id, projectColorMap) }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {view === 'Week' && (
            <div className="panel p-3">
              <div className="grid grid-cols-7 gap-2">
                {weekDates.map((dateStr, i) => {
                  const dayEvents = getEventsForDate(dateStr)
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDay
                  const dayNum = parseInt(dateStr.slice(8))

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                      className={`flex flex-col items-center p-2 rounded cursor-pointer transition-colors min-h-[80px]
                        ${isToday ? 'ring-1 ring-accent' : ''}
                        ${isSelected ? 'bg-charcoal-lighter' : 'hover:bg-charcoal-lighter/50'}
                      `}
                    >
                      <span className="text-[9px] text-text-secondary font-body">{DAY_LABELS[i]}</span>
                      <span className={`text-xs font-body ${dayEvents.length > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                        {dayNum}
                      </span>
                      <div className="flex flex-col gap-0.5 mt-1 w-full">
                        {dayEvents.slice(0, 2).map((ev, j) => (
                          <div
                            key={j}
                            className="w-full h-1 rounded-full"
                            style={{ backgroundColor: getProjectColor(ev.project_id, projectColorMap) }}
                          />
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[8px] text-text-muted text-center">+{dayEvents.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* YEAR VIEW */}
          {view === 'Year' && (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const mDays = getDaysInMonth(year, m)
                const mName = new Date(year, m - 1).toLocaleString('default', { month: 'short' })
                // Count events this month
                const monthEvents = events.filter((e) => {
                  const eMonth = parseInt(e.due_date.slice(5, 7))
                  return eMonth === m
                })

                return (
                  <div
                    key={m}
                    onClick={() => { setMonth(m); setView('Month') }}
                    className="panel p-2 cursor-pointer hover:bg-charcoal-lighter/50 transition-colors"
                  >
                    <span className="text-[10px] font-body text-text-primary">{mName}</span>
                    {monthEvents.length > 0 && (
                      <span className="text-[9px] font-body text-accent ml-1">{monthEvents.length}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Selected day detail — inline expansion */}
          {selectedDay && (
            <div className="panel p-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-body text-text-primary text-xs">{selectedDay}</span>
                <button
                  onClick={() => { setShowAddForm(true); setAddForm({ title: '', due_date: selectedDay, project_id: '' }) }}
                  className="text-[10px] text-accent hover:text-accent/80 font-body"
                >
                  + Add
                </button>
              </div>
              {getEventsForDate(selectedDay).length === 0 ? (
                <p className="text-text-muted text-[10px] font-body">Nothing due this day</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {getEventsForDate(selectedDay).map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between py-1 border-b border-charcoal-lighter/30 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getProjectColor(ev.project_id, projectColorMap) }}
                        />
                        <span className={`text-xs font-body truncate ${ev.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                          {ev.title}
                        </span>
                        {ev.project_name && (
                          <span className="text-[9px] text-text-muted font-body shrink-0">
                            {ev.project_name}
                          </span>
                        )}
                      </div>
                      {ev.type === 'deadline' && (
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="text-[10px] text-text-muted hover:text-red-400 ml-2 shrink-0"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Color legend — only shown in the selected day detail when items are visible */}
        </>
      )}
    </div>
  )
}
