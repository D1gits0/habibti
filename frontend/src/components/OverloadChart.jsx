import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

const TIME_RANGES = ['1m', '3m', '6m', 'YTD']

/**
 * Parse reps and sets from the notes field.
 * Formats: "8r", "8r x 3s", "failure:true|10r x 3s"
 */
function parseNotesData(notes) {
  if (!notes) return { reps: null, sets: 1 }
  const repsMatch = notes.match(/(\d+)r/)
  const setsMatch = notes.match(/(\d+)s/)
  return {
    reps: repsMatch ? parseInt(repsMatch[1], 10) : null,
    sets: setsMatch ? parseInt(setsMatch[1], 10) : 1,
  }
}

/**
 * Compute volume score: weight × reps × sets
 * This gives a single number representing total work output per exercise.
 */
function computeScore(weight, reps, sets) {
  if (!weight || !reps) return null
  return Math.round(weight * reps * sets)
}

export default function OverloadChart({ exerciseName, data, timeRange, onTimeRangeChange, onDotClick, hideTimeRange }) {
  const chartData = (data || []).map((entry) => {
    const { reps, sets } = parseNotesData(entry.notes)
    const score = computeScore(entry.value, reps, sets)
    return {
      date: entry.date,
      weight: entry.value,
      reps,
      sets,
      score,
    }
  })

  return (
    <div className="mt-2 mb-4">
      {/* Time range selector */}
      {!hideTimeRange && (
        <div className="flex items-center gap-1 mb-2">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`px-2 py-0.5 text-[10px] font-body rounded transition-colors ${
                timeRange === range
                  ? 'bg-accent text-white'
                  : 'bg-charcoal-lighter text-text-muted hover:text-text-secondary'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      )}

      {/* Chart or empty state */}
      {chartData.length === 0 ? (
        <div className="h-[120px] flex items-center justify-center text-text-secondary text-xs font-body">
          No data for this period
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                tick={{ fontSize: 9, fill: '#6b7280' }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis
                stroke="#FF4F00"
                tick={{ fontSize: 9, fill: '#FF4F00' }}
                width={40}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#242430',
                  border: '1px solid #2e2e3a',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value, name) => {
                  if (name === 'Volume Score') return [value.toLocaleString(), name]
                  return [value, name]
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#FF4F00"
                strokeWidth={2}
                dot={{ fill: '#FF4F00', r: 3, cursor: onDotClick ? 'pointer' : 'default' }}
                activeDot={onDotClick ? {
                  r: 5,
                  fill: '#FF4F00',
                  cursor: 'pointer',
                  onClick: (data, index, e) => {
                    if (data && data.payload) {
                      const rect = e?.target?.getBoundingClientRect?.()
                      const parentRect = e?.target?.closest?.('.recharts-wrapper')?.getBoundingClientRect?.()
                      let x = 0, y = 0
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
                      onDotClick({
                        date: data.payload.date,
                        weight: data.payload.weight,
                        position: { x: Math.max(0, x), y: Math.max(0, y) },
                      })
                    }
                  },
                } : { r: 4, fill: '#FF4F00' }}
                name="Volume Score"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[8px] text-text-muted mt-1">Volume = weight × reps × sets</p>
        </>
      )}
    </div>
  )
}
