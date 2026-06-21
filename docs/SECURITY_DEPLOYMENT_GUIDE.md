# Security Deployment Guide

## RFS Station Manager - Authentication & API Protection

This guide explains how to deploy the RFS Station Manager with the new authentication and API protection features.

---

## Overview

The Station Manager now includes two independent security layers:

1. **Admin Authentication** - Protects administrative operations (station management, brigade access)
2. **API Endpoint Protection** - Protects data endpoints from unauthorized access

Both features are **optional** and **backward compatible** - they can be enabled independently via environment variables.

Beyond these auth layers, the platform now carries **SaaS, billing, and AI**
features that introduce additional secrets that must be configured securely (see
the Secrets Checklist below).

---

## Secrets Checklist (current env vars)

Configure these as App Service settings or, preferably, references to **Azure Key
Vault**. Never commit them. Rotate them periodically and per-environment.

### Must be set securely in production

| Secret | Purpose | Notes |
|---|---|---|
| `JWT_SECRET` | Signs all admin/owner JWTs | Falls back to a known dev secret if unset — **always** override. Rotating it invalidates all issued tokens. |
| `DEFAULT_ADMIN_PASSWORD` | Seed admin/owner password | bcrypt-hashed at rest; set a strong value before first boot. |
| `AZURE_STORAGE_CONNECTION_STRING` | Table + Blob Storage access | Long-lived account key; treat as a high-value secret. |

### Required only when the corresponding feature is enabled

| Secret | Feature | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe billing | Live/secret API key. |
| `STRIPE_WEBHOOK_SECRET` | Stripe billing | Verifies `POST /api/billing/webhook` signatures; the webhook handler consumes a **raw** request body. |
| `AZURE_OPENAI_KEY` | AI gateway | Server-side Azure OpenAI key (never exposed to the browser). |
| `AZURE_SPEECH_KEY` | AI speech | Used to vend short-lived Speech tokens; the long-lived key stays server-side. |

### Non-secret but security-relevant config

- `FRONTEND_URLS` — exact allowed CORS origins. A wrong value silently falls back
  to `localhost` and blocks everything (the origin callback **denies without
  throwing**, see the seam note below).
- `ENABLE_ENTITLEMENTS` — default on; **never** `false` in production (removes
  all plan/billing enforcement).
- `REQUIRE_AUTH`, `ENABLE_DATA_PROTECTION` — the two auth layers documented below.
- Stripe price IDs (`STRIPE_PRICE_*`), `STRIPE_METERED_USAGE_ENABLED`,
  `STRIPE_AI_METER_EVENT`, `APP_URL` — billing configuration (not secrets, but
  environment-specific).

> **Storage tip:** Prefer Key Vault references over plaintext App Service
> settings for everything in the first two tables. Rotate `JWT_SECRET`,
> `AZURE_STORAGE_CONNECTION_STRING`, and the Stripe/OpenAI/Speech keys on a
> schedule.

---

## Multi-app integration seams (security-relevant)

This single App Service serves the React SPA at `/`, AAR Studio at `/aar`, and
the API at `/api` — all from **one origin**. Two seams matter for security:

- **Scoped `/aar` CSP override.** The main app keeps Helmet's strict global CSP.
  A *looser* CSP is applied only on `/aar` (it needs jsDelivr scripts and Azure
  OpenAI/Speech `connect-src`, plus mic/display-capture). Keep AAR-only hosts in
  the `/aar` override, **not** the global policy — widening the global CSP weakens
  the main app. Note `connect-src` also governs `fetch()` made by the service
  worker.
- **CORS denies without throwing.** A single `allowedOriginsList` (from
  `FRONTEND_URLS`) is shared by Express and Socket.io. The origin callback returns
  `callback(null, false)` for disallowed origins rather than throwing — throwing
  would 500 every same-origin asset request. Keep `FRONTEND_URLS` accurate.

See `CLAUDE.md` ("Multi-app structure & integration seams") for the full list of
co-dependent places (service-worker denylist, SPA-fallback regex, CSP, CORS,
static mounts, deploy packaging).

---

## Security Layers

### Layer 1: Admin Authentication

