import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useClampMenuToViewport } from './useClampMenuToViewport';

/**
 * Every dropdown this hook is wired into (admin menu, export menu, account
 * menu, org switcher, device info badge) anchors with `right: 0` and a fixed
 * min-width — silently overflowing off the left edge of the viewport
 * whenever the trigger sits closer to that edge than the menu is wide. See
 * the hook's own doc comment.
 */
function mockRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON: () => {},
      ...rect,
    }) as DOMRect;
}

describe('useClampMenuToViewport', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
  });

  it('does nothing when the menu is closed', () => {
    const el = document.createElement('div');
    mockRect(el, { left: -100, right: 100 });
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(el);
      useClampMenuToViewport(ref, false);
      return ref;
    });
    expect(result.current.current!.style.transform).toBe('');
  });

  it('leaves the menu alone when it already fits on screen', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    const el = document.createElement('div');
    mockRect(el, { left: 100, right: 300 });
    renderHook(() => {
      const ref = useRef<HTMLElement | null>(el);
      useClampMenuToViewport(ref, true);
    });
    expect(el.style.transform).toBe('');
  });

  it('shifts the menu right when it overflows the left edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    const el = document.createElement('div');
    // Anchored right:0 near a trigger close to the left edge — classic overflow.
    mockRect(el, { left: -150, right: 50 });
    renderHook(() => {
      const ref = useRef<HTMLElement | null>(el);
      useClampMenuToViewport(ref, true);
    });
    // margin(8) - left(-150) = 158
    expect(el.style.transform).toBe('translateX(158px)');
  });

  it('shifts the menu left when it overflows the right edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    const el = document.createElement('div');
    mockRect(el, { left: 350, right: 450 });
    renderHook(() => {
      const ref = useRef<HTMLElement | null>(el);
      useClampMenuToViewport(ref, true);
    });
    // innerWidth(400) - margin(8) - right(450) = -58
    expect(el.style.transform).toBe('translateX(-58px)');
  });

  it('does nothing when the ref has no element', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(null);
      useClampMenuToViewport(ref, true);
      return ref;
    });
    expect(result.current.current).toBeNull();
  });
});
