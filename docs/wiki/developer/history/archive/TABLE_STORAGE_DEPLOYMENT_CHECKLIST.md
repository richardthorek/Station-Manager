# Table Storage Migration - Deployment Checklist

**Purpose:** Step-by-step checklist for migrating from Cosmos DB to Azure Table Storage  
**Expected Duration:** 2-4 hours  
**Cost Savings:** 70-95% ($0.10-2/month vs $0.50-3/month)

---

## Pre-Deployment

### ✅ Prerequisites

- [ ] Azure Storage Account exists (or plan to create one)
- [ ] Access to Azure Portal and Azure CLI
- [ ] Current Cosmos DB connection string (for fallback)
- [ ] App Service deployment access
- [ ] Member list backup (optional - can re-register)

### ✅ Code Preparation

- [x] Table Storage services implemented (`tableStorageDatabase.ts`, `tableStorageTruckChecksDatabase.ts`)
- [x] Database factories updated with Table Storage support
- [x] `USE_TABLE_STORAGE` environment variable support added
- [x] TypeScript compilation successful
- [x] Documentation updated (AS_BUILT.md, AZURE_DEPLOYMENT.md)

---

## Deployment Steps

### Step 1: Get Storage Connection String

**Option A: Use Existing Storage Account**
```bash
az storage account show-connection-string \
  --name <your-storage-account> \
  --resource-group <your-resource-group> \
  --output tsv
```

**Option B: Create New Storage Account**
```bash
az storage account create \
  --name stationstorageXXXXX \
  --resource-group <your-resource-group> \
  --location australiaeast \
  --sku Standard_LRS

az storage account show-connection-string \
  --name stationstorageXXXXX \
  --resource-group <your-resource-group> \
  --output tsv
```

- [ ] Storage account connection string obtained
- [ ] Connection string saved securely

### Step 2: Deploy Updated Code

```bash
cd /path/to/Station-Manager
npm run build
# Deploy via Azure App Service deployment method
```

- [ ] Code deployed to App Service
- [ ] Deployment successful (check logs)

### Step 3: Configure Environment Variables

```bash
az webapp config appsettings set \
  --name bungrfsstation \
  --resource-group <your-resource-group> \
  --settings \
    USE_TABLE_STORAGE=true \
    AZURE_STORAGE_CONNECTION_STRING="<your-connection-string>" \
    MONGODB_URI="<cosmos-connection-string>"
```

**Note:** Keep `MONGODB_URI` for 2 weeks as fallback

- [ ] `USE_TABLE_STORAGE=true` set
- [ ] `AZURE_STORAGE_CONNECTION_STRING` configured
- [ ] `MONGODB_URI` kept as fallback

### Step 4: Restart App Service

```bash
az webapp restart \
  --name bungrfsstation \
  --resource-group <your-resource-group>
```

- [ ] App Service restarted

### Step 5: Verify Connection

```bash
az webapp log tail \
  --name bungrfsstation \
  --resource-group <your-resource-group>
```

**Look for:**
```
✅ Connected to Azure Table Storage
✅ Connected to Table Storage for Truck Checks
```

- [ ] Table Storage connection confirmed
- [ ] No connection errors in logs
- [ ] Application starts successfully

### Step 6: Verify Tables Created

**In Azure Portal:**
1. Navigate to Storage Account
2. Go to "Tables" section
3. Verify tables exist:
   - Members
   - Activities
   - Events
   - EventParticipants
   - ActiveActivity
   - CheckIns
   - Appliances
   - ChecklistTemplates
   - CheckRuns
   - CheckResults

- [ ] All expected tables exist in storage account

---

## Post-Deployment Testing

### Functional Testing

- [ ] **Member Management:**
  - [ ] Create new member
  - [ ] Update member details
  - [ ] Search for member
  - [ ] View member profile

- [ ] **Activity Management:**
  - [ ] View activities list
  - [ ] Select active activity
  - [ ] Create custom activity

- [ ] **Event System:**
  - [ ] Create new event
  - [ ] Add participant to event
  - [ ] View active events
  - [ ] End event

- [ ] **Truck Checks:**
  - [ ] Start new check run
  - [ ] Complete checklist items
  - [ ] Upload photos (if applicable)
  - [ ] Complete check run
  - [ ] View historical checks

- [ ] **Real-Time Sync:**
  - [ ] Open app on two devices
  - [ ] Create member on device 1
  - [ ] Verify appears on device 2 (< 2 seconds)
  - [ ] Check in member on device 1
  - [ ] Verify updates on device 2

### Performance Testing

- [ ] Page load time < 2 seconds
- [ ] API responses < 500ms
- [ ] Database queries < 200ms (single partition)
- [ ] Real-time updates < 2 seconds

