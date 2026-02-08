import { useEffect, useState } from 'react';
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
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    // Generate 50 confetti pieces
    const pieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 1,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));
    setConfettiPieces(pieces);

    const timer = setTimeout(() => {
      setConfettiPieces([]);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div className="confetti-container" aria-hidden="true">
      {confettiPieces.map((piece) => (
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
