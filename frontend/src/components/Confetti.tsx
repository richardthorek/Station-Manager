import { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import './Confetti.css';

interface ConfettiProps {
  duration?: number;
}

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
}

const CONFETTI_COLORS = [
  '#e5281B', // RFS Red
  '#cbdb2a', // RFS Lime
  '#fbb034', // Amber
  '#215e9e', // Blue
  '#008550', // Green
  '#4CAF50', // Success Green
];

export function Confetti({ duration = 3000 }: ConfettiProps) {
  // Generate confetti pieces once on mount using useMemo
  // Math.random is intentional here - we want random values generated once
  const confettiPieces = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      // eslint-disable-next-line react-hooks/purity
      left: Math.random() * 100,
      // eslint-disable-next-line react-hooks/purity
      delay: Math.random() * 0.5,
      // eslint-disable-next-line react-hooks/purity
      duration: 2 + Math.random() * 1,
      // eslint-disable-next-line react-hooks/purity
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));
  }, []); // Empty deps - only generate once

  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div className="confetti-container" aria-hidden="true">
      {isVisible && confettiPieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: window.innerHeight + 20,
            opacity: 0,
            rotate: 360 * 3,
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  );
}
