import { useState, useEffect, useCallback } from 'react'
import { getLogs, upsertLog } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import InlineInput from '../components/InlineInput'

const HABIT_CATEGORIES = ['sleep', 'hydration', 'habit']

export default function HabitView() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [inlineEdit, setInlineEdit] = useState(null) // { date, metric, category, existingValue, position }

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0]

    const allLogs = await Promise.all(
      HABIT_CATEGORIES.map((cat) => getLogs({ category: cat, date_from: dateFrom }))
    )
    setLogs(allLogs.flat())
    setLoading(false)
  }

  // Handle chart data point click
  const handleDotClick = useCallback((metric, category, chartData) => (data, index, e) => {
    if (!data || !data.payload) return
    const { date, value } = data.payload

    // Get position from the mouse event or the dot element
    const rect = e?.target?.getBoundingClientRect?.()
    const parentRect = e?.target?.closest?.('.recharts-wrapper')?.getBoundingClientRect?.()

    let x = 0
    let y = 0
    if (rect && parentRect) {
      x = rect.left - parentRect.left + rect.width / 2
      y = rect.top - parentRect.top - 60 // position above the point
    } else if (e?.clientX != null) {
      // Fallback to click coordinates relative to the chart wrapper
      const wrapper = e?.target?.closest?.('.recharts-wrapper')
      if (wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect()
        x = e.clientX - wrapperRect.left
        y = e.clientY - wrapperRect.top - 60
      }
    }

    setInlineEdit({
      date,
      metric,
      category,
      existingValue: value,
      position: { x: Math.max(0, x), y: Math.max(0, y) },
    })
  }, [])

  // Handle save from InlineInput
  const handleSave = useCallback(async (value) => {
    if (!inlineEdit) return
    const { date, metric, category } = inlineEdit

    await upsertLog({ date, metric, category, value })

    // Dismiss the input
    setInlineEdit(null)

    // Refresh chart data
    await loadLogs()
  }, [inlineEdit])

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setInlineEdit(null)
  }, [])

  // Group by category then metric
  const grouped = {}
  for (const log of logs) {
    const key = `${log.category}|${log.metric}`
    if (!grouped[key]) grouped[key] = { category: log.category, metric: log.metric, entries: [] }
    grouped[key].entries.push(log)
  }

  // Calculate streaks and totals for XP bars
  function getXpInfo(entries) {
    const total = entries.length
    const maxXp = 30 // 30-day period
    const pct = Math.min((total / maxXp) * 100, 100)
    return { total, pct }
  }

  if (loading) {
    return (
      <div className="md:mt-12">
        <h1 className="font-body text-text-primary text-xs md:text-sm mb-4">HABITS</h1>
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="md:mt-12">
      <h1 className="font-body text-text-primary text-xs md:text-sm mb-4">HABITS — LAST 30 DAYS</h1>

      {Object.keys(grouped).length === 0 ? (
        <div className="panel p-6 text-center text-text-secondary text-sm">
          No habit data in the last 30 days. Start logging!
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.values(grouped).map(({ category, metric, entries }) => {
            const chartData = [...entries].reverse().map((e) => ({
              date: e.date,
              value: e.value,
            }))
            const { total, pct } = getXpInfo(entries)

            return (
              <div key={`${category}-${metric}`} className="panel p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-body text-[10px] text-text-primary uppercase">
                      {metric.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-text-muted ml-2">{category}</span>
                  </div>
                  <span className="font-body text-[10px] text-text-secondary">
                    LVL {Math.floor(total / 5)}
                  </span>
                </div>

                {/* XP bar */}
                <div className="xp-bar mb-3">
                  <div
                    className="xp-bar-fill"
                    style={{ width: `${pct}%`, backgroundColor: '#FF4F00' }}
                  />
                </div>
                <p className="text-[10px] text-text-secondary mb-3">
                  {total} entries / 30 days ({Math.round(pct)}% consistency)
                </p>

                {/* Mini chart with clickable data points */}
                {chartData.length > 1 && (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={100}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3a" />
                        <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          tick={{ fontSize: 9, fill: '#6b7280' }}
                          tickFormatter={(v) => v.slice(5)}
                        />
                        <YAxis stroke="#6b7280" tick={{ fontSize: 9, fill: '#6b7280' }} width={30} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#242430',
                            border: '1px solid #2e2e3a',
                            borderRadius: '8px',
                            fontSize: '11px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#9ca3af"
                          strokeWidth={1.5}
                          dot={{ fill: '#9ca3af', r: 3, cursor: 'pointer' }}
                          activeDot={{
                            r: 5,
                            fill: '#FF4F00',
                            cursor: 'pointer',
                            onClick: handleDotClick(metric, category, chartData),
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    {/* InlineInput overlay positioned within the chart area */}
                    {inlineEdit && inlineEdit.metric === metric && inlineEdit.category === category && (
                      <InlineInput
                        date={inlineEdit.date}
                        metric={inlineEdit.metric}
                        category={inlineEdit.category}
                        existingValue={inlineEdit.existingValue}
                        position={inlineEdit.position}
                        onSave={handleSave}
                        onDismiss={handleDismiss}
                      />
                    )}
                  </div>
                )}

                {/* Recent values table */}
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {entries.slice(0, 5).map((e) => (
                        <tr key={e.id} className="border-b border-charcoal-lighter/30">
                          <td className="py-1 text-text-secondary">{e.date}</td>
                          <td className="py-1 text-right font-medium text-text-primary">{e.value}</td>
                          <td className="py-1 pl-2 text-text-muted truncate max-w-[100px]">{e.notes || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
