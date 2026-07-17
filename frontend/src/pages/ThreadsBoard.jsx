import { useState, useEffect } from 'react'
import { getThreads, createThread, updateThread, deleteThread } from '../api'

const STATUSES = ['not_started', 'in_progress', 'blocked', 'done']
const STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Complete',
}
const STATUS_COLORS = {
  not_started: 'bg-charcoal-lighter text-text-muted',
  in_progress: 'bg-charcoal-lighter text-text-primary border border-charcoal-lighter',
  blocked: 'bg-charcoal-lighter text-text-secondary border border-charcoal-lighter',
  done: 'bg-charcoal-lighter text-text-muted border border-charcoal-lighter',
}
const CATEGORIES = ['transfer_app', 'club', 'research', 'school', 'personal_project']

export default function ThreadsBoard() {
  const [threads, setThreads] = useState([])
  const [collapsed, setCollapsed] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'personal_project', next_action: '' })
  const [filterCategory, setFilterCategory] = useState('')

  useEffect(() => {
    loadThreads()
  }, [filterCategory])

  async function loadThreads() {
    const params = {}
    if (filterCategory) params.category = filterCategory
    const data = await getThreads(params)
    setThreads(data)
  }

  async function handleCreate(e) {
    e.preventDefault()
    await createThread({
      ...form,
      status: 'not_started',
      next_action: form.next_action || null,
    })
    setForm({ name: '', category: 'personal_project', next_action: '' })
    setShowForm(false)
    loadThreads()
  }

  async function handleStatusChange(id, newStatus) {
    await updateThread(id, { status: newStatus })
    loadThreads()
  }

  async function handleDelete(id) {
    await deleteThread(id)
    loadThreads()
  }

  function toggleCollapse(status) {
    setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }))
  }

  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = threads.filter((t) => t.status === s)
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mt-12">
        <h1 className="font-body text-text-primary text-xs md:text-sm">THREADS BOARD</h1>
        <div className="flex gap-2 items-center">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-charcoal-lighter border border-charcoal-lighter rounded px-2 py-1 text-sm text-text-secondary font-body"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-charcoal-lighter border border-charcoal-lighter text-text-secondary px-3 py-1 rounded text-sm font-body hover:bg-charcoal-light transition-colors"
          >
            + New Thread
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-charcoal-light border border-charcoal-lighter rounded p-4 mb-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Thread name..."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm font-body text-text-primary placeholder-text-muted"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm font-body text-text-secondary"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Next action (optional)"
            value={form.next_action}
            onChange={(e) => setForm({ ...form, next_action: e.target.value })}
            className="bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm font-body text-text-primary placeholder-text-muted"
          />
          <button type="submit" className="bg-charcoal-lighter text-text-primary px-4 py-2 rounded text-sm font-body font-medium hover:bg-charcoal-light transition-colors">
            Create Thread
          </button>
        </form>
      )}

      {/* Mobile: stacked collapsible */}
      <div className="flex flex-col gap-3 md:hidden">
        {STATUSES.map((status) => (
          <div key={status} className="bg-charcoal-light border border-charcoal-lighter rounded p-3">
            <button
              onClick={() => toggleCollapse(status)}
              className="w-full flex items-center justify-between"
            >
              <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
              <span className="text-text-muted text-sm font-body">{grouped[status].length}</span>
            </button>
            {!collapsed[status] && (
              <div className="mt-3 flex flex-col gap-2">
                {grouped[status].map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
                {grouped[status].length === 0 && (
                  <p className="text-text-muted text-xs italic font-body">No threads</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: kanban columns */}
      <div className="hidden md:grid md:grid-cols-4 gap-4">
        {STATUSES.map((status) => (
          <div key={status} className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
              <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
              <span className="text-text-muted text-xs font-body">{grouped[status].length}</span>
            </div>
            {grouped[status].map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ThreadCard({ thread, onStatusChange, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="bg-charcoal-light border border-charcoal-lighter rounded p-3 hover:bg-charcoal-lighter transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium font-body text-text-primary">{thread.name}</p>
          <p className="text-xs font-body text-text-secondary mt-0.5">{thread.category.replace(/_/g, ' ')}</p>
        </div>
      </div>
      {thread.next_action && (
        <p className="text-xs font-body text-text-muted mt-2 border-l-2 border-charcoal-lighter pl-2">
          → {thread.next_action}
        </p>
      )}
      {expanded && (
        <div className="mt-3 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {STATUSES.filter((s) => s !== thread.status).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(thread.id, s)}
              className={`badge text-[7px] font-body ${STATUS_COLORS[s]} cursor-pointer hover:opacity-80`}
            >
              → {STATUS_LABELS[s]}
            </button>
          ))}
          <button
            onClick={() => onDelete(thread.id)}
            className="badge text-[7px] font-body bg-charcoal-lighter text-text-secondary border border-charcoal-lighter hover:opacity-80"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
