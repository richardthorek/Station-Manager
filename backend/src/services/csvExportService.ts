/**
 * CSV Export Service
 * 
 * Provides functionality to convert data to CSV format for export
 * Handles special characters, proper escaping, and consistent formatting
 */

import { Parser } from 'json2csv';
import type { 
  Member, 
  CheckIn, 
  CheckInWithDetails,
  Event, 
  EventWithParticipants,
  CheckRun,
  CheckRunWithResults,
  CheckResult
} from '../types';

/**
 * Export members to CSV format
 * @param members Array of members to export
 * @returns CSV string
 */
export function exportMembersToCSV(members: Member[]): string {
  const fields = [
    { label: 'ID', value: 'id' },
    { label: 'Name', value: 'name' },
    { label: 'First Name', value: 'firstName' },
    { label: 'Last Name', value: 'lastName' },
    { label: 'Rank', value: 'rank' },
    { label: 'Member Number', value: 'memberNumber' },
    { label: 'QR Code', value: 'qrCode' },
    { label: 'Station ID', value: 'stationId' },
    { label: 'Created At', value: 'createdAt' },
    { label: 'Updated At', value: 'updatedAt' },
  ];

  const parser = new Parser({ fields });
  return parser.parse(members);
}

/**
 * Export check-ins to CSV format
 * @param checkIns Array of check-ins to export
 * @returns CSV string
 */
export function exportCheckInsToCSV(checkIns: (CheckIn | CheckInWithDetails)[]): string {
  const fields = [
    { label: 'ID', value: 'id' },
    { label: 'Member ID', value: 'memberId' },
    { label: 'Member Name', value: 'memberName' },
    { label: 'Activity ID', value: 'activityId' },
    { label: 'Activity Name', value: 'activityName' },
    { label: 'Station ID', value: 'stationId' },
    { label: 'Check-In Time', value: 'checkInTime' },
    { label: 'Check-In Method', value: 'checkInMethod' },
    { label: 'Location', value: 'location' },
    { label: 'Is Offsite', value: 'isOffsite' },
    { label: 'Is Active', value: 'isActive' },
    { label: 'Created At', value: 'createdAt' },
  ];

  const parser = new Parser({ fields });
  return parser.parse(checkIns);
}

/**
 * Export events with participants to CSV format
 * Creates a flattened structure with one row per participant per event
 * @param events Array of events with participants to export
 * @returns CSV string
 */
export function exportEventsToCSV(events: EventWithParticipants[]): string {
  // Flatten events - one row per participant
  const flattenedData: any[] = [];
  
  events.forEach(event => {
    if (event.participants.length === 0) {
      // Event with no participants
      flattenedData.push({
        eventId: event.id,
        activityName: event.activityName,
        activityId: event.activityId,
        stationId: event.stationId || '',
        startTime: event.startTime,
        endTime: event.endTime || '',
        isActive: event.isActive,
        createdBy: event.createdBy || '',
        participantCount: 0,
        participantId: '',
        participantMemberId: '',
        participantMemberName: '',
        participantRank: '',
        participantCheckInTime: '',
        participantCheckInMethod: '',
        participantLocation: '',
        participantIsOffsite: '',
      });
    } else {
      event.participants.forEach(participant => {
        flattenedData.push({
          eventId: event.id,
          activityName: event.activityName,
          activityId: event.activityId,
          stationId: event.stationId || '',
          startTime: event.startTime,
          endTime: event.endTime || '',
          isActive: event.isActive,
          createdBy: event.createdBy || '',
          participantCount: event.participantCount,
          participantId: participant.id,
          participantMemberId: participant.memberId,
          participantMemberName: participant.memberName,
          participantRank: participant.memberRank || '',
          participantCheckInTime: participant.checkInTime,
          participantCheckInMethod: participant.checkInMethod,
          participantLocation: participant.location || '',
          participantIsOffsite: participant.isOffsite,
        });
      });
    }
  });

  const fields = [
    { label: 'Event ID', value: 'eventId' },
    { label: 'Activity Name', value: 'activityName' },
    { label: 'Activity ID', value: 'activityId' },
    { label: 'Station ID', value: 'stationId' },
    { label: 'Start Time', value: 'startTime' },
    { label: 'End Time', value: 'endTime' },
    { label: 'Is Active', value: 'isActive' },
    { label: 'Created By', value: 'createdBy' },
    { label: 'Participant Count', value: 'participantCount' },
    { label: 'Participant ID', value: 'participantId' },
    { label: 'Participant Member ID', value: 'participantMemberId' },
    { label: 'Participant Member Name', value: 'participantMemberName' },
    { label: 'Participant Rank', value: 'participantRank' },
    { label: 'Participant Check-In Time', value: 'participantCheckInTime' },
    { label: 'Participant Check-In Method', value: 'participantCheckInMethod' },
    { label: 'Participant Location', value: 'participantLocation' },
    { label: 'Participant Is Offsite', value: 'participantIsOffsite' },
  ];

  const parser = new Parser({ fields });
  return parser.parse(flattenedData);
}

