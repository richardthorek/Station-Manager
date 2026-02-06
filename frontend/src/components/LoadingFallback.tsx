import { motion } from 'framer-motion';
import './LoadingFallback.css';

interface LoadingFallbackProps {
  message?: string;
}

/**
 * Loading fallback component for lazy-loaded routes
 * Displays a centered spinner with optional message
 */
export function LoadingFallback({ message = 'Loading...' }: LoadingFallbackProps) {
  return (
    <div className="loading-fallback">
      <motion.div
        className="loading-spinner"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <div className="spinner-circle" />
      </motion.div>
      <p className="loading-message">{message}</p>
    </div>
  );
}
