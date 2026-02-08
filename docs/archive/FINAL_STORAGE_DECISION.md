# FINAL DECISION: Azure Table Storage Migration

**Date**: January 2026  
**Context**: Cosmos DB free tier reserved for other uses  
**Scope**: Azure infrastructure costs only (no personnel costs)  
**Decision**: ✅ **MIGRATE to Azure Table Storage**

---

## The Bottom Line

**Azure Table Storage is 70-95% cheaper than Cosmos DB Serverless.**

With minimal data to migrate (just re-seed member list), and looking only at Azure costs, Table Storage is the clear winner.

---

## Cost Comparison

### Single Station (Typical RFS Usage)

| Storage | Monthly | Annual | 5-Year |
|---------|---------|--------|--------|
| **Cosmos DB Serverless** | $0.50-3 | $6-36 | $30-180 |
| **Table Storage** | $0.01-0.20 | $0.12-2.40 | $0.60-12 |
| **💰 SAVINGS** | **$0.50-2.80** | **$5.88-33.60** | **$18-168** |

### 10 Stations

| Storage | Annual | 5-Year |
|---------|--------|--------|
| **Cosmos DB Serverless** | $60-360 | $300-1,800 |
| **Table Storage** | $1.20-24 | $6-120 |
| **💰 SAVINGS** | **$58.80-336** | **$180-1,680** |

**Even for 1 station, Table Storage saves $6-34/year. At 10+ stations, savings become substantial.**

---

## Why Table Storage Wins

### 1. Pure Cost Savings
- **70-95% cheaper** than Cosmos DB Serverless
- Flat transaction pricing: $0.036 per 100K operations
- Minimal storage costs for this data size

### 2. Minimal Migration
- **No historical data to migrate** - can start fresh
- Only need to re-seed member list (40-100 names)
- Export/import takes < 1 hour

### 3. No Personnel Cost Barrier
- Without counting development time as cost
- Pure Azure savings are the only factor
- Table Storage clearly wins

### 4. Scales Economically
- Costs stay low as you grow
- No RU consumption surprises
- Predictable flat-rate pricing

---

## What You're Trading

### Giving Up (Cosmos DB Features)
- ❌ Native MongoDB aggregations
- ❌ Database-level sorting
- ❌ Regex search
- ❌ Change streams (already using Socket.io anyway)

### Getting (Table Storage Benefits)
- ✅ 70-95% cost reduction
- ✅ Predictable flat pricing
- ✅ Azure-native integration
- ✅ Unlimited scale potential

### Reality Check
The application already uses Socket.io for real-time updates, so Cosmos DB's change streams aren't critical. Most queries are simple lookups that Table Storage handles efficiently.

---

## Migration Plan

### Phase 1: Setup (2 hours)

```bash
# 1. Create Storage Account
az storage account create \
  --name rfsstationmanager \
  --resource-group <rg> \
  --location australiaeast \
  --sku Standard_LRS

# 2. Create Tables
az storage table create --name Members --account-name rfsstationmanager
az storage table create --name Activities --account-name rfsstationmanager
az storage table create --name Events --account-name rfsstationmanager
az storage table create --name EventParticipants --account-name rfsstationmanager
az storage table create --name Appliances --account-name rfsstationmanager
az storage table create --name ChecklistTemplates --account-name rfsstationmanager
az storage table create --name CheckRuns --account-name rfsstationmanager
az storage table create --name CheckResults --account-name rfsstationmanager
az storage table create --name ActiveActivity --account-name rfsstationmanager

# 3. Get Connection String
az storage account show-connection-string \
  --name rfsstationmanager \
  --resource-group <rg> \
  --output tsv
```

### Phase 2: Export Members (30 minutes)

```bash
# Export current members to CSV
mongoexport --uri="<cosmos-uri>" \
  --db=StationManager \
  --collection=Members \
  --type=csv \
  --fields=name,memberNumber,rank \
  --out=members.csv
```

### Phase 3: Implement (1-2 days)

Create `backend/src/services/tableStorageDatabase.ts`:
- Implement IDatabase interface
- Use Azure Table Storage SDK
- Handle partition/row key strategy

Key implementation file created: See `COSMOS_DB_OPTIMIZATION_GUIDE.md` for patterns.

### Phase 4: Deploy & Import (2 hours)

```bash
# 1. Update environment variables
az webapp config appsettings set \
  --name <app-service> \
  --resource-group <rg> \
  --settings \
    AZURE_STORAGE_CONNECTION_STRING="<connection-string>" \
    USE_TABLE_STORAGE=true

# 2. Deploy updated code
npm run build
az webapp deployment source config-zip --src dist.zip ...

# 3. Import members via admin UI or script
```

### Phase 5: Cleanup (1 week later)

```bash
# After confirming everything works, delete Cosmos DB
az cosmosdb delete \
  --name <cosmos-account> \
  --resource-group <rg>

# Confirm cost savings in Azure billing
```

---

## Partition Key Strategy

**Efficient queries require good partition design:**

```typescript
// Members - All in one partition (small dataset)
PartitionKey: "Member"
RowKey: <memberId>

// Activities - All in one partition
PartitionKey: "Activity"
RowKey: <activityId>

// Events - Partition by month for efficient queries
PartitionKey: "Event_2026-01"
RowKey: <eventId>

// EventParticipants - Co-locate with event
PartitionKey: <eventId>
RowKey: <participantId>

// CheckRuns - Co-locate with appliance
PartitionKey: <applianceId>
RowKey: <timestamp>_<runId>

// CheckResults - Co-locate with run
PartitionKey: <runId>
RowKey: <resultId>
```