### Data Migration (Optional)

If preserving existing members:

- [ ] Export member list from Cosmos DB
- [ ] Re-create members in UI or via API
- [ ] Verify all members present

**Alternative:** Let members re-register on first use (simpler)

---

## Monitoring (First 2 Weeks)

### Daily Checks

- [ ] Application uptime (Azure Portal)
- [ ] Error logs (Azure App Service Logs)
- [ ] Storage account transactions (Monitor tab)
- [ ] Cost accumulation (Cost Management)

### Weekly Checks

- [ ] User feedback collection
- [ ] Performance metrics review
- [ ] Cost comparison vs Cosmos DB
- [ ] Any issues reported

### Cost Monitoring

**Expected Costs (Table Storage):**
- Storage: $0.01-0.05/month
- Transactions: $0.05-0.20/month
- **Total: $0.06-0.25/month**

**Previous Costs (Cosmos DB):**
- RU consumption: $0.50-3/month

- [ ] Week 1: Cost tracking enabled
- [ ] Week 2: Costs within expected range
- [ ] Savings confirmed (70-95%)

---

## Rollback Plan (If Needed)

### Quick Rollback (< 5 minutes)

```bash
# Disable Table Storage, use Cosmos DB
az webapp config appsettings set \
  --name bungrfsstation \
  --resource-group <your-resource-group> \
  --settings \
    USE_TABLE_STORAGE=false

# Restart
az webapp restart \
  --name bungrfsstation \
  --resource-group <your-resource-group>
```

- [ ] Rollback procedure tested in staging (optional)
- [ ] Rollback steps documented and accessible

### When to Rollback

- Critical functionality broken
- Performance significantly degraded (> 2x slower)
- Data integrity issues
- Unresolvable errors

---

## Final Cleanup (After 2 Weeks Success)

**⚠️ Only perform after confirming Table Storage is stable**

### Remove Cosmos DB Fallback

```bash
az webapp config appsettings delete \
  --name bungrfsstation \
  --resource-group <your-resource-group> \
  --setting-names MONGODB_URI
```

- [ ] 2 weeks elapsed since migration
- [ ] No stability issues observed
- [ ] User feedback positive
- [ ] Cost savings confirmed
- [ ] `MONGODB_URI` removed from App Service

### Optional: Delete Cosmos DB Account

**⚠️ ONLY if you're certain you won't need it**

```bash
# Export final backup first
# (mongoexport or manual backup)

az cosmosdb delete \
  --name <your-cosmos-db-name> \
  --resource-group <your-resource-group>
```

- [ ] Final backup created and stored
- [ ] Confirmed no other apps use this Cosmos DB
- [ ] Cosmos DB account deleted (optional)
- [ ] Cost savings fully realized

---

## Success Criteria

### Must Have (Week 1)
- [x] Table Storage connection successful
- [ ] All features working
- [ ] Real-time sync functional
- [ ] No data loss
- [ ] Performance acceptable

### Should Have (Week 2)
- [ ] Cost reduction confirmed (70-95%)
- [ ] No stability issues
- [ ] User feedback positive or neutral
- [ ] Ready to remove Cosmos DB fallback

### Nice to Have (Month 1)
- [ ] Performance metrics documented
- [ ] Lessons learned documented
- [ ] Migration guide refined
- [ ] Consider other stations for migration

---

## Support & Troubleshooting

### Common Issues

**Issue:** Tables not creating
- **Solution:** Check connection string, verify storage account access, check firewall rules

**Issue:** High latency
- **Solution:** Verify partition key strategy, check Azure region co-location, review query patterns

**Issue:** Data not syncing
- **Solution:** Check Socket.io events, verify real-time updates in backend logs

**Issue:** Connection errors
- **Solution:** Verify environment variables, check storage account status, review app service logs

### Getting Help

1. Check application logs: `az webapp log tail`
2. Check storage account metrics in Azure Portal
3. Review TABLE_STORAGE_MIGRATION_PLAN.md
4. Check GitHub issues or create new one
5. Review AS_BUILT.md for architecture details

### Contacts

- **Project Owner:** @richardthorek
- **Documentation:** `docs/` directory
- **Issue Tracker:** GitHub Issues

---

## Deployment Record

**Migration Date:** _________________  
**Performed By:** _________________  
**Storage Account:** _________________  
**Initial Cost (Month 1):** _________________  
**Issues Encountered:** _________________  
**Resolution Time:** _________________  
**Final Status:** ☐ Success ☐ Rollback ☐ Ongoing

**Notes:**
____________________________________________
____________________________________________
____________________________________________

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Next Review:** After first deployment
