# Cosmos DB Optimization Implementation Guide

**Purpose**: Reduce RU consumption and minimize costs for Cosmos DB Serverless  
**Target**: Reduce monthly costs by 75-85% through caching and query optimization  
**Estimated Time**: 2-4 hours implementation

---

## Overview

This guide provides step-by-step instructions to optimize Cosmos DB usage for the RFS Station Manager application.

**Expected Results:**
- **Before**: $2-3/month per busy station
- **After**: $0.50-1/month per busy station
- **Savings**: 75-85% cost reduction

---

## Step 1: Verify Serverless Pricing Model

### Check Current Pricing Model

```bash
# Check if using Serverless
az cosmosdb show \
  --name <your-cosmos-account> \
  --resource-group <your-resource-group> \
  --query "capabilities[?name=='EnableServerless'].name" \
  --output tsv
```

**Expected Output**: `EnableServerless`

If empty, you're using Provisioned Throughput (more expensive).

### Convert to Serverless (if needed)

⚠️ **Note**: Cannot convert existing account. Must create new Serverless account and migrate data.

```bash
# Create new Serverless account
az cosmosdb create \
  --name <your-cosmos-account>-serverless \
  --resource-group <your-resource-group> \
  --locations regionName=<region> \
  --capabilities EnableServerless \
  --kind MongoDB

# Get connection string
az cosmosdb keys list \
  --name <your-cosmos-account>-serverless \
  --resource-group <your-resource-group> \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

Then migrate data using standard MongoDB tools.

---

## Step 2: Implement Caching Layer

### Create Cache Service

Create `backend/src/services/cacheService.ts`:

```typescript
/**
 * Simple in-memory cache with TTL support
 */
