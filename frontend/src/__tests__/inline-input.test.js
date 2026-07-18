import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Validates: Requirements 5.9, 5.6, 5.10
 *
 * The InlineInput validation logic:
 * - Rejects empty or whitespace-only input
 * - Rejects non-numeric input
 * - Accepts valid finite numbers (integers, decimals, negative)
 */

// Extracted validation logic (mirrors InlineInput component)
function validateInlineInput(val) {
  const trimmed = String(val).trim()
  if (trimmed === '') {
    return 'Value is required'
  }
  const num = Number(trimmed)
  if (!Number.isFinite(num)) {
    return 'Must be a valid number'
  }
  return ''
}

describe('InlineInput validation', () => {
  describe('unit tests', () => {
    it('rejects empty string', () => {
      expect(validateInlineInput('')).toBe('Value is required')
    })

    it('rejects whitespace-only input', () => {
      expect(validateInlineInput('   ')).toBe('Value is required')
      expect(validateInlineInput('\t')).toBe('Value is required')
      expect(validateInlineInput('\n')).toBe('Value is required')
    })

    it('rejects non-numeric strings', () => {
      expect(validateInlineInput('abc')).toBe('Must be a valid number')
      expect(validateInlineInput('12abc')).toBe('Must be a valid number')
      expect(validateInlineInput('--5')).toBe('Must be a valid number')
      expect(validateInlineInput('1.2.3')).toBe('Must be a valid number')
    })

    it('rejects Infinity and NaN', () => {
      expect(validateInlineInput('Infinity')).toBe('Must be a valid number')
      expect(validateInlineInput('-Infinity')).toBe('Must be a valid number')
      expect(validateInlineInput('NaN')).toBe('Must be a valid number')
    })

    it('accepts valid integers', () => {
      expect(validateInlineInput('0')).toBe('')
      expect(validateInlineInput('42')).toBe('')
      expect(validateInlineInput('-10')).toBe('')
    })

    it('accepts valid decimals', () => {
      expect(validateInlineInput('3.14')).toBe('')
      expect(validateInlineInput('-0.5')).toBe('')
      expect(validateInlineInput('.5')).toBe('')
    })

    it('accepts numbers with surrounding whitespace', () => {
      expect(validateInlineInput('  7  ')).toBe('')
      expect(validateInlineInput(' -3.2 ')).toBe('')
    })
  })

  describe('property: numeric validation (Property 9)', () => {
    /**
     * **Validates: Requirements 5.9**
     *
     * For any string input, the validator SHALL reject it if and only if
     * the trimmed string is empty or cannot be parsed as a valid finite number.
     */

    it('accepts any valid finite number formatted as string', () => {
      fc.assert(
        fc.property(
          fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e15, max: 1e15 }),
          (num) => {
            const result = validateInlineInput(String(num))
            expect(result).toBe('')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects any string that is not a valid finite number', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            const trimmed = s.trim()
            if (trimmed === '') return true // empty = rejected
            const n = Number(trimmed)
            return !Number.isFinite(n)
          }),
          (input) => {
            const result = validateInlineInput(input)
            expect(result).not.toBe('')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('empty or whitespace-only strings are always rejected', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 20 }),
          (chars) => {
            const ws = chars.join('')
            const result = validateInlineInput(ws)
            expect(result).toBe('Value is required')
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
