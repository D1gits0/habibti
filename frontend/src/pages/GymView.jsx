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

  const chartData = logs
    .filter((l) => l.metric === selectedMetric)
    .reverse()
    .map((l) => ({
      date: l.date,
      value: l.value,
      notes: l.notes,
    }))

  const recentLogs = logs.slice(0, 20)

  return (
    <div className="md:mt-12">
      <h1 className="font-pixel text-gym-red text-xs md:text-sm mb-4">🏋️ GYM LOG</h1>

      {/* Metric selector */}
      {metrics.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {metrics.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMetric(m)}
              className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                selectedMetric === m
                  ? 'bg-gym-red/20 border-gym-red/40 text-gym-red'
                  : 'border-charcoal-lighter text-gray-400 hover:border-gray-500'
              }`}
            >
              {m.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="panel panel-glow-red p-4 mb-6">
          <p className="font-pixel text-[8px] text-gray-400 mb-3">
            {selectedMetric.replace(/_/g, ' ').toUpperCase()} OVER TIME
          </p>
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
                stroke="#e85d4a"
                strokeWidth={2}
                dot={{ fill: '#e85d4a', r: 3 }}
                activeDot={{ r: 5, fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="panel p-6 mb-6 text-center text-gray-500 text-sm">
          {metrics.length === 0 ? 'No gym logs yet. Log some sets!' : 'Select a metric above.'}
        </div>
      )}

      {/* Recent entries table */}
      <div className="panel p-4">
        <p className="font-pixel text-[8px] text-gray-400 mb-3">RECENT ENTRIES</p>
        {recentLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-charcoal-lighter">
                  <th className="text-left pb-2 pr-3">Date</th>
                  <th className="text-left pb-2 pr-3">Exercise</th>
                  <th className="text-right pb-2 pr-3">Value</th>
                  <th className="text-left pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id} className="border-b border-charcoal-lighter/50">
                    <td className="py-2 pr-3 text-gray-400 text-xs">{log.date}</td>
                    <td className="py-2 pr-3 text-gray-200">{log.metric.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-3 text-right text-gym-red font-medium">{log.value}</td>
                    <td className="py-2 text-gray-400 text-xs truncate max-w-[120px]">{log.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No entries yet.</p>
        )}
      </div>
    </div>
  )
}