/**
 * Export truck check results to CSV format
 * Creates a flattened structure with one row per check result
 * @param checkRuns Array of check runs with results to export
 * @returns CSV string
 */
export function exportTruckCheckResultsToCSV(checkRuns: CheckRunWithResults[]): string {
  // Flatten check runs - one row per check result
  const flattenedData: any[] = [];
  
  checkRuns.forEach(run => {
    if (run.results.length === 0) {
      // Check run with no results
      flattenedData.push({
        runId: run.id,
        applianceId: run.applianceId,
        applianceName: run.applianceName,
        stationId: run.stationId || '',
        startTime: run.startTime,
        endTime: run.endTime || '',
        completedBy: run.completedBy,
        completedByName: run.completedByName || '',
        contributors: run.contributors.join(', '),
        additionalComments: run.additionalComments || '',
        runStatus: run.status,
        hasIssues: run.hasIssues,
        resultId: '',
        itemId: '',
        itemName: '',
        itemDescription: '',
        resultStatus: '',
        resultComment: '',
        resultPhotoUrl: '',
        resultCompletedBy: '',
      });
    } else {
      run.results.forEach(result => {
        flattenedData.push({
          runId: run.id,
          applianceId: run.applianceId,
          applianceName: run.applianceName,
          stationId: run.stationId || '',
          startTime: run.startTime,
          endTime: run.endTime || '',
          completedBy: run.completedBy,
          completedByName: run.completedByName || '',
          contributors: run.contributors.join(', '),
          additionalComments: run.additionalComments || '',
          runStatus: run.status,
          hasIssues: run.hasIssues,
          resultId: result.id,
          itemId: result.itemId,
          itemName: result.itemName,
          itemDescription: result.itemDescription,
          resultStatus: result.status,
          resultComment: result.comment || '',
          resultPhotoUrl: result.photoUrl || '',
          resultCompletedBy: result.completedBy || '',
        });
      });
    }
  });

  const fields = [
    { label: 'Run ID', value: 'runId' },
    { label: 'Appliance ID', value: 'applianceId' },
    { label: 'Appliance Name', value: 'applianceName' },
    { label: 'Station ID', value: 'stationId' },
    { label: 'Start Time', value: 'startTime' },
    { label: 'End Time', value: 'endTime' },
    { label: 'Completed By', value: 'completedBy' },
    { label: 'Completed By Name', value: 'completedByName' },
    { label: 'Contributors', value: 'contributors' },
    { label: 'Additional Comments', value: 'additionalComments' },
    { label: 'Run Status', value: 'runStatus' },
    { label: 'Has Issues', value: 'hasIssues' },
    { label: 'Result ID', value: 'resultId' },
    { label: 'Item ID', value: 'itemId' },
    { label: 'Item Name', value: 'itemName' },
    { label: 'Item Description', value: 'itemDescription' },
    { label: 'Result Status', value: 'resultStatus' },
    { label: 'Result Comment', value: 'resultComment' },
    { label: 'Result Photo URL', value: 'resultPhotoUrl' },
    { label: 'Result Completed By', value: 'resultCompletedBy' },
  ];

  const parser = new Parser({ fields });
  return parser.parse(flattenedData);
}

/**
 * Apply date range filter to items with a date field
 * @param items Array of items with a date field
 * @param dateField Name of the date field to filter on
 * @param startDate Optional start date (inclusive)
 * @param endDate Optional end date (inclusive)
 * @returns Filtered array
 */
export function applyDateRangeFilter<T extends Record<string, any>>(
  items: T[],
  dateField: keyof T,
  startDate?: Date,
  endDate?: Date
): T[] {
  return items.filter(item => {
    const itemDate = item[dateField] as any;
    
    // Check if the field is a valid Date
    if (typeof itemDate !== 'object' || itemDate === null || !(itemDate instanceof Date) || isNaN(itemDate.getTime())) {
      return true; // Skip items without valid date
    }

    if (startDate && (itemDate as Date).getTime() < startDate.getTime()) {
      return false;
    }

    if (endDate) {
      // Set end date to end of day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if ((itemDate as Date).getTime() > endOfDay.getTime()) {
        return false;
      }
    }

    return true;
  });
}
