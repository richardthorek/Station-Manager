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
  CheckStatus,
  Station,
  StationLookupResult
} from '../types';
import type { MemberAchievementSummary } from '../types/achievements';

// Use relative URL in production, localhost in development; ensure trailing /api
const rawApiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
const API_BASE_URL = rawApiBase.endsWith('/api') ? rawApiBase : `${rawApiBase.replace(/\/$/, '')}/api`;

// Default station ID for backward compatibility
const DEFAULT_STATION_ID = 'default-station';

// Station ID provider - will be set by StationContext
let currentStationId: string | null = null;

export function setCurrentStationId(stationId: string | null) {
  currentStationId = stationId;
}

export function getCurrentStationId(): string {
  return currentStationId || DEFAULT_STATION_ID;
}

class ApiService {
  /**
   * Fetch helper with limited retry/backoff for 429/503 to reduce bursty failures in dev
   */
  private async fetchWithRetry(url: string, init?: RequestInit, retries: number = 2): Promise<Response> {
    let attempt = 0;
    let backoffMs = 300;

    const buildInit = (): RequestInit => {
      const mergedHeaders = this.getHeaders(init?.headers);
      return { ...init, headers: mergedHeaders };
    };

    while (true) {
      const response = await fetch(url, buildInit());

      // If success or non-retriable status, return immediately
      if (response.ok || ![429, 503].includes(response.status) || attempt >= retries) {
        return response;
      }

      // Respect Retry-After header if provided
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      const jitter = Math.random() * 150;
      const delayMs = retryAfterMs || backoffMs + jitter;

      await new Promise(resolve => setTimeout(resolve, delayMs));

      attempt += 1;
      backoffMs *= 2;
    }
  }
  /**
   * Create headers with X-Station-Id for multi-station support
   */
  private getHeaders(additionalHeaders?: HeadersInit): HeadersInit {
    const headers: HeadersInit = {
      'X-Station-Id': getCurrentStationId(),
      ...additionalHeaders,
    };
    return headers;
  }

  // ============================================
  // Stations
  // ============================================
  
  async getStations(): Promise<Station[]> {
    const response = await this.fetchWithRetry(`${API_BASE_URL}/stations`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch stations');
    const data = await response.json();
    return data.stations || data;
  }

  async getStation(id: string): Promise<Station> {
    const response = await fetch(`${API_BASE_URL}/stations/${id}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch station');
    return response.json();
  }

  async createStation(stationData: Partial<Station>): Promise<Station> {
    const response = await fetch(`${API_BASE_URL}/stations`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(stationData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create station');
    }
    return response.json();
  }

  async updateStation(id: string, updates: Partial<Station>): Promise<Station> {
    const response = await fetch(`${API_BASE_URL}/stations/${id}`, {
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update station');
    }
    return response.json();
  }

  async deleteStation(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/stations/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete station');
    }
    return response.json();
  }

  async resetDemoStation(): Promise<{ 
    success: boolean; 
    message: string; 
    stationId: string;
    resetAt: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/stations/demo/reset`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to reset demo station');
    }
    return response.json();
  }

  async lookupStations(query?: string, lat?: number, lon?: number, limit: number = 10): Promise<{
    results: StationLookupResult[];
    count: number;
  }> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (lat !== undefined) params.append('lat', lat.toString());
    if (lon !== undefined) params.append('lon', lon.toString());
    params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/stations/lookup?${params}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to lookup stations');
    return response.json();
  }

