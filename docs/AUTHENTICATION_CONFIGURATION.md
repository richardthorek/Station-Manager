# Authentication Configuration Guide

## Overview

Station Manager supports optional authentication to control access to station data and administrative features. When authentication is enabled, unauthenticated users are restricted to viewing only the demo station with sample data.

## Configuration

### Environment Variables

Authentication is controlled via the `REQUIRE_AUTH` environment variable in the backend `.env` file:

```bash
# Enable authentication (recommended for production)
REQUIRE_AUTH=true

# JWT Secret (change this in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# JWT Token Expiry (default: 24h)
JWT_EXPIRY=24h
```

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

## User Roles

The system supports two user roles:

### Admin
- Full access to all features
- Can create/edit/delete stations
- Can generate brigade access tokens
- Can manage users (future feature)

### Viewer
- Read-only access to authenticated endpoints
- Cannot create/edit/delete stations
- Cannot generate brigade access tokens

## Default Users

For development and initial setup, a default admin user is available:

```
Username: admin
Password: admin123
```

**⚠️ IMPORTANT**: Change the default admin password before deploying to production!

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

- [Authentication Context Implementation](../frontend/src/contexts/AuthContext.tsx)
- [Auth Middleware Implementation](../backend/src/middleware/auth.ts)
- [Station Context Implementation](../frontend/src/contexts/StationContext.tsx)
- [API Documentation](./API_DOCUMENTATION.md)
- [Master Plan](./MASTER_PLAN.md)
