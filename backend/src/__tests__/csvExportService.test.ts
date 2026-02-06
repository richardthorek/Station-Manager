/**
 * CSV Export Service Tests
 * 
 * Tests for CSV export functionality:
 * - Members export
 * - Check-ins export
 * - Events export
 * - Truck check results export
 * - Date range filtering
 * - Special character handling
 */

import {
  exportMembersToCSV,
  exportCheckInsToCSV,
  exportEventsToCSV,
  exportTruckCheckResultsToCSV,
  applyDateRangeFilter,
} from '../services/csvExportService';
import type { 
  Member, 
  CheckInWithDetails,
  EventWithParticipants,
  CheckRunWithResults,
} from '../types';

describe('CSV Export Service', () => {
  describe('exportMembersToCSV', () => {
    it('should export members to CSV format', () => {
      const members: Member[] = [
        {
          id: 'member-1',
          name: 'John Smith',
          qrCode: 'QR123',
          firstName: 'John',
          lastName: 'Smith',
          rank: 'Captain',
          memberNumber: '12345',
          stationId: 'station-1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'member-2',
          name: 'Jane Doe',
          qrCode: 'QR456',
          firstName: 'Jane',
          lastName: 'Doe',
          stationId: 'station-1',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      const csv = exportMembersToCSV(members);

      expect(csv).toContain('ID');
      expect(csv).toContain('Name');
      expect(csv).toContain('First Name');
      expect(csv).toContain('Last Name');
      expect(csv).toContain('Rank');
      expect(csv).toContain('QR Code');
      expect(csv).toContain('John Smith');
      expect(csv).toContain('Jane Doe');
      expect(csv).toContain('Captain');
      expect(csv).toContain('QR123');
    });

    it('should handle special characters in member names', () => {
      const members: Member[] = [
        {
          id: 'member-1',
          name: 'O\'Brien, John "Jack"',
          qrCode: 'QR123',
          firstName: 'John',
          lastName: 'O\'Brien',
          stationId: 'station-1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const csv = exportMembersToCSV(members);

      // CSV should handle quotes and commas properly
      expect(csv).toContain('O\'Brien');
      expect(csv).toBeDefined();
    });
  });

  describe('exportCheckInsToCSV', () => {
    it('should export check-ins with details to CSV format', () => {
      const checkIns: CheckInWithDetails[] = [
        {
          id: 'checkin-1',
          memberId: 'member-1',
          memberName: 'John Smith',
          activityId: 'activity-1',
          activityName: 'Training',
          activityTagColor: '#FF0000',
          stationId: 'station-1',
          checkInTime: new Date('2024-01-01T10:00:00Z'),
          checkInMethod: 'kiosk',
          location: 'Station',
          isOffsite: false,
          isActive: true,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      const csv = exportCheckInsToCSV(checkIns);

      expect(csv).toContain('Member Name');
      expect(csv).toContain('Activity Name');
      expect(csv).toContain('Check-In Time');
      expect(csv).toContain('John Smith');
      expect(csv).toContain('Training');
      expect(csv).toContain('kiosk');
    });
  });

  describe('exportEventsToCSV', () => {
    it('should export events with participants to CSV format', () => {
      const events: EventWithParticipants[] = [
        {
          id: 'event-1',
          activityId: 'activity-1',
          activityName: 'Fire Response',
          stationId: 'station-1',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T12:00:00Z'),
          isActive: false,
          createdBy: 'Captain',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T12:00:00Z'),
          participants: [
            {
              id: 'participant-1',
              eventId: 'event-1',
              memberId: 'member-1',
              memberName: 'John Smith',
              memberRank: 'Captain',
              stationId: 'station-1',
              checkInTime: new Date('2024-01-01T10:00:00Z'),
              checkInMethod: 'mobile',
              isOffsite: false,
              createdAt: new Date('2024-01-01T10:00:00Z'),
            },
          ],
          participantCount: 1,
        },
      ];

      const csv = exportEventsToCSV(events);

      expect(csv).toContain('Event ID');
      expect(csv).toContain('Activity Name');
      expect(csv).toContain('Participant Member Name');
      expect(csv).toContain('Fire Response');
      expect(csv).toContain('John Smith');
      expect(csv).toContain('Captain');
    });

    it('should handle events with no participants', () => {
      const events: EventWithParticipants[] = [
        {
          id: 'event-1',
          activityId: 'activity-1',
          activityName: 'Training',
          stationId: 'station-1',
          startTime: new Date('2024-01-01T10:00:00Z'),
          isActive: true,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          participants: [],
          participantCount: 0,
        },
      ];

      const csv = exportEventsToCSV(events);

      expect(csv).toContain('Training');
      expect(csv).toContain('0'); // participant count
    });
  });

  describe('exportTruckCheckResultsToCSV', () => {
    it('should export truck check results to CSV format', () => {
      const checkRuns: CheckRunWithResults[] = [
        {
          id: 'run-1',
          applianceId: 'appliance-1',
          applianceName: 'Tanker 1',
          stationId: 'station-1',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T11:00:00Z'),
          completedBy: 'member-1',
          completedByName: 'John Smith',
          contributors: ['John Smith', 'Jane Doe'],
          additionalComments: 'All checks passed',
          status: 'completed',
          hasIssues: false,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T11:00:00Z'),
          results: [
            {
              id: 'result-1',
              runId: 'run-1',
              itemId: 'item-1',
              itemName: 'Water Pump',
              itemDescription: 'Check water pump operation',
              stationId: 'station-1',
              status: 'done',
              comment: 'Working well',
              completedBy: 'John Smith',
              createdAt: new Date('2024-01-01T10:30:00Z'),
              updatedAt: new Date('2024-01-01T10:30:00Z'),
            },
          ],
        },
      ];

      const csv = exportTruckCheckResultsToCSV(checkRuns);

      expect(csv).toContain('Run ID');
      expect(csv).toContain('Appliance Name');
      expect(csv).toContain('Item Name');
      expect(csv).toContain('Result Status');
      expect(csv).toContain('Tanker 1');
      expect(csv).toContain('Water Pump');
      expect(csv).toContain('done');
    });

    it('should handle check runs with no results', () => {
      const checkRuns: CheckRunWithResults[] = [
        {
          id: 'run-1',
          applianceId: 'appliance-1',
          applianceName: 'Tanker 1',
          stationId: 'station-1',
          startTime: new Date('2024-01-01T10:00:00Z'),
          completedBy: 'member-1',
          completedByName: 'John Smith',
          contributors: ['John Smith'],
          status: 'in-progress',
          hasIssues: false,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          results: [],
        },
      ];

      const csv = exportTruckCheckResultsToCSV(checkRuns);

      expect(csv).toContain('Tanker 1');
      expect(csv).toContain('in-progress');
    });
  });

  describe('applyDateRangeFilter', () => {
    const items = [
      { id: 1, date: new Date('2024-01-01') },
      { id: 2, date: new Date('2024-01-15') },
      { id: 3, date: new Date('2024-02-01') },
      { id: 4, date: new Date('2024-02-15') },
      { id: 5, date: new Date('2024-03-01') },
    ];

    it('should filter items by start date', () => {
      const filtered = applyDateRangeFilter(
        items,
        'date',
        new Date('2024-01-15'),
        undefined
      );

      expect(filtered).toHaveLength(4);
      expect(filtered[0].id).toBe(2);
      expect(filtered[3].id).toBe(5);
    });

    it('should filter items by end date', () => {
      const filtered = applyDateRangeFilter(
        items,
        'date',
        undefined,
        new Date('2024-02-01')
      );

      expect(filtered).toHaveLength(3);
      expect(filtered[0].id).toBe(1);
      expect(filtered[2].id).toBe(3);
    });

    it('should filter items by both start and end date', () => {
      const filtered = applyDateRangeFilter(
        items,
        'date',
        new Date('2024-01-15'),
        new Date('2024-02-15')
      );

      expect(filtered).toHaveLength(3);
      expect(filtered[0].id).toBe(2);
      expect(filtered[2].id).toBe(4);
    });

    it('should return all items if no date range specified', () => {
      const filtered = applyDateRangeFilter(
        items,
        'date',
        undefined,
        undefined
      );

      expect(filtered).toHaveLength(5);
    });

    it('should handle end date at end of day', () => {
      const filtered = applyDateRangeFilter(
        items,
        'date',
        undefined,
        new Date('2024-02-01T00:00:00')
      );

      // Should include Feb 1st (entire day)
      expect(filtered).toHaveLength(3);
      expect(filtered.some(item => item.id === 3)).toBe(true);
    });
  });
});
