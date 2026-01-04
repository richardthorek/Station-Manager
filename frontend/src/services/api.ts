import type { 
  Member, 
  Activity, 
  CheckIn, 
  CheckInWithDetails, 
  ActiveActivity, 
  EventWithParticipants, 
  EventParticipant,
  Appliance,
  ChecklistTemplate,
  ChecklistItem,
  CheckRun,
  CheckRunWithResults,
  CheckResult,
  CheckStatus
} from '../types';
import type { MemberAchievementSummary } from '../types/achievements';

// Use relative URL in production, localhost in development; ensure trailing /api
const rawApiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
const API_BASE_URL = rawApiBase.endsWith('/api') ? rawApiBase : `${rawApiBase.replace(/\/$/, '')}/api`;

class ApiService {
  // System Status
  async getStatus(): Promise<{
    status: string;
    databaseType: 'mongodb' | 'in-memory' | 'table-storage';
    isProduction: boolean;
    usingInMemory: boolean;
    timestamp: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/status`);
    if (!response.ok) throw new Error('Failed to fetch status');
    return response.json();
  }

  // Members
  async getMembers(): Promise<Member[]> {
    const response = await fetch(`${API_BASE_URL}/members`);
    if (!response.ok) throw new Error('Failed to fetch members');
    return response.json();
  }

  async getMember(id: string): Promise<Member> {
    const response = await fetch(`${API_BASE_URL}/members/${id}`);
    if (!response.ok) throw new Error('Failed to fetch member');
    return response.json();
  }

  async createMember(name: string): Promise<Member> {
    const response = await fetch(`${API_BASE_URL}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to create member');
    return response.json();
  }