**Purpose**: Protect administrative functions from unauthorized modification

**Protected Operations:**
- Station CRUD (create, update, delete stations)
- Brigade access token management
- System configuration changes

**Configuration:**
```bash
# Enable admin authentication
REQUIRE_AUTH=true

# Set admin credentials
DEFAULT_ADMIN_USERNAME=admin  # Optional, defaults to "admin"
DEFAULT_ADMIN_PASSWORD=YourSecurePassword123  # Required

# JWT configuration (optional)
JWT_SECRET=your-production-secret-key  # Defaults to dev secret (CHANGE IN PRODUCTION!)
JWT_EXPIRY=24h  # Token expiration time
```

**When to Enable:**
- You want to restrict who can add/delete stations
- You want to control brigade access token generation
- You're deploying to a production environment

**When to Keep Disabled:**
- Testing/development environment
- Single-user setup with physical security
- You want maximum ease of use

---

### Layer 2: API Endpoint Protection

**Purpose**: Prevent unauthorized access to member data, events, and check-ins

**Protected Endpoints:**
- `GET /api/members` - Member list and details
- `GET /api/events` - Event list and details
- `GET /api/checkins` - Check-in records
- `GET /api/activities` - Activity list

**Configuration:**
```bash
# Enable data endpoint protection
ENABLE_DATA_PROTECTION=true  # Default: false
```

**Authentication Methods:**
1. **Admin JWT Token** - Full access to all data
   ```bash
   curl -H "Authorization: ****** \
        http://your-server/api/members
   ```

2. **Brigade Access Token** - Brigade/station-scoped access
   ```bash
   # Via header
   curl -H "X-Brigade-Token: your-brigade-token-uuid" \
        http://your-server/api/members?stationId=your-station

   # Via query parameter
   curl "http://your-server/api/members?brigadeToken=your-uuid&stationId=your-station"
   ```

**When to Enable:**
- You're concerned about API enumeration
- You want to prevent data scraping
- You're deploying to public internet
- You need to audit data access

**When to Keep Disabled:**
- Internal network deployment
- Testing/development
- You trust all network users
- You need backward compatibility

---

## Deployment Scenarios

### Scenario 1: Open Development Environment

**Use Case**: Local development, testing, demo mode

**Configuration:**
```bash
REQUIRE_AUTH=false
ENABLE_DATA_PROTECTION=false
```

**Behavior:**
- No authentication required for any operation
- Full backward compatibility
- Maximum ease of use

---

### Scenario 2: Protected Admin, Open Data

**Use Case**: Community deployment with trusted network, but want to protect configuration

**Configuration:**
```bash
REQUIRE_AUTH=true
DEFAULT_ADMIN_PASSWORD=SecurePassword123
ENABLE_DATA_PROTECTION=false
```

**Behavior:**
- Admin functions require login
- Data endpoints remain open
- Kiosk mode works without tokens
- Good for internal networks

---

### Scenario 3: Fully Secured Deployment

**Use Case**: Production deployment on public internet

**Configuration:**
```bash
# Admin protection
REQUIRE_AUTH=true
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=VerySecurePassword123!
JWT_SECRET=random-production-secret-64-chars-minimum
JWT_EXPIRY=24h

# Data protection
ENABLE_DATA_PROTECTION=true
```

**Behavior:**
- Admin functions require JWT login
- Data endpoints require JWT OR brigade token
- Kiosk devices must use brigade access tokens
- All access logged for audit

**Setup Steps:**
1. Enable both security layers
2. Generate brigade access tokens for each kiosk
3. Configure kiosks with their tokens
4. Test access with tokens
5. Monitor logs for unauthorized attempts

---

### Scenario 4: Gradual Security Rollout

**Use Case**: Migrate existing deployment to secured mode

**Phase 1: Enable Admin Auth Only**
```bash
REQUIRE_AUTH=true
DEFAULT_ADMIN_PASSWORD=SecurePassword
ENABLE_DATA_PROTECTION=false
```
- Test admin login works
- Verify kiosks still function
- Train admins on new login

