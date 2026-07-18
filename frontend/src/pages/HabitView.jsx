import { useState, useEffect, useCallback } from 'react'
import { getLogs, upsertLog, deleteLog } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import InlineInput from '../components/InlineInput'

const HABIT_CATEGORIES = ['sleep', 'hydration', 'habit']

// All known habit metrics — used to show cards even when no data exists
const KNOWN_METRICS = [
  { metric: 'sleep_quality', category: 'sleep', label: 'Sleep Quality' },
  { metric: 'oz_water', category: 'hydration', label: 'Water (oz)' },
  { metric: 'protein_g', category: 'habit', label: 'Protein (g)' },
]

const TIME_RANGES = [
  { key: '1w', label: '1W', days: 7 },
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: '6m', label: '6M', days: 180 },
  { key: 'ytd', label: 'YTD', days: null },
  { key: 'all', label: 'All', days: null },
]

function getDateFrom(rangeKey) {
  const now = new Date()
  if (rangeKey === 'ytd') {
    return `${now.getFullYear()}-01-01`
  }
  if (rangeKey === 'all') {
    return null
  }
  const range = TIME_RANGES.find((r) => r.key === rangeKey)
  if (!range || !range.days) return null
  const d = new Date()
  d.setDate(d.getDate() - range.days)
  return d.toISOString().split('T')[0]
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function HabitView() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('1m')
  const [inlineEdit, setInlineEdit] = useState(null)

  useEffect(() => {
    loadLogs()
  }, [timeRange])

  async function loadLogs() {
    setLoading(true)
    const dateFrom = getDateFrom(timeRange)
    const params = dateFrom ? { date_from: dateFrom } : {}

    const allLogs = await Promise.all(
      HABIT_CATEGORIES.map((cat) => getLogs({ category: cat, ...params }))
    )
    setLogs(allLogs.flat())
    setLoading(false)
  }

  // Open inline input for a specific date/metric (works from chart tap or add button)
  function openInlineEdit(date, metric, category, existingValue, position) {
    setInlineEdit({ date, metric, category, existingValue, position })
  }

  // Handle chart area click — opens inline input for the nearest date on x-axis
  const handleChartClick = useCallback((metric, category, chartData) => (e) => {
    if (!e || !e.activeLabel) return
    const date = e.activeLabel
    const existing = chartData.find((d) => d.date === date)

    const x = e.chartX || 60
    const y = Math.max(0, (e.chartY || 40) - 60)

    openInlineEdit(date, metric, category, existing ? existing.value : null, { x, y })
  }, [])

  // Handle clicking directly on a data point dot
  const handleDotClick = useCallback((metric, category) => (data, index, e) => {
    if (!data || !data.payload) return
    const { date, value } = data.payload

    const rect = e?.target?.getBoundingClientRect?.()
    const parentRect = e?.target?.closest?.('.recharts-wrapper')?.getBoundingClientRect?.()

    let x = 60, y = 0
    if (rect && parentRect) {
      x = rect.left - parentRect.left + rect.width / 2
      y = rect.top - parentRect.top - 60
    } else if (e?.clientX != null) {
      const wrapper = e?.target?.closest?.('.recharts-wrapper')
      if (wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect()
        x = e.clientX - wrapperRect.left
        y = e.clientY - wrapperRect.top - 60
      }
    }

    // Prevent the chart onClick from also firing
    e?.stopPropagation?.()

    openInlineEdit(date, metric, category, value, { x: Math.max(0, x), y: Math.max(0, y) })
  }, [])

  // Handle "Add today" button when no chart exists
  function handleAddToday(metric, category) {
    openInlineEdit(todayStr(), metric, category, null, { x: 60, y: 20 })
  }

  // Handle save from InlineInput
  const handleSave = useCallback(async (value) => {
    if (!inlineEdit) return
    const { date, metric, category } = inlineEdit

    await upsertLog({ date, metric, category, value })
    setInlineEdit(null)
    await loadLogs()
  }, [inlineEdit, timeRange])

  // Handle delete from InlineInput
  const handleDelete = useCallback(async () => {
    if (!inlineEdit) return
    const { date, metric, category } = inlineEdit

    const match = logs.find(
      (log) => log.date === date && log.metric === metric && log.category === category
    )
    if (match) {
      await deleteLog(match.id)
    }
    setInlineEdit(null)
    await loadLogs()
  }, [inlineEdit, logs, timeRange])

  const handleDismiss = useCallback(() => {
    setInlineEdit(null)
  }, [])

  // Group logs by category|metric
  const grouped = {}
  for (const log of logs) {
    const key = `${log.category}|${log.metric}`
    if (!grouped[key]) grouped[key] = { category: log.category, metric: log.metric, entries: [] }
    grouped[key].entries.push(log)
  }

  // Build display cards: show known metrics even if they have no data
  const displayCards = KNOWN_METRICS.map((km) => {
    const key = `${km.category}|${km.metric}`
    const data = grouped[key] || { category: km.category, metric: km.metric, entries: [] }
    return { ...data, label: km.label }
  })
  // Also include any additional metrics found in logs that aren't in KNOWN_METRICS
  for (const [key, data] of Object.entries(grouped)) {
    if (!KNOWN_METRICS.some((km) => `${km.category}|${km.metric}` === key)) {
      displayCards.push({ ...data, label: data.metric.replace(/_/g, ' ') })
    }
  }

  function getXpInfo(entries) {
    const total = entries.length
    const rangeDef = TIME_RANGES.find((r) => r.key === timeRange)
    const maxXp = rangeDef?.days || total || 1
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-body text-text-primary text-xs md:text-sm">HABITS</h1>
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setTimeRange(r.key)}
              className={`px-2 py-0.5 text-[10px] font-body rounded transition-colors ${
                timeRange === r.key
                  ? 'bg-accent text-white'
                  : 'bg-charcoal-lighter text-text-muted hover:text-text-secondary'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {displayCards.map(({ category, metric, entries, label }) => {
          const chartData = [...entries]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e) => ({ date: e.date, value: e.value }))
          const { total, pct } = getXpInfo(entries)
          const hasData = chartData.length > 0

          return (
            <div key={`${category}-${metric}`} className="panel p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-body text-[10px] text-text-primary uppercase">
                    {label}
                  </span>
                  <span className="text-[10px] text-text-muted ml-2">{category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-body text-[10px] text-text-secondary">
                    LVL {Math.floor(total / 5)}
                  </span>
                  {/* Always-visible Add button */}
                  <button
                    onClick={() => handleAddToday(metric, category)}
                    className="text-[10px] text-accent hover:text-accent/80 font-body transition-colors"
                    title="Log today"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {hasData && (
                <>
                  <div className="xp-bar mb-3">
                    <div
                      className="xp-bar-fill"
                      style={{ width: `${pct}%`, backgroundColor: '#FF4F00' }}
                    />
                  </div>
                  <p className="text-[10px] text-text-secondary mb-3">
                    {total} entries ({Math.round(pct)}% consistency)
                  </p>
                </>
              )}

              {/* Chart — shown when data exists, clickable to edit/add */}
              {hasData && (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart
                      data={chartData}
                      onClick={handleChartClick(metric, category, chartData)}
                    >
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
                        dot={{ fill: '#9ca3af', r: 4, cursor: 'pointer' }}
                        activeDot={{
                          r: 6,
                          fill: '#FF4F00',
                          cursor: 'pointer',
                          onClick: handleDotClick(metric, category),
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* InlineInput overlay */}
                  {inlineEdit && inlineEdit.metric === metric && inlineEdit.category === category && (
                    <InlineInput
                      date={inlineEdit.date}
                      metric={inlineEdit.metric}
                      category={inlineEdit.category}
                      existingValue={inlineEdit.existingValue}
                      position={inlineEdit.position}
                      onSave={handleSave}
                      onDelete={handleDelete}
                      onDismiss={handleDismiss}
                    />
                  )}
                </div>
              )}

              {/* Empty state with inline input support */}
              {!hasData && (
                <div className="relative">
                  <div className="h-[60px] flex items-center justify-center text-text-muted text-xs border border-dashed border-charcoal-lighter rounded">
                    No data yet — tap "+ Add" above to log today's value
                  </div>
                  {inlineEdit && inlineEdit.metric === metric && inlineEdit.category === category && (
                    <InlineInput
                      date={inlineEdit.date}
                      metric={inlineEdit.metric}
                      category={inlineEdit.category}
                      existingValue={inlineEdit.existingValue}
                      position={inlineEdit.position}
                      onSave={handleSave}
                      onDelete={handleDelete}
                      onDismiss={handleDismiss}
                    />
                  )}
                </div>
              )}

              {/* Recent values */}
              {hasData && (
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
