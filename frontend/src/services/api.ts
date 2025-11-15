import type { Member, Activity, CheckIn, CheckInWithDetails, ActiveActivity } from '../types';

// Use relative URL in production, localhost in development
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

class ApiService {
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

  async updateMember(id: string, name: string): Promise<Member> {
    const response = await fetch(`${API_BASE_URL}/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
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
}

export const api = new ApiService();
