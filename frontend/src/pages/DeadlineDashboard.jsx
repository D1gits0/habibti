import { useState, useEffect, useMemo } from 'react'
import { getDeadlines, getCalendarEvents, deleteDeadline, getThreads } from '../api'

const PROJECT_COLORS = [
  '#FF4F00', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa',
  '#f472b6', '#38bdf8', '#4ade80', '#fb923c', '#c084fc',
]
const PERSONAL_COLOR = '#9ca3af'

function getProjectColor(projectId, projectColorMap) {
  if (!projectId) return PERSONAL_COLOR
  return projectColorMap[projectId] || PROJECT_COLORS[projectId % PROJECT_COLORS.length]
}

export default function DeadlineDashboard() {
  const [events, setEvents] = useState([])
  const [projects, setProjects] = useState([])
  const [filterProject, setFilterProject] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [loading, setLoading] = useState(true)

  const projectColorMap = useMemo(() => {
    const map = {}
    projects.forEach((p, idx) => { map[p.id] = PROJECT_COLORS[idx % PROJECT_COLORS.length] })
    return map
  }, [projects])

  useEffect(() => {
    getThreads().then(setProjects).catch(() => setProjects([]))
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      // Fetch a wide range — all deadlines from a year ago to a year ahead
      const now = new Date()
      const from = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0]
      const to = new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0]
      const data = await getCalendarEvents(from, to)
      setEvents(data || [])
    } catch {
      setEvents([])
    }
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]

  // Filter and sort
  const filtered = useMemo(() => {
    let items = [...events]
    if (filterProject) {
      items = items.filter((e) => String(e.project_id) === filterProject)
    }
    if (filterSource) {
      if (filterSource === 'personal') items = items.filter((e) => e.source === 'personal' && e.type === 'deadline')
      else if (filterSource === 'project') items = items.filter((e) => e.type === 'subtask' || (e.type === 'deadline' && e.project_id))
    }
    // Sort by due_date ascending
    items.sort((a, b) => a.due_date.localeCompare(b.due_date))
    return items
  }, [events, filterProject, filterSource])

  // Split into overdue, today, upcoming
  const overdue = filtered.filter((e) => e.due_date < today && !e.done)
  const dueToday = filtered.filter((e) => e.due_date === today)
  const upcoming = filtered.filter((e) => e.due_date > today)

  async function handleDelete(eventId) {
    if (!eventId.startsWith('deadline-')) return
    const id = parseInt(eventId.replace('deadline-', ''))
    await deleteDeadline(id)
    await loadAll()
  }

  if (loading) {
    return (
      <div className="md:mt-12">
        <h1 className="font-body text-text-primary text-xs md:text-sm mb-4">DEADLINES</h1>
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    )
  }

  function renderItem(ev) {
    const isPast = ev.due_date < today && !ev.done
    return (
      <div key={ev.id} className="flex items-center justify-between py-2 border-b border-charcoal-lighter/30 last:border-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: getProjectColor(ev.project_id, projectColorMap) }}
          />
          <span className={`text-xs font-body truncate ${ev.done ? 'text-text-muted line-through' : isPast ? 'text-red-400' : 'text-text-primary'}`}>
            {ev.title}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={`text-[10px] font-body ${isPast ? 'text-red-400' : 'text-text-muted'}`}>
            {ev.due_date.slice(5)}
          </span>
          {ev.project_name && (
            <span className="text-[9px] font-body text-text-muted">{ev.project_name}</span>
          )}
          {ev.type === 'deadline' && (
            <button
              onClick={() => handleDelete(ev.id)}
              className="text-[10px] text-text-muted hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="md:mt-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-body text-text-primary text-xs md:text-sm">DEADLINES</h1>
        <div className="flex gap-2">
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="bg-charcoal border border-charcoal-lighter rounded px-2 py-0.5 text-[10px] text-text-secondary font-body"
          >
            <option value="">All Sources</option>
            <option value="personal">Personal</option>
            <option value="project">Project-linked</option>
          </select>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-charcoal border border-charcoal-lighter rounded px-2 py-0.5 text-[10px] text-text-secondary font-body"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-4">
          <h2 className="font-body text-red-400 text-[10px] mb-2 uppercase">Overdue ({overdue.length})</h2>
          <div className="panel p-3">
            {overdue.map(renderItem)}
          </div>
        </div>
      )}

      {/* Today */}
      {dueToday.length > 0 && (
        <div className="mb-4">
          <h2 className="font-body text-accent text-[10px] mb-2 uppercase">Due Today ({dueToday.length})</h2>
          <div className="panel p-3">
            {dueToday.map(renderItem)}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-4">
          <h2 className="font-body text-text-primary text-[10px] mb-2 uppercase">Upcoming ({upcoming.length})</h2>
          <div className="panel p-3">
            {upcoming.map(renderItem)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="panel p-6 text-center text-text-muted text-xs font-body">
          No deadlines found. Add some from the Calendar page or set due dates on subtasks.
        </div>
      )}
    </div>
  )
}
