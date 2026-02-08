# Kiosk Mode Setup and Brigade Access Token Management

**Version:** 1.0  
**Last Updated:** February 2026  
**Purpose:** Guide for administrators to configure kiosk mode and manage brigade access tokens

---

## Table of Contents

1. [Overview](#overview)
2. [What is Kiosk Mode?](#what-is-kiosk-mode)
3. [Security Model](#security-model)
4. [Token Management](#token-management)
5. [Setting Up a Kiosk Device](#setting-up-a-kiosk-device)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Overview

Kiosk mode enables you to lock station iPads or tablets to a specific brigade/station, preventing users from accessing or viewing data from other brigades. This is essential for multi-brigade deployments where data separation is critical.

**Key Benefits:**
- ✅ Strict data isolation between brigades
- ✅ Prevents accidental cross-brigade data access
- ✅ Secure, unguessable access tokens
- ✅ Simple URL-based activation
- ✅ No user training required

---

## What is Kiosk Mode?

Kiosk mode is a special operating mode for devices that should be permanently locked to a single brigade/station. When active:

1. **Station Selector is Disabled:** Users cannot switch stations
2. **Visual Indicator:** A "Kiosk Mode" badge and lock icon are displayed
3. **Token-Based Access:** Access is controlled via a unique, unguessable URL token
4. **Session-Based:** Kiosk mode persists for the browser session

### When to Use Kiosk Mode

| Use Case | Kiosk Mode? | Reason |
|----------|-------------|--------|
| **Station kiosk iPad (replacing paper book)** | ✅ Yes | Device is shared and should only access one brigade's data |
| **Station captain's personal device** | ❌ No | Officer may need to view multiple stations |
| **Roaming officers** | ❌ No | Need flexibility to switch between stations |
| **Admin devices** | ❌ No | Require full system access |

---

## Security Model

### Token Structure

Brigade access tokens are **UUID v4** (Universally Unique Identifiers):
- **Length:** 36 characters (128-bit random)
- **Format:** `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- **Example:** `a3d5e8f2-1234-4abc-8def-9876543210ab`

### Security Properties

1. **Unguessable:** 128-bit randomness = 2^128 possible values
2. **Cryptographically Secure:** Generated using Node.js `crypto.randomUUID()`
3. **No Sequential Patterns:** Each token is completely random
4. **Validated Server-Side:** Token must exist in database to grant access
5. **Optional Expiration:** Tokens can expire for rotation policies

### Threat Protection

| Threat | Protection |
|--------|------------|
| **Unauthorized Brigade Access** | Token required to access brigade data |
| **Token Guessing** | Statistically impossible (2^128 combinations) |
| **Token Sharing** | Each device gets unique token with description |
| **Token Leakage** | Tokens can be revoked instantly |
| **Expired Access** | Optional expiration dates enforce rotation |

---

## Token Management

### Generating a Token

**Via API:**
```bash
curl -X POST https://stationmanager.com/api/brigade-access/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brigadeId": "my-brigade-id",
    "stationId": "my-station-id",
    "description": "Main Kiosk iPad - Station Entrance",
    "expiresInDays": 365
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "a3d5e8f2-1234-4abc-8def-9876543210ab",
  "brigadeId": "my-brigade-id",
  "stationId": "my-station-id",
  "description": "Main Kiosk iPad - Station Entrance",
  "createdAt": "2026-02-06T00:00:00.000Z",
  "expiresAt": "2027-02-06T00:00:00.000Z",
  "kioskUrl": "https://stationmanager.com/signin?brigade=a3d5e8f2-1234-4abc-8def-9876543210ab"
}
```

### Validating a Token

Check if a token is still valid:

```bash
curl -X POST https://stationmanager.com/api/brigade-access/validate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "a3d5e8f2-1234-4abc-8def-9876543210ab"
  }'
```

### Revoking a Token

Immediately revoke access:

```bash
curl -X DELETE https://stationmanager.com/api/brigade-access/a3d5e8f2-1234-4abc-8def-9876543210ab
```

### Listing Tokens

**By Brigade:**
```bash
curl https://stationmanager.com/api/brigade-access/brigade/my-brigade-id
```

**By Station:**
```bash
curl https://stationmanager.com/api/brigade-access/station/my-station-id
```

---

## Setting Up a Kiosk Device

### Step 1: Generate Token

1. Generate a brigade access token using the API (see above)
2. Copy the `kioskUrl` from the response
3. Store the token securely (e.g., password manager)

### Step 2: Configure Device

**Option A: Set as Browser Homepage**
1. Open Safari/Chrome on the iPad
2. Go to Settings → Safari/Chrome → Homepage
3. Set homepage to the kiosk URL
4. Enable "Show homepage button"

**Option B: Create Home Screen Bookmark**
1. Open Safari on the iPad
2. Navigate to the kiosk URL
3. Tap the Share button
4. Select "Add to Home Screen"
5. Name it appropriately (e.g., "Sign In - Main Station")

**Option C: Use Guided Access (iOS)**
1. Navigate to the kiosk URL
2. Triple-click the Home button to enable Guided Access
3. Device is now locked to the app

### Step 3: Verify Kiosk Mode

Kiosk mode is active when you see:
- 🔒 Lock icon in the station selector
- "Kiosk Mode" badge displayed
- Station selector button is disabled (grey)
- Cannot open the station dropdown

### Step 4: Test Data Isolation

1. Sign in a member on the kiosk device
2. Open a personal device (not in kiosk mode)
3. Switch to a different station
4. Verify the kiosk member does NOT appear in the other station

---

## API Reference

### POST /api/brigade-access/generate

Generate a new kiosk access token.

**Request Body:**
```json
{
  "brigadeId": "string (required)",
  "stationId": "string (required)",
  "description": "string (optional)",
  "expiresInDays": "number (optional, 1-3650)"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "token": "uuid",
  "brigadeId": "string",
  "stationId": "string",
  "description": "string",
  "createdAt": "ISO 8601 date",
  "expiresAt": "ISO 8601 date (if expiration set)",
  "kioskUrl": "https://... full URL with token"
}
```

### POST /api/brigade-access/validate

Validate a token.

**Request Body:**
```json
{
  "token": "uuid (required)"
}
```

**Response:** 200 OK (valid) or 404 Not Found (invalid)

### DELETE /api/brigade-access/:token

Revoke a token immediately.

**Response:** 200 OK or 404 Not Found

### GET /api/brigade-access/brigade/:brigadeId

List all active tokens for a brigade.

**Response:** 200 OK
```json
{
  "brigadeId": "string",
  "tokens": [
    {
      "token": "uuid",
      "stationId": "string",
      "description": "string",
      "createdAt": "ISO 8601 date",
      "expiresAt": "ISO 8601 date or null"
    }
  ],
  "count": "number"
}
```

### GET /api/brigade-access/station/:stationId

List all active tokens for a station.

### GET /api/brigade-access/stats

Get token statistics.

**Response:**
```json
{
  "totalActiveTokens": "number",
  "timestamp": "ISO 8601 date"
}
```

---

## Troubleshooting

### Token Not Working

**Problem:** Kiosk URL shows "Invalid or expired brigade access token"

**Solutions:**
1. Check if token was revoked: `POST /api/brigade-access/validate`
2. Check if token expired (if expiration was set)
3. Verify token is correctly copied (no extra spaces)
4. Generate a new token and update device

### Station Selector Not Locked

**Problem:** Users can still switch stations in kiosk mode

**Symptoms:**
- No 🔒 lock icon displayed
- No "Kiosk Mode" badge
- Dropdown is clickable

**Solutions:**
1. Verify URL contains `?brigade=<token>` query parameter
2. Check browser console for errors
3. Clear browser cache and reload
4. Ensure kiosk URL was used (not regular URL)

### Cross-Brigade Data Appearing

**Problem:** Members from Brigade A appearing in Brigade B

**This should not happen if:**
- Brigade B device is in kiosk mode with correct token
- Backend middleware is properly configured
- Token is valid and not expired

**Investigation:**
1. Check if device is actually in kiosk mode (look for lock icon)
2. Verify token belongs to correct brigade/station
3. Check backend logs for middleware errors
4. Test with a fresh browser session

### Token Expired

**Problem:** Token stopped working after some time

**Solution:**
Tokens with expiration dates automatically expire. Generate a new token and update devices.

---

## Best Practices

### Token Management

1. **Use Descriptive Names:**
   ```json
   {
     "description": "Main Kiosk iPad - Station Entrance - iPad #1"
   }
   ```

2. **Set Expiration Dates:**
   - Annual rotation: `"expiresInDays": 365`
   - Temporary access: `"expiresInDays": 90`

3. **Track Tokens:**
   - Maintain a spreadsheet of device-to-token mappings
   - Include device location, serial number, and creation date

4. **Revoke Unused Tokens:**
   - Revoke tokens when devices are decommissioned
   - Audit tokens quarterly: `GET /api/brigade-access/stats`

### Security

1. **Protect Token URLs:**
   - Don't share kiosk URLs publicly
   - Don't post on social media or public forums
   - Store in secure password manager

2. **Rotate Tokens Annually:**
   - Set 12-month expiration on all tokens
   - Schedule annual rotation reminder

3. **Use One Token Per Device:**
   - Each kiosk should have its own unique token
   - Easier to track and revoke if device is lost/stolen

4. **Monitor Access:**
   - Regularly check brigade token lists
   - Look for unexpected tokens
   - Revoke unknown tokens immediately

### Device Configuration

1. **iOS Guided Access:**
   - Lock device to Station Manager app
   - Prevents home button/app switching
   - Settings → Accessibility → Guided Access

2. **Kiosk Browser Mode:**
   - Use dedicated kiosk browser apps
   - Disable URL bar editing
   - Auto-restart on crash

3. **Physical Security:**
   - Mount iPads securely (wall mount or stand)
   - Use lockable enclosures
   - Cable lock for portable tablets

---

## Example Workflow

### Setting Up 3 Kiosks for Main Station

1. **Generate tokens:**
```bash
# Kiosk 1 - Station Entrance
curl -X POST .../generate -d '{"brigadeId":"main","stationId":"main-1","description":"Entrance iPad"}'

# Kiosk 2 - Vehicle Bay
curl -X POST .../generate -d '{"brigadeId":"main","stationId":"main-1","description":"Vehicle Bay iPad"}'

# Kiosk 3 - Training Room
curl -X POST .../generate -d '{"brigadeId":"main","stationId":"main-1","description":"Training Room iPad"}'
```

2. **Configure devices:**
   - iPad 1: Add entrance kiosk URL to home screen
   - iPad 2: Add vehicle bay kiosk URL to home screen
   - iPad 3: Add training room kiosk URL to home screen

3. **Label devices:**
   - Physical label on each iPad with location
   - QR code with token for easy re-setup

4. **Document:**
   - Record serial numbers
   - Store tokens in password manager
   - Set calendar reminder for annual rotation

---

## Support

For issues or questions:
- **GitHub:** Open an issue in the repository
- **Email:** Contact your system administrator
- **Emergency:** If data breach suspected, revoke all tokens immediately

---

**Security Notice:** Brigade access tokens grant access to sensitive station data. Treat them like passwords. Never share tokens publicly or commit them to source control.
