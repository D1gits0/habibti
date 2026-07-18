import { useState, useEffect } from 'react'
import { getTodaySchedule } from '../api'

const SPLIT_CYCLE = ['Pull', 'Push', 'Legs', 'Rest', 'Upper', 'Rest', 'Lower']

export default function Settings() {
  const [todayInfo, setTodayInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const data = await getTodaySchedule()
        setTodayInfo(data)
      } catch (err) {
        setError('Failed to load schedule info.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="md:mt-12">
      <h1 className="font-body text-text-primary text-sm md:text-base mb-4">Settings</h1>
      <p className="text-text-secondary text-sm">Loading...</p>
    </div>
  )

  return (
    <div className="md:mt-12">
      <h1 className="font-body text-text-primary text-sm md:text-base mb-4">Settings</h1>

      {todayInfo && (
        <section className="mb-6">
          <h2 className="font-body text-text-primary text-xs mb-3">Today</h2>
          <div className="panel p-4">
            <span className="text-text-secondary text-xs">Day Type: </span>
            <span className="text-text-primary text-sm">{todayInfo.day_type}</span>
            <span className="text-text-muted text-xs ml-3">(Day {todayInfo.day_index + 1} of 7)</span>
          </div>
        </section>
      )}

      {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

      <section className="mb-6">
        <h2 className="font-body text-text-primary text-xs mb-3">Split Cycle (Reference)</h2>
        <div className="panel p-3">
          <div className="flex flex-wrap gap-2">
            {SPLIT_CYCLE.map((day, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs font-body">
                <span className="text-text-muted w-4">{idx + 1}</span>
                <span className={"px-2 py-0.5 rounded " + (day === 'Rest' ? "text-text-muted bg-charcoal" : "text-text-primary bg-charcoal-lighter")}>
                  {day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}