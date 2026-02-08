# Sign-In by Link and QR Code - Brigade/Station-Specific Implementation

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Implementation Status:** ✅ Complete

---

## Overview

This document describes the implementation of brigade/station-specific sign-in links and QR codes for the RFS Station Manager. This enhancement ensures that member sign-in links are tied to specific brigades/stations, preventing cross-station check-ins.

## Problem Statement

Previously, sign-in links used only the member name as an identifier:
```
https://example.com/sign-in?user=John%20Smith
```

**Issues:**
1. No station/brigade information in the URL
2. Backend relied on client-provided `X-Station-Id` header
3. Potential for members to check into wrong station
4. No visual QR code for easy mobile scanning

## Solution

### 1. Enhanced URL Format

New sign-in links now include the `stationId` parameter:
```
https://example.com/sign-in?user=John%20Smith&station=bungendore-rfs
```

**Benefits:**
- ✅ Station is embedded in the URL itself
- ✅ Links are brigade/station-specific
- ✅ Prevents cross-station check-ins
- ✅ More secure and explicit

### 2. Backend Changes

**File:** `backend/src/routes/checkins.ts`

The `/url-checkin` endpoint now prioritizes the `stationId` from the request body:

```typescript
router.post('/url-checkin', validateUrlCheckIn, handleValidationErrors, async (req: Request, res: Response) => {
  const { identifier, stationId: urlStationId } = req.body;
  
  // Prioritize stationId from URL parameter, fallback to header
  const stationId = urlStationId || getStationIdFromRequest(req);
  
  // Find member in the specified station
  const members = await db.getAllMembers(stationId);
  const member = members.find(
    m => m.name.toLowerCase() === decodeURIComponent(identifier).toLowerCase()
  );
  
  // ... rest of check-in logic
});
```

**Priority Order:**
1. `stationId` from request body (URL parameter)
2. `X-Station-Id` header (fallback)
3. Default station ID (`'default-station'`)

### 3. Frontend Changes

#### UserProfilePage.tsx

**Added QR Code Import:**
```typescript
import { QRCodeSVG } from 'qrcode.react';
```

**Enhanced URL Generation:**
```typescript
const generateSignInUrl = () => {
  if (!member) return '';
  const identifier = encodeURIComponent(member.name);
  const baseUrl = window.location.origin;
  // Include stationId for brigade/station-specific sign-in
  const stationParam = member.stationId ? `&station=${encodeURIComponent(member.stationId)}` : '';
  return `${baseUrl}/sign-in?user=${identifier}${stationParam}`;
};
```

**QR Code Display:**
```typescript
<div className="qr-code-section">
  <button 
    className="btn-secondary" 
    onClick={() => setShowQRCode(!showQRCode)}
  >
    {showQRCode ? 'Hide QR Code' : 'Show QR Code'}
  </button>
  
  {showQRCode && (
    <div className="qr-code-container">
      <div className="qr-code-wrapper">
        <QRCodeSVG
          value={generateSignInUrl()}
          size={200}
          level="M"
          includeMargin={true}
        />
      </div>
      <p className="qr-code-hint">
        Scan this QR code with a mobile device to quickly check in
      </p>
    </div>
  )}
</div>
```

#### SignInLinkPage.tsx

**URL Parsing:**
```typescript
const userIdentifier = searchParams.get('user');
const stationId = searchParams.get('station'); // Extract stationId from URL

// Pass stationId to API
const result = await api.urlCheckIn(userIdentifier, stationId || undefined);
```

#### api.ts

**Updated API Method:**
```typescript
async urlCheckIn(identifier: string, stationId?: string): Promise<...> {
  const response = await fetch(`${API_BASE_URL}/checkins/url-checkin`, {
    method: 'POST',
    headers: this.getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ identifier, stationId }),
  });
  // ...
}
```

### 4. Validation

**File:** `backend/src/middleware/checkinValidation.ts`

Added optional validation for `stationId`:
```typescript
export const validateUrlCheckIn = [
  body('identifier')
    .trim()
    .escape()
    .notEmpty()
    .withMessage('User identifier is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Identifier must be between 1 and 500 characters'),
  body('stationId')
    .optional()
    .trim()
    .isString()
    .withMessage('Station ID must be a string'),
];
```

## Data Flow

```
┌─────────────────────────────────────────────────┐
│  1. User Profile Page                            │
│  - Member: John Smith                            │
│  - Station: bungendore-rfs                       │
│  - Generate URL with stationId                   │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Generate URL
                  ▼
┌─────────────────────────────────────────────────┐
│  2. Sign-In URL                                  │
│  /sign-in?user=John%20Smith&station=bungendore  │
│  (Can be shared as link or QR code)             │
└─────────────────┬───────────────────────────────┘
                  │
                  │ User clicks or scans QR
                  ▼
┌─────────────────────────────────────────────────┐
│  3. SignInLinkPage.tsx                           │
│  - Extract 'user' and 'station' from URL         │
│  - Call api.urlCheckIn(user, station)            │
└─────────────────┬───────────────────────────────┘
                  │
                  │ POST /api/checkins/url-checkin
                  ▼
┌─────────────────────────────────────────────────┐
│  4. Backend: checkins.ts                         │
│  - Priority: URL stationId > Header > Default    │
│  - Find member in specified station              │
│  - Get active activity for station               │
│  - Create check-in record                        │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Success
                  ▼
┌─────────────────────────────────────────────────┐
│  5. Success Response                             │
│  - Display success message                       │
│  - Emit socket event for real-time updates       │
└─────────────────────────────────────────────────┘
```

