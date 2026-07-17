import { useState, useEffect } from 'react'
import { getLogs } from '../api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function GymView() {
  const [logs, setLogs] = useState([])
  const [metrics, setMetrics] = useState([])
  const [selectedMetric, setSelectedMetric] = useState('')

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    const data = await getLogs({ category: 'gym' })
    setLogs(data)
    const uniqueMetrics = [...new Set(data.map((l) => l.metric))]
    setMetrics(uniqueMetrics)
    if (uniqueMetrics.length > 0 && !selectedMetric) {
      setSelectedMetric(uniqueMetrics[0])
    }
  }

  // Compute personal records: max value per metric
  const personalRecords = metrics.reduce((acc, m) => {
    const values = logs.filter((l) => l.metric === m).map((l) => l.value)
    if (values.length > 0) {
      acc[m] = Math.max(...values)
    }
    return acc
  }, {})

  const chartData = logs
    .filter((l) => l.metric === selectedMetric)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({
      date: l.date,
      value: l.value,
      notes: l.notes,
    }))

  const recentLogs = logs.slice(0, 20)

  // Req 3.7: If no gym log entries exist, show a single empty-state replacing both chart and table
  if (logs.length === 0) {
    return (
      <div className="md:mt-12">
        <h1 className="font-body text-text-primary text-sm md:text-base mb-4">Gym Log</h1>
        <div className="panel p-6 text-center text-text-secondary text-sm">
          No gym data logged yet. Start logging exercises to track your progress.
        </div>
      </div>
    )
  }

  return (
    <div className="md:mt-12">
      <h1 className="font-body text-text-primary text-sm md:text-base mb-4">Gym Log</h1>

      {/* Chart Section */}
      <section className="mb-6">
        <h2 className="font-body text-text-primary text-xs mb-3">Progress Chart</h2>

        {/* Metric selector dropdown */}
        {metrics.length > 0 && (
          <div className="mb-3">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-charcoal-light border border-charcoal-lighter rounded px-3 py-1.5 text-xs text-text-muted font-body focus:outline-none focus:border-text-secondary"
            >
              {metrics.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Req 3.8: If selected metric has no entries, show empty in chart only */}
        {chartData.length > 0 ? (
          <div className="panel p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3a" />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#242430',
                    border: '1px solid #2e2e3a',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    const isPR = payload.value === personalRecords[selectedMetric]
                    return (
                      <circle
                        key={`dot-${payload.date}`}
                        cx={cx}
                        cy={cy}
                        r={isPR ? 5 : 3}
                        fill={isPR ? '#FF4F00' : '#9ca3af'}
                        stroke="none"
                      />
                    )
                  }}
                  activeDot={{ r: 5, fill: '#9ca3af' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="panel p-6 text-center text-text-secondary text-sm">
            No data for this metric.
          </div>
        )}
      </section>

      {/* Recent Entries Table Section */}
      <section>
        <h2 className="font-body text-text-primary text-xs mb-3">Recent Entries</h2>

        <div className="panel p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-charcoal-lighter">
                  <th className="text-left pb-2 pr-3">Date</th>
                  <th className="text-left pb-2 pr-3">Exercise</th>
                  <th className="text-right pb-2 pr-3">Value</th>
                  <th className="text-left pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id} className="border-b border-charcoal-lighter/50">
                    <td className="py-2 pr-3 text-text-secondary text-xs">{log.date}</td>
                    <td className="py-2 pr-3 text-text-primary">{log.metric.replace(/_/g, ' ')}</td>
                    <td className={`py-2 pr-3 text-right ${log.value === personalRecords[log.metric] ? 'text-accent font-bold' : 'text-text-muted'}`}>{log.value}</td>
                    <td className="py-2 text-text-secondary text-xs truncate max-w-[120px]">{log.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
