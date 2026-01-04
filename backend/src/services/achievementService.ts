/**
 * Achievement Service
 * 
 * Calculates and manages member achievements based on their activity history.
 * This service analyzes check-in patterns and awards achievements accordingly.
 */

import type {
  MemberAchievement,
  AchievementType,
  MemberAchievementSummary,
  AchievementProgress,
} from '../types/achievements';
import type { EventParticipant, CheckRun, Event, Member } from '../types';

interface Database {
  getEvents(limit?: number, offset?: number): Promise<Event[]> | Event[];
  getEventParticipants(eventId: string): Promise<EventParticipant[]> | EventParticipant[];
  getMemberById(memberId: string): Promise<Member | null | undefined> | Member | null | undefined;
}

interface TruckChecksDatabase {
  getAllCheckRuns(): Promise<CheckRun[]> | CheckRun[];
}

export class AchievementService {
  private achievements: Map<string, MemberAchievement[]> = new Map();

  constructor(
    private db: Database,
    private truckChecksDb: TruckChecksDatabase
  ) {}

  /**
   * Calculate all achievements for a member
   */
  async calculateAchievements(memberId: string, memberName: string): Promise<MemberAchievementSummary> {
    // Get member's participation history by scanning all events
    const participants = await this.getParticipantsByMember(memberId);
    const allCheckRuns = await this.truckChecksDb.getAllCheckRuns();
    const checkRuns = allCheckRuns.filter(run => run.completedBy === memberId);

    // Get or initialize member achievements
    let earnedAchievements = this.achievements.get(memberId) || [];

    // Calculate new achievements
    const newAchievements: MemberAchievement[] = [];

    // Training achievements
    const trainingCount = this.countActivityType(participants, 'training');
    newAchievements.push(...this.checkCountAchievement(memberId, 'training_enthusiast', trainingCount, 5, earnedAchievements));
    newAchievements.push(...this.checkCountAchievement(memberId, 'training_veteran', trainingCount, 15, earnedAchievements));
    newAchievements.push(...this.checkCountAchievement(memberId, 'training_master', trainingCount, 30, earnedAchievements));

    // Maintenance achievements
    const maintenanceCount = this.countActivityType(participants, 'maintenance');
    newAchievements.push(...this.checkCountAchievement(memberId, 'maintenance_hero', maintenanceCount, 5, earnedAchievements));
    newAchievements.push(...this.checkCountAchievement(memberId, 'maintenance_champion', maintenanceCount, 15, earnedAchievements));
    newAchievements.push(...this.checkCountAchievement(memberId, 'maintenance_legend', maintenanceCount, 30, earnedAchievements));

    // Truck inspector (first truck check)
    if (checkRuns.length > 0) {
      newAchievements.push(...this.checkCountAchievement(memberId, 'truck_inspector', 1, 1, earnedAchievements));
    }

    // Meeting achievements
    const meetingCount = this.countActivityType(participants, 'meeting');
    newAchievements.push(...this.checkCountAchievement(memberId, 'meeting_regular', meetingCount, 5, earnedAchievements));
    newAchievements.push(...this.checkCountAchievement(memberId, 'meeting_advocate', meetingCount, 10, earnedAchievements));

    // Century club
    const totalCheckIns = participants.length;
    newAchievements.push(...this.checkCountAchievement(memberId, 'century_club', totalCheckIns, 100, earnedAchievements));

    // Training streaks
    const trainingParticipants = participants.filter(p => this.isActivityType(p, 'training'));
    const trainingStreak3 = this.checkWeeklyStreak(trainingParticipants, 3);
    if (trainingStreak3) {
      newAchievements.push(...this.createStreakAchievement(memberId, 'training_streak_3', 3, earnedAchievements));
    }
    const trainingStreak6 = this.checkWeeklyStreak(trainingParticipants, 6);
    if (trainingStreak6) {
      newAchievements.push(...this.createStreakAchievement(memberId, 'training_streak_6', 6, earnedAchievements));
    }

    // Maintenance streak
    const maintenanceParticipants = participants.filter(p => this.isActivityType(p, 'maintenance'));
    const maintenanceStreak4 = this.checkWeeklyStreak(maintenanceParticipants, 4);
    if (maintenanceStreak4) {
      newAchievements.push(...this.createStreakAchievement(memberId, 'maintenance_streak_4', 4, earnedAchievements));
    }

    // Pattern achievements (monthly)
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthParticipants = participants.filter(p => new Date(p.checkInTime) >= monthStart);

    // All-rounder (weekly)
    const allRounderAchieved = this.checkAllRounder(participants);
    if (allRounderAchieved) {
      newAchievements.push(...this.checkCountAchievement(memberId, 'all_rounder', 1, 1, earnedAchievements));
    }

    // Perfect month
    const perfectMonthAchieved = this.checkPerfectMonth(monthParticipants);
    if (perfectMonthAchieved) {
      newAchievements.push(...this.checkCountAchievement(memberId, 'perfect_month', 1, 1, earnedAchievements));
    }

    // Strategic thinker (all meetings in a month)
    const strategicThinkerAchieved = this.checkStrategicThinker(monthParticipants);
    if (strategicThinkerAchieved) {
      newAchievements.push(...this.checkCountAchievement(memberId, 'strategic_thinker', 1, 1, earnedAchievements));
    }

    // Time-based patterns
    const earlyBirdCount = this.countTimePattern(monthParticipants, 6, 9);
    const nightOwlCount = this.countTimePattern(monthParticipants, 18, 21);
    
    // Day-based patterns
    const wednesdayCount = this.countDayOfWeek(monthParticipants, 3); // Wednesday
    const weekendCount = this.countWeekends(monthParticipants);

    // Note: Pattern achievements like "wednesday_warrior" would need comparison
    // with other members to determine "most". For now, we'll skip these
    // as they require leaderboard-style calculation

    // Update stored achievements
    earnedAchievements = [...earnedAchievements, ...newAchievements];
    this.achievements.set(memberId, earnedAchievements);

    // Calculate progress for unearned achievements
    const progress = this.calculateProgress(
      memberId,
      trainingCount,
      maintenanceCount,
      meetingCount,
      totalCheckIns,
      earnedAchievements
    );

    return {
      memberId,
      memberName,
      totalAchievements: earnedAchievements.length,
      achievements: earnedAchievements,
      recentlyEarned: newAchievements.slice(-5).reverse(),
      activeStreaks: earnedAchievements.filter(a => a.isActive && a.achievementType.includes('streak')),
      progress,
    };
  }

