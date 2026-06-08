/**
 * Pure helper for formatting a member's length of service.
 *
 * Keeping this separate from the component makes it trivially testable
 * without mounting React and without mocking global Date.
 */

export function formatMembershipDuration(startDate: Date, now: Date = new Date()): string {
  const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return ''; // future date edge-case

  if (diffDays < 30) {
    return diffDays === 1 ? '1 day' : `${diffDays} days`;
  }

  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month' : `${months} months`;
  }

  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const yearPart = years === 1 ? '1 year' : `${years} years`;
  if (months === 0) return yearPart;
  const monthPart = months === 1 ? '1 month' : `${months} months`;
  return `${yearPart} ${monthPart}`;
}
