import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

const TIME_RANGES = ['1m', '3m', '6m', 'YTD']

/**
 * Parse reps from the notes field.
 * Formats: "8r", "failure:true|10r", "dropset:true|6r", "8r x 3s"
 */
function parseReps(notes) {
  if (!notes) return null
  const match = notes.match(/(\d+)r/)
  return match ? parseInt(match[1], 10) : null
}

export default function OverloadChart({ exerciseName, data, timeRange, onTimeRangeChange, onDotClick, hideTimeRange }) {
  const chartData = (data || []).map((entry) => ({
    date: entry.date,
    weight: entry.value,
    reps: parseReps(entry.notes),
  }))

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
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              yAxisId="weight"
              stroke="#9ca3af"
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              width={35}
            />
            <YAxis
              yAxisId="reps"
              orientation="right"
              stroke="#FF4F00"
              tick={{ fontSize: 9, fill: '#FF4F00' }}
              width={25}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#242430',
                border: '1px solid #2e2e3a',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="weight"
              stroke="#9ca3af"
              strokeWidth={1.5}
              dot={{ fill: '#9ca3af', r: 3, cursor: onDotClick ? 'pointer' : 'default' }}
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
              } : { r: 4, fill: '#9ca3af' }}
              name="Weight"
            />
            <Line
              yAxisId="reps"
              type="monotone"
              dataKey="reps"
              stroke="#FF4F00"
              strokeWidth={1.5}
              dot={false}
              name="Reps"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