  /**
   * Get all participants for a member across all events
   */
  private async getParticipantsByMember(memberId: string): Promise<EventParticipant[]> {
    // Get a large number of events (we'll use 1000 as a reasonable limit)
    const allEvents = await this.db.getEvents(1000, 0);
    const participants: EventParticipant[] = [];
    
    for (const event of allEvents) {
      const eventParticipants = await this.db.getEventParticipants(event.id);
      // Add activityName to each participant from the event
      const participantsWithActivity = eventParticipants
        .filter(p => p.memberId === memberId)
        .map(p => ({
          ...p,
          activityName: event.activityName
        }));
      participants.push(...participantsWithActivity);
    }
    
    return participants;
  }

  /**
   * Get achievements for a member (without recalculation)
   */
  getMemberAchievements(memberId: string): MemberAchievement[] {
    return this.achievements.get(memberId) || [];
  }

  /**
   * Check if a count-based achievement should be awarded
   */
  private checkCountAchievement(
    memberId: string,
    type: AchievementType,
    currentCount: number,
    targetCount: number,
    earnedAchievements: MemberAchievement[]
  ): MemberAchievement[] {
    // Check if already earned
    const alreadyEarned = earnedAchievements.some(a => a.achievementType === type);
    if (alreadyEarned || currentCount < targetCount) {
      return [];
    }

    return [{
      id: `${memberId}-${type}-${Date.now()}`,
      memberId,
      achievementType: type,
      earnedAt: new Date(),
      isActive: true,
      metadata: { count: currentCount },
      createdAt: new Date(),
      updatedAt: new Date(),
    }];
  }

  /**
   * Create a streak achievement
   */
  private createStreakAchievement(
    memberId: string,
    type: AchievementType,
    streakLength: number,
    earnedAchievements: MemberAchievement[]
  ): MemberAchievement[] {
    // Check if already earned
    const alreadyEarned = earnedAchievements.some(a => a.achievementType === type && a.isActive);
    if (alreadyEarned) {
      return [];
    }

    return [{
      id: `${memberId}-${type}-${Date.now()}`,
      memberId,
      achievementType: type,
      earnedAt: new Date(),
      isActive: true,
      metadata: { streakLength },
      createdAt: new Date(),
      updatedAt: new Date(),
    }];
  }

  /**
   * Count participants by activity type (approximate)
   */
  private countActivityType(participants: EventParticipant[], activityType: string): number {
    return participants.filter(p => this.isActivityType(p, activityType)).length;
  }

  /**
   * Check if participant is of a specific activity type
   */
  private isActivityType(participant: any, activityType: string): boolean {
    // Activity names are stored in the event context
    const activityName = participant.activityName?.toLowerCase() || '';
    return activityName.includes(activityType.toLowerCase());
  }

