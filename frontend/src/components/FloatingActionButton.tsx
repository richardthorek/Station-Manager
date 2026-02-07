import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './FloatingActionButton.css';

interface FloatingActionButtonProps {
  /** Icon or content to display in FAB */
  icon: ReactNode;
  /** Click handler */
  onClick: () => void;
  /** Button aria-label for accessibility */
  ariaLabel: string;
  /** Whether to hide FAB on scroll down (default: true) */
  hideOnScroll?: boolean;
  /** Scroll container ref (optional, defaults to window) */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Position (default: 'bottom-right') */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  /** Enable haptic feedback on tap (default: true) */
  enableHaptic?: boolean;
}

/**
 * Floating Action Button (FAB) component
 *
 * Features:
 * - Large touch target (60px diameter)
 * - Hides on scroll down, shows on scroll up
 * - Haptic feedback on tap
 * - Accessible with keyboard
 * - RFS brand colors
 */
export function FloatingActionButton({
  icon,
  onClick,
  ariaLabel,
  hideOnScroll = true,
  scrollContainerRef,
  position = 'bottom-right',
  enableHaptic = true,
}: FloatingActionButtonProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isPressed, setIsPressed] = useState(false);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10; // Minimum scroll distance to trigger hide/show

  useEffect(() => {
    if (!hideOnScroll) return;

    const handleScroll = () => {
      const target = scrollContainerRef?.current || window;
      const scrollY = target === window
        ? window.scrollY
        : (target as HTMLElement).scrollTop;

      const delta = scrollY - lastScrollY.current;

      // Only update if scroll delta exceeds threshold
      if (Math.abs(delta) > scrollThreshold) {
        if (delta > 0 && scrollY > 100) {
          // Scrolling down & not at top - hide FAB
          setIsVisible(false);
        } else if (delta < 0) {
          // Scrolling up - show FAB
          setIsVisible(true);
        }
        lastScrollY.current = scrollY;
      }
    };

    const target = scrollContainerRef?.current || window;
    target.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      target.removeEventListener('scroll', handleScroll);
    };
  }, [hideOnScroll, scrollContainerRef]);

  const triggerHaptic = () => {
    if (enableHaptic && 'vibrate' in navigator) {
      // Medium vibration (30ms) for button tap
      navigator.vibrate(30);
    }
  };

  const handleClick = () => {
    triggerHaptic();
    onClick();
  };

  const handleTouchStart = () => {
    setIsPressed(true);
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          type="button"
          className={`fab fab-${position} ${isPressed ? 'fab-pressed' : ''}`}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          aria-label={ariaLabel}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          whileTap={{ scale: 0.9 }}
        >
          <span className="fab-icon" aria-hidden="true">
            {icon}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
