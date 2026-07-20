import { useLayoutEffect, type RefObject } from 'react';

/**
 * Every dropdown/popover menu in this app (admin menu, export menu, account
 * menu, org switcher, device info badge) anchors with `right: 0` relative to
 * its trigger and grows leftward by a fixed min-width. That silently
 * overflows off the left edge of the viewport whenever the trigger sits
 * closer to the left edge than the menu is wide — a narrow phone, a
 * shorter header, or just a trigger that isn't pinned to the far right.
 * Nudges the open menu back on-screen with a translateX once its real
 * position is measured, instead of each menu re-deriving this itself.
 */
export function useClampMenuToViewport(ref: RefObject<HTMLElement | null>, isOpen: boolean, margin = 8): void {
  useLayoutEffect(() => {
    if (!isOpen || !ref.current) return;
    const el = ref.current;
    el.style.transform = '';
    const rect = el.getBoundingClientRect();
    if (rect.left < margin) {
      el.style.transform = `translateX(${margin - rect.left}px)`;
    } else if (rect.right > window.innerWidth - margin) {
      el.style.transform = `translateX(${window.innerWidth - margin - rect.right}px)`;
    }
  }, [isOpen, ref, margin]);
}