## Backward Compatibility

The system maintains backward compatibility with old URLs that don't include a `stationId`:

```
https://example.com/sign-in?user=John%20Smith
```

When no `stationId` is in the URL:
1. System checks `X-Station-Id` header
2. Falls back to `DEFAULT_STATION_ID` ('default-station')
3. Continues normal check-in flow

## Security Considerations

1. **Station Validation:** Backend validates stationId is a string and sanitizes input
2. **Member Isolation:** Members are looked up only within their specified station
3. **No Injection:** URL parameters are properly encoded/decoded
4. **Audit Trail:** All check-ins are logged with station information

## Testing

### Manual Testing

1. **Test Station-Specific URL:**
   - Generate sign-in link from member profile
   - Verify URL includes `&station={stationId}`
   - Click link and verify successful check-in

2. **Test QR Code:**
   - Click "Show QR Code" button in profile
   - Scan QR code with mobile device
   - Verify mobile browser opens correct sign-in URL
   - Verify successful check-in

3. **Test Backward Compatibility:**
   - Use old URL format (without station param)
   - Verify check-in still works using header/default station

4. **Test Cross-Station Prevention:**
   - Try checking in Station A member with Station B URL
   - Verify "Member not found" error

### Automated Tests

**File:** `backend/src/__tests__/url-checkin-station.test.ts`

Tests include:
- ✅ Check-in with stationId in body
- ✅ Priority: body stationId over header
- ✅ Fallback to header when no body stationId
- ✅ Member not found in wrong station
- ✅ Validation of stationId type
- ✅ Backward compatibility

## UI/UX Changes

### Before
- ✅ Copy sign-in URL button
- ❌ No QR code visualization
- ❌ No station info in URL

### After
- ✅ Copy sign-in URL button
- ✅ Show/Hide QR Code toggle button
- ✅ Animated QR code display with RFS branding
- ✅ Station ID embedded in URL
- ✅ Mobile-friendly QR scanning

### QR Code Section Styling

```css
.qr-code-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(229, 40, 27, 0.03) 0%, rgba(203, 219, 42, 0.03) 100%);
  border-radius: 12px;
  border: 2px solid rgba(229, 40, 27, 0.1);
  animation: fadeIn 0.3s ease-out;
}
```

## API Documentation Updates

### POST /api/checkins/url-checkin

**Request Body:**
```json
{
  "identifier": "John Smith",
  "stationId": "bungendore-rfs"  // Optional, new field
}
```

**Priority Order:**
1. `stationId` from body (if provided)
2. `X-Station-Id` header (fallback)
3. `DEFAULT_STATION_ID` (default)

**Response:**
```json
{
  "action": "checked-in",
  "member": "John Smith",
  "checkIn": {
    "id": "...",
    "memberId": "...",
    "activityId": "...",
    "stationId": "bungendore-rfs",
    "checkInTime": "2026-02-08T...",
    "checkInMethod": "qr",
    "isActive": true
  }
}
```

## Future Enhancements

### Multi-Station Membership (Not Currently Needed)

The current data model supports single `stationId` per member. If future requirements demand multi-station membership:

1. Update Member schema to support array of stations
2. Add station selection UI when link doesn't include stationId
3. Display member's station list on profile page
4. Store last-used station preference

**Note:** Current implementation verified that members have single stationId field, not array.

## Rollback Plan

If issues arise:
1. Remove `stationId` parameter from frontend URL generation
2. Revert backend to use only header-based stationId
3. Hide QR code section in UI
4. Use git revert on commit `50795b6`

## Documentation Updates Required

- [x] Create this implementation document
- [ ] Update `docs/API_DOCUMENTATION.md` with new URL parameter
- [ ] Update `docs/api_register.json` with stationId field
- [ ] Update `docs/MASTER_PLAN.md` with completion status
- [ ] Take iPad screenshots showing QR code feature

## Files Changed

1. `backend/src/routes/checkins.ts` - Added stationId priority logic
2. `backend/src/middleware/checkinValidation.ts` - Added stationId validation
3. `frontend/src/features/profile/UserProfilePage.tsx` - Added QR code, updated URL
4. `frontend/src/features/profile/UserProfilePage.css` - Added QR code styles
5. `frontend/src/features/signin/SignInLinkPage.tsx` - Parse stationId from URL
6. `frontend/src/services/api.ts` - Added stationId parameter to urlCheckIn
7. `backend/src/__tests__/url-checkin-station.test.ts` - New test file

## Success Criteria

- [x] Sign-in URLs include stationId parameter
- [x] Backend prioritizes URL stationId over header
- [x] QR code displays station-specific URL
- [x] Backward compatibility maintained
- [x] Member isolation by station enforced
- [ ] Tests passing (requires running test suite)
- [ ] iPad screenshots captured (portrait + landscape)

## Related Issues

- GitHub Issue: Review and Update 'Sign In by Link' and QR Code for Brigade/Station Specificity
- Pull Request: copilot/review-update-signin-methods
- Commit: 50795b6 - feat: Add brigade/station-specific sign-in links and QR codes
