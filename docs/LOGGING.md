# Logging Guide - RFS Station Manager

## Overview

The RFS Station Manager uses **Winston** for structured logging across the backend. This provides consistent, structured logs with proper log levels, request tracing, and integration-ready output for monitoring systems like Azure Log Analytics.

## Quick Start

### Basic Logging

```typescript
import { logger } from './services/logger';

// Simple log messages
logger.info('Server started successfully');
logger.warn('Configuration missing, using defaults');
logger.error('Failed to connect to database', { error: err });
logger.debug('Processing request', { userId: '123' });
```

### Logging with Context

Always include relevant context in your logs:

```typescript
// In route handlers
logger.error('Error fetching member', {
  error,
  memberId: req.params.id,
  requestId: req.id,
  stationId: getStationIdFromRequest(req),
});

// In services
logger.info('Member created', {
  memberId: member.id,
  stationId: member.stationId,
  name: member.name,
});
```

### Using Request Logger

Request logging is automatic via middleware. Every HTTP request/response is logged with:
- Request ID (unique per request)
- HTTP method and path
- Response status code
- Request duration in milliseconds
- Client IP address

No action needed in route handlers - it's handled by `requestLoggingMiddleware`.

## Log Levels

### When to Use Each Level

**`logger.error()`** - Error conditions requiring attention
- Database connection failures
- API request failures
- Unhandled exceptions
- Data validation errors that prevent operation
- External service failures (Azure Storage, etc.)

**`logger.warn()`** - Warning conditions that should be monitored
- Rate limit exceeded
- Deprecated API usage
- Fallback to default configuration
- Non-critical service degradation
- Invalid input that can be handled

**`logger.info()`** - Normal operational events
- Server startup/shutdown
- Database connections established
- Important state changes (member created, event started)
- Configuration loaded
- Manual admin actions

**`logger.debug()`** - Detailed debugging information
- WebSocket events
- Demo mode activations
- Database queries
- Detailed flow tracing
- Performance metrics

### Log Level Configuration

Logs are filtered by environment:

- **Production**: `info` and above (info, warn, error)
- **Development**: `debug` and above (all logs)
- **Test**: `warn` and above (warn, error) to reduce noise

Set via `NODE_ENV` environment variable.

## Structured Logging

### Metadata Best Practices

Always use structured metadata instead of string interpolation:

```typescript
// ✅ GOOD - Structured metadata
logger.info('Member created', { 
  memberId: '123', 
  name: 'John Doe',
  stationId: 'abc',
});

// ❌ BAD - String interpolation
logger.info(`Member ${name} created with ID ${memberId}`);
```

Benefits:
- Machine-readable for log aggregation
- Easy to filter and search
- Consistent format across logs
- Better performance in production

### Common Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | string | Unique request identifier (from `req.id`) |
| `memberId` | string | Member identifier |
| `eventId` | string | Event identifier |
| `stationId` | string | Station identifier |
| `activityId` | string | Activity identifier |
| `error` | Error | Error object (automatically formatted) |
| `durationMs` | number | Operation duration in milliseconds |
| `method` | string | HTTP method (GET, POST, etc.) |
| `path` | string | Request path |
| `statusCode` | number | HTTP status code |
| `ip` | string | Client IP address |

## Request Tracing

Every HTTP request gets a unique `requestId` that's:
1. Generated automatically (UUID v4)
2. Added to `req.id` for route handlers
3. Added to `X-Request-ID` response header
4. Included in all logs for that request

### Using Request ID

```typescript
// In route handler - automatically available
router.get('/members/:id', async (req, res) => {
  logger.info('Fetching member', { 
    requestId: req.id,  // Always include this
    memberId: req.params.id 
  });
  
  // ... handle request
});
```

### Client-Side Request Tracing

Clients can pass `X-Request-ID` header to trace requests across systems:

```javascript
fetch('/api/members', {
  headers: {
    'X-Request-ID': 'my-custom-id-123'
  }
});
```

## Performance Logging

Use the performance helper for operation timing:

```typescript
import { logPerformance } from './services/logger';

const start = Date.now();
await db.getAllMembers(stationId);
logPerformance('db.getAllMembers', Date.now() - start, { stationId });
```

This logs:
```json
{
  "level": "info",
  "message": "Performance metric",
  "operation": "db.getAllMembers",
  "durationMs": 45,
  "stationId": "station-123",
  "timestamp": "2026-02-06T10:30:45.123Z"
}
```

## Log Output Formats

### Development (Console)

Human-readable colored output:

```
2026-02-06 10:30:45 [info]: Server started { port: 3000, environment: 'development' }
2026-02-06 10:30:47 [error]: Database connection failed { error: 'Connection timeout' }
```

### Production (JSON)

Machine-readable JSON for log aggregation:

