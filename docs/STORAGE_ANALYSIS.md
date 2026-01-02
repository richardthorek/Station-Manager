# Storage Efficiency Analysis: Azure Cosmos DB vs Azure Table Storage

**Date**: January 2026  
**Purpose**: Evaluate cost-effectiveness of Azure Table Storage vs Azure Cosmos DB (Document DB) for RFS Station Manager

---

## Executive Summary

### Current Architecture
- **Database**: Azure Cosmos DB with MongoDB API (also known as Azure Document DB)
- **Collections**: 10 collections (Members, Activities, CheckIns, Events, EventParticipants, Appliances, ChecklistTemplates, CheckRuns, CheckResults, ActiveActivity)
- **Estimated Monthly Cost**: $5-25 AUD (Free tier: 1000 RU/s, 25GB storage)

### Recommendation
**KEEP Azure Cosmos DB** - The free tier covers typical station needs, and migration costs outweigh potential savings.

### Key Findings
| Factor | Cosmos DB (Current) | Table Storage |
|--------|-------------------|---------------|
| **Free Tier** | 1000 RU/s, 25GB storage | N/A (pay per operation) |
| **Typical Monthly Cost** | $0-5 (within free tier) | $2-8 (estimate) |
| **Query Flexibility** | Full MongoDB queries | Limited (PartitionKey + RowKey) |
| **Real-time Support** | Native change streams | Requires custom polling |
| **Migration Effort** | None | High (2-3 weeks dev time) |
| **Developer Experience** | Excellent (MongoDB API) | Requires redesign |

---

## Current Data Model Analysis

### Collection Overview

#### 1. **Members Collection**
```typescript
{
  id: string,              // ~36 bytes (UUID)
  name: string,            // ~30 bytes average
  qrCode: string,          // ~36 bytes (UUID)
  memberNumber?: string,   // ~10 bytes
  rank?: string,           // ~20 bytes
  createdAt: Date,         // ~8 bytes
  updatedAt: Date          // ~8 bytes
}
```
- **Size per document**: ~150 bytes
- **Typical station size**: 40-100 members
- **Total storage**: 6-15 KB

**Access Patterns:**
- Get all members (sorted by recent check-ins)
- Get member by ID
- Get member by QR code
- Search by name (partial match)

#### 2. **Activities Collection**
```typescript
{
  id: string,           // ~36 bytes
  name: string,         // ~20 bytes
  isCustom: boolean,    // ~1 byte
  createdBy?: string,   // ~36 bytes
  createdAt: Date       // ~8 bytes
}
```
- **Size per document**: ~100 bytes
- **Typical count**: 5-10 activities
- **Total storage**: <1 KB

**Access Patterns:**
- Get all activities
- Get activity by ID

#### 3. **Events Collection**
```typescript
{
  id: string,
  activityId: string,
  activityName: string,
  startTime: Date,
  endTime?: Date,
  isActive: boolean,
  createdBy?: string,
  createdAt: Date,
  updatedAt: Date
}
```
- **Size per document**: ~200 bytes
- **Creation rate**: 2-5 events/day
- **Annual growth**: 730-1,825 documents (~150-365 KB/year)

**Access Patterns:**
- Get active events
- Get events with pagination (most recent first)
- Get event by ID
- Historical queries (date ranges)

#### 4. **EventParticipants Collection**
```typescript
{
  id: string,
  eventId: string,
  memberId: string,
  memberName: string,
  memberRank?: string,
  checkInTime: Date,
  checkInMethod: 'kiosk' | 'mobile' | 'qr',
  location?: string,
  isOffsite: boolean,
  createdAt: Date
}
```
- **Size per document**: ~180 bytes
- **Growth rate**: 5-15 check-ins/event × 2-5 events/day = 10-75/day
- **Annual growth**: 3,650-27,375 documents (~650 KB - 5 MB/year)

**Access Patterns:**
- Get participants by event ID
- Get all active participants (across active events)
- Historical queries (member participation)

