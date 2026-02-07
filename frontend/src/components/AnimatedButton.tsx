/**
 * AnimatedButton Component
 *
 * Button with hover/tap micro-interactions using Framer Motion.
 * Provides tactile feedback and polish to the UI.
 *
 * Features:
 * - Scale on hover/tap
 * - Reduced motion support
 * - Configurable animation strength
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { buttonVariants, getVariants, getTransition, transitions } from '../utils/animations';

// Omit motion-specific props that conflict with HTML button attributes
type MotionButtonProps = Omit<
  HTMLMotionProps<'button'>,
  'variants' | 'whileHover' | 'whileTap' | 'transition'
>;

interface AnimatedButtonProps extends MotionButtonProps {
  /** Button content */
  children: ReactNode;
  /** Animation variant (default: 'standard') */
  variant?: 'standard' | 'primary' | 'icon';
}

/**
 * Button with smooth hover/tap animations
 *
 * Usage:
 * ```tsx
 * <AnimatedButton variant="primary" onClick={handleClick}>
 *   Click Me
 * </AnimatedButton>
 * ```
 */
export function AnimatedButton({
  children,
  variant = 'standard',
  ...props
}: AnimatedButtonProps) {
  const variants = getVariants(buttonVariants[variant]);
  const transition = getTransition(transitions.fast);

  return (
    <motion.button
      variants={variants}
      whileHover="hover"
      whileTap="tap"
      transition={transition}
      {...props}
    >
      {children}
    </motion.button>
  );
}