```json
{
  "level": "info",
  "message": "Server started",
  "port": 3000,
  "environment": "production",
  "service": "station-manager-backend",
  "timestamp": "2026-02-06T10:30:45.123Z"
}
```

## File Logging (Production)

In production, logs are also written to files:

- **`logs/error.log`** - Error logs only
- **`logs/combined.log`** - All logs

Files rotate at 5MB with 5 backups retained.

## Child Loggers

Create child loggers with persistent context:

```typescript
import { createChildLogger } from './services/logger';

// Create logger with persistent context
const userLogger = createChildLogger({ 
  userId: '123',
  component: 'authentication' 
});

// All logs include userId and component
userLogger.info('Login attempt');
userLogger.error('Login failed', { reason: 'invalid_password' });
```

## Azure Log Analytics Integration

### Future Enhancement

Azure Log Analytics integration is planned but not yet implemented. When ready:

1. Install Azure transport: `npm install winston-azure-application-insights`
2. Configure in `logger.ts`:
```typescript
import { AzureApplicationInsightsLogger } from 'winston-azure-application-insights';

// Add to transports array
new AzureApplicationInsightsLogger({
  key: process.env.AZURE_INSIGHTS_KEY,
})
```

3. Set up queries and alerts in Azure Portal

## Migration from console.log

### Before
```typescript
console.log('Member created:', memberId);
console.error('Error:', error);
```

### After
```typescript
logger.info('Member created', { memberId });
logger.error('Failed to create member', { error, memberId });
```

## Testing Logging

### Verify Log Output

```bash
# Development mode - see all logs
NODE_ENV=development npm run dev

# Production mode - info and above
NODE_ENV=production npm start

# Test mode - warnings and errors only
npm test
```

### Check Log Files (Production)

```bash
tail -f logs/combined.log
tail -f logs/error.log
```

## Common Patterns

### Route Handler Logging

```typescript
router.post('/members', async (req, res) => {
  try {
    logger.info('Creating member', { 
      requestId: req.id,
      stationId: getStationIdFromRequest(req),
    });
    
    const member = await db.createMember(req.body.name);
    
    logger.info('Member created', {
      requestId: req.id,
      memberId: member.id,
    });
    
    res.status(201).json(member);
  } catch (error) {
    logger.error('Error creating member', {
      error,
      requestId: req.id,
      stationId: getStationIdFromRequest(req),
    });
    res.status(500).json({ error: 'Failed to create member' });
  }
});
```

### Service Logging

```typescript
async function processEvent(eventId: string) {
  logger.debug('Processing event', { eventId });
  
  const start = Date.now();
  
  try {
    // ... do work
    
    logPerformance('processEvent', Date.now() - start, { eventId });
    logger.info('Event processed', { eventId });
  } catch (error) {
    logger.error('Failed to process event', { error, eventId });
    throw error;
  }
}
```

### WebSocket Logging

```typescript
io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { socketId: socket.id });
  
  socket.on('checkin', (data) => {
    logger.debug('WebSocket event: checkin', { 
      socketId: socket.id,
      data 
    });
  });
  
  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { socketId: socket.id });
  });
});
```

## Troubleshooting

### No Logs Appearing

1. Check `NODE_ENV` - tests run with `warn` level by default
2. Verify log level configuration matches your needs
3. Check if stdout/stderr is being redirected

### Performance Impact

Winston is optimized for production use:
- Asynchronous file writes
- Efficient JSON serialization
- Conditional formatting based on environment
- Measured impact: < 5ms per request

### Log File Growth

Production log files rotate automatically:
- Maximum size: 5MB per file
- 5 backups retained
- Oldest files deleted automatically

Consider implementing log aggregation for long-term retention.

## Best Practices

1. **Always include `requestId`** in route handler logs
2. **Use structured metadata** instead of string interpolation
3. **Log errors with full context** (error + relevant IDs)
4. **Use appropriate log levels** (don't log debug in production)
5. **Keep logs concise** but informative
6. **Don't log sensitive data** (passwords, tokens, PII)
7. **Use child loggers** for persistent context
8. **Monitor error logs** in production
9. **Add performance logs** for slow operations
10. **Test log output** in development

## Security Considerations

**Never log:**
- Passwords or credentials
- API keys or access tokens
- Personal Identifiable Information (PII) without masking
- Credit card or financial data
- Session tokens

**Safe to log:**
- User IDs (non-PII identifiers)
- Timestamps
- HTTP status codes
- Error messages (sanitized)
- Resource IDs
- IP addresses (consider privacy laws)

## Related Documentation

- [Winston Documentation](https://github.com/winstonjs/winston)
- [AS_BUILT.md](./AS_BUILT.md) - System architecture
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
- [MASTER_PLAN.md](./MASTER_PLAN.md) - Project roadmap

## Support

For issues or questions about logging:
1. Check this guide first
2. Review Winston documentation
3. Check existing code examples
4. Open an issue on GitHub
