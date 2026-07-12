/**
 * useInView — tracks whether an element is visible in the viewport.
 *
 * Used by the landing-page showcase demos so their animation timers only run
 * while the panel is actually on screen. Falls back to "visible" when
 * IntersectionObserver is unavailable so the demos still play.
 */

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useInView<T extends HTMLElement>(threshold = 0.3): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}
