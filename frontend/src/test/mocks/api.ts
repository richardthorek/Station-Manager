/**
 * Mock API Service
 * 
 * Provides mock implementations of all API methods for testing.
 * Can be customized per-test to return specific data or errors.
 */

import { vi } from 'vitest'
import type { 
  Member, 
  Activity, 
  CheckInWithDetails, 
  ActiveActivity,
  EventWithParticipants,
  Appliance,
  ChecklistTemplate,
  CheckRun,
  CheckRunWithResults,
} from '../../types'

// Sample test data
export const mockMembers: Member[] = [
  {
    id: 'member-1',
    name: 'John Smith',
    qrCode: 'qr-john',
    memberNumber: '12345',
    rank: 'Firefighter',
    firstName: 'John',
    lastName: 'Smith',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'member-2',
    name: 'Jane Doe',
    qrCode: 'qr-jane',
    memberNumber: '12346',
    rank: 'Senior Firefighter',
    firstName: 'Jane',
    lastName: 'Doe',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

export const mockActivities: Activity[] = [
  {
    id: 'activity-1',
    name: 'Training',
    isCustom: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'activity-2',
    name: 'Maintenance',
    isCustom: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'activity-3',
    name: 'Meeting',
    isCustom: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
]

export const mockActiveActivity: ActiveActivity = {
  id: 'active-1',
  activityId: 'activity-1',
  setAt: '2024-01-01T00:00:00Z',
  activity: mockActivities[0],
}

export const mockCheckIns: CheckInWithDetails[] = [
  {
    id: 'checkin-1',
    memberId: 'member-1',
    activityId: 'activity-1',
    checkInTime: '2024-01-01T10:00:00Z',
    checkInMethod: 'kiosk',
    isOffsite: false,
    isActive: true,
    memberName: 'John Smith',
    activityName: 'Training',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
]

export const mockEvents: EventWithParticipants[] = [
  {
    id: 'event-1',
    activityId: 'activity-1',
    activityName: 'Training',
    startTime: '2024-01-01T10:00:00Z',
    isActive: true,
    participants: [],
    participantCount: 0,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
]

// Create mock API service
export const createMockApi = () => ({
  // System Status
  getStatus: vi.fn().mockResolvedValue({
    status: 'ok',
    databaseType: 'in-memory',
    isProduction: false,
    usingInMemory: true,
    timestamp: new Date().toISOString(),
  }),

  // Members
  getMembers: vi.fn().mockResolvedValue(mockMembers),
  getMember: vi.fn((id: string) => Promise.resolve(mockMembers.find(m => m.id === id))),
  createMember: vi.fn((name: string) => 
    Promise.resolve({
      id: `member-${Date.now()}`,
      name,
      qrCode: `qr-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Member)
  ),
  updateMember: vi.fn((id: string, name: string, rank?: string | null) =>
    Promise.resolve({
      ...mockMembers.find(m => m.id === id)!,
      name,
      rank,
      updatedAt: new Date().toISOString(),
    })
  ),
  getMemberHistory: vi.fn().mockResolvedValue([]),

  // Activities
  getActivities: vi.fn().mockResolvedValue(mockActivities),
  getActiveActivity: vi.fn().mockResolvedValue(mockActiveActivity),
  setActiveActivity: vi.fn((activityId: string, setBy?: string) =>
    Promise.resolve({
      id: 'active-1',
      activityId,
      setAt: new Date().toISOString(),
      setBy,
    } as ActiveActivity)
  ),
  createActivity: vi.fn((name: string, createdBy?: string) =>
    Promise.resolve({
      id: `activity-${Date.now()}`,
      name,
      isCustom: true,
      createdBy,
      createdAt: new Date().toISOString(),
    } as Activity)
  ),

  // Check-ins
  getActiveCheckIns: vi.fn().mockResolvedValue(mockCheckIns),
  checkIn: vi.fn().mockResolvedValue({
    action: 'checked-in',
    checkIn: mockCheckIns[0],
  }),
  undoCheckIn: vi.fn().mockResolvedValue(undefined),
  urlCheckIn: vi.fn().mockResolvedValue({
    action: 'checked-in',
    member: 'John Smith',
  }),

  // Events
  getEvents: vi.fn().mockResolvedValue(mockEvents),
  getActiveEvents: vi.fn().mockResolvedValue(mockEvents.filter(e => e.isActive)),
  getEvent: vi.fn((id: string) => Promise.resolve(mockEvents.find(e => e.id === id))),
  createEvent: vi.fn().mockResolvedValue(mockEvents[0]),
  endEvent: vi.fn().mockResolvedValue({ ...mockEvents[0], isActive: false }),
  addEventParticipant: vi.fn().mockResolvedValue({
    action: 'added',
    participant: {
      id: 'participant-1',
      eventId: 'event-1',
      memberId: 'member-1',
      memberName: 'John Smith',
      checkInTime: new Date().toISOString(),
      checkInMethod: 'kiosk',
      isOffsite: false,
      createdAt: new Date().toISOString(),
    },
  }),
  removeEventParticipant: vi.fn().mockResolvedValue(undefined),

  // Truck Checks
  getAppliances: vi.fn().mockResolvedValue([]),
  getAppliance: vi.fn().mockResolvedValue(null),
  createAppliance: vi.fn().mockResolvedValue({} as Appliance),
  updateAppliance: vi.fn().mockResolvedValue({} as Appliance),
  uploadAppliancePhoto: vi.fn().mockResolvedValue({ photoUrl: '/mock-photo.jpg' }),
  deleteAppliance: vi.fn().mockResolvedValue(undefined),
  getTemplate: vi.fn().mockResolvedValue({} as ChecklistTemplate),
  updateTemplate: vi.fn().mockResolvedValue({} as ChecklistTemplate),
  createCheckRun: vi.fn().mockResolvedValue({} as CheckRun),
  getCheckRun: vi.fn().mockResolvedValue({} as CheckRunWithResults),
  getCheckRuns: vi.fn().mockResolvedValue([]),
  completeCheckRun: vi.fn().mockResolvedValue({} as CheckRun),
  createCheckResult: vi.fn().mockResolvedValue({} as any),
  updateCheckResult: vi.fn().mockResolvedValue({} as any),
  deleteCheckResult: vi.fn().mockResolvedValue(undefined),
  uploadReferencePhoto: vi.fn().mockResolvedValue({ photoUrl: '/mock-photo.jpg' }),
  uploadResultPhoto: vi.fn().mockResolvedValue({ photoUrl: '/mock-photo.jpg' }),
  getStorageStatus: vi.fn().mockResolvedValue({ enabled: false, message: 'Mock storage' }),

  // Achievements
  getMemberAchievements: vi.fn().mockResolvedValue({
    memberId: 'member-1',
    totalSignIns: 0,
    totalHoursLogged: 0,
    totalEventsAttended: 0,
    totalTruckChecks: 0,
    earnedAchievements: [],
    totalEarned: 0,
  }),
  getRecentAchievements: vi.fn().mockResolvedValue({
    recentlyEarned: [],
    totalNew: 0,
  }),
  getAchievementProgress: vi.fn().mockResolvedValue({
    progress: [],
    activeStreaks: [],
  }),
})

// Default mock instance
export const mockApi = createMockApi()