  async checkBrigadeExists(brigadeId: string): Promise<{
    exists: boolean;
    station?: Station;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/stations/check-brigade/${encodeURIComponent(brigadeId)}`, {
      headers: this.getHeaders(),
    });
    
    if (response.status === 404) {
      return { exists: false, message: 'No active station found with this brigade ID' };
    }
    
    if (!response.ok) {
      throw new Error('Failed to check brigade ID');
    }
    
    return response.json();
  }

  async getStationStatistics(): Promise<{
    memberCount: number;
    eventCount: number;
    checkInCount: number;
    activeCheckInCount: number;
  }> {
    // Note: This is a simplified version that gets counts for the current station
    // The stationId parameter is kept for API compatibility but not used
    // as all API calls already filter by the current station via X-Station-Id header
    const [members, events, activeCheckIns] = await Promise.all([
      this.getMembers(),
      this.getEvents(),
      this.getActiveCheckIns(),
    ]);

    return {
      memberCount: members.length,
      eventCount: events.length,
      checkInCount: 0, // Historical check-in count not available in this simplified version
      activeCheckInCount: activeCheckIns.length,
    };
  }

  // System Status
  async getStatus(): Promise<{
    status: string;
    databaseType: 'mongodb' | 'in-memory' | 'table-storage';
    isProduction: boolean;
    usingInMemory: boolean;
    timestamp: string;
  }> {
    const response = await this.fetchWithRetry(`${API_BASE_URL}/status`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch status');
    return response.json();
  }

  // Members
  async getMembers(options?: { search?: string; filter?: string; sort?: string }): Promise<Member[]> {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);
    if (options?.filter) params.append('filter', options.filter);
    if (options?.sort) params.append('sort', options.sort);
    
    const queryString = params.toString();
    const url = queryString ? `${API_BASE_URL}/members?${queryString}` : `${API_BASE_URL}/members`;
    
    const response = await this.fetchWithRetry(url, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch members');
    return response.json();
  }

  async getMember(id: string): Promise<Member> {
    const response = await fetch(`${API_BASE_URL}/members/${id}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch member');
    return response.json();
  }

