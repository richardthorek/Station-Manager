# Event Management Guide

This guide explains the event-based activity management system in RFS Station Manager.

## Overview

The event management system allows multiple discrete activity instances to run concurrently. Each event has its own lifecycle, participants, and timeline, making it easy to track different activities happening at the station simultaneously.

## Key Concepts

### Events
An **Event** is a discrete instance of an activity type (e.g., Training, Maintenance, Meeting). Each event:
- Has a unique start time and optional end time
- Maintains its own list of participants
- Can be active (ongoing) or ended (completed)
- Is displayed in the Event Log on the left side of the UI

### Event Lifecycle
1. **Creation**: Start a new event by selecting an activity type
2. **Active**: Participants can sign in/out while the event is active
3. **Ended**: Event is marked as complete with an end time; no more sign-ins allowed

### Multi-Event Support
- Multiple events can be active simultaneously
- Switch between active events by clicking them in the Event Log
- Participants can be signed into different events at the same time
- Each event tracks its participants independently

## Using the Event System

### Starting a New Event
1. Click the **"+ Start New Event"** button in the toolbar
2. Select an activity type from the modal (Training, Maintenance, Meeting, or custom)
3. Click **"Start Event"**
4. The new event becomes the current/selected event automatically

### Signing In Participants
1. Select an active event from the Event Log (if not already selected)
2. Click a member name from the Sign In panel on the right
3. The member is added to the current event's participant list
4. A checkmark (✓) appears next to signed-in members

### Switching Between Events
1. Click on any active event card in the Event Log
2. The middle panel updates to show that event's details
3. The Sign In panel highlights members signed into the selected event
4. New sign-ins will be added to the currently selected event

### Viewing Event Details
1. Click the expand arrow (▶) on an event card
2. View all participants with their check-in times and methods
3. See the "End Event" button for active events
4. Click collapse arrow (▼) to minimize the details

### Ending an Event
1. Expand the event card or view it as the current event
2. Click the **"End Event"** button
3. The event is marked as ended and moved to the Past Events section
4. Participants can no longer be added to ended events

### Event Log Structure
The Event Log is organized into two sections:
- **Active Events**: Currently ongoing events, newest first
- **Past Events**: Completed events, newest first

### Pagination and Performance
- Initial load shows the 50 most recent events
- Scroll down to automatically load older events
- Each event loads with its participant list
- Efficient database queries prevent performance issues with large event histories

## API Endpoints

### Events

#### GET `/api/events`
Get events with pagination.

**Query Parameters:**
- `limit` (optional, default 50, max 100): Number of events to return
- `offset` (optional, default 0): Number of events to skip

**Response:**
```json
[
  {
    "id": "uuid",
    "activityId": "uuid",
    "activityName": "Training",
    "startTime": "2024-11-15T12:44:00.000Z",
    "endTime": null,
    "isActive": true,
    "createdBy": "system",
    "createdAt": "2024-11-15T12:44:00.000Z",
    "updatedAt": "2024-11-15T12:44:00.000Z",
    "participants": [
      {
        "id": "uuid",
        "eventId": "uuid",
        "memberId": "uuid",
        "memberName": "John Smith",
        "checkInTime": "2024-11-15T12:44:30.000Z",
        "checkInMethod": "mobile",
        "isOffsite": false,
        "createdAt": "2024-11-15T12:44:30.000Z"
      }
    ],
    "participantCount": 1
  }
]
```

#### GET `/api/events/active`
Get all currently active (not ended) events.

#### GET `/api/events/:eventId`
Get a specific event with all participants.

#### POST `/api/events`
Create a new event.

**Body:**
```json
{
  "activityId": "uuid",
  "createdBy": "username"
}
```

#### PUT `/api/events/:eventId/end`
End an event (sets end time and marks as inactive).

#### POST `/api/events/:eventId/participants`
Add a participant to an event (or remove if already signed in).

**Body:**
```json
{
  "memberId": "uuid",
  "method": "mobile",
  "location": "Station",
  "isOffsite": false
}
```

**Response:**
```json
{
  "action": "added",  // or "removed"
  "participant": { /* participant object */ }
}
```

#### DELETE `/api/events/:eventId/participants/:participantId`
Remove a participant from an event.

## Real-Time Updates

The system uses Socket.io for real-time synchronization:

### Events Emitted
- `event-created`: When a new event is started
- `event-ended`: When an event is ended
- `participant-change`: When a participant is added/removed

### Events Received
- `event-update`: Triggers reload of event data across all connected clients

## Best Practices

### For Station Staff
1. Start an event before participants begin signing in
2. Use descriptive activity types that match your station's needs
3. End events when activities are complete to keep the log clean
4. Review past events to track participation patterns

### For System Administrators
1. Create custom activity types that match your station's operations
2. Monitor the event log for unusual patterns
3. Use pagination to manage large event histories efficiently
4. Consider archiving very old events if performance degrades

## Migration from Old System

The new event-based system replaces the single "active activity" approach:

**Old System:**
- One activity active at a time
- All check-ins associated with current activity
- Changing activity didn't create discrete records

**New System:**
- Multiple concurrent events
- Each event is a discrete record with its own timeline
- Participants can be in multiple events simultaneously
- Complete history of all activities with participant lists

**Compatibility:**
- The old activity and check-in endpoints still exist but are deprecated
- Use the new event-based endpoints for new development
- Both systems share the same activity types

## Troubleshooting

### Issue: Events not loading
- Check browser console for errors
- Verify backend server is running
- Check network connectivity

### Issue: Participants not showing up
- Ensure the correct event is selected
- Refresh the page to sync with server
- Check that the event is still active

### Issue: Can't sign in to event
- Verify an active event is selected
- Check that member exists in the system
- Ensure the event hasn't been ended

### Issue: Real-time updates not working
- Check Socket.io connection status (indicator in header)
- Verify firewall allows WebSocket connections
- Try refreshing the page

## Future Enhancements

Potential improvements to the event system:
- Event templates for common activity patterns
- Bulk sign-in/sign-out operations
- Event reports and analytics
- Export event data to CSV
- Event notifications and reminders
- Integration with external calendar systems
- Photo/note attachments to events
- Automatic event scheduling
