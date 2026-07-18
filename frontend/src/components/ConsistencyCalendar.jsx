import { useMemo } from 'react'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Returns the number of days in a given month/year.
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

/**
 * Returns the day-of-week (0=Sun) for the 1st of the given month.
 */
function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay()
}

/**
 * Checks if the given month/year is the current month.
 */
function isCurrentMonth(year, month) {
  const now = new Date()
  return now.getFullYear() === year && now.getMonth() + 1 === month
}

/**
 * ConsistencyCalendar — month-view grid showing which days had gym sessions.
 *
 * Props:
 *   month     - 1-12
 *   year      - full year (e.g. 2025)
 *   gymDays   - array of day numbers (1-31) that have at least one gym log
 *   onNavigate - function('prev' | 'next')
 */
export default function ConsistencyCalendar({ month, year, gymDays = [], onNavigate }) {
  const today = new Date()
  const todayDay = today.getDate()
  const isToday = isCurrentMonth(year, month)

  const canGoNext = useMemo(() => {
    const now = new Date()
    return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)
  }, [year, month])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfWeek(year, month)

  const gymDaysSet = useMemo(() => new Set(gymDays), [gymDays])

  // Build grid cells: leading blanks + day numbers
  const cells = useMemo(() => {
    const result = []
    // Leading empty cells for days before the 1st
    for (let i = 0; i < firstDayOfWeek; i++) {
      result.push({ key: `empty-${i}`, day: null })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ key: `day-${d}`, day: d })
    }
    return result
  }, [firstDayOfWeek, daysInMonth])

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' })

  return (
    <div className="panel p-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onNavigate('prev')}
          className="text-text-muted hover:text-text-primary px-2 py-1 text-sm"
          aria-label="Previous month"
        >
          ←
        </button>
        <h3 className="font-body text-text-primary text-xs">
          {monthName} {year}
        </h3>
        <button
          onClick={() => onNavigate('next')}
          disabled={!canGoNext}
          className={`px-2 py-1 text-sm ${canGoNext ? 'text-text-muted hover:text-text-primary' : 'text-charcoal-lighter cursor-not-allowed'}`}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] text-text-secondary font-body">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (cell.day === null) {
            return <div key={cell.key} className="aspect-square" />
          }

          const hasGym = gymDaysSet.has(cell.day)
          const isTodayCell = isToday && cell.day === todayDay

          return (
            <div
              key={cell.key}
              className={`aspect-square flex items-center justify-center rounded text-[11px] font-body
                ${hasGym ? 'bg-accent/20 text-accent' : 'text-text-muted'}
                ${isTodayCell ? 'ring-1 ring-accent' : ''}
              `}
            >
              {cell.day}
            </div>
          )
        })}
      </div>
    </div>
  )
}
