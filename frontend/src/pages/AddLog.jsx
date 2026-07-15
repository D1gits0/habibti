import { useState } from 'react'
import { createLog } from '../api'

const CATEGORIES = ['gym', 'sleep', 'hydration', 'habit']
const METRIC_SUGGESTIONS = {
  gym: ['incline_db_press', 'bench_press', 'squat', 'deadlift', 'lat_pulldown', 'bicep_curl', 'shoulder_press'],
  sleep: ['hours_slept', 'sleep_quality'],
  hydration: ['oz_water'],
  habit: ['tiktok_minutes', 'reading_minutes', 'meditation_minutes', 'screen_time_hours'],
}

export default function AddLog() {
  const [form, setForm] = useState({
    category: 'gym',
    metric: '',
    value: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  })
  const [xpAnim, setXpAnim] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    await createLog({
      ...form,
      value: parseFloat(form.value),
      notes: form.notes || null,
    })
    setXpAnim(true)
    setSubmitted(true)
    setTimeout(() => {
      setXpAnim(false)
      setSubmitted(false)
      setForm({ ...form, metric: '', value: '', notes: '' })
    }, 1500)
  }

  const categoryColors = {
    gym: 'border-gym-red/40',
    sleep: 'border-academic-blue/40',
    hydration: 'border-academic-blue/40',
    habit: 'border-habit-green/40',
  }

  const xpBarColors = {
    gym: 'bg-gym-red',
    sleep: 'bg-academic-blue',
    hydration: 'bg-academic-blue',
    habit: 'bg-habit-green',
  }

  return (
    <div className="max-w-md mx-auto md:mt-16">
      <h1 className="font-pixel text-habit-green text-xs md:text-sm mb-6">✏️ LOG ENTRY</h1>

      {/* XP bar animation */}
      <div className="xp-bar mb-4">
        <div
          className={`xp-bar-fill ${xpBarColors[form.category]} ${xpAnim ? 'w-full' : 'w-0'}`}
        />
      </div>
      {submitted && (
        <p className="text-center font-pixel text-[8px] text-quest-gold mb-4 animate-pulse">
          +XP LOGGED!
        </p>
      )}

      <form onSubmit={handleSubmit} className={`panel p-4 flex flex-col gap-4 border ${categoryColors[form.category]}`}>
        {/* Category */}
        <div>
          <label className="font-pixel text-[8px] text-gray-400 block mb-1">CATEGORY</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setForm({ ...form, category: cat, metric: '' })}
                className={`px-3 py-2 rounded text-sm border transition-colors ${
                  form.category === cat
                    ? 'bg-charcoal-lighter border-quest-purple text-white'
                    : 'border-charcoal-lighter text-gray-400 hover:border-gray-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Metric */}
        <div>
          <label className="font-pixel text-[8px] text-gray-400 block mb-1">METRIC</label>
          <input
            type="text"
            list="metric-suggestions"
            value={form.metric}
            onChange={(e) => setForm({ ...form, metric: e.target.value })}
            placeholder="e.g. incline_db_press"
            required
            className="w-full bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm placeholder-gray-500"
          />
          <datalist id="metric-suggestions">
            {(METRIC_SUGGESTIONS[form.category] || []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        {/* Value */}
        <div>
          <label className="font-pixel text-[8px] text-gray-400 block mb-1">VALUE</label>
          <input
            type="number"
            step="any"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="e.g. 45"
            required
            className="w-full bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm placeholder-gray-500"
          />
        </div>

        {/* Date */}
        <div>
          <label className="font-pixel text-[8px] text-gray-400 block mb-1">DATE</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm text-gray-300"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="font-pixel text-[8px] text-gray-400 block mb-1">NOTES (OPT)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes..."
            rows={2}
            className="w-full bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm placeholder-gray-500 resize-none"
          />
        </div>

        <button
          type="submit"
          className="bg-habit-green text-charcoal font-semibold px-4 py-2.5 rounded text-sm hover:bg-habit-green/80 transition-colors"
        >
          Log Entry
        </button>
      </form>
    </div>
  )
}
