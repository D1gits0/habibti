import { useState } from 'react'
import { parseNaturalLanguage, createLog } from '../api'

const EXCLUDED_CATEGORIES = ['cardio', 'schoolwork', 'canvas', 'sms']

export default function NLInputModal({ isOpen, onClose }) {
  const [inputText, setInputText] = useState('')
  const [parsedEntries, setParsedEntries] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saveResults, setSaveResults] = useState(null)

  if (!isOpen) return null

  const today = new Date().toISOString().split('T')[0]

  function filterExcluded(entries) {
    return entries.filter(
      (e) => !EXCLUDED_CATEGORIES.includes(e.category?.toLowerCase())
    )
  }

  async function handleParse() {
    if (!inputText.trim()) return
    setLoading(true)
    setError(null)
    setParsedEntries(null)
    setSaveResults(null)

    try {
      const result = await parseNaturalLanguage({ text: inputText })
      const entries = Array.isArray(result) ? result : result.entries || []
      const filtered = filterExcluded(entries).map((entry) => ({
        ...entry,
        date: entry.date || today,
      }))
      setParsedEntries(filtered)
    } catch (err) {
      if (
        err.message?.toLowerCase().includes('timeout') ||
        err.message?.toLowerCase().includes('timed out')
      ) {
        setError('Claude API timed out. Please retry.')
      } else {
        setError(err.message || 'Failed to parse input. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmSave() {
    if (!parsedEntries || parsedEntries.length === 0) return
    setSaving(true)
    setSaveResults(null)

    const results = await Promise.allSettled(
      parsedEntries.map((entry) =>
        createLog({
          category: entry.category,
          metric: entry.metric,
          value: parseFloat(entry.value) || 0,
          notes: entry.notes || null,
          date: entry.date || today,
        })
      )
    )

    const failures = results
      .map((r, i) => (r.status === 'rejected' ? i : null))
      .filter((i) => i !== null)

    if (failures.length === 0) {
      setSaveResults({ success: true })
      setTimeout(() => {
        handleClose()
      }, 1000)
    } else {
      setSaveResults({
        success: false,
        failedIndices: failures,
        message: `${failures.length} of ${parsedEntries.length} entries failed to save.`,
      })
    }
    setSaving(false)
  }

  function handleClose() {
    setInputText('')
    setParsedEntries(null)
    setError(null)
    setSaveResults(null)
    setLoading(false)
    setSaving(false)
    onClose()
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-charcoal-light border border-charcoal-lighter rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto font-body">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary text-sm font-semibold">
            Natural Language Input
          </h2>
          <button
            onClick={handleClose}
            className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Input area */}
        <div className="mb-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, 2000))}
            placeholder="Describe your workout or habits in plain English..."
            rows={5}
            className="w-full bg-charcoal border border-charcoal-lighter rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-text-secondary transition-colors"
            maxLength={2000}
            disabled={loading}
          />
          <div className="flex justify-end mt-1">
            <span className="text-text-muted text-xs">
              {inputText.length}/2000
            </span>
          </div>
        </div>

        {/* Parse button */}
        {!parsedEntries && (
          <button
            onClick={handleParse}
            disabled={loading || !inputText.trim()}
            className="w-full bg-charcoal-lighter border border-charcoal-lighter text-text-primary px-4 py-2 rounded text-sm hover:bg-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Parsing...' : 'Parse'}
          </button>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-3 bg-charcoal border border-red-500/30 rounded">
            <p className="text-red-400 text-xs">{error}</p>
            <button
              onClick={handleParse}
              className="mt-2 text-text-secondary text-xs hover:text-text-primary underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Parsed entries preview */}
        {parsedEntries && parsedEntries.length > 0 && (
          <div className="mt-4">
            <h3 className="text-text-secondary text-xs mb-2 uppercase tracking-wide">
              Parsed Entries
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {parsedEntries.map((entry, i) => (
                <div
                  key={i}
                  className={`p-2 bg-charcoal border rounded text-xs ${
                    saveResults?.failedIndices?.includes(i)
                      ? 'border-red-500/40'
                      : 'border-charcoal-lighter'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-text-primary font-semibold">
                      {entry.category}
                    </span>
                    <span className="text-text-muted">{entry.date}</span>
                  </div>
                  <div className="text-text-secondary mt-1">
                    {entry.metric}: {entry.value}
                    {entry.notes && (
                      <span className="text-text-muted ml-2">
                        — {entry.notes}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Save results */}
            {saveResults?.success && (
              <p className="mt-3 text-green-400 text-xs">
                All entries saved successfully!
              </p>
            )}
            {saveResults && !saveResults.success && (
              <p className="mt-3 text-red-400 text-xs">{saveResults.message}</p>
            )}

            {/* Confirm button */}
            {!saveResults?.success && (
              <button
                onClick={handleConfirmSave}
                disabled={saving}
                className="w-full mt-4 bg-accent/90 hover:bg-accent text-charcoal font-semibold px-4 py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Confirm & Save'}
              </button>
            )}
          </div>
        )}

        {/* Empty parsed results */}
        {parsedEntries && parsedEntries.length === 0 && (
          <div className="mt-4 p-3 bg-charcoal border border-charcoal-lighter rounded">
            <p className="text-text-muted text-xs">
              No supported entries found. Only gym, sleep, water, and protein
              entries are tracked.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
