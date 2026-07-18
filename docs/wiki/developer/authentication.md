# Authentication Configuration Guide

## Overview

Station Manager supports optional authentication to control access to station
data and administrative features. When authentication is enabled, unauthenticated
users are restricted to viewing only the demo station with sample data.

The platform layers **two distinct concerns** that are often confused:

- **Authentication (who you are)** — JWT (signed with `JWT_SECRET`, password
  hashing via bcrypt) plus the optional brigade-access-token / kiosk path.
  Governed by `REQUIRE_AUTH` and `ENABLE_DATA_PROTECTION`.
- **Entitlements (what your plan can use)** — per-organization feature gating
  (`signInEnabled`, `truckCheckEnabled`, `reportsEnabled`, `aiEnabled`, plus the
  per-app flags `aarStudioEnabled`, `santaRunEnabled`, `fireBreakEnabled`).
  Governed by `ENABLE_ENTITLEMENTS` (default **on**).

A request must pass **both** layers for a gated feature: authentication proves
identity; entitlements check the identity's organization plan. They are
independent — being logged in does not grant a feature your plan lacks, and a
feature being on-plan does not bypass auth. See **Authentication vs Entitlements**
below.

### JWT claims and organization scoping

Admin/owner JWTs carry `{ id, username, role, organizationId }`. The
`organizationId` claim is the tenant boundary: middleware loads the org and reads
its entitlements from it. Sibling StationKit apps validate this **same** SM JWT
and read entitlements via `GET /api/auth/entitlements` — see
[`SUITE_TOKEN_VALIDATION.md`](suite-token-validation.md). Station Manager is the
suite's identity provider and licensing service.

## Configuration

### Environment Variables

Authentication is controlled via these environment variables in the backend
`.env` (or App Service settings):

```bash
# Enable authentication (recommended for production)
REQUIRE_AUTH=true

# JWT Secret (change this in production! defaults to a known dev secret)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# JWT Token Expiry (default: 24h)
JWT_EXPIRY=24h

# Seed admin/owner credentials (created on first startup)
DEFAULT_ADMIN_USERNAME=admin        # optional, defaults to "admin"
DEFAULT_ADMIN_PASSWORD=change-me     # set a strong value before production

# Data-endpoint protection (independent of REQUIRE_AUTH)
ENABLE_DATA_PROTECTION=true          # require JWT or brigade token on data routes

# Entitlement / plan gating (default ON; never disable in production)
ENABLE_ENTITLEMENTS=true
```

> `JWT_SECRET` falls back to a hard-coded dev secret if unset — this **must** be
> overridden in production, or all issued tokens are forgeable.

### Authentication Modes

#### Open Access Mode (REQUIRE_AUTH=false or not set)
- **Default behavior** for development
- All users can access all stations
- No login required
- Station management features are fully accessible

#### Authenticated Mode (REQUIRE_AUTH=true)
- **Recommended for production** deployments
- Unauthenticated users can only access the demo station
- Real brigade/station data requires authentication
- Station management features require login
- Brigade access tokens still work for kiosk mode

## Protected Endpoints

When `REQUIRE_AUTH=true`, the following endpoints require authentication:

### Station Endpoints
- `GET /api/stations` - List all stations
- `GET /api/stations/:id` - Get specific station
- `GET /api/stations/lookup` - Search stations
- `GET /api/stations/check-brigade/:brigadeId` - Check brigade existence
- `GET /api/stations/brigade/:brigadeId` - Get stations by brigade
- `POST /api/stations` - Create station
- `PUT /api/stations/:id` - Update station
- `DELETE /api/stations/:id` - Delete station

### Brigade Access Endpoints
- `GET /api/brigade-access/brigade/:brigadeId` - List brigade tokens
- `GET /api/brigade-access/station/:stationId` - List station tokens
- `GET /api/brigade-access/stats` - Token statistics
- `GET /api/brigade-access/all-tokens` - All tokens (admin)
- `POST /api/brigade-access/generate` - Generate new token
- `DELETE /api/brigade-access/:token` - Revoke token

### Public Endpoints (No Authentication Required)

These endpoints are always accessible without authentication:

- `GET /api/stations/demo` - Get demo station (public sample data)
- `POST /api/brigade-access/validate` - Validate kiosk token (for kiosk mode)
- `POST /api/auth/login` - Login endpoint
- `GET /api/auth/config` - Authentication configuration

### Demo Station Endpoints (Authentication Bypassed)

**IMPORTANT**: The demo station is publicly accessible even when `ENABLE_DATA_PROTECTION=true`.