**Phase 2: Enable Data Protection**
```bash
REQUIRE_AUTH=true
DEFAULT_ADMIN_PASSWORD=SecurePassword
ENABLE_DATA_PROTECTION=true
```
- Generate brigade tokens
- Deploy tokens to kiosks
- Test kiosk access
- Monitor unauthorized attempts
- Revoke/regenerate tokens if needed

---

## Kiosk Mode Configuration

### Generating Brigade Access Tokens

Brigade access tokens allow kiosk devices to access station-specific data without admin privileges.

**Using Admin UI** (when REQUIRE_AUTH=true):
1. Log in as admin
2. Navigate to "Brigade Access" page
3. Click "Generate Token"
4. Provide description (e.g., "Main Station Kiosk")
5. Set optional expiration date
6. Copy token UUID

**Using API** (with admin JWT):
```bash
curl -X POST http://your-server/api/brigade-access/generate \
  -H "Authorization: ****** \
  -H "Content-Type: application/json" \
  -d '{
    "brigadeId": "your-brigade-id",
    "stationId": "your-station-id",
    "description": "Main Kiosk",
    "expiresInDays": 365
  }'
```

### Configuring Kiosk Devices

**Option 1: Environment Variable**
```bash
# On kiosk device
BRIGADE_TOKEN=your-uuid-here
```

**Option 2: URL Parameter**
```
http://your-server/signin?brigadeToken=your-uuid
```

**Option 3: Frontend Configuration**
Update `frontend/.env`:
```
VITE_BRIGADE_TOKEN=your-uuid-here
```

---

## Token Management

### Admin JWT Tokens

**Lifespan**: Configurable via `JWT_EXPIRY` (default: 24 hours)

**Storage**: 
- Frontend: localStorage
- Included automatically in all API requests

**Renewal**: 
- Users must log in again after expiration
- Future: Implement refresh tokens

**Revocation**:
- Change `JWT_SECRET` to invalidate all tokens
- No per-token revocation currently

### Brigade Access Tokens

**Lifespan**: Optional expiration (set during generation)

**Storage**:
- Backend: In-memory (current) or Table Storage (future)
- Frontend: Environment variable or query parameter

**Renewal**:
- Generate new token before expiration
- Update kiosk configuration with new token

**Revocation**:
```bash
curl -X DELETE http://your-server/api/brigade-access/:token \
  -H "Authorization: ******
```

---

## Monitoring & Logging

### Unauthorized Access Attempts

All unauthorized access attempts are logged:

```json
{
  "level": "warn",
  "message": "Unauthorized API access attempt",
  "path": "/api/members",
  "method": "GET",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2026-02-08T03:00:00.000Z"
}
```

### Scope Violations

When a token doesn't have sufficient scope:

```json
{
  "level": "warn",
  "message": "Insufficient scope for API access",
  "path": "/api/members",
  "credentialType": "brigade-token",
  "requestedScope": "station",
  "brigadeId": "abc123",
  "stationId": "xyz789"
}
```

### Log Analysis

**Monitor for:**
- Repeated unauthorized attempts from same IP
- Access to non-existent endpoints (enumeration)
- Scope violations (misconfigured tokens)
- High volume from single source (possible scraping)

**Tools:**
- Azure Application Insights (if configured)
- grep/awk for log analysis
- Log aggregation service (Splunk, ELK, etc.)

---

## Security Best Practices

### Production Deployment Checklist

- [ ] Set unique `JWT_SECRET` (64+ random characters) — never use the dev default
- [ ] Use strong `DEFAULT_ADMIN_PASSWORD` (12+ characters, mixed case, numbers, symbols)
- [ ] Set `AZURE_STORAGE_CONNECTION_STRING` (and keep it out of source control)
- [ ] If billing is enabled: set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- [ ] If AI is enabled: set `AZURE_OPENAI_KEY` (and `AZURE_SPEECH_KEY` for speech)
- [ ] Keep `ENABLE_ENTITLEMENTS` on (default) — never `false` in production
- [ ] Set `FRONTEND_URLS` to the exact prod origin(s)
- [ ] Prefer Azure Key Vault references for all of the above
- [ ] Enable both `REQUIRE_AUTH` and `ENABLE_DATA_PROTECTION`
- [ ] Use HTTPS/TLS for all connections
- [ ] Generate brigade tokens with descriptions
- [ ] Set token expiration dates (1 year recommended)
- [ ] Store tokens securely on kiosk devices
- [ ] Monitor logs for unauthorized access
- [ ] Regular token/secret rotation (annually)
- [ ] Backup token list before regeneration
- [ ] Test kiosk access after token changes

