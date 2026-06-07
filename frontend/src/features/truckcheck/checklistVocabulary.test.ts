import { describe, it, expect } from 'vitest'
import {
  VEHICLE_TYPES,
  ITEM_CODES,
  slugify,
  resolveVocabSlug,
  vocabLabel,
} from './checklistVocabulary'

describe('checklistVocabulary', () => {
  describe('slugify', () => {
    it('lowercases and hyphenates free text', () => {
      expect(slugify('Tyre Condition')).toBe('tyre-condition')
    })

    it('strips punctuation and collapses separators', () => {
      expect(slugify('  Engine Oil & Coolant!! ')).toBe('engine-oil-coolant')
    })

    it('trims leading/trailing hyphens', () => {
      expect(slugify('--Pump--')).toBe('pump')
    })

    it('returns empty string for non-alphanumeric input', () => {
      expect(slugify('!!!')).toBe('')
    })
  })

  describe('resolveVocabSlug', () => {
    it('maps a known label to its canonical slug', () => {
      const tanker = VEHICLE_TYPES.find((v) => v.value === 'cat7-tanker')!
      expect(resolveVocabSlug(tanker.label, VEHICLE_TYPES)).toBe('cat7-tanker')
    })

    it('returns the canonical slug unchanged when given the slug itself', () => {
      expect(resolveVocabSlug('tyre-condition', ITEM_CODES)).toBe('tyre-condition')
    })

    it('slugifies a custom value that is not in the vocabulary', () => {
      expect(resolveVocabSlug('Custom Winch Check', ITEM_CODES)).toBe('custom-winch-check')
    })

    it('returns undefined for empty input', () => {
      expect(resolveVocabSlug('   ', VEHICLE_TYPES)).toBeUndefined()
    })

    it('is case-insensitive when matching labels', () => {
      const entry = ITEM_CODES.find((c) => c.value === 'fuel-level')!
      expect(resolveVocabSlug(entry.label.toUpperCase(), ITEM_CODES)).toBe('fuel-level')
    })
  })

  describe('vocabLabel', () => {
    it('maps a known slug back to its friendly label', () => {
      const entry = VEHICLE_TYPES.find((v) => v.value === 'bulk-water')!
      expect(vocabLabel('bulk-water', VEHICLE_TYPES)).toBe(entry.label)
    })

    it('falls back to the raw slug for unknown values', () => {
      expect(vocabLabel('some-custom-type', VEHICLE_TYPES)).toBe('some-custom-type')
    })

    it('returns empty string for undefined', () => {
      expect(vocabLabel(undefined, VEHICLE_TYPES)).toBe('')
    })
  })
})
