import { isValidEmail } from '../utils/emailValidation';

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('captain@example.org')).toBe(true);
    expect(isValidEmail('a.b+c@sub.example.com')).toBe(true);
  });

  it('rejects missing @, missing domain dot, and non-strings', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing-dot@example')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });

  it('rejects a leading/trailing dot in the domain', () => {
    expect(isValidEmail('user@.example.com')).toBe(false);
    expect(isValidEmail('user@example.com.')).toBe(false);
  });

  it('rejects an over-long address', () => {
    const long = `${'a'.repeat(250)}@b.co`;
    expect(isValidEmail(long)).toBe(false);
  });

  it('resolves quickly on the ReDoS-shaped input that flagged the old regex', () => {
    const attack = '!@!' + '.!'.repeat(50000);
    const start = Date.now();
    isValidEmail(attack);
    expect(Date.now() - start).toBeLessThan(100);
  });
});
