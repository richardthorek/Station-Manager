/**
 * Achievement and Gamification Types (Frontend)
 * 
 * Defines the achievement system for gamifying volunteer participation
 * in the RFS Station Manager.
 */

export type AchievementType =
  // Training-based achievements
  | 'training_enthusiast'      // Attended 5 training sessions
  | 'training_veteran'         // Attended 15 training sessions
  | 'training_master'          // Attended 30 training sessions
  | 'training_streak_3'        // Attended training 3 weeks in a row
  | 'training_streak_6'        // Attended training 6 weeks in a row
  
  // Maintenance-based achievements
  | 'maintenance_hero'         // Completed 5 maintenance checks
  | 'maintenance_champion'     // Completed 15 maintenance checks
  | 'maintenance_legend'       // Completed 30 maintenance checks
  | 'maintenance_streak_4'     // Maintenance 4 weeks in a row
  | 'truck_inspector'          // Completed first truck check
  
  // Meeting-based achievements
  | 'meeting_regular'          // Attended 5 meetings
  | 'meeting_advocate'         // Attended 10 meetings
  | 'strategic_thinker'        // Attended all meetings in a month
  
  // Day-of-week pattern achievements
  | 'wednesday_warrior'        // Most Wednesday check-ins in a month
  | 'weekend_defender'         // Most weekend check-ins in a month
  | 'early_bird'               // Most morning (6am-9am) check-ins
  | 'night_owl'                // Most evening (6pm-9pm) check-ins
  
  // Diversity & milestone achievements
  | 'all_rounder'              // Participated in all 3 activity types in a week
  | 'perfect_month'            // 2 trainings + 4 maintenance + 1 meeting in a month
  | 'century_club'             // 100 total check-ins
  | 'first_responder';         // First person to check in 5 times

export interface AchievementDefinition {
  type: AchievementType;
  name: string;
  description: string;
  emoji: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  category: 'training' | 'maintenance' | 'meeting' | 'pattern' | 'milestone';
}