export class CacheService {
  private cache = new Map<string, { data: any, expiry: number }>();

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null if expired/missing
   */
  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param data Data to cache
   * @param ttlMs Time-to-live in milliseconds
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
  }

  /**
   * Invalidate cache entry
   * @param key Cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching pattern
   * @param pattern Regex pattern to match keys
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
export const cache = new CacheService();
```

### Update Database Service

Update `backend/src/services/mongoDatabase.ts`:

```typescript
import { cache } from './cacheService';

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
  MEMBERS: 5 * 60 * 1000,      // 5 minutes
  ACTIVITIES: 10 * 60 * 1000,   // 10 minutes
  ACTIVE_EVENTS: 30 * 1000,     // 30 seconds
  EVENT_PARTICIPANTS: 30 * 1000 // 30 seconds
};

// Add to MongoDBService class
async getAllMembers(): Promise<Member[]> {
  // Try cache first
  const cached = cache.get<Member[]>('members:all');
  if (cached) {
    console.log('Cache hit: members');
    return cached;
  }

  // Cache miss - fetch from database
  console.log('Cache miss: members');
  if (!this.membersCollection || !this.eventParticipantsCollection) {
    throw new Error('Database not connected');
  }
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const members = await this.membersCollection.find().toArray();
  
  const memberCheckInCounts = await this.eventParticipantsCollection.aggregate([
    { $match: { checkInTime: { $gte: sixMonthsAgo } } },
    { $group: { _id: '$memberId', checkInCount: { $sum: 1 } } }
  ]).toArray();
  
  const checkInMap = new Map<string, number>();
  memberCheckInCounts.forEach((item: any) => {
    checkInMap.set(item._id, item.checkInCount);
  });
  
  members.sort((a, b) => {
    const countA = checkInMap.get(a.id) || 0;
    const countB = checkInMap.get(b.id) || 0;
    if (countB !== countA) {
      return countB - countA;
    }
    return a.name.localeCompare(b.name);
  });
  
  // Store in cache
  cache.set('members:all', members, CACHE_TTL.MEMBERS);
  
  return members;
}

async getAllActivities(): Promise<Activity[]> {
  const cached = cache.get<Activity[]>('activities:all');
  if (cached) {
    return cached;
  }

  if (!this.activitiesCollection) throw new Error('Database not connected');
  
  const activities = await this.activitiesCollection.find().toArray();
  
  const sorted = activities.sort((a, b) => {
    if (a.isCustom !== b.isCustom) {
      return a.isCustom ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
  
  cache.set('activities:all', sorted, CACHE_TTL.ACTIVITIES);
  return sorted;
}

async getActiveEvents(): Promise<Event[]> {
  const cached = cache.get<Event[]>('events:active');
  if (cached) {
    return cached;
  }

  if (!this.eventsCollection) throw new Error('Database not connected');
  
  const events = await this.eventsCollection
    .find({ isActive: true })
    .sort({ startTime: -1 })
    .toArray();
  
  cache.set('events:active', events, CACHE_TTL.ACTIVE_EVENTS);
  return events;
}

// Invalidate cache on writes
async createMember(name: string): Promise<Member> {
  if (!this.membersCollection) throw new Error('Database not connected');
  
  const member: Member = {
    id: uuidv4(),
    name,
    qrCode: uuidv4(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await this.membersCollection.insertOne(member);
  
  // Invalidate members cache
  cache.invalidate('members:all');
  
  return member;
}

async createActivity(name: string, createdBy?: string): Promise<Activity> {
  if (!this.activitiesCollection) throw new Error('Database not connected');
  
  const activity: Activity = {
    id: uuidv4(),
    name,
    isCustom: true,
    createdBy,
    createdAt: new Date(),
  };
  
  await this.activitiesCollection.insertOne(activity);
  
  // Invalidate activities cache
  cache.invalidate('activities:all');
  
  return activity;
}

async createEvent(activityId: string, createdBy?: string): Promise<Event> {
  if (!this.eventsCollection || !this.activitiesCollection) {
    throw new Error('Database not connected');
  }
  
  const activity = await this.activitiesCollection.findOne({ id: activityId });
  if (!activity) {
    throw new Error('Activity not found');
  }

  const event: Event = {
    id: uuidv4(),
    activityId,
    activityName: activity.name,
    startTime: new Date(),
    endTime: undefined,
    isActive: true,
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await this.eventsCollection.insertOne(event);
  
  // Invalidate active events cache
  cache.invalidate('events:active');
  
  return event;
}

async endEvent(eventId: string): Promise<Event | null> {
  if (!this.eventsCollection) throw new Error('Database not connected');
  
  const result = await this.eventsCollection.findOneAndUpdate(
    { id: eventId },
    { 
      $set: { 
        endTime: new Date(),
        isActive: false,
        updatedAt: new Date()
      } 
    },
    { returnDocument: 'after' }
  );
  
  // Invalidate active events cache
  cache.invalidate('events:active');
  
  return result || null;
}
```

**Key Points:**
- Cache members for 5 minutes (rarely changes)
- Cache activities for 10 minutes (rarely changes)
- Cache active events for 30 seconds (changes frequently)
- Invalidate cache on any write operation

---

## Step 3: Optimize Indexes

### Create Index Script

Create `backend/src/scripts/createIndexes.ts`:

```typescript
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function createIndexes() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not set');
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('StationManager');
    
    console.log('Creating indexes...');
    
    // Members indexes
    await db.collection('Members').createIndex({ name: 1 });
    await db.collection('Members').createIndex({ qrCode: 1 }, { unique: true });
    console.log('✓ Members indexes created');
    
    // CheckIns indexes
    await db.collection('CheckIns').createIndex({ memberId: 1 });
    await db.collection('CheckIns').createIndex({ isActive: 1 });
    await db.collection('CheckIns').createIndex({ checkInTime: -1 });
    console.log('✓ CheckIns indexes created');
    
    // Events indexes
    await db.collection('Events').createIndex({ startTime: -1 });
    await db.collection('Events').createIndex({ isActive: 1 });
    await db.collection('Events').createIndex({ activityId: 1 });
    console.log('✓ Events indexes created');
    
    // EventParticipants indexes
    await db.collection('EventParticipants').createIndex({ eventId: 1 });
    await db.collection('EventParticipants').createIndex({ memberId: 1 });
    await db.collection('EventParticipants').createIndex({ checkInTime: -1 });
    console.log('✓ EventParticipants indexes created');
    
    // Appliances indexes (truck checks)
    await db.collection('Appliances').createIndex({ name: 1 });
    console.log('✓ Appliances indexes created');
    
    // CheckRuns indexes
    await db.collection('CheckRuns').createIndex({ applianceId: 1 });
    await db.collection('CheckRuns').createIndex({ startTime: -1 });
    await db.collection('CheckRuns').createIndex({ hasIssues: 1 });
    await db.collection('CheckRuns').createIndex({ status: 1 });
    console.log('✓ CheckRuns indexes created');
    
    // CheckResults indexes
    await db.collection('CheckResults').createIndex({ runId: 1 });
    console.log('✓ CheckResults indexes created');
    
    // ChecklistTemplates indexes
    await db.collection('ChecklistTemplates').createIndex({ applianceId: 1 }, { unique: true });
    console.log('✓ ChecklistTemplates indexes created');
    
    console.log('All indexes created successfully!');
    
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  } finally {
    await client.close();
  }
}

createIndexes();
```

### Run Index Creation

```bash
cd backend
npx ts-node src/scripts/createIndexes.ts
```

Add to `package.json`:
```json
{
  "scripts": {
    "indexes": "ts-node src/scripts/createIndexes.ts"
  }
}
```

---

## Step 4: Set Up Cost Monitoring

### Create Budget Alert

```bash
# Set $5/month budget alert
az consumption budget create \
  --resource-group <your-resource-group> \
  --budget-name cosmos-db-monthly-budget \
  --amount 5 \
  --time-grain monthly \
  --category cost \
  --time-period start-date=$(date -d "first day of this month" +%Y-%m-01)T00:00:00Z \
  --notifications Enabled=true \
    ContactEmails=<your-email> \
    ThresholdType=Actual \
    Threshold=80
```

### Create RU Usage Alert

```bash
# Alert if RU usage exceeds 500K per hour
az monitor metrics alert create \
  --name cosmos-high-ru-usage \
  --resource <cosmos-account-resource-id> \
  --resource-group <your-resource-group> \
  --condition "total RequestCharge > 500000" \
  --window-size 1h \
  --evaluation-frequency 15m \
  --action-group <action-group-id>
```

### Create Monitoring Dashboard Script

Create `backend/src/scripts/monitorCosts.ts`:

```typescript
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function monitorCosts() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not set');
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('StationManager');
    
    console.log('\n=== Database Statistics ===\n');
    
    // Get collection sizes
    const collections = await db.listCollections().toArray();
    let totalSize = 0;
    let totalDocuments = 0;
    
    for (const col of collections) {
      const stats = await db.command({ collStats: col.name });
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      totalSize += stats.size;
      totalDocuments += stats.count;
      
      console.log(`${col.name}:`);
      console.log(`  Documents: ${stats.count}`);
      console.log(`  Size: ${sizeMB} MB`);
      console.log(`  Avg Doc Size: ${Math.round(stats.avgObjSize)} bytes`);
      console.log('');
    }
    
    console.log('=== Total ===');
    console.log(`Documents: ${totalDocuments}`);
    console.log(`Storage: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Storage Cost: $${((totalSize / 1024 / 1024 / 1024) * 0.30).toFixed(4)}/month`);
    console.log('');
    
    // Estimate RU usage (rough estimate)
    const eventsPerDay = 3;
    const checkInsPerEvent = 10;
    const queriesPerDay = 500;
    
    const estimatedDailyRU = (
      (eventsPerDay * 5) +           // Create events
      (checkInsPerEvent * eventsPerDay * 5) +  // Check-ins
      (queriesPerDay * 3)            // Read queries
    );
    
    const estimatedMonthlyRU = estimatedDailyRU * 30;
    const estimatedMonthlyCost = (estimatedMonthlyRU / 1000000) * 0.357;
    
    console.log('=== Estimated Monthly Costs ===');
    console.log(`Estimated RU/month: ${estimatedMonthlyRU.toLocaleString()}`);
    console.log(`Estimated RU cost: $${estimatedMonthlyCost.toFixed(4)}`);
    console.log(`Total Estimated: $${(estimatedMonthlyCost + ((totalSize / 1024 / 1024 / 1024) * 0.30)).toFixed(2)}`);
    console.log('');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.close();
  }
}

monitorCosts();
```

Add to `package.json`:
```json
{
  "scripts": {
    "monitor": "ts-node src/scripts/monitorCosts.ts"
  }
}
```

---

## Step 5: Deploy Changes

### 1. Test Locally

```bash
cd backend
npm install
npm run dev
```

Verify caching is working:
- Check console logs for "Cache hit" messages
- Load member list multiple times - should see cache hits

### 2. Deploy to Azure

```bash
# Build
npm run build

# Deploy to App Service
az webapp deployment source config-zip \
  --resource-group <your-resource-group> \
  --name <your-app-service> \
  --src backend.zip
```

### 3. Run Index Creation on Production

```bash
# Set production MONGODB_URI
MONGODB_URI="<production-connection-string>" npm run indexes
```

### 4. Monitor for 1 Week

```bash
# Check costs daily
npm run monitor
```

---

## Step 6: Validation

### Check Cache Hit Rate

Add logging to track cache effectiveness:

```typescript
let cacheHits = 0;
let cacheMisses = 0;

// In cache.get()
if (cached && Date.now() < cached.expiry) {
  cacheHits++;
  if ((cacheHits + cacheMisses) % 100 === 0) {
    const hitRate = (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(1);
    console.log(`Cache hit rate: ${hitRate}% (${cacheHits}/${cacheHits + cacheMisses})`);
  }
  return cached.data as T;
}

cacheMisses++;
```

**Target**: 90%+ cache hit rate for members and activities

### Monitor RU Consumption

Use Azure Portal:
1. Go to Cosmos DB account
2. Click "Metrics"
3. Select "Request Units" metric
4. View hourly/daily consumption

**Target**: <500K RU/month for typical station

### Verify Cost Reduction

After 1 month:
```bash
npm run monitor
```

Compare to previous month's billing.

**Expected**: 75-85% reduction in RU costs

---

## Troubleshooting

### High Cache Miss Rate

**Symptoms**: Cache hit rate < 50%

**Causes**:
- TTL too short
- Cache invalidation too aggressive
- Load balancer sending requests to different instances

**Solutions**:
- Increase TTL for stable data (members: 10 minutes)
- Use Redis for multi-instance caching
- Reduce invalidation frequency

### High RU Consumption

**Symptoms**: >500K RU/month

**Causes**:
- Missing indexes
- Inefficient queries
- No caching

**Solutions**:
- Run `npm run indexes` to ensure all indexes exist
- Check slow query logs in Azure Portal
- Verify cache is working (check logs)

### Increased Latency

**Symptoms**: Slow response times

**Causes**:
- Cache lookup overhead
- Too many cache invalidations

**Solutions**:
- Profile cache operations
- Reduce cache invalidation frequency
- Use read-through pattern consistently

---

## Monitoring Checklist

- [ ] Budget alert set at $5/month
- [ ] RU usage alert configured
- [ ] Weekly cost monitoring script
- [ ] Cache hit rate tracking
- [ ] Monthly cost review

---

## Summary

After implementing these optimizations:

**Before:**
- RU Cost: $2-3/month
- Storage: $0.001/month
- Total: ~$3/month

**After:**
- RU Cost: $0.50-1/month (75% reduction)
- Storage: $0.001/month (same)
- Total: ~$1/month

**Effort**: 2-4 hours implementation + 1 hour monitoring setup

**ROI**: Immediate 75-85% cost savings

---

## Next Steps

1. ✅ Implement caching (Step 2)
2. ✅ Create indexes (Step 3)
3. ✅ Set up monitoring (Step 4)
4. ✅ Deploy (Step 5)
5. ⏱️ Monitor for 1 month
6. 📊 Review actual cost savings
7. 📝 Document learnings

---

**Document Version**: 1.0  
**Last Updated**: January 2026
