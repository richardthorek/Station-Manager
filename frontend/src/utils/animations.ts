/**
 * Animation Utilities for Framer Motion
 *
 * Centralized animation variants and utilities for consistent transitions
 * throughout the application. All animations are GPU-accelerated using
 * transform and opacity properties only.
 *
 * Performance: 60fps target with reduced-motion support
 */

import React from 'react';
import type { Variants, Transition } from 'framer-motion';

/**
 * Standard transition timing for consistent feel across the app
 */
export const transitions = {
  /** Fast transitions for micro-interactions (200ms) */
  fast: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } as Transition,
  /** Standard transitions for most animations (300ms) */
  standard: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as Transition,
  /** Slow transitions for emphasis (400ms) */
  slow: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } as Transition,
  /** Spring transitions for playful feel */
  spring: { type: 'spring', stiffness: 260, damping: 20 } as Transition,
} as const;

/**
 * Page transition variants - used for route changes
 */
export const pageTransitions = {
  /** Fade in/out - subtle, professional */
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  } as Variants,

  /** Slide from right - forward navigation feel */
  slideFromRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  } as Variants,

  /** Slide from bottom - upward reveal */
  slideFromBottom: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  } as Variants,

  /** Scale + fade - emphasis on new content */
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  } as Variants,
} as const;

/**
 * Stagger animation utilities for list items
 */
export const staggerVariants = {
  /** Parent container that orchestrates stagger */
  container: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05,
      },
    },
  } as Variants,

  /** Child items that fade + slide in */
  item: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
  } as Variants,
} as const;

/**
 * Micro-interaction variants for buttons and interactive elements
 */
export const buttonVariants = {
  /** Standard button hover/tap */
  standard: {
    hover: { scale: 1.02, transition: transitions.fast },
    tap: { scale: 0.98, transition: transitions.fast },
  } as Variants,

  /** Primary action button - more emphasis */
  primary: {
    hover: { scale: 1.05, transition: transitions.fast },
    tap: { scale: 0.95, transition: transitions.fast },
  } as Variants,

  /** Icon button - subtle scale */
  icon: {
    hover: { scale: 1.1, transition: transitions.fast },
    tap: { scale: 0.9, transition: transitions.fast },
  } as Variants,
} as const;

/**
 * Form element animations
 */
export const formVariants = {
  /** Input focus animation */
  input: {
    initial: { scale: 1 },
    focus: { scale: 1.01, transition: transitions.fast },
  } as Variants,

  /** Checkbox/toggle check animation */
  checkbox: {
    checked: { scale: 1.1, transition: transitions.spring },
    unchecked: { scale: 1 },
  } as Variants,
} as const;

/**
 * Toast/notification animations
 */
export const toastVariants = {
  /** Slide in from top */
  slideFromTop: {
    initial: { opacity: 0, y: -50, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -50, scale: 0.95 },
  } as Variants,

  /** Slide in from bottom */
  slideFromBottom: {
    initial: { opacity: 0, y: 50, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 50, scale: 0.95 },
  } as Variants,
} as const;

/**
 * Achievement unlock animation - celebratory and eye-catching
 */
export const achievementVariants = {
  /** Badge entrance with bounce */
  badge: {
    initial: { scale: 0, rotate: -180, opacity: 0 },
    animate: {
      scale: [0, 1.2, 0.9, 1],
      rotate: [0, 10, -10, 0],
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.34, 1.56, 0.64, 1], // Back easing for overshoot
      },
    },
    exit: {
      scale: 0,
      opacity: 0,
      transition: transitions.fast,
    },
  } as Variants,
} as const;

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get transition with reduced motion support
 * If user prefers reduced motion, returns instant transition
 */
export function getTransition(transition: Transition = transitions.standard): Transition {
  if (prefersReducedMotion()) {
    return { duration: 0.001 };
  }
  return transition;
}

/**
 * Get variants with reduced motion support
 * If user prefers reduced motion, removes transforms and only keeps opacity
 */
export function getVariants(variants: Variants): Variants {
  if (!prefersReducedMotion()) {
    return variants;
  }

  // For reduced motion, simplify to opacity-only transitions
  const simplifiedVariants: Variants = {};
  for (const [key, value] of Object.entries(variants)) {
    if (typeof value === 'object') {
      simplifiedVariants[key] = {
        opacity: value.opacity ?? 1,
      };
    } else {
      simplifiedVariants[key] = value;
    }
  }
  return simplifiedVariants;
}

/**
 * Hook to detect reduced motion preference changes
 */
export function useReducedMotion(): boolean {
  // Use lazy initialization to avoid calling prefersReducedMotion on server
  const [reducedMotion, setReducedMotion] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return prefersReducedMotion();
  });

  React.useEffect(() => {
    // Only run effect in browser
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return reducedMotion;
}