### Environment Variable Security

**DO:**
- Store in `.env` file (not committed to Git)
- Use Azure Key Vault or similar for production
- Rotate secrets regularly
- Use different secrets per environment

**DON'T:**
- Commit `.env` to version control
- Use default/example secrets in production
- Share secrets via email/chat
- Reuse secrets across environments

---

## Troubleshooting

### Admin Can't Log In

**Symptoms**: Login page returns "Invalid username or password"

**Check:**
1. `REQUIRE_AUTH=true` is set
2. `DEFAULT_ADMIN_PASSWORD` is set
3. Password matches what you're entering
4. Backend logs show admin user initialized
5. No typos in environment variables

**Solution:**
```bash
# Verify backend logs
grep "Admin user database initialized" backend.log

# Check environment
echo $REQUIRE_AUTH
echo $DEFAULT_ADMIN_PASSWORD
```

### Kiosk Gets 401 Unauthorized

**Symptoms**: Kiosk can't access member data after enabling protection

**Check:**
1. `ENABLE_DATA_PROTECTION=true` is set
2. Kiosk has brigade token configured
3. Token is valid (not expired/revoked)
4. Token matches station being accessed

**Solution:**
```bash
# Test token validity
curl -X POST http://your-server/api/brigade-access/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "your-token-uuid"}'

# Should return token details if valid
```

### 403 Forbidden with Valid Token

**Symptoms**: Brigade token works but returns 403

**Check:**
1. Token's stationId matches requested station
2. X-Station-Id header or stationId query param provided
3. Token not expired

**Solution:**
```bash
# Get token details
curl /api/brigade-access/tokens?brigadeId=your-brigade

# Ensure stationId matches
curl -H "X-Brigade-Token: uuid" \
     -H "X-Station-Id: matching-station-id" \
     /api/members
```

### All Requests Get 401 After Enabling

**Symptoms**: Everything broken after enabling protection

**Quick Fix:**
```bash
# Temporarily disable to restore service
ENABLE_DATA_PROTECTION=false

# Then gradually enable with testing
```

---

## Migration Guide

### From Unprotected to Protected

**Step 1: Backup**
```bash
# Backup your database
# Export current configuration
```

**Step 2: Enable Admin Auth**
```bash
REQUIRE_AUTH=true
DEFAULT_ADMIN_PASSWORD=TempPassword123
```

**Step 3: Test Admin Login**
- Access UI and log in
- Verify admin functions work
- Test logout/re-login

**Step 4: Generate Brigade Tokens**
- One token per kiosk device
- Record tokens securely
- Add descriptions for tracking

**Step 5: Configure Kiosks**
- Add tokens to kiosk configs
- Test kiosk access (protection still off)
- Verify data loads correctly

**Step 6: Enable Data Protection**
```bash
ENABLE_DATA_PROTECTION=true
```

**Step 7: Validate**
- Test kiosk access with tokens
- Test admin access with JWT
- Check logs for issues
- Verify no unauthorized access

**Step 8: Monitor**
- Watch logs for 24 hours
- Address any issues
- Document any custom configurations

---

## Support

For issues or questions:
1. Check logs for error messages
2. Verify environment variables
3. Test with protection temporarily disabled
4. Review this guide's troubleshooting section
5. Check GitHub issues for similar problems

---

## Summary

**Default State (Backward Compatible):**
- No authentication required
- All endpoints open
- Works like before

**Recommended Production Setup:**
```bash
REQUIRE_AUTH=true
DEFAULT_ADMIN_PASSWORD=SecurePassword123!
JWT_SECRET=random-64-char-secret
ENABLE_DATA_PROTECTION=true
```

**Remember:**
- Both features are optional and independent
- Enable gradually to minimize disruption
- Test thoroughly before full deployment
- Monitor logs after enabling
- Keep tokens secure and rotated