When requests include the header `X-Station-Id: demo-station`, authentication is automatically bypassed for all data endpoints:
- `GET /api/members` - Demo members (with demo station ID)
- `GET /api/activities` - Demo activities (with demo station ID)
- `GET /api/events` - Demo events (with demo station ID)
- `GET /api/checkins` - Demo check-ins (with demo station ID)

This allows users to explore the application with sample data without requiring authentication. All other stations still require authentication when data protection is enabled.

## User Roles

The system supports these admin-user roles:

### Owner
- Created for the first user of an `Organization` (e.g. via signup).
- Everything Admin can do, **plus** organization/plan management and billing
  (Stripe Checkout/Portal — guarded by `requireOwner`).

### Admin
- Full operational access: create/edit/delete stations, generate brigade access
  tokens, manage station data.

### Viewer
- Read-only access to authenticated endpoints.
- Cannot create/edit/delete stations or generate brigade access tokens.

> Roles answer "who you are" (authentication). They do **not** decide which
> product features are available — that's the entitlement layer (plan). Use
> `requireOwner`/`requireAdmin` for role gates and `requireFeature(...)` for plan
> gates; never mix the two.

## Default Users

On first startup the backend seeds a default admin/owner user from
`DEFAULT_ADMIN_USERNAME` (default `admin`) and `DEFAULT_ADMIN_PASSWORD`.

```
Username: ${DEFAULT_ADMIN_USERNAME:-admin}
Password: ${DEFAULT_ADMIN_PASSWORD}
```

**⚠️ IMPORTANT**: Set a strong `DEFAULT_ADMIN_PASSWORD` before deploying to
production. Passwords are hashed with bcrypt before storage.

## Demo Station

The demo station (`demo-station`) is automatically seeded on server startup with sample data:
- **10 demo members** with varied ranks (Captain, Deputy Captain, Firefighters, etc.)
- **5 standard activities** (Training, Maintenance, Meeting, Brigade Training, District Training)
- **Demo brigade** hierarchy for realistic testing

Demo station characteristics:
- **Always publicly accessible** - No authentication required, even when `ENABLE_DATA_PROTECTION=true`
- **Isolated data** - Demo members, activities, and events are separate from real brigade data
- **Auto-seeded** - Data is automatically created on server startup for in-memory database
- **Reset capability** - Admin can reset demo data via the API
- **Testing & Demonstration** - Perfect for exploring features without affecting real data

This allows new users and evaluators to test the application immediately without needing credentials or setup.

## Kiosk Mode

Kiosk mode continues to work with authentication enabled:

1. Admin generates a brigade access token for a specific station
2. Token is embedded in a URL: `https://your-domain.com/signin?brigade=TOKEN`
3. Devices using this URL are locked to the specified station
4. Token validation happens via `POST /api/brigade-access/validate` (no auth required)

This allows kiosks to function without storing user credentials while still restricting access to a single station.

## Frontend Behavior

### Unauthenticated Users (when REQUIRE_AUTH=true)
- Automatically loads demo station only
- Cannot switch stations
- Cannot access station management features
- See "Authentication required" message on admin features
- Can still use sign-in, truck check, and reports features (with demo data)

### Authenticated Users
- Full access to all stations
- Can switch between stations
- Access to station management features
- Can generate brigade access tokens
- Normal application functionality

### Kiosk Mode Users
- Access via brigade token in URL
- Locked to specific station
- Cannot switch stations
- Full access to locked station's features

## Authentication vs Entitlements

These are separate gates and must both pass for a plan-gated feature.

| Concern | Question | Mechanism | Env flag |
|---|---|---|---|
| Authentication | Who are you? | JWT (bcrypt-hashed passwords) or brigade/kiosk token | `REQUIRE_AUTH`, `ENABLE_DATA_PROTECTION` |
| Entitlements | What can your plan use? | `Organization.entitlements` checked per feature | `ENABLE_ENTITLEMENTS` (default on) |

**Backend** — plan features are gated with `requireFeature('<flag>')`
(`middleware/entitlements.ts`) on the matching `/api/*` mount; admin/role routes
use `requireOwner`/`requireAdmin`. `requireFeature` is a **no-op** when
entitlements are disabled **or** when there is no organization context (kiosk /
demo / plain-JWT requests), preserving single-tenant/kiosk back-compat.

**Frontend** — `<FeatureRoute feature="...">` wraps plan-gated routes;
`<ProtectedRoute>` wraps auth-gated (admin) routes. `AuthContext.hasFeature()`
reads entitlements from `/api/auth/me`.