  /**
   * Check for weekly streak (consecutive weeks with at least one activity)
   */
  private checkWeeklyStreak(participants: EventParticipant[], requiredWeeks: number): boolean {
    if (participants.length === 0) return false;

    // Sort by date
    const sorted = [...participants].sort((a, b) => 
      new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
    );

    // Get unique weeks
    const weeks = new Set<string>();
    sorted.forEach(p => {
      const date = new Date(p.checkInTime);
      const weekKey = this.getWeekKey(date);
      weeks.add(weekKey);
    });

    // Check for consecutive weeks ending in current/recent week
    const weekArray = Array.from(weeks).sort();
    const now = new Date();
    let consecutiveWeeks = 0;
    let checkDate = new Date(now);

    for (let i = 0; i < requiredWeeks + 4; i++) { // Check a few extra weeks
      const weekKey = this.getWeekKey(checkDate);
      if (weekArray.includes(weekKey)) {
        consecutiveWeeks++;
        if (consecutiveWeeks >= requiredWeeks) {
          return true;
        }
      } else if (consecutiveWeeks > 0) {
        // Streak broken
        break;
      }
      // Go back one week
      checkDate.setDate(checkDate.getDate() - 7);
    }

    return false;
  }

  /**
   * Get week key for grouping (year-week format)
   */
  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const weekNumber = this.getWeekNumber(date);
    return `${year}-W${weekNumber}`;
  }

  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Check all-rounder achievement (all 3 types in a week)
   */
  private checkAllRounder(participants: EventParticipant[]): boolean {
    // Get participants from last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentParticipants = participants.filter(p => new Date(p.checkInTime) >= weekAgo);

    const hasTraining = recentParticipants.some(p => this.isActivityType(p, 'training'));
    const hasMaintenance = recentParticipants.some(p => this.isActivityType(p, 'maintenance'));
    const hasMeeting = recentParticipants.some(p => this.isActivityType(p, 'meeting'));

    return hasTraining && hasMaintenance && hasMeeting;
  }

  /**
   * Check perfect month (2 trainings + 4 maintenance + 1 meeting)
   */
  private checkPerfectMonth(monthParticipants: EventParticipant[]): boolean {
    const trainingCount = this.countActivityType(monthParticipants, 'training');
    const maintenanceCount = this.countActivityType(monthParticipants, 'maintenance');
    const meetingCount = this.countActivityType(monthParticipants, 'meeting');

    return trainingCount >= 2 && maintenanceCount >= 4 && meetingCount >= 1;
  }

  /**
   * Check strategic thinker (all meetings in a month)
   */
  private checkStrategicThinker(monthParticipants: EventParticipant[]): boolean {
    // This would require knowing total meetings in the month
    // For now, we'll use a simple heuristic: attended at least 3 meetings
    const meetingCount = this.countActivityType(monthParticipants, 'meeting');
    return meetingCount >= 3;
  }

  /**
   * Count check-ins in a time window
   */
  private countTimePattern(participants: EventParticipant[], startHour: number, endHour: number): number {
    return participants.filter(p => {
      const hour = new Date(p.checkInTime).getHours();
      return hour >= startHour && hour < endHour;
    }).length;
  }

  /**
   * Count check-ins on a specific day of week (0 = Sunday, 3 = Wednesday)
   */
  private countDayOfWeek(participants: EventParticipant[], dayOfWeek: number): number {
    return participants.filter(p => new Date(p.checkInTime).getDay() === dayOfWeek).length;
  }

  /**
   * Count weekend check-ins
   */
  private countWeekends(participants: EventParticipant[]): number {
    return participants.filter(p => {
      const day = new Date(p.checkInTime).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    }).length;
  }

  /**
   * Calculate progress toward unearned achievements
   */
  private calculateProgress(
    memberId: string,
    trainingCount: number,
    maintenanceCount: number,
    meetingCount: number,
    totalCheckIns: number,
    earnedAchievements: MemberAchievement[]
  ): AchievementProgress[] {
    const progress: AchievementProgress[] = [];

    // Training progress
    this.addProgress(progress, 'training_enthusiast', trainingCount, 5, earnedAchievements);
    this.addProgress(progress, 'training_veteran', trainingCount, 15, earnedAchievements);
    this.addProgress(progress, 'training_master', trainingCount, 30, earnedAchievements);

    // Maintenance progress
    this.addProgress(progress, 'maintenance_hero', maintenanceCount, 5, earnedAchievements);
    this.addProgress(progress, 'maintenance_champion', maintenanceCount, 15, earnedAchievements);
    this.addProgress(progress, 'maintenance_legend', maintenanceCount, 30, earnedAchievements);

    // Meeting progress
    this.addProgress(progress, 'meeting_regular', meetingCount, 5, earnedAchievements);
    this.addProgress(progress, 'meeting_advocate', meetingCount, 10, earnedAchievements);

    // Century club
    this.addProgress(progress, 'century_club', totalCheckIns, 100, earnedAchievements);

    return progress;
  }

  /**
   * Add progress entry for an achievement
   */
  private addProgress(
    progress: AchievementProgress[],
    type: AchievementType,
    current: number,
    target: number,
    earnedAchievements: MemberAchievement[]
  ): void {
    const isEarned = earnedAchievements.some(a => a.achievementType === type);
    if (!isEarned) {
      progress.push({
        achievementType: type,
        currentProgress: current,
        targetProgress: target,
        percentComplete: Math.min(100, Math.round((current / target) * 100)),
        isEarned: false,
      });
    }
  }
}
