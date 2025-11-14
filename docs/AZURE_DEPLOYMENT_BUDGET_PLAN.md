# Azure Deployment Plan - Budget-Friendly Architecture

**Document Version:** 2.0  
**Last Updated:** November 2024  
**Status:** Recommended Architecture Options

---

## Executive Summary

This document presents **budget-optimized Azure deployment architectures** for the RFS Station Manager application, with detailed analysis of costs, trade-offs, and real-time synchronization (WebSocket) support. The goal is to minimize monthly costs while maintaining essential functionality for a volunteer organization.

**Key Recommendation:** Multiple viable options are presented, ranging from **$0-5 AUD/month** (fully free tier) to **$13+ AUD/month** (production-grade), each with different trade-offs.

---

## Table of Contents

1. [Current Architecture Review](#1-current-architecture-review)
2. [Budget-Friendly Architecture Options](#2-budget-friendly-architecture-options)
3. [WebSocket/Real-Time Sync Analysis](#3-websocketreal-time-sync-analysis)
4. [Detailed Cost Comparison](#4-detailed-cost-comparison)
5. [Implementation Recommendations](#5-implementation-recommendations)
6. [Migration Path](#6-migration-path)
7. [Appendix: Technical Details](#7-appendix-technical-details)

---

## 1. Current Architecture Review

### 1.1 Current Implementation
The application is built with:
- **Frontend:** React + TypeScript + Vite (static build output)
- **Backend:** Node.js + Express + Socket.io (WebSockets for real-time sync)
- **Database:** In-memory (development only, needs persistent storage)
- **Real-time:** Socket.io for instant synchronization across devices

### 1.2 Current Deployment Plan (from AZURE_DEPLOYMENT.md)
- **Frontend:** Azure Static Web Apps (Free tier available)
- **Backend:** Azure App Service B1 tier (~$13 AUD/month)
- **Database:** Azure Cosmos DB (Free tier) or Table Storage (~$1 AUD/month)
- **Total Cost:** ~$13-15 AUD/month

### 1.3 Key Requirements
- ✅ Real-time synchronization across multiple devices (< 2 seconds)
- ✅ Support for 10+ concurrent users
- ✅ WebSocket support for live updates
- ✅ Persistent data storage
- ✅ High availability for volunteer organization
- ✅ Budget-friendly for low-traffic usage

---

## 2. Budget-Friendly Architecture Options

### Option A: Azure Container Apps + Static Web Apps + Table Storage
**💰 Cost: $0-5 AUD/month (likely $0 with free tier)**

#### Architecture
```
┌──────────────────────────┐
│  Azure Static Web Apps   │  ← React Frontend (Free tier)
│     (Free Tier)          │
└────────────┬─────────────┘
             │ HTTP + WebSocket
┌────────────▼─────────────┐
│  Azure Container Apps    │  ← Node.js + Socket.io Backend
│   (Consumption Plan)     │    (Free tier: 180K vCPU-sec/month)
│   - WebSocket Support    │
│   - Scale to Zero        │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│  Azure Table Storage     │  ← Data Persistence
│   (Pay-as-you-go)        │    (~$1-2/month for low traffic)
└──────────────────────────┘
```

#### Key Features
- **✅ Full WebSocket support** via Container Apps
- **✅ Scale to zero** - no cost when idle
- **✅ Free tier:** 180,000 vCPU-seconds + 360,000 GiB-seconds + 2M requests/month
- **✅ Pay only for usage** beyond free tier

#### Pros
- ✅ **Extremely cost-effective**: Free tier covers typical volunteer org usage
- ✅ **WebSocket/Socket.io works natively** - no code changes needed
- ✅ **Scales automatically** from 0 to 300+ instances
- ✅ **Production-ready** - not a "toy" solution
- ✅ **Simple deployment** with Docker container

#### Cons
- ⚠️ **Cold start delay** (2-5 seconds) when scaling from zero
- ⚠️ **Slightly more complex** than App Service (requires container image)
- ⚠️ **Container knowledge** helpful but not required

#### Estimated Monthly Cost
- **Static Web Apps:** $0 (Free tier - 100GB bandwidth/month)
- **Container Apps:** $0 (within free tier for <10 concurrent users)
- **Table Storage:** $1-2 (0.36¢ per 10K transactions + storage)
- **TOTAL:** **$0-5 AUD/month**

---

### Option B: Azure Static Web Apps + Azure Functions + Azure SignalR/Web PubSub
**💰 Cost: $0-5 AUD/month (free tier only)**

#### Architecture
```
┌──────────────────────────┐
│  Azure Static Web Apps   │  ← React Frontend + API Routes
│   - Frontend (dist/)     │
│   - Azure Functions API  │  ← HTTP API endpoints
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│  Azure SignalR Service   │  ← Real-time messaging
│   or Azure Web PubSub    │    (Free: 20 connections, 20K msgs/day)
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│  Azure Table Storage     │  ← Data Persistence
└──────────────────────────┘
```

#### Key Features
- **✅ Fully serverless** architecture
- **✅ Built-in Functions integration** with Static Web Apps
- **✅ SignalR/Web PubSub** for real-time messaging

#### Pros
- ✅ **True serverless** - no servers to manage
- ✅ **Free tier available** for SignalR/Web PubSub
- ✅ **Integrated deployment** with Static Web Apps
- ✅ **No cold starts** for static content

#### Cons
- ⚠️ **Limited free tier**: Only 20 concurrent connections (may be tight for 10+ users)
- ⚠️ **Requires code changes**: Replace Socket.io with SignalR or Web PubSub SDK
- ⚠️ **More complex architecture**: Multiple Azure services to coordinate
- ⚠️ **Functions have limitations**: No persistent WebSocket connections

#### Estimated Monthly Cost
- **Static Web Apps:** $0 (Free tier)
- **Azure Functions:** $0 (within free tier for low traffic)
- **SignalR/Web PubSub:** $0 (Free tier: 20 concurrent connections)
- **Table Storage:** $1-2
- **TOTAL:** **$0-5 AUD/month**

**⚠️ WARNING:** Free tier limited to 20 concurrent connections. May not scale if >20 devices connect simultaneously.

---

### Option C: Current Plan - App Service + Static Web Apps + Table Storage
**💰 Cost: $13-15 AUD/month**

#### Architecture
```
┌──────────────────────────┐
│  Azure Static Web Apps   │  ← React Frontend
└────────────┬─────────────┘
             │ HTTP + WebSocket
┌────────────▼─────────────┐
│  Azure App Service (B1)  │  ← Node.js + Socket.io Backend
│   - Always On            │    (Basic tier, 1 core, 1.75GB RAM)
│   - WebSocket Enabled    │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│  Azure Table Storage     │  ← Data Persistence
└──────────────────────────┘
```

#### Key Features
- **✅ Always-on** - no cold starts
- **✅ Native WebSocket support** - Socket.io works out of the box
- **✅ Simple deployment** - just push code

#### Pros
- ✅ **Zero cold starts** - always responsive
- ✅ **No code changes** - Socket.io works as-is
- ✅ **Predictable performance**
- ✅ **Simple to deploy and manage**

#### Cons
- ⚠️ **Fixed monthly cost** even when idle (~$13/month)
- ⚠️ **Less cost-effective** for variable traffic

#### Estimated Monthly Cost
- **Static Web Apps:** $0
- **App Service B1:** $12-13
- **Table Storage:** $1-2
- **TOTAL:** **$13-15 AUD/month**

---

### Option D: Hybrid - Static Web Apps + Container Apps (Standby Mode) + Table Storage
**💰 Cost: $5-10 AUD/month**

#### Architecture
Same as Option A but with **"always warm"** configuration to eliminate cold starts.

#### Key Features
- **✅ Configured with minimum 1 replica** (always warm)
- **✅ No cold starts** - instant response
- **✅ Still more cost-effective** than App Service

#### Estimated Monthly Cost
- **Static Web Apps:** $0
- **Container Apps (1 replica always-on):** $5-8
- **Table Storage:** $1-2
- **TOTAL:** **$5-10 AUD/month**

---

## 3. WebSocket/Real-Time Sync Analysis

### 3.1 Critical Finding: Azure Functions Don't Support WebSockets

**Azure Functions and Static Web Apps API do NOT support WebSocket connections.**

From Microsoft documentation:
> "Azure Functions APIs are HTTP-only. WebSocket protocols are not supported."

This means **Option B requires replacing Socket.io** with Azure SignalR Service or Web PubSub.

### 3.2 WebSocket Support by Service

| Service | WebSocket Support | Native Socket.io | Notes |
|---------|-------------------|------------------|-------|
| **Azure App Service** | ✅ Yes | ✅ Yes | Full support, just enable in config |
| **Azure Container Apps** | ✅ Yes | ✅ Yes | Native support, no config needed |
| **Azure Functions** | ❌ No | ❌ No | HTTP only |
| **Azure SignalR** | ✅ Yes (via SDK) | ❌ No | Requires SDK integration |
| **Azure Web PubSub** | ✅ Yes (via SDK) | ❌ No | Requires SDK integration |

### 3.3 Real-Time Sync Options Analysis

#### Option 1: Keep Socket.io (Current Implementation)
**✅ Works with:** App Service, Container Apps  
**❌ Does NOT work with:** Azure Functions

**Pros:**
- ✅ No code changes required
- ✅ Battle-tested implementation
- ✅ Well-documented and widely used

**Cons:**
- ⚠️ Limits deployment to App Service or Container Apps

**Recommendation:** ✅ **Best option for budget** - use with Container Apps

---

#### Option 2: Switch to Azure SignalR Service
**✅ Works with:** Azure Functions, Static Web Apps, App Service, Container Apps

**Code Changes Required:**
```typescript
// OLD: Socket.io
import { io } from 'socket.io-client';
const socket = io('https://backend.azurewebsites.net');
socket.emit('checkin', data);

// NEW: Azure SignalR
import * as signalR from '@microsoft/signalr';
const connection = new signalR.HubConnectionBuilder()
  .withUrl('https://myapp.service.signalr.net')
  .build();
connection.invoke('CheckIn', data);
```

**Pros:**
- ✅ Works with serverless (Azure Functions)
- ✅ Excellent scaling
- ✅ Microsoft-managed infrastructure

**Cons:**
- ⚠️ Requires significant code changes (frontend + backend)
- ⚠️ Free tier limited to 20 concurrent connections
- ⚠️ More complex setup

**Recommendation:** ⚠️ **Only if must use Azure Functions**

---

#### Option 3: Switch to Azure Web PubSub
**✅ Works with:** Azure Functions, Static Web Apps, App Service, Container Apps

**Similar to SignalR but protocol-agnostic.**

**Recommendation:** ⚠️ **Similar trade-offs to SignalR**

---

#### Option 4: Polling Fallback
**✅ Works with:** Everything (HTTP-based)

**Implementation:**
```typescript
// Poll every 5 seconds
setInterval(async () => {
  const data = await fetch('/api/checkins');
  updateUI(data);
}, 5000);
```

**Pros:**
- ✅ Works everywhere
- ✅ Simple implementation
- ✅ No WebSocket dependencies

**Cons:**
- ⚠️ Higher latency (5-10 second delay)
- ⚠️ More server load
- ⚠️ Not true "real-time"

**Recommendation:** ⚠️ **Fallback only if WebSockets impossible**

---

### 3.4 Real-Time Sync Recommendation Matrix

| Requirement | Best Solution | Alternative |
|-------------|--------------|-------------|
| **Keep existing code** | Container Apps + Socket.io | App Service + Socket.io |
| **Lowest cost** | Container Apps + Socket.io | Polling with Functions |
| **True serverless** | Functions + SignalR | Functions + Web PubSub |
| **Simplest** | App Service + Socket.io | Container Apps + Socket.io |
| **Most scalable** | SignalR Service | Web PubSub |

---

## 4. Detailed Cost Comparison

### 4.1 Monthly Cost Breakdown

| Component | Option A (Container Apps) | Option B (Functions + SignalR) | Option C (App Service) | Option D (Container Apps Always-On) |
|-----------|--------------------------|-------------------------------|----------------------|-----------------------------------|
| **Frontend** | $0 (SWA Free) | $0 (SWA Free) | $0 (SWA Free) | $0 (SWA Free) |
| **Compute** | $0-2 (Free tier) | $0 (Free tier) | $12-13 (B1) | $5-8 (1 replica) |
| **Real-time** | $0 (included) | $0 (Free tier, 20 conn limit) | $0 (included) | $0 (included) |
| **Database** | $1-2 (Table Storage) | $1-2 (Table Storage) | $1-2 (Table Storage) | $1-2 (Table Storage) |
| **TOTAL** | **$0-5 AUD** | **$0-5 AUD** | **$13-15 AUD** | **$5-10 AUD** |

### 4.2 Cost Scaling (as usage grows)

**Scenario: 50 concurrent users, 500K requests/month**

| Option | Estimated Cost | Notes |
|--------|----------------|-------|
| **Option A** | $10-15 | Still within generous limits |
| **Option B** | $50+ | SignalR exceeds free tier (20 conn → 1 unit @ $1.61/day) |
| **Option C** | $13-15 | Same (fixed cost) |
| **Option D** | $8-12 | May need 2 replicas |

**Winner:** Option A (Container Apps) scales most cost-effectively.

---

### 4.3 Free Tier Limits Comparison

| Service | Free Tier Limit | What Happens When Exceeded |
|---------|-----------------|---------------------------|
| **Azure Static Web Apps** | 100GB bandwidth/month | Additional $0.20/GB |
| **Azure Container Apps** | 180K vCPU-sec, 360K GiB-sec, 2M requests | Pay per second of usage |
| **Azure Functions** | 1M requests, 400K GB-sec | Pay per execution |
| **Azure SignalR/Web PubSub** | 20 concurrent connections | Must upgrade to paid tier ($1.61/unit/day) |
| **Azure Table Storage** | None (pay-as-you-go) | $0.00036 per 10K operations |

**Key Insight:** Container Apps free tier is most generous for typical volunteer org usage.

---

## 5. Implementation Recommendations

### 5.1 Recommended Approach: Option A (Container Apps)

**Rationale:**
1. ✅ **Best cost-to-value ratio** ($0-5/month vs $13-15/month)
2. ✅ **No code changes required** (Socket.io works as-is)
3. ✅ **Production-ready** (not a compromise solution)
4. ✅ **Scales efficiently** (free tier → paid tiers)
5. ✅ **Cold starts acceptable** for volunteer org (2-5 sec initial delay after idle)

**When to choose this:**
- Budget is a priority
- Can tolerate 2-5 second cold start after idle periods
- Want modern cloud-native architecture

---

### 5.2 Alternative: Option D (Always-Warm Container Apps)

**If cold starts are unacceptable:**
- Configure Container Apps with minimum 1 replica
- Cost: $5-10/month (still cheaper than App Service)
- Zero cold starts

---

### 5.3 Not Recommended: Option B (Functions + SignalR)

**Why not:**
- ⚠️ Significant code refactoring required
- ⚠️ Free tier limited to 20 concurrent connections (tight for 10+ users)
- ⚠️ More complex architecture with multiple services
- ⚠️ Container Apps achieves same goals with less complexity

**When to consider:**
- Already using SignalR elsewhere
- Need to integrate with other Azure Functions

---

### 5.4 Fallback: Option C (App Service)

**When to choose:**
- Absolutely zero cold starts required
- Simple deployment is priority
- $13/month is acceptable budget

---

## 6. Migration Path

### 6.1 Phase 1: Add Azure Table Storage Support (All Options)

**Current State:** In-memory database (development only)  
**Target State:** Azure Table Storage for persistence

**Implementation Steps:**

1. **Install Azure Storage SDK:**
```bash
cd backend
npm install @azure/data-tables
```

2. **Create Table Storage Service:**
```typescript
// backend/src/services/tableStorage.ts
import { TableClient } from '@azure/data-tables';

export class TableStorageService {
  private membersTable: TableClient;
  private activitiesTable: TableClient;
  private checkInsTable: TableClient;

  constructor(connectionString: string) {
    this.membersTable = TableClient.fromConnectionString(
      connectionString, 
      'Members'
    );
    this.activitiesTable = TableClient.fromConnectionString(
      connectionString, 
      'Activities'
    );
    this.checkInsTable = TableClient.fromConnectionString(
      connectionString, 
      'CheckIns'
    );
  }

  // Implement CRUD methods...
}
```

3. **Replace in-memory database:**
```typescript
// backend/src/services/database.ts
- class DatabaseService { /* in-memory maps */ }
+ import { TableStorageService } from './tableStorage';
+ export const db = new TableStorageService(process.env.AZURE_STORAGE_CONNECTION_STRING);
```

**Testing:**
- Use Azurite (Azure Storage Emulator) locally
- Test all CRUD operations
- Verify data persists across restarts

---

### 6.2 Phase 2A: Deploy to Container Apps (Option A - Recommended)

**Steps:**

1. **Create Dockerfile:**
```dockerfile
# backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

2. **Build and push container:**
```bash
# Build
docker build -t rfs-station-backend:latest ./backend

# Push to Azure Container Registry (or Docker Hub)
az acr build --registry rfsstationacr \
  --image rfs-station-backend:latest \
  ./backend
```

3. **Create Container App:**
```bash
# Create Container App Environment
az containerapp env create \
  --name rfs-station-env \
  --resource-group rfs-station-manager \
  --location australiaeast

# Create Container App
az containerapp create \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --environment rfs-station-env \
  --image rfsstationacr.azurecr.io/rfs-station-backend:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 10 \
  --env-vars \
    AZURE_STORAGE_CONNECTION_STRING=secretref:storage-connection \
    FRONTEND_URL=https://YOUR_STATIC_WEB_APP.azurestaticapps.net
```

4. **Deploy frontend to Static Web Apps:**
```bash
cd frontend
npm run build

# Deploy
az staticwebapp create \
  --name rfs-station-frontend \
  --resource-group rfs-station-manager \
  --location australiaeast \
  --source dist
```

5. **Configure frontend environment:**
```env
VITE_API_URL=https://rfs-station-backend.australiaeast.azurecontainerapps.io/api
VITE_SOCKET_URL=https://rfs-station-backend.australiaeast.azurecontainerapps.io
```

---

### 6.2 Phase 2B: Deploy to App Service (Option C - Fallback)

**Follow existing AZURE_DEPLOYMENT.md instructions** - already documented.

---

### 6.3 Phase 2C: Deploy with Functions + SignalR (Option B - Not Recommended)

**This requires significant code changes.** Contact for detailed migration guide if needed.

---

## 7. Appendix: Technical Details

### 7.1 Azure Container Apps Deep Dive

**What is Container Apps?**
- Serverless container platform built on Kubernetes
- Runs any containerized application
- Scales from 0 to 300+ instances automatically
- Supports WebSockets, gRPC, HTTP/HTTPS

**Key Features:**
- **Scale to zero:** Reduces cost to $0 when idle
- **KEDA autoscaling:** Intelligent scaling based on load
- **Managed ingress:** Built-in load balancing and SSL
- **Dapr integration:** Microservices patterns built-in

**Perfect for:**
- API backends with WebSocket requirements
- Microservices architectures
- Variable traffic patterns
- Cost-sensitive deployments

---

### 7.2 Azure Table Storage Guidance

**Schema Design:**

| Table | Partition Key | Row Key | Notes |
|-------|--------------|---------|-------|
| Members | 'MEMBER' | memberId (UUID) | All members in one partition |
| Activities | 'ACTIVITY' | activityId (UUID) | Default + custom activities |
| CheckIns | date (YYYY-MM-DD) | checkInId (UUID) | Partition by date for efficient queries |
| ActiveActivity | 'ACTIVE' | 'CURRENT' | Single row for current activity |

**Performance Considerations:**
- Batch operations (up to 100 entities) count as 1 transaction
- Query by partition key is most efficient
- Use continuation tokens for large result sets

**Cost Optimization:**
- Batch check-in updates together
- Cache member list in-memory (rarely changes)
- Use PartitionKey for efficient queries

---

### 7.3 Cold Start Mitigation Strategies

**For Container Apps with Scale-to-Zero:**

1. **Warm-up ping** (free):
```typescript
// Add to frontend - ping backend every 5 minutes
setInterval(() => {
  fetch('/health').catch(() => {});
}, 5 * 60 * 1000);
```

2. **Set min replicas to 1** (costs $5-8/month):
```bash
az containerapp update \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --min-replicas 1
```

3. **Azure Front Door** (overkill for this use case)

**Typical Cold Start Times:**
- First request after idle: 2-5 seconds
- Subsequent requests: < 100ms
- After warmup: consistent < 100ms

**Is this acceptable?**
- ✅ For a volunteer organization: **Yes** (saves $10+/month)
- ⚠️ For commercial 24/7 app: Consider always-warm or App Service

---

### 7.4 WebSocket Connection Limits

| Service | Concurrent Connections | Cost Beyond Limit |
|---------|----------------------|-------------------|
| Azure App Service B1 | ~500 | N/A (fixed cost) |
| Azure Container Apps | Limited by CPU/RAM allocation | Scale automatically |
| Azure SignalR Free | 20 | $1.61/day per unit (1000 connections) |
| Azure Web PubSub Free | 20 | $1.61/day per unit (1000 connections) |

**For RFS Station Manager:**
- Expected concurrent users: < 10
- All options support this easily
- Container Apps recommended for cost efficiency

---

### 7.5 Security Considerations

**All Options:**
1. **Enable HTTPS only**
2. **Configure CORS** to allow only your frontend domain
3. **Use Managed Identity** for Azure service access (no connection strings in code)
4. **Enable Application Insights** for monitoring
5. **Set up Azure Key Vault** for secrets

**Container Apps Specific:**
- Enable built-in authentication (Entra ID, GitHub, etc.)
- Use secrets and environment variables properly
- Configure network security (if needed)

---

### 7.6 Monitoring and Debugging

**Recommended Setup:**
```bash
# Enable Application Insights
az monitor app-insights component create \
  --app rfs-station-insights \
  --location australiaeast \
  --resource-group rfs-station-manager

# Link to Container Apps
az containerapp update \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --set-env-vars \
    APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:appinsights-cs
```

**View logs:**
```bash
# Container Apps logs
az containerapp logs show \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --follow

# Table Storage metrics
az monitor metrics list \
  --resource /subscriptions/.../storageAccounts/rfsstationstorage \
  --metric Transactions
```

---

## Conclusion and Final Recommendation

### 🎯 Best Overall Solution: **Option A - Azure Container Apps**

**Why:**
1. **Cost:** $0-5 AUD/month (vs $13-15 for App Service)
2. **No code changes:** Socket.io works as-is
3. **Production-ready:** Not a compromise solution
4. **Scalable:** Handles growth efficiently
5. **Modern:** Cloud-native, serverless architecture

**Trade-off:** 2-5 second cold start after idle periods (acceptable for volunteer org)

**If cold starts are unacceptable:** Add $5-8/month for always-warm mode (still cheaper than App Service)

---

### 📊 Decision Matrix

| Priority | Choose This Option |
|----------|-------------------|
| **Lowest cost** | Option A (Container Apps, scale-to-zero) |
| **Zero cold starts** | Option D (Container Apps, always-warm) or Option C (App Service) |
| **No code changes** | Option A, C, or D |
| **True serverless** | Option B (Functions + SignalR) |
| **Simplest deployment** | Option C (App Service) |

---

### 🚀 Next Steps

1. **Review this document** and decide on preferred option
2. **Set up Azure account** and resource group
3. **Implement Phase 1:** Add Table Storage support to backend
4. **Deploy Phase 2A:** Container Apps deployment (recommended)
5. **Test thoroughly** across multiple devices
6. **Monitor costs** in first month to validate estimates
7. **Iterate** based on real-world usage

---

## Questions or Concerns?

**Common Questions:**

**Q: Will cold starts be noticeable to users?**  
A: First request after idle (e.g., first user in the morning) may take 2-5 seconds. Subsequent requests are instant. For a volunteer organization, this is typically acceptable.

**Q: What if we exceed the free tier?**  
A: Very unlikely for <10 concurrent users. If you do, Container Apps charges ~$0.000012 per vCPU-second, which is extremely low.

**Q: Can we switch between options later?**  
A: Yes! With Table Storage (Phase 1), your data is portable. You can switch between App Service and Container Apps easily.

**Q: Is Container Apps as reliable as App Service?**  
A: Yes. Container Apps is enterprise-grade, used by Microsoft and large companies. It's built on Azure Kubernetes Service (AKS).

---

**Document prepared for budget-conscious deployment decision-making.**  
**All pricing accurate as of November 2024.**