**Entitlement flags** (see `backend/src/types/index.ts`, `constants/plans.ts`):
`signInEnabled`, `truckCheckEnabled`, `reportsEnabled`, `aiEnabled`,
`aarStudioEnabled`, `santaRunEnabled`, `fireBreakEnabled`, plus limits
(`maxStations`, `maxDevices`, `aiIncludedSessions`).

**Sibling apps** — Fire Santa Run, Fire Break Calculator, and the AAR Studio
sub-app validate the SM JWT and gate themselves via `GET /api/auth/entitlements`.
See [`SUITE_TOKEN_VALIDATION.md`](suite-token-validation.md).

> **Never set `ENABLE_ENTITLEMENTS=false` in production** — it disables all
> plan/billing enforcement. It exists only for local single-tenant dev.

---

## Security Recommendations

### Production Deployment

1. **Enable Authentication**
   ```bash
   REQUIRE_AUTH=true
   ```

2. **Change JWT Secret**
   ```bash
   JWT_SECRET=$(openssl rand -base64 32)
   ```

3. **Set Secure Token Expiry**
   ```bash
   JWT_EXPIRY=8h  # Or appropriate value for your use case
   ```

4. **Change Default Admin Password**
   - Log in as admin
   - Navigate to user management
   - Update password immediately

5. **Use HTTPS**
   - Ensure your deployment uses HTTPS
   - JWT tokens are transmitted in Authorization headers
   - Never use HTTP in production with authentication enabled

6. **Regular Token Rotation**
   - Rotate JWT_SECRET periodically
   - Revoke old brigade access tokens when no longer needed

## Troubleshooting

### Users Can't Access Stations

**Symptom**: All users only see demo station

**Solution**: Check `REQUIRE_AUTH` environment variable:
- If you want open access: Remove `REQUIRE_AUTH` or set to `false`
- If authentication is intended: Users need to log in

### Token Expired Errors

**Symptom**: Users frequently logged out

**Solution**: Increase `JWT_EXPIRY` value:
```bash
JWT_EXPIRY=24h  # Or longer
```

### Kiosk Mode Not Working

**Symptom**: Kiosk URLs redirect to demo station

**Solution**: 
1. Verify brigade token is valid (not expired or revoked)
2. Check token validation endpoint is accessible (no auth required)
3. Ensure token is properly embedded in URL: `?brigade=TOKEN`

### Authentication Not Taking Effect

**Symptom**: Changes to `REQUIRE_AUTH` not working

**Solution**:
1. Restart backend server after changing `.env`
2. Clear browser localStorage (auth token caching)
3. Verify `.env` file is in backend root directory
4. Check backend logs for configuration confirmation

## Implementation Details

### Backend Middleware

The `optionalAuth` middleware is used on protected endpoints:

```typescript
import { optionalAuth } from '../middleware/auth';

router.get('/api/stations', optionalAuth, handler);
```

This middleware:
- Checks `REQUIRE_AUTH` environment variable
- If `true`, validates JWT token from Authorization header
- If `false` or not set, allows request through
- Returns 401 Unauthorized for invalid/missing tokens when required

### Frontend Context

The `StationContext` handles authentication state:

```typescript
const { isAuthenticated, requireAuth } = useAuth();

// Load demo-only for unauthenticated users when auth required
const stations = (!requireAuth || isAuthenticated) 
  ? await api.getStations()
  : [await api.getDemoStation()];
```

## Migration Guide

### Enabling Authentication on Existing Deployment

1. **Backup Data** (if using Azure Table Storage, this is automatic)

2. **Update Environment Variables**
   ```bash
   REQUIRE_AUTH=true
   JWT_SECRET=$(openssl rand -base64 32)
   ```

3. **Restart Backend**
   ```bash
   npm run start
   ```

4. **Test Demo Station Access**
   - Visit application without logging in
   - Verify only demo station is visible
   - Confirm station management shows "Authentication required"

5. **Test Authenticated Access**
   - Log in with admin credentials
   - Verify all stations are accessible
   - Confirm station management features work

6. **Update Kiosk Devices** (if applicable)
   - No changes needed - kiosk tokens continue to work
   - Verify each kiosk URL still functions correctly

## Related Documentation

- [Authentication Context Implementation](../../../frontend/src/contexts/AuthContext.tsx)
- [Auth Middleware Implementation](../../../backend/src/middleware/auth.ts)
- [Station Context Implementation](../../../frontend/src/contexts/StationContext.tsx)
- [API Documentation](api-reference.md)
- [Master Plan](../../MASTER_PLAN.md)
