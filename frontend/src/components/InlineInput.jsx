import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * InlineInput - A positioned input overlay for chart-based data entry.
 *
 * Props:
 *   date       - The date string for the data point being edited
 *   metric     - The metric name (e.g., "sleep_hours")
 *   category   - The log category (e.g., "sleep", "hydration")
 *   existingValue - Pre-populated value if editing an existing entry (number or null)
 *   position   - { x, y } coordinates for positioning the overlay
 *   onSave     - async (value: number) => void — called on Enter with validated numeric value
 *   onDismiss  - () => void — called on Escape or click outside
 */
export default function InlineInput({ date, metric, category, existingValue, position, onSave, onDismiss }) {
  const [value, setValue] = useState(existingValue != null ? String(existingValue) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Focus the input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  // Click-outside handler
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onDismiss()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onDismiss])

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const validate = useCallback((val) => {
    const trimmed = val.trim()
    if (trimmed === '') {
      return 'Value is required'
    }
    const num = Number(trimmed)
    if (!Number.isFinite(num)) {
      return 'Must be a valid number'
    }
    return ''
  }, [])

  async function handleSubmit() {
    const validationError = validate(value)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSaving(true)

    try {
      await onSave(Number(value.trim()))
    } catch (err) {
      setToast(err.message || 'Save failed. Please try again.')
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onDismiss()
    }
  }

  function handleChange(e) {
    setValue(e.target.value)
    // Clear validation error as user types
    if (error) {
      setError('')
    }
  }

  const style = position
    ? { position: 'absolute', left: `${position.x}px`, top: `${position.y}px` }
    : {}

  return (
    <div
      ref={containerRef}
      className="z-50 bg-charcoal-light border border-charcoal-lighter rounded-lg shadow-lg p-2 min-w-[140px]"
      style={style}
      data-testid="inline-input-container"
    >
      <div className="text-[9px] text-text-muted mb-1 truncate">
        {date} — {metric}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="w-full bg-charcoal border border-charcoal-lighter rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent transition-colors disabled:opacity-50"
        placeholder="Enter value"
        aria-label={`Value for ${metric} on ${date}`}
        data-testid="inline-input-field"
      />
      {error && (
        <p className="text-[10px] text-red-400 mt-1" data-testid="inline-input-error">
          {error}
        </p>
      )}
      {toast && (
        <p className="text-[10px] text-red-400 mt-1 bg-red-900/20 rounded px-1 py-0.5" data-testid="inline-input-toast">
          {toast}
        </p>
      )}
      <div className="text-[8px] text-text-muted mt-1">
        Enter to save · Esc to cancel
      </div>
    </div>
  )
}