  async createMember(name: string, rank?: string | null): Promise<Member> {
    const response = await fetch(`${API_BASE_URL}/members`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, rank }),
    });
    if (!response.ok) throw new Error('Failed to create member');
    return response.json();
  }

  async updateMember(id: string, name: string, rank?: string | null): Promise<Member> {
    const response = await fetch(`${API_BASE_URL}/members/${id}`, {
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, rank }),
    });
    if (!response.ok) throw new Error('Failed to update member');
    return response.json();
  }

  async deleteMember(id: string): Promise<{ success: boolean; member: Member }> {
    const response = await fetch(`${API_BASE_URL}/members/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to delete member');
    }

    return response.json();
  }

  async getMemberHistory(id: string): Promise<CheckIn[]> {
    const response = await fetch(`${API_BASE_URL}/members/${id}/history`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch member history');
    return response.json();
  }

  async importMembersCSV(file: File): Promise<{
    totalRows: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    validationResults: Array<{
      row: number;
      data: {
        firstName?: string;
        lastName?: string;
        name: string;
        rank?: string;
        roles?: string;
      };
      isValid: boolean;
      isDuplicate: boolean;
      errors: string[];
    }>;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/members/import`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to import CSV');
    }

    return response.json();
  }

  async executeMemberImport(members: Array<{
    firstName?: string;
    lastName?: string;
    name: string;
    rank?: string;
  }>): Promise<{
    totalAttempted: number;
    successCount: number;
    failureCount: number;
    successful: Array<{ name: string; id: string; qrCode: string }>;
    failed: Array<{ name: string; error: string }>;
  }> {
    const response = await fetch(`${API_BASE_URL}/members/import/execute`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ members }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to execute import');
    }

    return response.json();
  }

  // Activities
  async getActivities(): Promise<Activity[]> {
    const response = await this.fetchWithRetry(`${API_BASE_URL}/activities`);
    if (!response.ok) throw new Error('Failed to fetch activities');
    return response.json();
  }

  async getActiveActivity(): Promise<ActiveActivity> {
    const response = await fetch(`${API_BASE_URL}/activities/active`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch active activity');
    return response.json();
  }

  async setActiveActivity(activityId: string, setBy?: string): Promise<ActiveActivity> {
    const response = await fetch(`${API_BASE_URL}/activities/active`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ activityId, setBy }),
    });
    if (!response.ok) throw new Error('Failed to set active activity');
    return response.json();
  }

  async createActivity(name: string, createdBy?: string): Promise<Activity> {
    const response = await fetch(`${API_BASE_URL}/activities`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, createdBy }),
    });
    if (!response.ok) throw new Error('Failed to create activity');
    return response.json();
  }

  async deleteActivity(activityId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/activities/${activityId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete activity');
  }

  // Check-ins
  async getActiveCheckIns(): Promise<CheckInWithDetails[]> {
    const response = await fetch(`${API_BASE_URL}/checkins/active`, {
      headers: this.getHeaders(),
    });
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
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ memberId, method, activityId, location, isOffsite }),
    });
    if (!response.ok) throw new Error('Failed to check in');
    return response.json();
  }

  async undoCheckIn(memberId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/checkins/${memberId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to undo check-in');
  }

  async urlCheckIn(identifier: string): Promise<{ action: string; member: string; checkIn?: CheckIn }> {
    const response = await fetch(`${API_BASE_URL}/checkins/url-checkin`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ identifier }),
    });
    if (!response.ok) throw new Error('Failed to perform URL check-in');
    return response.json();
  }
  // Events
  async getEvents(limit: number = 50, offset: number = 0): Promise<EventWithParticipants[]> {
    const response = await this.fetchWithRetry(`${API_BASE_URL}/events?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  }

  async getActiveEvents(): Promise<EventWithParticipants[]> {
    const response = await fetch(`${API_BASE_URL}/events/active`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch active events');
    return response.json();
  }

  async getEvent(eventId: string): Promise<EventWithParticipants> {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch event');
    return response.json();
  }

  async createEvent(activityId: string, createdBy?: string): Promise<EventWithParticipants> {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ activityId, createdBy }),
    });
    if (!response.ok) throw new Error('Failed to create event');
    return response.json();
  }

  async endEvent(eventId: string): Promise<EventWithParticipants> {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/end`, {
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!response.ok) throw new Error('Failed to end event');
    return response.json();
  }

  async reactivateEvent(eventId: string): Promise<EventWithParticipants> {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/reactivate`, {
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
    });

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Event can only be reopened within 24 hours of closing');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to reactivate event');
    }

    return response.json();
  }

  async deleteEvent(eventId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete event');
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
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ memberId, method, location, isOffsite }),
    });
    if (!response.ok) throw new Error('Failed to add participant');
    return response.json();
  }

  async removeEventParticipant(eventId: string, participantId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/participants/${participantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to remove participant');
  }

  // ============================================
  // Truck Checks
  // ============================================

  // Appliances
  async getAppliances(): Promise<Appliance[]> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch appliances');
    return response.json();
  }

  async getAppliance(id: string): Promise<Appliance> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances/${id}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch appliance');
    return response.json();
  }

  async createAppliance(name: string, description?: string, photoUrl?: string): Promise<Appliance> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, description, photoUrl }),
    });
    if (!response.ok) throw new Error('Failed to create appliance');
    return response.json();
  }

  async updateAppliance(id: string, name: string, description?: string, photoUrl?: string): Promise<Appliance> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances/${id}`, {
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
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
      headers: this.getHeaders(),
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload appliance photo');
    return response.json();
  }

  async deleteAppliance(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/appliances/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete appliance');
  }

  // Templates
  async getTemplate(applianceId: string): Promise<ChecklistTemplate> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/templates/${applianceId}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch template');
    return response.json();
  }

  async updateTemplate(applianceId: string, items: Omit<ChecklistItem, 'id'>[]): Promise<ChecklistTemplate> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/templates/${applianceId}`, {
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ items }),
    });
    if (!response.ok) throw new Error('Failed to update template');
    return response.json();
  }

  // Check Runs
  async createCheckRun(applianceId: string, completedBy: string, completedByName?: string): Promise<CheckRun> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/runs`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ applianceId, completedBy, completedByName }),
    });
    if (!response.ok) throw new Error('Failed to create check run');
    return response.json();
  }

  async getCheckRun(id: string): Promise<CheckRunWithResults> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/runs/${id}`, {
      headers: this.getHeaders(),
    });
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

    const response = await fetch(`${API_BASE_URL}/truck-checks/runs?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch check runs');
    return response.json();
  }

  async completeCheckRun(id: string, additionalComments?: string): Promise<CheckRun> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/runs/${id}/complete`, {
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
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
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
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
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, comment, photoUrl }),
    });
    if (!response.ok) throw new Error('Failed to update check result');
    return response.json();
  }

  async deleteCheckResult(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/results/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete check result');
  }

  // Photo Uploads
  async uploadReferencePhoto(file: File): Promise<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await fetch(`${API_BASE_URL}/truck-checks/upload/reference-photo`, {
      method: 'POST',
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload result photo');
    return response.json();
  }

  async getStorageStatus(): Promise<{ enabled: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/truck-checks/storage-status`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to get storage status');
    return response.json();
  }

  // Achievements
  async getMemberAchievements(memberId: string): Promise<MemberAchievementSummary> {
    const response = await fetch(`${API_BASE_URL}/achievements/${memberId}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch achievements');
    return response.json();
  }

  async getRecentAchievements(memberId: string): Promise<{
    recentlyEarned: unknown[];
    totalNew: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/achievements/${memberId}/recent`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch recent achievements');
    return response.json();
  }

  async getAchievementProgress(memberId: string): Promise<{
    progress: unknown[];
    activeStreaks: unknown[];
  }> {
    const response = await fetch(`${API_BASE_URL}/achievements/${memberId}/progress`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch achievement progress');
    return response.json();
  }

  // Reports
  async getAttendanceSummary(startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    summary: Array<{ month: string; count: number }>;
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/attendance-summary?startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch attendance summary');
    return response.json();
  }

  async getMemberParticipation(startDate: string, endDate: string, limit: number = 10): Promise<{
    startDate: string;
    endDate: string;
    limit: number;
    participation: Array<{
      memberId: string;
      memberName: string;
      participationCount: number;
      lastCheckIn: string;
    }>;
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/member-participation?startDate=${startDate}&endDate=${endDate}&limit=${limit}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch member participation');
    return response.json();
  }

  async getActivityBreakdown(startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    breakdown: Array<{
      category: string;
      count: number;
      percentage: number;
    }>;
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/activity-breakdown?startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch activity breakdown');
    return response.json();
  }

  async getEventStatistics(startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    statistics: {
      totalEvents: number;
      activeEvents: number;
      completedEvents: number;
      totalParticipants: number;
      averageParticipantsPerEvent: number;
      averageDuration: number;
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/event-statistics?startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch event statistics');
    return response.json();
  }

  async getTruckCheckCompliance(startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    compliance: {
      totalChecks: number;
      completedChecks: number;
      inProgressChecks: number;
      checksWithIssues: number;
      complianceRate: number;
      applianceStats: Array<{
        applianceId: string;
        applianceName: string;
        checkCount: number;
        lastCheckDate: string | null;
      }>;
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/truckcheck-compliance?startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch truck check compliance');
    return response.json();
  }

  // ============================================
  // Cross-Station Reports
  // ============================================

  async getCrossStationAttendanceSummary(stationIds: string[], startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    stationIds: string[];
    summaries: Record<string, Array<{ month: string; count: number }>>;
  }> {
    const idsParam = stationIds.join(',');
    const response = await fetch(`${API_BASE_URL}/reports/cross-station/attendance-summary?stationIds=${idsParam}&startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch cross-station attendance summary');
    return response.json();
  }

  async getCrossStationMemberParticipation(stationIds: string[], startDate: string, endDate: string, limit: number = 10): Promise<{
    startDate: string;
    endDate: string;
    stationIds: string[];
    limit: number;
    participation: Record<string, Array<{
      memberId: string;
      memberName: string;
      participationCount: number;
      lastCheckIn: string;
    }>>;
  }> {
    const idsParam = stationIds.join(',');
    const response = await fetch(`${API_BASE_URL}/reports/cross-station/member-participation?stationIds=${idsParam}&startDate=${startDate}&endDate=${endDate}&limit=${limit}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch cross-station member participation');
    return response.json();
  }

  async getCrossStationActivityBreakdown(stationIds: string[], startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    stationIds: string[];
    breakdowns: Record<string, Array<{
      category: string;
      count: number;
      percentage: number;
    }>>;
  }> {
    const idsParam = stationIds.join(',');
    const response = await fetch(`${API_BASE_URL}/reports/cross-station/activity-breakdown?stationIds=${idsParam}&startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch cross-station activity breakdown');
    return response.json();
  }

  async getCrossStationEventStatistics(stationIds: string[], startDate: string, endDate: string): Promise<{
    startDate: string;
    stationIds: string[];
    statistics: Record<string, {
      totalEvents: number;
      activeEvents: number;
      completedEvents: number;
      totalParticipants: number;
      averageParticipantsPerEvent: number;
      averageDuration: number;
    }>;
  }> {
    const idsParam = stationIds.join(',');
    const response = await fetch(`${API_BASE_URL}/reports/cross-station/event-statistics?stationIds=${idsParam}&startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch cross-station event statistics');
    return response.json();
  }

  // ============================================
  // Advanced Analytics
  // ============================================

  async getTrendAnalysis(startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    trends: {
      attendanceTrend: Array<{ month: string; count: number; change: number; changePercent: number }>;
      eventsTrend: Array<{ month: string; count: number; change: number; changePercent: number }>;
      memberGrowth: { currentTotal: number; previousTotal: number; change: number; changePercent: number };
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/advanced/trend-analysis?startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch trend analysis');
    return response.json();
  }

  async getActivityHeatMap(startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    heatMap: Array<{ day: number; hour: number; count: number }>;
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/advanced/heat-map?startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch activity heat map');
    return response.json();
  }

  async getMemberFunnel(startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    funnel: {
      stages: Array<{ stage: string; count: number; conversionRate: number }>;
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/advanced/funnel?startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch member funnel');
    return response.json();
  }

  async getCohortAnalysis(startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    cohort: {
      cohorts: Array<{ cohort: string; members: number; retentionRates: number[] }>;
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/advanced/cohort?startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch cohort analysis');
    return response.json();
  }

  async getBrigadeSummary(brigadeId: string, startDate: string, endDate: string): Promise<{
    startDate: string;
    endDate: string;
    brigadeId: string;
    stations: Array<{ id: string; name: string }>;
    summary: {
      totalEvents: number;
      totalParticipants: number;
      totalCompletedEvents: number;
      totalStations: number;
      averageEventsPerStation: number;
      averageParticipantsPerStation: number;
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/reports/brigade-summary?brigadeId=${brigadeId}&startDate=${startDate}&endDate=${endDate}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch brigade summary');
    return response.json();
  }

  // ============================================
  // Brigade Access (Kiosk Mode Tokens)
  // ============================================

  async generateBrigadeAccessToken(data: {
    brigadeId: string;
    stationId: string;
    description?: string;
    expiresInDays?: number;
  }): Promise<{
    success: boolean;
    token: string;
    brigadeId: string;
    stationId: string;
    description?: string;
    createdAt: string;
    expiresAt?: string;
    kioskUrl: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/brigade-access/generate`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate brigade access token');
    }
    return response.json();
  }

  async getAllBrigadeAccessTokens(): Promise<{
    tokens: Array<{
      token: string;
      brigadeId: string;
      stationId: string;
      description?: string;
      createdAt: string;
      expiresAt?: string;
      kioskUrl: string;
    }>;
    count: number;
    timestamp: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/brigade-access/all-tokens`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch brigade access tokens');
    return response.json();
  }

  async revokeBrigadeAccessToken(token: string): Promise<{
    success: boolean;
    message: string;
    token: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/brigade-access/${token}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to revoke token');
    }
    return response.json();
  }

  // Demo Mode
  async getDemoStatus(): Promise<{
    isDemo: boolean;
    demoAvailable: boolean;
    perDeviceMode: boolean;
    instructions: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/demo/status`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch demo status');
    return response.json();
  }

  async getDemoInfo(): Promise<{
    description: string;
    features: string[];
    testData: {
      members: number;
      activities: number;
      appliances: number;
      description: string;
    };
    usage: {
      activate: string;
      deactivate: string;
      seedData: string;
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/demo/info`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch demo info');
    return response.json();
  }

  // ============================================
  // Data Export
  // ============================================

  /**
   * Export members to CSV file
   */
  async exportMembers(): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/export/members`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to export members');
    return response.blob();
  }

  /**
   * Export check-ins to CSV file with optional date range
   * @param startDate Optional start date (ISO string)
   * @param endDate Optional end date (ISO string)
   */
  async exportCheckIns(startDate?: string, endDate?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    
    const url = `${API_BASE_URL}/export/checkins${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to export check-ins');
    return response.blob();
  }

  /**
   * Export events to CSV file with optional date range
   * @param startDate Optional start date (ISO string)
   * @param endDate Optional end date (ISO string)
   */
  async exportEvents(startDate?: string, endDate?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    
    const url = `${API_BASE_URL}/export/events${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to export events');
    return response.blob();
  }

  /**
   * Export truck check results to CSV file with optional date range
   * @param startDate Optional start date (ISO string)
   * @param endDate Optional end date (ISO string)
   */
  async exportTruckCheckResults(startDate?: string, endDate?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    
    const url = `${API_BASE_URL}/export/truckcheck-results${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to export truck check results');
    return response.blob();
  }
}

export const api = new ApiService();