  async updateMember(id: string, name: string, rank?: string | null): Promise<Member> {
    const response = await fetch(`${API_BASE_URL}/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rank }),
    });
    if (!response.ok) throw new Error('Failed to update member');
    return response.json();
  }

  async getMemberHistory(id: string): Promise<CheckIn[]> {
    const response = await fetch(`${API_BASE_URL}/members/${id}/history`);
    if (!response.ok) throw new Error('Failed to fetch member history');
    return response.json();
  }

  // Activities
  async getActivities(): Promise<Activity[]> {
    const response = await fetch(`${API_BASE_URL}/activities`);
    if (!response.ok) throw new Error('Failed to fetch activities');
    return response.json();
  }

  async getActiveActivity(): Promise<ActiveActivity> {
    const response = await fetch(`${API_BASE_URL}/activities/active`);
    if (!response.ok) throw new Error('Failed to fetch active activity');
    return response.json();
  }

  async setActiveActivity(activityId: string, setBy?: string): Promise<ActiveActivity> {
    const response = await fetch(`${API_BASE_URL}/activities/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, setBy }),
    });
    if (!response.ok) throw new Error('Failed to set active activity');
    return response.json();
  }

  async createActivity(name: string, createdBy?: string): Promise<Activity> {
    const response = await fetch(`${API_BASE_URL}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, createdBy }),
    });
    if (!response.ok) throw new Error('Failed to create activity');
    return response.json();
  }

  // Check-ins
  async getActiveCheckIns(): Promise<CheckInWithDetails[]> {
    const response = await fetch(`${API_BASE_URL}/checkins/active`);
    if (!response.ok) throw new Error('Failed to fetch check-ins');
    return response.json();
  }

  async checkIn(
    memberId: string,
    method: 'kiosk' | 'mobile' | 'qr' = 'mobile',
    activityId?: string,
    location?: string,
    isOffsite?: boolean
  ): Promise<{ action: string; checkIn: CheckIn }> {
    const response = await fetch(`${API_BASE_URL}/checkins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, method, activityId, location, isOffsite }),
    });
    if (!response.ok) throw new Error('Failed to check in');
    return response.json();
  }

  async undoCheckIn(memberId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/checkins/${memberId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to undo check-in');
  }

  async urlCheckIn(identifier: string): Promise<{ action: string; member: string; checkIn?: CheckIn }> {
    const response = await fetch(`${API_BASE_URL}/checkins/url-checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    if (!response.ok) throw new Error('Failed to perform URL check-in');
    return response.json();
  }
  // Events
  async getEvents(limit: number = 50, offset: number = 0): Promise<EventWithParticipants[]> {
    const response = await fetch(`${API_BASE_URL}/events?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  }

  async getActiveEvents(): Promise<EventWithParticipants[]> {
    const response = await fetch(`${API_BASE_URL}/events/active`);
    if (!response.ok) throw new Error('Failed to fetch active events');
    return response.json();
  }

  async getEvent(eventId: string): Promise<EventWithParticipants> {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`);
    if (!response.ok) throw new Error('Failed to fetch event');
    return response.json();
  }

  async createEvent(activityId: string, createdBy?: string): Promise<EventWithParticipants> {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, createdBy }),
    });
    if (!response.ok) throw new Error('Failed to create event');
    return response.json();
  }

  async endEvent(eventId: string): Promise<EventWithParticipants> {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/end`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to end event');
    return response.json();
  }

  async addEventParticipant(
    eventId: string,
    memberId: string,
    method: 'kiosk' | 'mobile' | 'qr' = 'mobile',
    location?: string,
    isOffsite?: boolean
  ): Promise<{ action: string; participant: EventParticipant }> {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, method, location, isOffsite }),
    });
    if (!response.ok) throw new Error('Failed to add participant');
    return response.json();
  }

  async removeEventParticipant(eventId: string, participantId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participants/${participantId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to remove participant');
  }

  // ============================================
  // Truck Checks
  // ============================================

  // Appliances
  async getAppliances(): Promise<Appliance[]> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances`);
    if (!response.ok) throw new Error('Failed to fetch appliances');
    return response.json();
  }

  async getAppliance(id: string): Promise<Appliance> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances/${id}`);
    if (!response.ok) throw new Error('Failed to fetch appliance');
    return response.json();
  }

  async createAppliance(name: string, description?: string, photoUrl?: string): Promise<Appliance> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, photoUrl }),
    });
    if (!response.ok) throw new Error('Failed to create appliance');
    return response.json();
  }

  async updateAppliance(id: string, name: string, description?: string, photoUrl?: string): Promise<Appliance> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, photoUrl }),
    });
    if (!response.ok) throw new Error('Failed to update appliance');
    return response.json();
  }

  async uploadAppliancePhoto(file: File): Promise<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await fetch(`${API_BASE_URL}/truck-checks/upload/reference-photo`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload appliance photo');
    return response.json();
  }

  async deleteAppliance(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete appliance');
  }

  // Templates
  async getTemplate(applianceId: string): Promise<ChecklistTemplate> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/templates/${applianceId}`);
    if (!response.ok) throw new Error('Failed to fetch template');
    return response.json();
  }

  async updateTemplate(applianceId: string, items: Omit<ChecklistItem, 'id'>[]): Promise<ChecklistTemplate> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/templates/${applianceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!response.ok) throw new Error('Failed to update template');
    return response.json();
  }

  // Check Runs
  async createCheckRun(applianceId: string, completedBy: string, completedByName?: string): Promise<CheckRun> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applianceId, completedBy, completedByName }),
    });
    if (!response.ok) throw new Error('Failed to create check run');
    return response.json();
  }

  async getCheckRun(id: string): Promise<CheckRunWithResults> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/runs/${id}`);
    if (!response.ok) throw new Error('Failed to fetch check run');
    return response.json();
  }

  async getCheckRuns(filters?: {
    applianceId?: string;
    startDate?: string;
    endDate?: string;
    withIssues?: boolean;
  }): Promise<CheckRunWithResults[]> {
    const params = new URLSearchParams();
    if (filters?.applianceId) params.append('applianceId', filters.applianceId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.withIssues) params.append('withIssues', 'true');

    const response = await fetch(`${API_BASE_URL}/truck-checks/runs?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch check runs');
    return response.json();
  }

  async completeCheckRun(id: string, additionalComments?: string): Promise<CheckRun> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/runs/${id}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ additionalComments }),
    });
    if (!response.ok) throw new Error('Failed to complete check run');
    return response.json();
  }

  // Check Results
  async createCheckResult(
    runId: string,
    itemId: string,
    itemName: string,
    itemDescription: string,
    status: CheckStatus,
    comment?: string,
    photoUrl?: string,
    completedBy?: string
  ): Promise<CheckResult> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, itemId, itemName, itemDescription, status, comment, photoUrl, completedBy }),
    });
    if (!response.ok) throw new Error('Failed to create check result');
    return response.json();
  }

  async updateCheckResult(
    id: string,
    status: CheckStatus,
    comment?: string,
    photoUrl?: string
  ): Promise<CheckResult> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/results/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment, photoUrl }),
    });
    if (!response.ok) throw new Error('Failed to update check result');
    return response.json();
  }

  async deleteCheckResult(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/results/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete check result');
  }

  // Photo Uploads
  async uploadReferencePhoto(file: File): Promise<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await fetch(`${API_BASE_URL}/truck-checks/upload/reference-photo`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload reference photo');
    return response.json();
  }

  async uploadResultPhoto(file: File): Promise<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await fetch(`${API_BASE_URL}/truck-checks/upload/result-photo`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload result photo');
    return response.json();
  }

  async getStorageStatus(): Promise<{ enabled: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/storage-status`);
    if (!response.ok) throw new Error('Failed to get storage status');
    return response.json();
  }

  // Achievements
  async getMemberAchievements(memberId: string): Promise<MemberAchievementSummary> {
    const response = await fetch(`${API_BASE_URL}/achievements/${memberId}`);
    if (!response.ok) throw new Error('Failed to fetch achievements');
    return response.json();
  }

  async getRecentAchievements(memberId: string): Promise<{
    recentlyEarned: unknown[];
    totalNew: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/achievements/${memberId}/recent`);
    if (!response.ok) throw new Error('Failed to fetch recent achievements');
    return response.json();
  }

  async getAchievementProgress(memberId: string): Promise<{
    progress: unknown[];
    activeStreaks: unknown[];
  }> {
    const response = await fetch(`${API_BASE_URL}/achievements/${memberId}/progress`);
    if (!response.ok) throw new Error('Failed to fetch achievement progress');
    return response.json();
  }
}

export const api = new ApiService();
