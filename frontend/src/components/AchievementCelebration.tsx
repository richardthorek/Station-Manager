/**
 * Achievement Celebration Component
 * 
 * Displays a celebratory pop-up animation when a user earns a new achievement.
 * Includes multiple animation effects: confetti, fireworks, stars, and burst.
 * Auto-dismisses after a configurable duration.
 */

import { useEffect, useState } from 'react';
import { ACHIEVEMENT_DEFINITIONS, type MemberAchievement } from '../types/achievements';
import './AchievementCelebration.css';

interface AchievementCelebrationProps {
  achievement: MemberAchievement;
  effect?: 'confetti' | 'fireworks' | 'stars' | 'burst' | 'random';
  duration?: number;
  onDismiss: () => void;
}

export function AchievementCelebration({ 
  achievement, 
  effect = 'random',
  duration = 3000,
  onDismiss 
}: AchievementCelebrationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const definition = ACHIEVEMENT_DEFINITIONS[achievement.achievementType];
  
  // Choose random effect if specified
  const [selectedEffect] = useState(() => {
    if (effect === 'random') {
      const effects: Array<'confetti' | 'fireworks' | 'stars' | 'burst'> = 
        ['confetti', 'fireworks', 'stars', 'burst'];
      return effects[Math.floor(Math.random() * effects.length)];
    }
    return effect;
  });

  useEffect(() => {
    // Start fade out animation before dismissing
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, duration - 500);

    // Dismiss after duration
    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  if (!isVisible || !definition) return null;

  return (
    <>
      {/* Animation Effect */}
      {selectedEffect === 'confetti' && <ConfettiEffect />}
      {selectedEffect === 'fireworks' && <FireworksEffect />}
      {selectedEffect === 'stars' && <StarsEffect />}
      {selectedEffect === 'burst' && <BurstEffect />}

      {/* Achievement Card */}
      <div className={`achievement-celebration ${isFadingOut ? 'fade-out' : ''}`}>
        <div className="achievement-celebration-card">
          <div className="achievement-celebration-header">
            🎉 Achievement Unlocked! 🎉
          </div>
          <span className="achievement-celebration-emoji">{definition.emoji}</span>
          <div className="achievement-celebration-name">{definition.name}</div>
          <div className="achievement-celebration-description">{definition.description}</div>
          <span className={`achievement-celebration-tier ${definition.tier}`}>
            {definition.tier}
          </span>
        </div>
      </div>
    </>
  );
}

function ConfettiEffect() {
  useEffect(() => {
    const colors = ['#E2231A', '#C6D931', '#ffd700', '#00bfff', '#ff69b4'];
    const confettiCount = 50;
    const container = document.createElement('div');
    container.className = 'celebration-confetti';
    document.body.appendChild(container);

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'absolute';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.top = '-10px';
      confetti.style.width = Math.random() * 10 + 5 + 'px';
      confetti.style.height = Math.random() * 10 + 5 + 'px';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.opacity = (Math.random() * 0.5 + 0.5).toString();
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      
      const duration = Math.random() * 2 + 2;
      const drift = Math.random() * 200 - 100;
      
      confetti.animate([
        { transform: `translateY(0) translateX(0) rotate(0deg)`, opacity: 1 },
        { transform: `translateY(${window.innerHeight}px) translateX(${drift}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
      ], {
        duration: duration * 1000,
        easing: 'ease-out'
      });
      
      container.appendChild(confetti);
    }

    const cleanup = setTimeout(() => {
      document.body.removeChild(container);
    }, 4000);

    return () => {
      clearTimeout(cleanup);
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, []);

  return null;
}

function FireworksEffect() {
  useEffect(() => {
    const colors = ['#E2231A', '#C6D931', '#ffd700', '#00bfff', '#ff69b4'];
    const container = document.createElement('div');
    container.className = 'celebration-fireworks';
    document.body.appendChild(container);

    const createFirework = (x: number, y: number) => {
      const particleCount = 30;
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'firework';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = Math.random() * 100 + 50;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        
        particle.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
          duration: 1000,
          easing: 'ease-out'
        });
        
        container.appendChild(particle);
      }
    };

    // Create multiple fireworks
    const positions = [
      { x: window.innerWidth * 0.25, y: window.innerHeight * 0.3 },
      { x: window.innerWidth * 0.75, y: window.innerHeight * 0.3 },
      { x: window.innerWidth * 0.5, y: window.innerHeight * 0.2 }
    ];

    positions.forEach((pos, index) => {
      setTimeout(() => createFirework(pos.x, pos.y), index * 300);
    });

    const cleanup = setTimeout(() => {
      document.body.removeChild(container);
    }, 3000);

    return () => {
      clearTimeout(cleanup);
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, []);

  return null;
}

function StarsEffect() {
  useEffect(() => {
    const container = document.createElement('div');
    container.className = 'celebration-stars';
    document.body.appendChild(container);

    const starCount = 20;
    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.textContent = '⭐';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.animationDelay = Math.random() * 0.5 + 's';
      container.appendChild(star);
    }

    const cleanup = setTimeout(() => {
      document.body.removeChild(container);
    }, 2000);

    return () => {
      clearTimeout(cleanup);
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, []);

  return null;
}

function BurstEffect() {
  useEffect(() => {
    const colors = ['#E2231A', '#C6D931', '#ffd700', '#00bfff', '#ff69b4'];
    const container = document.createElement('div');
    container.className = 'celebration-burst';
    document.body.appendChild(container);

    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'burst-particle';
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = Math.random() * 300 + 150;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      
      particle.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
      ], {
        duration: 1000,
        easing: 'ease-out'
      });
      
      container.appendChild(particle);
    }

    const cleanup = setTimeout(() => {
      document.body.removeChild(container);
    }, 1500);

    return () => {
      clearTimeout(cleanup);
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, []);

  return null;
}
