import { useState } from 'react'

/**
 * SwapPicker - A picker for swapping exercises in a given slot.
 *
 * Props:
 *   slot            - The exercise slot index
 *   primaryExercise - The default primary exercise name
 *   swapHistory     - Array of previously-used swap exercise names (most recently used first)
 *   defaultSwap     - The default swap exercise name (from seed data), or null
 *   onSelect        - (exerciseName: string) => void — called when user selects/enters a swap
 */
export default function SwapPicker({ slot, primaryExercise, swapHistory = [], defaultSwap, onSelect }) {
  const [customName, setCustomName] = useState('')
  const [nameError, setNameError] = useState('')

  function handleSelectOption(name) {
    if (onSelect) onSelect(name)
  }

  function handleRevertToPrimary() {
    if (onSelect) onSelect(primaryExercise)
  }

  function handleCustomSubmit(e) {
    e.preventDefault()
    const trimmed = customName.trim()
    if (trimmed.length === 0) {
      setNameError('Exercise name is required')
      return
    }
    if (trimmed.length > 50) {
      setNameError('Exercise name must be 50 characters or fewer')
      return
    }
    setNameError('')
    if (onSelect) onSelect(trimmed)
    setCustomName('')
  }

  function handleCustomChange(e) {
    setCustomName(e.target.value)
    if (nameError) setNameError('')
  }

  // Build unique options: default swap first, then history (deduplicated, most recent first)
  const options = []
  const seen = new Set()

  if (defaultSwap && defaultSwap !== primaryExercise) {
    options.push(defaultSwap)
    seen.add(defaultSwap)
  }

  for (const name of swapHistory) {
    if (!seen.has(name) && name !== primaryExercise) {
      options.push(name)
      seen.add(name)
    }
  }

  return (
    <div
      className="bg-charcoal-light border border-charcoal-lighter rounded-lg p-3 shadow-lg"
      data-testid={`swap-picker-${slot}`}
    >
      <div className="text-[10px] text-text-muted mb-2">
        Swap for: <span className="text-text-primary">{primaryExercise}</span>
      </div>

      {/* Revert to primary option */}
      <button
        onClick={handleRevertToPrimary}
        className="w-full text-left px-2 py-1.5 text-xs text-accent hover:bg-charcoal-lighter rounded transition-colors mb-1"
        data-testid="swap-revert-primary"
      >
        ← {primaryExercise} (primary)
      </button>

      {/* Swap options */}
      {options.length > 0 && (
        <div className="border-t border-charcoal-lighter pt-1 mt-1">
          {options.map((name) => (
            <button
              key={name}
              onClick={() => handleSelectOption(name)}
              className="w-full text-left px-2 py-1.5 text-xs text-text-primary hover:bg-charcoal-lighter rounded transition-colors"
              data-testid={`swap-option-${name}`}
            >
              ↔ {name}
            </button>
          ))}
        </div>
      )}

      {/* Free-text entry */}
      <form onSubmit={handleCustomSubmit} className="border-t border-charcoal-lighter pt-2 mt-2">
        <div className="flex gap-1">
          <input
            type="text"
            value={customName}
            onChange={handleCustomChange}
            placeholder="New exercise name"
            maxLength={50}
            className={`flex-1 bg-charcoal border rounded px-2 py-1 text-xs text-text-primary outline-none transition-colors ${
              nameError ? 'border-red-500' : 'border-charcoal-lighter focus:border-accent'
            }`}
            aria-label="Custom swap exercise name"
            data-testid="swap-custom-input"
          />
          <button
            type="submit"
            className="px-2 py-1 text-xs bg-charcoal-lighter text-text-primary rounded hover:bg-charcoal transition-colors"
            data-testid="swap-custom-submit"
          >
            Use
          </button>
        </div>
        {nameError && (
          <p className="text-[10px] text-red-400 mt-1" data-testid="swap-name-error">
            {nameError}
          </p>
        )}
      </form>
    </div>
  )
}