#### 5. **CheckRuns Collection** (Truck Checks)
```typescript
{
  id: string,
  applianceId: string,
  applianceName: string,
  startTime: Date,
  endTime?: Date,
  completedBy: string,
  completedByName?: string,
  contributors: string[],
  additionalComments?: string,
  status: 'in-progress' | 'completed',
  hasIssues: boolean,
  createdAt: Date,
  updatedAt: Date
}
```
- **Size per document**: ~250 bytes
- **Creation rate**: 1-3 checks/week = 50-150/year
- **Annual growth**: ~12-37 KB/year

**Access Patterns:**
- Get active check run for appliance
- Get check runs by appliance ID
- Get check runs by date range
- Get runs with issues

#### 6. **CheckResults Collection**
```typescript
{
  id: string,
  runId: string,
  itemId: string,
  itemName: string,
  itemDescription: string,
  status: 'done' | 'issue' | 'skipped',
  comment?: string,
  photoUrl?: string,
  completedBy?: string,
  createdAt: Date,
  updatedAt: Date
}
```
- **Size per document**: ~200 bytes (excluding photos)
- **Per check run**: 8 items = 1.6 KB
- **Annual growth**: 50-150 runs × 8 items = ~80-240 KB/year

**Note**: Photos stored in Azure Blob Storage, not database

#### 7. **Other Collections**
- **Appliances**: 5-10 documents (~1 KB total)
- **ChecklistTemplates**: 5-10 documents (~5 KB total)
- **ActiveActivity**: 1 document (~100 bytes)
- **CheckIns** (legacy): Minimal ongoing usage

---

## Storage Growth Projections

### Year 1 Estimates
| Collection | Documents | Storage |
|-----------|-----------|---------|
| Members | 100 | 15 KB |
| Activities | 10 | 1 KB |
| Events | 1,500 | 300 KB |
| EventParticipants | 15,000 | 2.7 MB |
| CheckRuns | 100 | 25 KB |
| CheckResults | 800 | 160 KB |
| Other | 20 | 10 KB |
| **TOTAL** | **17,530** | **~3.2 MB** |

### 5-Year Projection
- **Total Storage**: ~16 MB (well within 25GB free tier)
- **Documents**: ~87,650
- **Read Operations**: ~100K-500K/month (well within free tier 1000 RU/s)

### Conclusion
A typical RFS station will remain within Cosmos DB free tier indefinitely.

---

## Cost Comparison

### Azure Cosmos DB (Current)

**Free Tier:**
- 1000 Request Units/second (RU/s)
- 25 GB storage
- Sufficient for 10-20 small stations

**Beyond Free Tier:**
- Serverless: $0.357/million RU operations + $0.30/GB storage
- Provisioned: $0.012/hour per 100 RU/s (~$8.70/month minimum)

**Estimated Cost for 1 Station:**
- Typical: **$0/month** (within free tier)
- High traffic (100+ active users): **$5-15/month**

### Azure Table Storage

**Pricing:**
- Storage: $0.045/GB/month (first 1TB)
- Operations: $0.00036 per 10,000 transactions
- Egress: First 100GB free, then $0.087/GB

**Estimated Cost for 1 Station:**
```
Storage: 3.2 MB × $0.045/GB = $0.0001/month
Operations: 
  - Reads: 100K/month × $0.036/million = $0.004
  - Writes: 20K/month × $0.036/million = $0.0007
Total: ~$0.01-2/month
```

**5-Year Projected Cost:**
```
Storage: 16 MB × $0.045/GB = $0.0007/month
Operations: Similar (~$0.01-2/month)
Total: ~$0.02-2.50/month
```

### Cost Difference
- **Year 1**: Cosmos DB $0 vs Table Storage $0.12-24 = **Cosmos DB saves $0.12-24**
- **Year 5**: Cosmos DB $0 vs Table Storage $0.24-30 = **Cosmos DB saves $0.24-30**

Even accounting for higher traffic, Cosmos DB remains competitive or cheaper due to free tier.

---

## Technical Comparison

### Query Capabilities

#### Cosmos DB (MongoDB API)
```javascript
// Complex queries are natural
db.members.find({ name: /^John/ })
  .sort({ updatedAt: -1 })
  .limit(10);

db.eventParticipants.aggregate([
  { $match: { checkInTime: { $gte: sixMonthsAgo } } },
  { $group: { _id: '$memberId', count: { $sum: 1 } } }
]);
```

