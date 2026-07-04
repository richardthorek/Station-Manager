/**
 * memberSession util tests (AC-1)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setMemberSessionToken, getMemberSessionToken, hasMemberSession, clearMemberSession } from './memberSession';

describe('memberSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('is inactive with nothing stored', () => {
    expect(hasMemberSession()).toBe(false);
    expect(getMemberSessionToken()).toBeNull();
  });

  it('stores and reads back a token', () => {
    setMemberSessionToken('abc.def.ghi');
    expect(getMemberSessionToken()).toBe('abc.def.ghi');
    expect(hasMemberSession()).toBe(true);
  });

  it('clears the stored token', () => {
    setMemberSessionToken('abc.def.ghi');
    clearMemberSession();
    expect(hasMemberSession()).toBe(false);
  });
});
