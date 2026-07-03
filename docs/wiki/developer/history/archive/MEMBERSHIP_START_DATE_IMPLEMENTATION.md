# Membership Start Date Feature Implementation

## Overview
This document describes the implementation of the `membershipStartDate` field, which allows the system to track when a member joined the brigade separately from when they were added to the system (`createdAt`).

## Problem Statement
As noted in PR comment by @richardthorek:
> "when a member became a member of the brigade is different to the date they were added to this system. Let me import the members including their actual membership start date, or manually override it for those that are created manually or already exist."

## Solution
Added a new optional `membershipStartDate` field to the `Member` interface across frontend and backend, with support for:
1. Manual entry when creating/updating members
2. CSV import with membership start date
3. Automatic fallback to `createdAt` when not provided

## Changes Made

### 1. Type Definitions

#### Frontend (`frontend/src/types/index.ts`)
```typescript
export interface Member {
  id: string;
  name: string;
  qrCode: string;
  memberNumber?: string;
  rank?: string | null;
  firstName?: string;
  lastName?: string;
  membershipStartDate?: string | null;  // NEW: When member joined the brigade
  lastSignIn?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

#### Backend (`backend/src/types/index.ts`)
```typescript
export interface Member {
  id: string;
  name: string;
  qrCode: string;
  memberNumber?: string;
  rank?: string | null;
  firstName?: string;
  lastName?: string;
  membershipStartDate?: Date | null;  // NEW: When member joined the brigade
  stationId?: string;
  lastSignIn?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Database Services

#### In-Memory Database (`backend/src/services/database.ts`)
- Updated `createMember()` to accept `membershipStartDate` in details parameter
- Updated `updateMember()` to accept optional `membershipStartDate` parameter

#### Table Storage Database (`backend/src/services/tableStorageDatabase.ts`)
- Updated `createMember()` to store `membershipStartDate` as ISO string
- Updated `updateMember()` to update `membershipStartDate` when provided
- Updated `entityToMember()` to parse `membershipStartDate` from ISO string to Date

#### Database Factory Interface (`backend/src/services/dbFactory.ts`)
- Updated `IDatabase.createMember()` signature to include `membershipStartDate` in details
- Updated `IDatabase.updateMember()` signature to include `membershipStartDate` parameter

### 3. Backend Routes (`backend/src/routes/members.ts`)

#### POST /api/members (Create Member)
- Accepts optional `membershipStartDate` in request body
- Parses ISO date string to Date object
- Passes to `db.createMember()` with other details

#### PUT /api/members/:id (Update Member)
- Accepts optional `membershipStartDate` in request body
- Parses ISO date string to Date object
- Passes to `db.updateMember()` as 4th parameter

#### POST /api/members/import (CSV Import Preview)
- Accepts "Membership Start Date", "membershipStartDate", or "MembershipStartDate" column
- Validates date format (ISO 8601 format like YYYY-MM-DD)
- Includes in validation results for preview

#### POST /api/members/import/execute (CSV Import Execute)
- Parses `membershipStartDate` from imported data
- Passes to `db.createMember()` for each member

### 4. Frontend Profile Page (`frontend/src/features/profile/UserProfilePage.tsx`)

Updated `calculateMembershipDuration()` function:
```typescript
const calculateMembershipDuration = () => {
  if (!member) return '';
  // Use membershipStartDate if available, otherwise fall back to createdAt
  const startDate = new Date(member.membershipStartDate || member.createdAt);
  const now = new Date();
  // ... calculation logic
};
```

## Usage Examples

### Creating a Member with Membership Start Date (API)
```bash
POST /api/members
Content-Type: application/json

{
  "name": "John Smith",
  "firstName": "John",
  "lastName": "Smith",
  "rank": "Captain",
  "membershipStartDate": "2020-01-15"
}
```

### Updating Membership Start Date (API)
```bash
PUT /api/members/{memberId}
Content-Type: application/json

{
  "name": "John Smith",
  "rank": "Captain",
  "membershipStartDate": "2020-01-15"
}
```

### CSV Import Format
```csv
First Name,Last Name,Rank,Membership Start Date
John,Smith,Captain,2020-01-15
Jane,Doe,Lieutenant,2019-03-20
```

Supported column name variations:
- "Membership Start Date"
- "membershipStartDate"
- "MembershipStartDate"

### Behavior
- **Display**: Profile page shows membership duration based on `membershipStartDate` if available, otherwise uses `createdAt`
- **Optional**: Field is optional for both creation and updates
- **Null Value**: Can be explicitly set to `null` to clear an existing membership start date
- **Validation**: CSV import validates date format and shows errors for invalid dates
- **Backward Compatibility**: Existing members without `membershipStartDate` continue to work, showing duration since `createdAt`

## Database Schema Changes

### Table Storage
New field in Members table:
- **membershipStartDate**: String (ISO 8601 format) - Optional

### In-Memory Database
New field in Member objects:
- **membershipStartDate**: Date | null - Optional

## Testing Recommendations

1. **Create Member**: Test creating members with and without `membershipStartDate`
2. **Update Member**: Test updating `membershipStartDate` for existing members
3. **CSV Import**: Test importing members with `membershipStartDate` column
4. **Profile Display**: Verify profile page shows correct membership duration
5. **Backward Compatibility**: Verify existing members without `membershipStartDate` still work
6. **Date Validation**: Test invalid date formats in CSV import

## Future Enhancements (Not Implemented)

1. **UI Form Field**: Add date picker in member creation/edit forms to manually set membership start date
2. **Bulk Update**: Add ability to bulk update membership start dates for existing members
3. **Date Format Localization**: Support multiple date format inputs (currently requires ISO 8601)
4. **Anniversary Notifications**: Use membership start date for anniversary celebrations/badges
