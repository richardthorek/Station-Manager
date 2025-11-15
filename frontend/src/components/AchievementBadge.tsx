/**
 * Achievement Badge Component
 * 
 * Displays achievement badges with different styling based on tier, status, and variant.
 * Supports compact, icon-only, and full variants.
 */

import { ACHIEVEMENT_DEFINITIONS, type MemberAchievement, type AchievementProgress } from '../types/achievements';
import './AchievementBadge.css';

interface AchievementBadgeProps {
  achievement?: MemberAchievement;
  progress?: AchievementProgress;
  variant?: 'full' | 'compact' | 'icon-only';
  showNew?: boolean;
  className?: string;
}

export function AchievementBadge({ 
  achievement, 
  progress,
  variant = 'full',
  showNew = false,
  className = ''
}: AchievementBadgeProps) {
  // Determine which data to use
  const achievementType = achievement?.achievementType || progress?.achievementType;
  if (!achievementType) return null;

  const definition = ACHIEVEMENT_DEFINITIONS[achievementType];
  if (!definition) return null;

  const isEarned = achievement !== undefined;
  const isActive = achievement?.isActive || false;
  const isNew = showNew && isEarned;

  const classes = [
    'achievement-badge',
    `tier-${definition.tier}`,
    variant,
    isActive && 'active-streak',
    isNew && 'new',
    !isEarned && 'locked',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} title={definition.description}>
      <span className="achievement-badge-emoji">{definition.emoji}</span>
      {variant !== 'icon-only' && (
        <div className="achievement-badge-text">
          <div className="achievement-badge-name">{definition.name}</div>
          {variant === 'full' && (
            <div className="achievement-badge-description">{definition.description}</div>
          )}
        </div>
      )}
      {!isEarned && progress && variant === 'full' && (
        <>
          <div className="achievement-progress">
            <div 
              className="achievement-progress-bar" 
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
          <div className="achievement-progress-text">
            {progress.currentProgress} / {progress.targetProgress}
          </div>
        </>
      )}
    </div>
  );
}

interface AchievementGridProps {
  achievements?: MemberAchievement[];
  progress?: AchievementProgress[];
  variant?: 'full' | 'compact' | 'icon-only';
  showRecent?: boolean;
  maxRecent?: number;
  className?: string;
}

export function AchievementGrid({ 
  achievements = [],
  progress = [],
  variant = 'full',
  showRecent = false,
  maxRecent = 5,
  className = ''
}: AchievementGridProps) {
  // Determine which achievements are recent (within last 7 days)
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 7);
  
  const recentAchievements = showRecent 
    ? achievements
        .filter(a => new Date(a.earnedAt) >= recentCutoff)
        .slice(0, maxRecent)
    : [];

  const gridClass = `achievement-grid ${variant} ${className}`;

  return (
    <div className={gridClass}>
      {achievements.map(achievement => (
        <AchievementBadge
          key={achievement.id}
          achievement={achievement}
          variant={variant}
          showNew={recentAchievements.some(a => a.id === achievement.id)}
        />
      ))}
      {progress.map(prog => (
        <AchievementBadge
          key={prog.achievementType}
          progress={prog}
          variant={variant}
        />
      ))}
    </div>
  );
}