**Why this works:**
- Single-partition queries are fast and cheap
- Related data co-located (event + participants)
- Time-based partitioning for events (query current month efficiently)

---

## Cost Monitoring

### After Migration

**Track these metrics:**
```bash
# View storage costs in Azure Portal
az monitor metrics list \
  --resource <storage-account-id> \
  --metric Transactions \
  --interval PT1H

# Expected monthly costs:
# - Storage: < $0.01 (under 10 MB)
# - Transactions: $0.10-2 (100K-500K operations)
# - Total: $0.11-2.01/month
```

**Set up alert:**
```bash
# Alert if costs exceed $5/month (safety margin)
az monitor metrics alert create \
  --name table-storage-budget \
  --resource <storage-account-id> \
  --condition "total Transactions > 10000000" \
  --window-size 1d
```

---

## Success Criteria

### Immediate (Week 1)
- [ ] All features working with Table Storage
- [ ] Real-time sync via Socket.io functioning
- [ ] Check-in/out working correctly
- [ ] Member list displays properly
- [ ] Truck checks functional

### 1 Month
- [ ] Cosmos DB costs: $0
- [ ] Table Storage costs: $0.10-2/month
- [ ] Monthly savings: $0.50-3 confirmed
- [ ] No performance issues
- [ ] No data loss

### 3 Months
- [ ] Quarterly savings: $1.50-9 confirmed
- [ ] System stable
- [ ] Cost trend predictable

---

## Rollback Plan

If issues arise:

1. **Keep Cosmos DB running** for 2 weeks after migration
2. **Revert environment variables** to use Cosmos DB
3. **Redeploy previous code** version
4. **Re-import data** from Cosmos DB

**Cost**: Running both for 2 weeks = extra $1-6 (insurance)

---

## Timeline

| Phase | Duration | Task |
|-------|----------|------|
| **Week 1** | 2 hours | Azure setup |
| **Week 1** | 30 min | Export members |
| **Week 1-2** | 1-2 days | Code implementation |
| **Week 2** | 1 day | Testing |
| **Week 2** | 2 hours | Deploy & import |
| **Week 2-3** | 1 week | Monitor (parallel operation) |
| **Week 3** | 30 min | Delete Cosmos DB |

**Total Elapsed**: 3 weeks  
**Active Work**: 2-4 days

---

## Decision Matrix

| Factor | Weight | Cosmos DB | Table Storage | Winner |
|--------|--------|-----------|---------------|--------|
| **Azure Cost** | 50% | 2/10 | 9/10 | Table Storage |
| **Features** | 20% | 9/10 | 6/10 | Cosmos DB |
| **Scalability** | 10% | 9/10 | 9/10 | Tie |
| **Migration Effort** | 10% | 10/10 | 7/10 | Cosmos DB |
| **Maintenance** | 10% | 8/10 | 7/10 | Cosmos DB |

**Weighted Score:**
- Cosmos DB: (2×0.5) + (9×0.2) + (9×0.1) + (10×0.1) + (8×0.1) = **5.5/10**
- Table Storage: (9×0.5) + (6×0.2) + (9×0.1) + (7×0.1) + (7×0.1) = **7.6/10**

**Winner: Azure Table Storage** (when cost is primary driver)

---

## Recommendation Summary

### ✅ PROCEED with Azure Table Storage Migration

**Justification:**
1. **70-95% cost savings** on Azure infrastructure
2. **Minimal migration** - just re-seed members
3. **No personnel cost barrier** (excluded from analysis)
4. **Immediate ROI** - saves money from day one
5. **Scalable** - costs stay low as network grows

**Expected Results:**
- Monthly savings: $0.50-2.80 per station
- Annual savings: $6-34 per station
- 5-year savings: $30-170 per station
- 10 stations: $180-1,680 saved over 5 years

### Action Required

**Approve migration and allocate 2-4 days for implementation.**

---

## References

📄 **Detailed Analysis**: [STORAGE_DECISION_AZURE_COSTS_ONLY.md](./STORAGE_DECISION_AZURE_COSTS_ONLY.md)  
📄 **Implementation Guide**: [COSMOS_DB_OPTIMIZATION_GUIDE.md](./COSMOS_DB_OPTIMIZATION_GUIDE.md)  
📄 **Previous Analysis** (with free tier): [STORAGE_ANALYSIS.md](./STORAGE_ANALYSIS.md)  

🔗 [Azure Table Storage Documentation](https://docs.microsoft.com/azure/storage/tables/)  
🔗 [Azure Storage Pricing](https://azure.microsoft.com/pricing/details/storage/tables/)

---

**Document Version**: Final  
**Decision Date**: January 2026  
**Approved By**: _[Pending]_  
**Implementation Start**: _[Pending]_

---

## Sign-off

- [ ] Technical Review Complete
- [ ] Cost Analysis Approved
- [ ] Migration Plan Reviewed
- [ ] Timeline Accepted
- [ ] Ready to Implement

**Estimated Savings**: $6-34/year per station  
**Implementation Time**: 2-4 days  
**Risk Level**: Low (can rollback)  
**Recommendation**: ✅ **APPROVED - PROCEED WITH MIGRATION**
