/**
 * PageTransition Component
 *
 * Wraps page content with smooth entrance/exit animations.
 * Uses Framer Motion for GPU-accelerated transitions.
 *
 * Features:
 * - Configurable transition variants
 * - Reduced motion support
 * - GPU-accelerated (transform + opacity only)
 * - 60fps performance target
 */

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { pageTransitions, transitions, getVariants, getTransition } from '../utils/animations';

interface PageTransitionProps {
  /** Page content to animate */
  children: ReactNode;
  /** Transition variant (default: 'slideFromBottom') */
  variant?: keyof typeof pageTransitions;
  /** Custom className for the wrapper */
  className?: string;
}

/**
 * Wraps page content with entrance/exit animations
 *
 * Usage:
 * ```tsx
 * <PageTransition variant="fade">
 *   <YourPageContent />
 * </PageTransition>
 * ```
 */
export function PageTransition({
  children,
  variant = 'slideFromBottom',
  className = '',
}: PageTransitionProps) {
  const variants = getVariants(pageTransitions[variant]);
  const transition = getTransition(transitions.standard);

  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={transition}
      // Prevent layout shift during animation
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
}
