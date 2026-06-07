import { describe, it, expect } from 'vitest'
import { formatMembershipDuration } from './membershipUtils'

const day = (n: number) => n * 24 * 60 * 60 * 1000

function dateAt(daysAgo: number, from = new Date('2026-06-07T12:00:00Z')): Date {
  return new Date(from.getTime() - day(daysAgo))
}

const NOW = new Date('2026-06-07T12:00:00Z')

describe('formatMembershipDuration', () => {
  it('returns singular "1 day" for exactly 1 day', () => {
    expect(formatMembershipDuration(dateAt(1), NOW)).toBe('1 day')
  })

  it('returns plural days for 2–29 days', () => {
    expect(formatMembershipDuration(dateAt(14), NOW)).toBe('14 days')
    expect(formatMembershipDuration(dateAt(29), NOW)).toBe('29 days')
  })

  it('returns "0 days" for same-day registration', () => {
    expect(formatMembershipDuration(dateAt(0), NOW)).toBe('0 days')
  })

  it('returns singular "1 month" at exactly 30 days', () => {
    expect(formatMembershipDuration(dateAt(30), NOW)).toBe('1 month')
  })

  it('returns plural months between 30 and 364 days', () => {
    expect(formatMembershipDuration(dateAt(60), NOW)).toBe('2 months')
    expect(formatMembershipDuration(dateAt(364), NOW)).toBe('12 months')
  })

  it('returns singular "1 year" at exactly 365 days', () => {
    expect(formatMembershipDuration(dateAt(365), NOW)).toBe('1 year')
  })

  it('returns plural years at 730 days', () => {
    expect(formatMembershipDuration(dateAt(730), NOW)).toBe('2 years')
  })

  it('combines years and months correctly', () => {
    // 365 + 61 = 426 days → 1 year, 2 months (61 % 365 = 61; 61/30 = 2)
    expect(formatMembershipDuration(dateAt(426), NOW)).toBe('1 year 2 months')
  })

  it('omits month segment when month remainder is 0', () => {
    // 365 days exactly → no remainder
    expect(formatMembershipDuration(dateAt(365), NOW)).toBe('1 year')
  })

  it('uses singular "month" when remainder is exactly 30 days', () => {
    // 395 days → 1 year, 30 days remaining → 1 month
    expect(formatMembershipDuration(dateAt(395), NOW)).toBe('1 year 1 month')
  })

  it('handles multiple years correctly', () => {
    // 3 * 365 = 1095 days → 3 years
    expect(formatMembershipDuration(dateAt(1095), NOW)).toBe('3 years')
    // 3 * 365 + 45 = 1140 days → 3 years 1 month
    expect(formatMembershipDuration(dateAt(1140), NOW)).toBe('3 years 1 month')
  })

  it('returns empty string for a future start date', () => {
    const future = new Date(NOW.getTime() + day(10))
    expect(formatMembershipDuration(future, NOW)).toBe('')
  })

  it('handles leap-year boundary (366 days) gracefully', () => {
    // 366 days → 1 year (366 % 365 = 1 day → 0 months remainder)
    expect(formatMembershipDuration(dateAt(366), NOW)).toBe('1 year')
  })
})
