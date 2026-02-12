# Demo Mode Behavior - Authentication and Data Access

**Date**: 2026-02-12  
**Status**: ✅ Implemented and Tested  
**Related Issue**: Fix demo members not loading (CSP/API 401 errors)

## Overview

This document describes the authentication behavior for demo mode in the Station Manager application, particularly how demo station endpoints bypass authentication requirements while maintaining security for production stations.

## Demo Station Configuration

### Station Identification
- **Demo Station ID**: `demo-station`
- **Demo Brigade ID**: `demo-brigade`
- **Header**: Requests must include `X-Station-Id: demo-station`

### Auto-Seeded Demo Data

The demo station is automatically populated with sample data on server startup:

**Members (10)**:
- Axel Thorne (Captain)
- Maris Vale (Senior Deputy Captain)
- Soraya Finch (Deputy Captain)
- Devon Quill (Firefighter)
- Kira Embers (Firefighter)
- Lucien Hale (Deputy Captain)
- Rhea Calder (Firefighter)
- Rio Penn (Firefighter)
- Aria Lark (Probationary Firefighter)
- Milo Sable (Firefighter)

**Activities (5)**:
- Training
- Maintenance
- Meeting
- Brigade Training
- District Training

## Authentication Behavior

### When Data Protection is Disabled
- **Environment Variable**: `ENABLE_DATA_PROTECTION` not set or `false`
- **Behavior**: All stations (including demo) are accessible without authentication
- **Use Case**: Development and testing environments

### When Data Protection is Enabled
- **Environment Variable**: `ENABLE_DATA_PROTECTION=true`
- **Demo Station**: Publicly accessible (authentication bypassed)
- **All Other Stations**: Require valid JWT token or Brigade Access Token
- **Use Case**: Production deployments with security enabled

## API Endpoint Access

### Demo Station Endpoints (Public When Using Demo Station ID)

The following endpoints bypass authentication when `X-Station-Id: demo-station` is provided:

```
GET /api/members          - Returns demo members
GET /api/activities       - Returns demo activities
GET /api/events           - Returns demo events
GET /api/checkins         - Returns demo check-ins
POST /api/members         - Create demo member
POST /api/activities      - Create demo activity
POST /api/events          - Create demo event
```

### Always Public Endpoints

These endpoints are always accessible without authentication:

```
GET /api/stations/demo    - Get demo station information
POST /api/auth/login      - Authentication endpoint
GET /api/auth/config      - Authentication configuration
POST /api/brigade-access/validate - Validate kiosk token
```

### Protected Endpoints

When `ENABLE_DATA_PROTECTION=true`, these require authentication for non-demo stations:

```
GET /api/stations         - List all stations
GET /api/stations/:id     - Get specific station
GET /api/members          - Get members (non-demo station)
GET /api/activities       - Get activities (non-demo station)
GET /api/events           - Get events (non-demo station)
... and all other data endpoints
```

## Implementation Details

### Backend Components

1. **flexibleAuth Middleware** (`backend/src/middleware/flexibleAuth.ts`)
   - Checks for demo station ID in request headers
   - Bypasses authentication for demo station
   - Enforces authentication for all other stations

2. **Demo Station Seeder** (`backend/src/services/demoStationSeeder.ts`)
   - Auto-seeds demo data on server startup
   - Idempotent - only seeds if data doesn't exist
   - Concurrent seeding protection

3. **Server Initialization** (`backend/src/index.ts`)
   - Calls demo seeder after database initialization
   - Ensures demo data is available immediately

### Data Isolation

Demo station data is completely isolated from production data:
- Members, activities, and events are station-scoped
- Database queries filter by `stationId`
- Demo station users cannot access other stations' data
- Other stations cannot access demo station data

## Frontend Behavior

### Unauthenticated Users

When `ENABLE_DATA_PROTECTION=true`:
- Automatically directed to demo station
- Can explore all features with sample data
- Cannot switch to other stations
- See "Authentication required" for admin features

### Authenticated Users

When logged in:
- Full access to all stations
- Can switch between stations
- Access to station management features
- Demo station remains accessible for testing

## Security Considerations

### Why Demo Station is Public

1. **User Onboarding**: New users can explore features without registration
2. **Demonstration**: Allows showcasing the application to potential users
3. **Testing**: Provides a safe environment for testing without affecting real data
4. **Documentation**: Live examples for training and documentation

### Security Measures

1. **Data Isolation**: Demo data is separate from production data
2. **Read-Only Intent**: While technically writable, demo station is for exploration
3. **Reset Capability**: Admin can reset demo data anytime
4. **No Sensitive Data**: Demo data contains only fictional information
5. **Station-Scoped**: All queries filter by station ID

### Not a Security Risk

The demo station bypass does NOT compromise security because:
- It only affects the `demo-station` ID
- Real brigade data requires authentication
- Station data is completely isolated
- No production data is exposed
- It's intentional and documented behavior

## Testing

### Backend Tests

Test suite: `backend/src/__tests__/demoStationAuth.test.ts`

Tests verify:
1. ✅ Demo station members endpoint returns 200 OK
2. ✅ Demo station activities endpoint returns 200 OK
3. ✅ Demo station events endpoint returns 200 OK
4. ✅ Data filtering correctly isolates demo station data

All 4 tests passing.

### Manual Testing

Verified with curl commands:
```bash
# Demo station access (returns data)
curl -H "X-Station-Id: demo-station" http://localhost:3000/api/members

# Other station access (returns 401 when ENABLE_DATA_PROTECTION=true)
curl -H "X-Station-Id: other-station" http://localhost:3000/api/members
```

## Configuration

### Environment Variables

```bash
# Enable data protection (recommended for production)
ENABLE_DATA_PROTECTION=true

# Disable data protection (development only)
ENABLE_DATA_PROTECTION=false
# or omit the variable entirely
```

### Deployment Checklist

- [ ] Set `ENABLE_DATA_PROTECTION=true` in production
- [ ] Configure JWT secret for authentication
- [ ] Set up default admin credentials
- [ ] Verify demo station is accessible without auth
- [ ] Verify other stations require auth
- [ ] Test station data isolation

## Troubleshooting

### Demo Members Not Loading

**Symptom**: Demo station returns empty arrays  
**Cause**: Demo data not seeded  
**Solution**: Restart server - seeding happens automatically on startup

### 401 Unauthorized for Demo Station

**Symptom**: Demo station returns 401  
**Cause**: Missing `X-Station-Id` header  
**Solution**: Include `X-Station-Id: demo-station` in request headers

### All Stations Require Auth in Development

**Symptom**: Local development requires authentication  
**Cause**: `ENABLE_DATA_PROTECTION=true` in environment  
**Solution**: Remove or set `ENABLE_DATA_PROTECTION=false` for development

## Related Documentation

- [Authentication Configuration Guide](../AUTHENTICATION_CONFIGURATION.md)
- [Master Plan](../MASTER_PLAN.md)
- [API Documentation](../API_DOCUMENTATION.md)
- [As-Built Documentation](../AS_BUILT.md)

## Change History

- **2026-02-12**: Initial implementation of demo station authentication bypass
  - Added bypass logic to flexibleAuth middleware
  - Created auto-seeding service
  - Added comprehensive tests
  - Updated documentation
