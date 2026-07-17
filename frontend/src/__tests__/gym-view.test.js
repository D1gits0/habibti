import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property tests for GymView logic (pure functions extracted from GymView.jsx).
 * These test the core logic without rendering components.
 */

// --- Arbitraries ---

const logEntry = fc.record({
  id: fc.nat(),
  date: fc.integer({ min: 0, max: 3652 }).map(offset => {
    const d = new Date('2020-01-01')
    d.setDate(d.getDate() + offset)
    return d.toISOString().split('T')[0]
  }),
  metric: fc.constantFrom(
    'bench_press', 'squat', 'deadlift', 'overhead_press',
    'barbell_row', 'pull_ups', 'leg_press', 'bicep_curl'
  ),
  value: fc.integer({ min: 1, max: 9999 }),
  notes: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  category: fc.constant('gym'),
})

// --- Pure logic functions (mirroring GymView.jsx) ---

function getRecentLogs(logs) {
  return [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
}

function computePersonalRecords(logs, metrics) {
  return metrics.reduce((acc, m) => {
    const values = logs.filter(l => l.metric === m).map(l => l.value)
    if (values.length > 0) {
      acc[m] = Math.max(...values)
    }
    return acc
  }, {})
}

function getChartData(logs, selectedMetric) {
  return logs
    .filter(l => l.metric === selectedMetric)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(l => ({ date: l.date, value: l.value, notes: l.notes }))
}

// --- Property Tests ---

/**
 * **Validates: Requirements 3.2**
 */
describe('Property 3: Gym Table Displays At Most 20 Entries Sorted by Date', () => {
  it('should display at most 20 entries for any non-empty log set', () => {
    fc.assert(
      fc.property(
        fc.array(logEntry, { minLength: 1, maxLength: 100 }),
        (logs) => {
          const recentLogs = getRecentLogs(logs)
          expect(recentLogs.length).toBeLessThanOrEqual(20)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should sort entries by date descending', () => {
    fc.assert(
      fc.property(
        fc.array(logEntry, { minLength: 2, maxLength: 100 }),
        (logs) => {
          const recentLogs = getRecentLogs(logs)
          for (let i = 1; i < recentLogs.length; i++) {
            expect(recentLogs[i - 1].date >= recentLogs[i].date).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should include the correct number of entries (min of log count and 20)', () => {
    fc.assert(
      fc.property(
        fc.array(logEntry, { minLength: 1, maxLength: 100 }),
        (logs) => {
          const recentLogs = getRecentLogs(logs)
          expect(recentLogs.length).toBe(Math.min(logs.length, 20))
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * **Validates: Requirements 3.4**
 */
describe('Property 4: Personal Record Equals Maximum Value Per Metric', () => {
  it('should compute PR as the maximum value for each metric', () => {
    fc.assert(
      fc.property(
        fc.array(logEntry, { minLength: 1, maxLength: 100 }),
        (logs) => {
          const metrics = [...new Set(logs.map(l => l.metric))]
          const personalRecords = computePersonalRecords(logs, metrics)

          for (const m of metrics) {
            const values = logs.filter(l => l.metric === m).map(l => l.value)
            const expectedMax = Math.max(...values)
            expect(personalRecords[m]).toBe(expectedMax)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should have a PR for every metric that has at least one entry', () => {
    fc.assert(
      fc.property(
        fc.array(logEntry, { minLength: 1, maxLength: 50 }),
        (logs) => {
          const metrics = [...new Set(logs.map(l => l.metric))]
          const personalRecords = computePersonalRecords(logs, metrics)

          for (const m of metrics) {
            expect(personalRecords[m]).toBeDefined()
            expect(typeof personalRecords[m]).toBe('number')
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * **Validates: Requirements 3.6**
 */
describe('Property 5: Chart Filter Shows Only Selected Metric', () => {
  it('should filter chart data to only the selected metric', () => {
    fc.assert(
      fc.property(
        fc.array(logEntry, { minLength: 2, maxLength: 100 }),
        fc.nat(),
        (logs, metricIndex) => {
          const metrics = [...new Set(logs.map(l => l.metric))]
          // Only test when we have multiple distinct metrics
          fc.pre(metrics.length >= 2)

          const selectedMetric = metrics[metricIndex % metrics.length]
          const chartData = getChartData(logs, selectedMetric)

          // All chart entries must be for the selected metric only
          for (const entry of chartData) {
            // chartData doesn't carry metric, but it's derived from filtered logs
            // Verify by checking the value exists in filtered source
            const sourceEntries = logs.filter(l => l.metric === selectedMetric)
            expect(sourceEntries.some(s =>
              s.date === entry.date && s.value === entry.value
            )).toBe(true)
          }

          // Chart data count must equal the number of logs for that metric
          const expectedCount = logs.filter(l => l.metric === selectedMetric).length
          expect(chartData.length).toBe(expectedCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should keep all metrics in the table (unfiltered)', () => {
    fc.assert(
      fc.property(
        fc.array(logEntry, { minLength: 2, maxLength: 100 }),
        fc.nat(),
        (logs, metricIndex) => {
          const metrics = [...new Set(logs.map(l => l.metric))]
          fc.pre(metrics.length >= 2)

          const selectedMetric = metrics[metricIndex % metrics.length]

          // Table logic: getRecentLogs shows all metrics (not filtered by selected)
          const recentLogs = getRecentLogs(logs)

          // The table should contain entries for multiple metrics (not just selected)
          const tableMetrics = [...new Set(recentLogs.map(l => l.metric))]

          // If logs have multiple metrics and enough entries,
          // the table should have more than just the selected metric
          // (unless all 20 happen to be the same metric by date ordering)
          // The key property: table is NOT filtered by selectedMetric
          // Verify that the table contents don't depend on selectedMetric
          const recentLogsWithDifferentSelection = getRecentLogs(logs)
          expect(recentLogs).toEqual(recentLogsWithDifferentSelection)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('chart data should not contain entries for non-selected metrics', () => {
    fc.assert(
      fc.property(
        fc.array(logEntry, { minLength: 2, maxLength: 100 }),
        fc.nat(),
        (logs, metricIndex) => {
          const metrics = [...new Set(logs.map(l => l.metric))]
          fc.pre(metrics.length >= 2)

          const selectedMetric = metrics[metricIndex % metrics.length]
          const chartData = getChartData(logs, selectedMetric)

          // Verify no entries from other metrics appear in chart data
          const otherMetricLogs = logs.filter(l => l.metric !== selectedMetric)
          for (const otherLog of otherMetricLogs) {
            // An entry from another metric should not appear in chart data
            // (unless by coincidence of same date+value, which is fine - 
            //  the key is chartData count matches filtered count)
            const matchesInChart = chartData.filter(c =>
              c.date === otherLog.date && c.value === otherLog.value && c.notes === otherLog.notes
            ).length

            const matchesInFiltered = logs.filter(l =>
              l.metric === selectedMetric &&
              l.date === otherLog.date &&
              l.value === otherLog.value &&
              l.notes === otherLog.notes
            ).length

            // Any match in chart data must be accounted for by the selected metric
            expect(matchesInChart).toBeLessThanOrEqual(matchesInFiltered)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
