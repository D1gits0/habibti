import { useState, useEffect } from 'react'
import { getDayTasks, createDayTask, updateDayTask, deleteDayTask } from '../api'

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DayPlanner() {
  const [date, setDate] = useState(localToday())
  const [tasks, setTasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTasks() }, [date])

  async function loadTasks() {
    setLoading(true)
    try {
      const data = await getDayTasks(date)
      setTasks(data || [])
    } catch { setTasks([]) }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createDayTask({ title: newTitle.trim(), date })
    setNewTitle('')
    await loadTasks()
  }

  async function handleToggle(id, done) {
    await updateDayTask(id, { done: !done })
    await loadTasks()
  }

  async function handleDelete(id) {
    await deleteDayTask(id)
    await loadTasks()
  }

  function navigateDay(offset) {
    const d = new Date(date)
    d.setDate(d.getDate() + offset)
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  const doneCount = tasks.filter((t) => t.done).length
  const isToday = date === localToday()

  return (
    <div className="md:mt-12">
      <h1 className="font-body text-text-primary text-xs md:text-sm mb-4">DAY PLANNER</h1>

      {/* Date navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigateDay(-1)} className="text-text-muted hover:text-text-primary text-sm font-body px-2">←</button>
        <div className="flex items-center gap-2">
          <span className="font-body text-text-primary text-xs">{date}</span>
          {!isToday && (
            <button onClick={() => setDate(localToday())} className="text-[9px] text-accent font-body">Today</button>
          )}
        </div>
        <button onClick={() => navigateDay(1)} className="text-text-muted hover:text-text-primary text-sm font-body px-2">→</button>
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-text-muted font-body">{doneCount}/{tasks.length} done</span>
            {doneCount === tasks.length && tasks.length > 0 && (
              <span className="text-[10px] text-accent font-body">All done!</span>
            )}
          </div>
          <div className="w-full h-1.5 bg-charcoal-lighter rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(doneCount / tasks.length) * 100}%`, backgroundColor: '#FF4F00' }}
            />
          </div>
        </div>
      )}

      {/* Add task form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-xs font-body text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="px-3 py-2 text-xs font-body bg-charcoal-lighter text-text-primary rounded hover:bg-accent hover:text-white transition-colors"
        >
          +
        </button>
      </form>

      {/* Task list */}
      {loading ? (
        <p className="text-text-muted text-xs">Loading...</p>
      ) : tasks.length === 0 ? (
        <div className="panel p-6 text-center text-text-muted text-xs font-body">
          No tasks for this day. Add one above!
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`panel p-3 flex items-center gap-3 group ${task.done ? 'opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => handleToggle(task.id, task.done)}
                className="w-4 h-4 rounded border-charcoal-lighter accent-accent cursor-pointer shrink-0"
              />
              <span className={`flex-1 text-xs font-body ${task.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                {task.title}
              </span>
              <button
                onClick={() => handleDelete(task.id)}
                className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