#### Table Storage
```javascript
// Queries limited to PartitionKey and RowKey
// Partition: entityType, Row: id
tableClient.listEntities({
  queryOptions: { 
    filter: "PartitionKey eq 'Member' and RowKey eq '12345'"
  }
});

// No native sorting, aggregation, or partial match
// Requires client-side processing for complex queries
```

**Impact:**
- Member search by name: Easy in Cosmos, requires full scan in Table Storage
- Active participants across events: Single query in Cosmos, multiple queries in Table Storage
- Sorting by check-in count: Native in Cosmos, requires client-side in Table Storage

### Real-Time Features

#### Cosmos DB
- **Change Streams**: Native support for real-time updates
- **Triggers**: Database-level triggers available
- **Integration**: Direct integration with Azure Functions, SignalR

#### Table Storage
- **Change Feed**: Basic change feed available (but delayed)
- **Real-time**: Requires custom polling or separate notification system
- **Integration**: More complex integration required

**Current Implementation:**
RFS Station Manager uses Socket.io for real-time sync. Migration to Table Storage wouldn't eliminate Socket.io, but Cosmos DB provides better foundation for future event-driven features.

### Data Modeling

#### Cosmos DB
```javascript
// Natural document structure
{
  id: "event-123",
  activityName: "Training",
  participants: [
    { memberId: "m1", name: "John", checkInTime: "2026-01-01T10:00" },
    { memberId: "m2", name: "Jane", checkInTime: "2026-01-01T10:15" }
  ]
}
```

#### Table Storage
```javascript
// Flat structure required
{
  PartitionKey: "Event",
  RowKey: "event-123",
  activityName: "Training"
}
// Separate table for participants
{
  PartitionKey: "event-123",
  RowKey: "participant-1",
  memberId: "m1",
  name: "John",
  checkInTime: "2026-01-01T10:00"
}
```

**Impact:**
- More complex data access patterns
- Additional network round-trips
- More application logic required

### Developer Experience

#### Cosmos DB (MongoDB API)
- **ORM/ODM**: Mongoose, native MongoDB driver
- **Queries**: Familiar MongoDB query language
- **Tooling**: MongoDB Compass, Studio 3T
- **Learning Curve**: Low (many developers know MongoDB)

#### Table Storage
- **SDK**: Azure-specific SDK only
- **Queries**: Custom query syntax (OData-like)
- **Tooling**: Azure Storage Explorer
- **Learning Curve**: Medium-High (Azure-specific knowledge)

---

## Migration Analysis

### Migration Effort

If moving **FROM** Cosmos DB **TO** Table Storage:

#### Code Changes Required

1. **Database Service Layer** (~40 hours)
   - Rewrite all database operations
   - Design new partition/row key strategies
   - Implement client-side filtering/sorting
   - Handle relationship queries

2. **Query Optimization** (~20 hours)
   - Redesign queries for PartitionKey/RowKey access
   - Implement caching for expensive operations
   - Add client-side aggregations

3. **Testing** (~30 hours)
   - Unit tests for new database layer
   - Integration tests
   - Performance testing
   - Data migration validation

4. **Data Migration** (~10 hours)
   - Export from Cosmos DB
   - Transform data structures
   - Import to Table Storage
   - Verify data integrity

**Total Effort**: ~100 hours (~2-3 weeks)

#### Example Migration Complexity

**Current (Cosmos DB):**
```typescript
async getAllMembers(): Promise<Member[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const members = await this.membersCollection.find().toArray();
  
  const checkInCounts = await this.eventParticipantsCollection.aggregate([
    { $match: { checkInTime: { $gte: sixMonthsAgo } } },
    { $group: { _id: '$memberId', count: { $sum: 1 } } }
  ]).toArray();
  
  // Sort and return
  return members.sort(...);
}
```