export interface MemberAchievement {
  id: string;
  memberId: string;
  achievementType: AchievementType;
  earnedAt: string;
  isActive: boolean; // For streak-based achievements that can expire
  metadata?: {
    count?: number;        // For count-based achievements
    streakLength?: number; // For streak achievements
    periodStart?: string;  // For time-bound achievements
    periodEnd?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AchievementProgress {
  achievementType: AchievementType;
  currentProgress: number;
  targetProgress: number;
  percentComplete: number;
  isEarned: boolean;
}

export interface MemberAchievementSummary {
  memberId: string;
  memberName: string;
  totalAchievements: number;
  achievements: MemberAchievement[];
  recentlyEarned: MemberAchievement[]; // Last 5 earned
  activeStreaks: MemberAchievement[];  // Currently active streak achievements
  progress: AchievementProgress[];     // Progress toward unearned achievements
}

/**
 * Achievement definitions with metadata
 */
export const ACHIEVEMENT_DEFINITIONS: Record<AchievementType, AchievementDefinition> = {
  // Training achievements
  training_enthusiast: {
    type: 'training_enthusiast',
    name: 'Training Enthusiast',
    description: 'Attended 5 training sessions',
    emoji: '📚',
    tier: 'bronze',
    category: 'training',
  },
  training_veteran: {
    type: 'training_veteran',
    name: 'Training Veteran',
    description: 'Attended 15 training sessions',
    emoji: '🎓',
    tier: 'silver',
    category: 'training',
  },
  training_master: {
    type: 'training_master',
    name: 'Training Master',
    description: 'Attended 30 training sessions',
    emoji: '🏆',
    tier: 'gold',
    category: 'training',
  },
  training_streak_3: {
    type: 'training_streak_3',
    name: 'Training Triple',
    description: 'Attended training 3 weeks in a row',
    emoji: '🔥',
    tier: 'silver',
    category: 'training',
  },
  training_streak_6: {
    type: 'training_streak_6',
    name: 'Training Inferno',
    description: 'Attended training 6 weeks in a row',
    emoji: '🔥🔥',
    tier: 'gold',
    category: 'training',
  },

  // Maintenance achievements
  maintenance_hero: {
    type: 'maintenance_hero',
    name: 'Maintenance Hero',
    description: 'Completed 5 maintenance checks',
    emoji: '🔧',
    tier: 'bronze',
    category: 'maintenance',
  },
  maintenance_champion: {
    type: 'maintenance_champion',
    name: 'Maintenance Champion',
    description: 'Completed 15 maintenance checks',
    emoji: '🛠️',
    tier: 'silver',
    category: 'maintenance',
  },
  maintenance_legend: {
    type: 'maintenance_legend',
    name: 'Maintenance Legend',
    description: 'Completed 30 maintenance checks',
    emoji: '⚙️',
    tier: 'gold',
    category: 'maintenance',
  },
  maintenance_streak_4: {
    type: 'maintenance_streak_4',
    name: 'Maintenance Streak',
    description: 'Completed maintenance 4 weeks in a row',
    emoji: '🛠️🔥',
    tier: 'silver',
    category: 'maintenance',
  },
  truck_inspector: {
    type: 'truck_inspector',
    name: 'Truck Inspector',
    description: 'Completed your first truck check',
    emoji: '🚒',
    tier: 'bronze',
    category: 'maintenance',
  },

  // Meeting achievements
  meeting_regular: {
    type: 'meeting_regular',
    name: 'Meeting Regular',
    description: 'Attended 5 meetings',
    emoji: '💬',
    tier: 'bronze',
    category: 'meeting',
  },
  meeting_advocate: {
    type: 'meeting_advocate',
    name: 'Meeting Advocate',
    description: 'Attended 10 meetings',
    emoji: '🗣️',
    tier: 'silver',
    category: 'meeting',
  },
  strategic_thinker: {
    type: 'strategic_thinker',
    name: 'Strategic Thinker',
    description: 'Attended all meetings in a calendar month',
    emoji: '🧠',
    tier: 'gold',
    category: 'meeting',
  },

  // Pattern-based achievements
  wednesday_warrior: {
    type: 'wednesday_warrior',
    name: 'Wednesday Warrior',
    description: 'Most Wednesday check-ins in a month',
    emoji: '⚔️',
    tier: 'gold',
    category: 'pattern',
  },
  weekend_defender: {
    type: 'weekend_defender',
    name: 'Weekend Defender',
    description: 'Most weekend check-ins in a month',
    emoji: '🛡️',
    tier: 'gold',
    category: 'pattern',
  },
  early_bird: {
    type: 'early_bird',
    name: 'Early Bird',
    description: 'Most morning (6am-9am) check-ins in a month',
    emoji: '🌅',
    tier: 'silver',
    category: 'pattern',
  },
  night_owl: {
    type: 'night_owl',
    name: 'Night Owl',
    description: 'Most evening (6pm-9pm) check-ins in a month',
    emoji: '🦉',
    tier: 'silver',
    category: 'pattern',
  },

  // Milestone achievements
  all_rounder: {
    type: 'all_rounder',
    name: 'All-Rounder',
    description: 'Participated in training, maintenance, and a meeting in one week',
    emoji: '⭐',
    tier: 'silver',
    category: 'milestone',
  },
  perfect_month: {
    type: 'perfect_month',
    name: 'Perfect Month',
    description: 'Completed 2 trainings, 4 maintenance checks, and 1 meeting in a month',
    emoji: '💎',
    tier: 'platinum',
    category: 'milestone',
  },
  century_club: {
    type: 'century_club',
    name: 'Century Club',
    description: 'Reached 100 total check-ins',
    emoji: '💯',
    tier: 'platinum',
    category: 'milestone',
  },
  first_responder: {
    type: 'first_responder',
    name: 'First Responder',
    description: 'First to check in on 5 different days',
    emoji: '🏃',
    tier: 'gold',
    category: 'milestone',
  },
};
