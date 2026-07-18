import { useState, useEffect, useRef } from 'react'
import {
  getThreads,
  createThread,
  updateThread,
  deleteThread,
  getSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  reorderSubtasks,
} from '../api'

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

export default function ProjectsBoard() {
  const [threads, setThreads] = useState([])
  const [collapsed, setCollapsed] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'personal_project', next_action: '' })
  const [filterCategory, setFilterCategory] = useState('')
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverStatus, setDragOverStatus] = useState(null)

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

  function handleDragStart(e, threadId) {
    setDraggedId(threadId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, status) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStatus(status)
  }

  function handleDragLeave() {
    setDragOverStatus(null)
  }

  async function handleDrop(e, targetStatus) {
    e.preventDefault()
    setDragOverStatus(null)
    if (draggedId == null) return
    const thread = threads.find((t) => t.id === draggedId)
    if (thread && thread.status !== targetStatus) {
      await handleStatusChange(draggedId, targetStatus)
    }
    setDraggedId(null)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOverStatus(null)
  }

  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = threads.filter((t) => t.status === s)
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mt-12">
        <h1 className="font-body text-text-primary text-xs md:text-sm">PROJECTS BOARD</h1>
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
            + New Project
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-charcoal-light border border-charcoal-lighter rounded p-4 mb-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Project name..."
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
            Create Project
          </button>
        </form>
      )}

      {/* Mobile: stacked collapsible — drag between sections */}
      <div className="flex flex-col gap-3 md:hidden">
        {STATUSES.map((status) => (
          <div
            key={status}
            className={`bg-charcoal-light border border-charcoal-lighter rounded p-3 transition-colors ${
              dragOverStatus === status ? 'ring-1 ring-accent/30 bg-charcoal-lighter/50' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
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
                  <div
                    key={thread.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, thread.id)}
                    onDragEnd={handleDragEnd}
                    className={draggedId === thread.id ? 'opacity-50' : ''}
                  >
                    <ProjectCard
                      thread={thread}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                    />
                  </div>
                ))}
                {grouped[status].length === 0 && (
                  <p className="text-text-muted text-xs italic font-body">No projects</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: kanban columns — drag to move between statuses */}
      <div className="hidden md:grid md:grid-cols-4 gap-4">
        {STATUSES.map((status) => (
          <div
            key={status}
            className={`flex flex-col gap-2 min-h-[200px] rounded-lg p-2 transition-colors ${
              dragOverStatus === status ? 'bg-charcoal-lighter/50 ring-1 ring-accent/30' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
              <span className="text-text-muted text-xs font-body">{grouped[status].length}</span>
            </div>
            {grouped[status].map((thread) => (
              <div
                key={thread.id}
                draggable
                onDragStart={(e) => handleDragStart(e, thread.id)}
                onDragEnd={handleDragEnd}
                className={`cursor-grab active:cursor-grabbing ${draggedId === thread.id ? 'opacity-50' : ''}`}
              >
                <ProjectCard
                  thread={thread}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}


function ProjectCard({ thread, onStatusChange, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [subtasks, setSubtasks] = useState([])
  const [completionPercentage, setCompletionPercentage] = useState(0)
  const [showSubtasks, setShowSubtasks] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (showSubtasks) {
      loadSubtasks()
    }
  }, [showSubtasks])

  async function loadSubtasks() {
    try {
      const data = await getSubtasks(thread.id)
      if (data.subtasks) {
        setSubtasks(data.subtasks)
        setCompletionPercentage(data.completion_percentage ?? 0)
      } else if (Array.isArray(data)) {
        setSubtasks(data)
        computeLocalPercentage(data)
      }
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load subtasks')
    }
  }

  function computeLocalPercentage(items) {
    if (!items || items.length === 0) {
      setCompletionPercentage(0)
      return
    }
    const doneCount = items.filter((s) => s.done).length
    setCompletionPercentage(Math.floor((doneCount / items.length) * 100))
  }

  // Load subtasks on mount to show progress bar
  useEffect(() => {
    loadSubtasksForProgress()
  }, [])

  async function loadSubtasksForProgress() {
    try {
      const data = await getSubtasks(thread.id)
      if (data.subtasks) {
        setSubtasks(data.subtasks)
        setCompletionPercentage(data.completion_percentage ?? 0)
      } else if (Array.isArray(data)) {
        setSubtasks(data)
        computeLocalPercentage(data)
      }
    } catch {
      // silent fail for progress bar load
    }
  }

  return (
    <div
      className="bg-charcoal-light border border-charcoal-lighter rounded p-3 hover:bg-charcoal-lighter transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium font-body text-text-primary">{thread.name}</p>
          <p className="text-xs font-body text-text-secondary mt-0.5">{thread.category.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar percentage={completionPercentage} />

      {thread.next_action && (
        <p className="text-xs font-body text-text-muted mt-2 border-l-2 border-charcoal-lighter pl-2">
          → {thread.next_action}
        </p>
      )}

      {expanded && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap gap-1 mb-3">
            {STATUSES.filter((s) => s !== thread.status).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(thread.id, s)}
                className={`badge text-[7px] font-body ${STATUS_COLORS[s]} cursor-pointer hover:opacity-80`}
              >
                → {STATUS_LABELS[s]}
              </button>
            ))}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="badge text-[7px] font-body bg-charcoal-lighter text-text-secondary border border-charcoal-lighter hover:opacity-80"
              >
                Delete
              </button>
            ) : (
              <span className="flex items-center gap-1">
                <span className="text-[9px] text-red-400 font-body">Delete?</span>
                <button
                  onClick={() => { onDelete(thread.id); setConfirmDelete(false) }}
                  className="badge text-[7px] font-body bg-red-900/30 text-red-400 border border-red-500/50 hover:bg-red-900/50"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="badge text-[7px] font-body bg-charcoal-lighter text-text-muted border border-charcoal-lighter hover:opacity-80"
                >
                  No
                </button>
              </span>
            )}
          </div>

          <button
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="text-xs font-body text-text-secondary hover:text-text-primary transition-colors"
          >
            {showSubtasks ? '▾ Hide Subtasks' : '▸ Show Subtasks'}
          </button>

          {showSubtasks && (
            <SubtaskList
              threadId={thread.id}
              subtasks={subtasks}
              onReload={loadSubtasks}
              error={error}
              setError={setError}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ percentage }) {
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-body text-text-muted">{percentage}%</span>
      </div>
      <div className="w-full h-1.5 bg-charcoal rounded-full overflow-hidden">
        <div
          className="h-full bg-text-secondary rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}


function SubtaskList({ threadId, subtasks, onReload, error, setError }) {
  // Build tree from flat list
  const tree = buildTree(subtasks)

  return (
    <div className="mt-2">
      {error && (
        <p className="text-xs text-red-400 font-body mb-2">{error}</p>
      )}
      <SubtaskGroup
        threadId={threadId}
        items={tree}
        allSubtasks={subtasks}
        parentId={null}
        depth={0}
        onReload={onReload}
        setError={setError}
      />
      <SubtaskCreateInput
        threadId={threadId}
        parentId={null}
        depth={0}
        allSubtasks={subtasks}
        onReload={onReload}
        setError={setError}
      />
    </div>
  )
}

function buildTree(subtasks) {
  const map = {}
  const roots = []
  subtasks.forEach((s) => {
    map[s.id] = { ...s, children: [] }
  })
  subtasks.forEach((s) => {
    if (s.parent_subtask_id && map[s.parent_subtask_id]) {
      map[s.parent_subtask_id].children.push(map[s.id])
    } else {
      roots.push(map[s.id])
    }
  })
  // Sort by sort_order
  roots.sort((a, b) => a.sort_order - b.sort_order)
  Object.values(map).forEach((node) => {
    node.children.sort((a, b) => a.sort_order - b.sort_order)
  })
  return roots
}

function SubtaskGroup({ threadId, items, allSubtasks, parentId, depth, onReload, setError }) {
  const [draggedId, setDraggedId] = useState(null)

  function handleDragStart(e, id) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e, targetId) {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }

    // Reorder: move draggedId to position of targetId
    const siblings = items.map((i) => i.id)
    const fromIdx = siblings.indexOf(draggedId)
    const toIdx = siblings.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedId(null)
      return
    }

    const newOrder = [...siblings]
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, draggedId)

    const reorderItems = newOrder.map((id, idx) => ({ id, sort_order: idx }))

    try {
      await reorderSubtasks(threadId, { items: reorderItems })
      onReload()
    } catch (err) {
      setError(err.message || 'Failed to reorder subtasks')
    }
    setDraggedId(null)
  }

  return (
    <div className={depth > 0 ? (depth === 1 ? 'ml-4' : 'ml-8') : ''}>
      {items.map((item) => (
        <SubtaskItem
          key={item.id}
          item={item}
          threadId={threadId}
          allSubtasks={allSubtasks}
          depth={depth}
          onReload={onReload}
          setError={setError}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          isDragging={draggedId === item.id}
        />
      ))}
    </div>
  )
}

function SubtaskItem({ item, threadId, allSubtasks, depth, onReload, setError, onDragStart, onDragOver, onDrop, isDragging }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(item.description)

  async function handleToggle() {
    try {
      await updateSubtask(item.id, { done: !item.done })
      onReload()
    } catch (err) {
      setError(err.message || 'Failed to update subtask')
    }
  }

  async function handleEditSave() {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed.length > 300) {
      setError('Description must be 1-300 non-whitespace characters')
      return
    }
    try {
      await updateSubtask(item.id, { description: trimmed })
      setIsEditing(false)
      onReload()
    } catch (err) {
      setError(err.message || 'Failed to update subtask')
    }
  }

  async function handleDeleteSubtask() {
    try {
      await deleteSubtask(item.id)
      onReload()
    } catch (err) {
      setError(err.message || 'Failed to delete subtask')
    }
  }

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1 group ${isDragging ? 'opacity-50' : ''}`}
        draggable
        onDragStart={(e) => onDragStart(e, item.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, item.id)}
      >
        <span className="cursor-grab text-text-muted text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">⠿</span>
        <input
          type="checkbox"
          checked={item.done}
          onChange={handleToggle}
          className="w-3.5 h-3.5 rounded border-charcoal-lighter accent-text-secondary cursor-pointer"
          aria-label={`Mark "${item.description}" as ${item.done ? 'undone' : 'done'}`}
        />
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditSave()
              if (e.key === 'Escape') { setIsEditing(false); setEditValue(item.description) }
            }}
            autoFocus
            className="flex-1 bg-charcoal border border-charcoal-lighter rounded px-2 py-0.5 text-xs font-body text-text-primary"
          />
        ) : (
          <span
            className={`flex-1 text-xs font-body cursor-pointer ${item.done ? 'text-text-muted line-through' : 'text-text-primary'}`}
            onDoubleClick={() => setIsEditing(true)}
          >
            {item.description}
          </span>
        )}
        <button
          onClick={handleDeleteSubtask}
          className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
          aria-label={`Delete subtask "${item.description}"`}
        >
          ✕
        </button>
      </div>

      {/* Render children */}
      {item.children && item.children.length > 0 && (
        <SubtaskGroup
          threadId={threadId}
          items={item.children}
          allSubtasks={allSubtasks}
          parentId={item.id}
          depth={depth + 1}
          onReload={onReload}
          setError={setError}
        />
      )}

      {/* Add child subtask input (only if depth < 2) */}
      {depth < 1 && (
        <SubtaskCreateInput
          threadId={threadId}
          parentId={item.id}
          depth={depth + 1}
          allSubtasks={allSubtasks}
          onReload={onReload}
          setError={setError}
        />
      )}
    </div>
  )
}


function SubtaskCreateInput({ threadId, parentId, depth, allSubtasks, onReload, setError }) {
  const [showInput, setShowInput] = useState(false)
  const [value, setValue] = useState('')
  const [validationError, setValidationError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showInput])

  function validate(text) {
    const trimmed = text.trim()
    if (!trimmed) return 'Description cannot be empty'
    if (trimmed.length > 300) return 'Description must be 300 characters or fewer'
    return ''
  }

  async function handleSubmit() {
    const trimmed = value.trim()
    const err = validate(value)
    if (err) {
      setValidationError(err)
      return
    }

    // Check max count
    if (allSubtasks.length >= 50) {
      setError('Maximum of 50 subtasks per project reached')
      return
    }

    // Check max depth
    if (depth >= 2) {
      setError('Cannot nest deeper than 2 levels')
      return
    }

    try {
      await createSubtask(threadId, {
        description: trimmed,
        parent_subtask_id: parentId,
      })
      setValue('')
      setValidationError('')
      setShowInput(false)
      onReload()
    } catch (err) {
      const msg = err.message || 'Failed to create subtask'
      if (msg.includes('nesting depth')) {
        setError('Cannot nest deeper than 2 levels')
      } else if (msg.includes('50 subtasks')) {
        setError('Maximum of 50 subtasks per project reached')
      } else if (msg.includes('Description')) {
        setValidationError(msg)
      } else {
        setError(msg)
      }
    }
  }

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className={`text-[10px] font-body text-text-muted hover:text-text-secondary transition-colors mt-1 ${depth > 0 ? (depth === 1 ? 'ml-4' : 'ml-8') : ''}`}
        disabled={allSubtasks.length >= 50}
      >
        {allSubtasks.length >= 50 ? 'Max subtasks reached' : (parentId ? '+ Add sub-subtask' : '+ Add subtask')}
      </button>
    )
  }

  return (
    <div className={`mt-1 ${depth > 0 ? (depth === 1 ? 'ml-4' : 'ml-8') : ''}`}>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setValidationError('') }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') { setShowInput(false); setValue(''); setValidationError('') }
          }}
          placeholder={parentId ? 'Sub-subtask description...' : 'Subtask description...'}
          maxLength={300}
          className="flex-1 bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs font-body text-text-primary placeholder-text-muted"
        />
        <button
          onClick={handleSubmit}
          className="text-xs font-body text-text-secondary hover:text-text-primary px-1"
        >
          ✓
        </button>
        <button
          onClick={() => { setShowInput(false); setValue(''); setValidationError('') }}
          className="text-xs font-body text-text-muted hover:text-text-primary px-1"
        >
          ✕
        </button>
      </div>
      {validationError && (
        <p className="text-[10px] text-red-400 font-body mt-0.5">{validationError}</p>
      )}
    </div>
  )
}