**After Migration (Table Storage):**
```typescript
async getAllMembers(): Promise<Member[]> {
  // 1. Fetch all members (full table scan)
  const memberEntities = tableClient.listEntities({
    queryOptions: { filter: "PartitionKey eq 'Member'" }
  });
  
  // 2. Fetch all event participants (full table scan)
  const participantEntities = tableClient.listEntities({
    queryOptions: { filter: "PartitionKey eq 'EventParticipant'" }
  });
  
  // 3. Client-side filtering for date range
  const sixMonthsAgo = new Date();
  const recentParticipants = [];
  for await (const entity of participantEntities) {
    if (entity.checkInTime >= sixMonthsAgo) {
      recentParticipants.push(entity);
    }
  }
  
  // 4. Client-side aggregation
  const checkInCounts = new Map();
  for (const participant of recentParticipants) {
    const count = checkInCounts.get(participant.memberId) || 0;
    checkInCounts.set(participant.memberId, count + 1);
  }
  
  // 5. Client-side sorting
  const members = [];
  for await (const entity of memberEntities) {
    members.push(entity);
  }
  return members.sort(...);
}
```

**Problems:**
- Multiple full table scans instead of indexed queries
- All filtering/aggregation in application code
- Higher memory usage
- Slower performance
- More complex code

### Data Migration Steps

1. **Export from Cosmos DB**
   ```bash
   mongoexport --uri="<cosmos-connection-string>" \
     --db=StationManager --collection=Members --out=members.json
   ```

2. **Transform Data**
   - Add PartitionKey/RowKey
   - Flatten nested structures
   - Handle date conversions

3. **Import to Table Storage**
   ```typescript
   for (const document of documents) {
     const entity = {
       partitionKey: 'Member',
       rowKey: document.id,
       ...document
     };
     await tableClient.createEntity(entity);
   }
   ```

4. **Validation**
   - Count verification
   - Sample data checks
   - Functional testing

---

## Risk Assessment

### Risks of Migration

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Query Performance Degradation** | High | High | Extensive testing, caching |
| **Increased Complexity** | Medium | Very High | Additional dev documentation |
| **Data Loss During Migration** | High | Low | Backup strategy, validation |
| **Development Time Overrun** | Medium | Medium | Buffer time, phased approach |
| **Broken Real-time Features** | High | Medium | Thorough integration testing |
| **Increased Maintenance** | Medium | High | Code reviews, monitoring |

### Risks of Staying with Cosmos DB

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Cost Overrun** | Low | Very Low | Monitor usage, free tier alerts |
| **Scaling Issues** | Low | Very Low | Provisioned throughput if needed |
| **Vendor Lock-in** | Medium | High | MongoDB API is standard |

---

## Recommendations

### Primary Recommendation: **KEEP Azure Cosmos DB**

#### Reasons

1. **Cost-Effective**: Free tier covers typical usage indefinitely
   - 25GB storage >> 16MB projected (5 years)
   - 1000 RU/s >> ~10-50 RU/s typical usage
   - Even beyond free tier, costs are comparable

2. **Superior Developer Experience**
   - MongoDB API is industry standard
   - Rich query capabilities
   - Less application code required
   - Faster development

3. **Better Technical Foundation**
   - Native indexing and aggregation
   - Change streams for future features
   - Better performance characteristics
   - Future-proof architecture

4. **Zero Migration Risk**
   - No data migration needed
   - No development time
   - No risk of breaking changes
   - Team can focus on features

5. **Minimal Complexity**
   - Current codebase is clean and maintainable
   - Well-tested
   - Documented

#### When to Reconsider

Table Storage might make sense if:
- Station network grows to 50+ sites with heavy usage (unlikely)
- Cosmos DB costs consistently exceed $50/month (very unlikely)
- Need for Azure-native geo-replication at scale
- Simplified data model with no complex queries

### Secondary Recommendation: Optimize Current Usage

Instead of migration, optimize Cosmos DB usage:

1. **Monitor Usage**
   ```bash
   # Set up alerts for RU consumption
   az monitor metrics alert create \
     --resource <cosmos-account-id> \
     --condition "total RequestCharge > 800"
   ```

2. **Optimize Indexes**
   ```javascript
   // Ensure proper indexes on frequently queried fields
   db.eventParticipants.createIndex({ eventId: 1, checkInTime: -1 });
   db.events.createIndex({ isActive: 1, startTime: -1 });
   ```

3. **Implement Caching**
   ```typescript
   // Cache member list with 5-minute TTL
   const cache = new Map<string, { data: Member[], expiry: number }>();
   ```

4. **Archive Old Data**
   ```typescript
   // Move events older than 2 years to cold storage
   async archiveOldEvents() {
     const twoYearsAgo = new Date();
     twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
     
     const oldEvents = await db.events.find({ 
       endTime: { $lt: twoYearsAgo } 
     }).toArray();
     
     // Export to Azure Blob Storage
     await blobClient.upload(JSON.stringify(oldEvents));
     
     // Delete from Cosmos DB
     await db.events.deleteMany({ endTime: { $lt: twoYearsAgo } });
   }
   ```

---

## Alternative: Hybrid Approach

If cost becomes a concern in the future, consider a **hybrid approach**:

### Hot/Cold Data Split

1. **Cosmos DB** (Hot Data)
   - Active events (last 30 days)
   - Current check-ins
   - Active members
   - Templates and configurations

2. **Azure Blob Storage** (Cold Data)
   - Historical events (>30 days old)
   - Archived check runs
   - Old participant records

3. **Benefits**
   - Keeps Cosmos DB within free tier
   - Low-cost archival storage
   - Maintains query performance for active data
   - No complete rewrite needed

### Implementation

```typescript
// Archive events older than 30 days
async archiveOldData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get old events with participants
  const oldEvents = await db.getEventsWithParticipants(1000, 0);
  const toArchive = oldEvents.filter(e => e.endTime && e.endTime < thirtyDaysAgo);
  
  if (toArchive.length === 0) return;
  
  // Upload to blob storage
  const archiveData = {
    archivedAt: new Date(),
    events: toArchive
  };
  
  const blobName = `archive-${new Date().toISOString().split('T')[0]}.json`;
  await blobClient.upload(blobName, JSON.stringify(archiveData));
  
  // Delete from Cosmos DB
  for (const event of toArchive) {
    await db.events.deleteOne({ id: event.id });
    await db.eventParticipants.deleteMany({ eventId: event.id });
  }
  
  console.log(`Archived ${toArchive.length} events to ${blobName}`);
}
```

**Cost Impact:**
- Blob Storage: $0.02/GB/month (cool tier)
- 5-year archive: ~15 MB = $0.0003/month
- Cosmos DB stays within free tier

---

## Conclusion

### Bottom Line

**Do NOT migrate to Azure Table Storage.** The current Azure Cosmos DB implementation is:

✅ **More cost-effective** (free tier covers all realistic usage)  
✅ **More feature-rich** (MongoDB query capabilities)  
✅ **Easier to maintain** (standard MongoDB API)  
✅ **Better performance** (native indexing and aggregation)  
✅ **Lower risk** (no migration needed)  
✅ **Future-proof** (better foundation for growth)

### Action Items

1. ✅ **Keep Cosmos DB** as the primary database
2. ⚠️ **Set up monitoring** for RU usage and storage
3. 💡 **Implement caching** for frequently accessed data
4. 📦 **Plan archival strategy** if data retention becomes a concern (5+ years)
5. 📊 **Review costs quarterly** to ensure staying within free tier

### Financial Summary

| Timeframe | Cosmos DB Cost | Table Storage Cost | Savings |
|-----------|----------------|-------------------|---------|
| Year 1 | $0 | $0.12-24 | $0.12-24 |
| Year 5 | $0-5 | $0.24-30 | $0.24-25 |
| **Total (5 years)** | **$0-25** | **$1.20-120** | **$1.20-95** |

**Migration Cost**: ~$10,000-15,000 (100 hours at typical rates)

**ROI of Migration**: **Negative** - Would cost far more than any potential savings

---

## References

- [Azure Cosmos DB Pricing](https://azure.microsoft.com/en-us/pricing/details/cosmos-db/)
- [Azure Table Storage Pricing](https://azure.microsoft.com/en-us/pricing/details/storage/tables/)
- [Cosmos DB Free Tier](https://docs.microsoft.com/en-us/azure/cosmos-db/free-tier)
- [MongoDB Query Documentation](https://docs.mongodb.com/manual/tutorial/query-documents/)

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Next Review**: January 2027 (or when approaching 80% of free tier limits)
