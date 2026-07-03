# Brigade Data Separation - Reproduction Test Cases

**Purpose:** Manual test cases to reproduce cross-brigade data contamination issues  
**Date:** February 7, 2026  
**Prerequisites:** 
- Development environment running (`npm run dev` in both frontend and backend)
- At least 2 stations configured with different brigadeIds
- Browser with DevTools (Chrome/Firefox recommended)

---

## Test Setup

### Environment Setup

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Verify backend is running
curl http://localhost:3000/health

# Get list of stations
curl http://localhost:3000/api/stations | jq
```

### Create Test Stations (if needed)

```bash
# Create Station A (Brigade 1)
curl -X POST http://localhost:3000/api/stations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Station A",
    "brigadeId": "brigade-1",
    "brigadeName": "Test Brigade 1"
  }'

# Create Station B (Brigade 2)
curl -X POST http://localhost:3000/api/stations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Station B", 
    "brigadeId": "brigade-2",
    "brigadeName": "Test Brigade 2"
  }'
```

---

## Test Case 1: Cross-Brigade WebSocket Event Visibility

**Objective:** Verify that WebSocket events from Brigade A are visible in Brigade B (BUG)

**Severity:** 🚨 CRITICAL

### Steps

1. **Open Browser A (Station A)**
   - Navigate to `http://localhost:5173`
   - Select "Test Station A" from station selector
   - Open DevTools → Console
   - Run this script:
   ```javascript
   // Browser A Console
   const socketA = io('http://localhost:3000', {
     transports: ['websocket']
   });
   
   socketA.on('connect', () => {
     console.log('Station A: Socket connected', socketA.id);
   });
   
   socketA.on('event-update', (data) => {
     console.log('🔴 Station A received event-update:', data);
   });
   
   socketA.on('checkin-update', (data) => {
     console.log('🔴 Station A received checkin-update:', data);
   });
   
   socketA.on('activity-update', (data) => {
     console.log('🔴 Station A received activity-update:', data);
   });
   ```

2. **Open Browser B (Station B)**
   - Open a NEW browser window (or incognito mode)
   - Navigate to `http://localhost:5173`
   - Select "Test Station B" from station selector
   - Open DevTools → Console
   - Run this script:
   ```javascript
   // Browser B Console
   const socketB = io('http://localhost:3000', {
     transports: ['websocket']
   });
   
   socketB.on('connect', () => {
     console.log('Station B: Socket connected', socketB.id);
   });
   
   socketB.on('event-update', (data) => {
     console.log('🟢 Station B received event-update:', data);
   });
   
   socketB.on('checkin-update', (data) => {
     console.log('🟢 Station B received checkin-update:', data);
   });
   
   socketB.on('activity-update', (data) => {
     console.log('🟢 Station B received activity-update:', data);
   });
   ```

3. **Trigger Event in Browser A**
   - In Browser A, navigate to Sign-In page
   - Add a test member if needed
   - Perform a member check-in

4. **Observe Browser B Console**
   - **BUG CONFIRMED:** Browser B console shows `🟢 Station B received checkin-update`
   - **EXPECTED:** Browser B should NOT receive any event

5. **Trigger Event Creation**
   - In Browser A, create a new event (Training, Callout, etc.)
   - **BUG CONFIRMED:** Browser B console shows `🟢 Station B received event-update`
   - **EXPECTED:** Browser B should NOT receive any event

### Expected Results

- ❌ **Current Behavior:** Browser B receives ALL events from Browser A
- ✅ **Expected Behavior:** Browser B receives NO events from Browser A
- ✅ **Expected Behavior:** Only events from Station B should appear in Browser B

### Evidence Collection

```bash
# Screenshot Browser A console showing events
# Screenshot Browser B console showing events (BUG)
# Save both screenshots as evidence
```

---

## Test Case 2: Cross-Brigade Truck Check Updates

**Objective:** Verify that truck check updates from Brigade A are visible in Brigade B (BUG)

**Severity:** ⚠️ HIGH

### Steps

1. **Setup both browsers** (same as Test Case 1)

2. **Add Truck Check Listeners**
   ```javascript
   // Browser A
   socketA.on('truck-check-update', (data) => {
     console.log('🔴 Station A truck check:', data);
   });
   
   // Browser B
   socketB.on('truck-check-update', (data) => {
     console.log('🟢 Station B truck check:', data);
   });
   ```

3. **Start Truck Check in Browser A**
   - Navigate to Truck Check page
   - Start a new truck check for any appliance
   - Answer several checklist questions

4. **Observe Browser B Console**
   - **BUG CONFIRMED:** Browser B receives `truck-check-update` events
   - Events show: `contributor-joined`, `question-answered`, `check-completed`

### Expected Results

- ❌ **Current Behavior:** Browser B receives truck check updates from Browser A
- ✅ **Expected Behavior:** Browser B receives NO truck check updates from Browser A

---

## Test Case 3: Offline Cache Contamination

**Objective:** Verify that cached data from Station A persists when switching to Station B in offline mode (BUG)

**Severity:** ⚠️ HIGH

### Steps

1. **Browser A - Cache Data for Station A**
   - Navigate to `http://localhost:5173`
   - Select "Test Station A"
   - Navigate to Sign-In page (loads members)
   - Open DevTools → Application → IndexedDB → `station-manager-db` → `cached-data`
   - Verify entries exist with keys like `members`, `events`, etc.
   - Note: NO `stationId` in the cache keys (BUG)

2. **Switch to Station B**
   - Change station selection to "Test Station B"
   - Navigate to Sign-In page (loads Station B members)
   - Check IndexedDB again
   - **BUG CONFIRMED:** Cache keys are OVERWRITTEN (no station isolation)

3. **Go Offline**
   - Open DevTools → Network tab
   - Check "Offline" checkbox
   - Reload the page

4. **Observe Cached Data**
   - Page loads using cached data
   - **BUG CONFIRMED:** Shows data from most recent station cached, not necessarily current station
   - If you switch stations while offline, wrong data is displayed

### Expected Results

- ❌ **Current Behavior:** Cache keys lack station context (`members`, `events`)
- ✅ **Expected Behavior:** Cache keys should include station (`station-A:members`, `station-B:members`)
- ❌ **Current Behavior:** Switching stations offline shows wrong cached data
- ✅ **Expected Behavior:** Switching stations offline should show "No offline data for this station"

### Manual Verification

```javascript
// Browser Console - Check cached keys
const dbRequest = indexedDB.open('station-manager-db');
dbRequest.onsuccess = () => {
  const db = dbRequest.result;
  const tx = db.transaction('cached-data', 'readonly');
  const store = tx.objectStore('cached-data');
  const getAllRequest = store.getAll();
  
  getAllRequest.onsuccess = () => {
    console.log('Cached entries:', getAllRequest.result);
    getAllRequest.result.forEach(entry => {
      console.log('Cache key:', entry.key); // ❌ Should include stationId
    });
  };
};
```

---

## Test Case 4: Cross-Brigade Activity Changes

**Objective:** Verify that activity changes from Brigade A are visible in Brigade B (BUG)

**Severity:** 🚨 CRITICAL

### Steps

1. **Setup both browsers** (same as Test Case 1)

2. **Change Activity in Browser A**
   - In Browser A, change the current activity (Training, Maintenance, etc.)
   - This triggers `activity-change` WebSocket event

3. **Observe Browser B Console**
   - **BUG CONFIRMED:** Browser B receives `activity-update` event
   - Browser B may update UI to show Station A's activity (if not filtering)

### Expected Results

- ❌ **Current Behavior:** Browser B receives activity updates from Browser A
- ✅ **Expected Behavior:** Browser B receives NO activity updates from Browser A

---

## Test Case 5: Station Management Broadcasts

**Objective:** Verify that station CRUD operations broadcast to all clients (INFO DISCLOSURE)

**Severity:** 📋 MEDIUM

### Steps

1. **Setup both browsers** (same as Test Case 1)

2. **Add Station Management Listeners**
   ```javascript
   // Browser A
   socketA.on('station-created', (data) => {
     console.log('🔴 Station A: station-created', data);
   });
   
   // Browser B
   socketB.on('station-created', (data) => {
     console.log('🟢 Station B: station-created', data);
   });
   ```

3. **Create a New Station**
   - Use API or admin UI to create a new station
   ```bash
   curl -X POST http://localhost:3000/api/stations \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Station C",
       "brigadeId": "brigade-3",
       "brigadeName": "Test Brigade 3"
     }'
   ```

4. **Observe Both Consoles**
   - **CONFIRMED:** BOTH Browser A and Browser B receive `station-created` event
   - This may be intentional for global station awareness, but worth reviewing

### Expected Results

- ⚠️ **Current Behavior:** All clients receive station management events
- ❓ **Review Required:** Should station management be:
  - Admin-only broadcasts?
  - Brigade-scoped broadcasts?
  - Global broadcasts (current)?

---

## Test Case 6: Offline Queue Context Validation

**Objective:** Verify that queued actions preserve station context when switching stations offline

**Severity:** 📋 MEDIUM

### Steps

1. **Browser A - Queue Action for Station A**
   - Select "Test Station A"
   - Go offline (DevTools → Network → Offline)
   - Perform an action (e.g., check-in a member)
   - Action is queued in IndexedDB

2. **Check Queue Structure**
   ```javascript
   // Browser Console
   const dbRequest = indexedDB.open('station-manager-db');
   dbRequest.onsuccess = () => {
     const db = dbRequest.result;
     const tx = db.transaction('offline-queue', 'readonly');
     const store = tx.objectStore('offline-queue');
     const getAllRequest = store.getAll();
     
     getAllRequest.onsuccess = () => {
       console.log('Queued actions:', getAllRequest.result);
       getAllRequest.result.forEach(action => {
         console.log('Action:', action);
         console.log('Has stationId?', 'stationId' in action); // ❌ Should be true
       });
     };
   };
   ```

3. **Switch to Station B (Still Offline)**
   - Select "Test Station B"
   - Perform another action (e.g., create event)
   - Action is queued

4. **Come Back Online**
   - Disable offline mode
   - Queue processes

5. **Verify Actions Execute with Correct Context**
   - Check backend logs
   - Verify each action used correct `X-Station-Id` header
   - **POTENTIAL BUG:** If actions don't preserve stationId, they may execute with wrong context

### Expected Results

- ❌ **Current Behavior:** QueuedAction interface may not include `stationId` field
- ✅ **Expected Behavior:** Each queued action should store `stationId` for validation
- ✅ **Expected Behavior:** Queue processing should verify current station matches action's station

---

## Test Case 7: Cross-Brigade Member Visibility

**Objective:** Verify that member lists are properly filtered by station in API responses

**Severity:** INFO (Baseline verification)

### Steps

1. **Create Members in Both Stations**
   ```bash
   # Create member in Station A
   curl -X POST http://localhost:3000/api/members \
     -H "Content-Type: application/json" \
     -H "X-Station-Id: station-A-id" \
     -d '{
       "name": "Member A1",
       "stationId": "station-A-id"
     }'
   
   # Create member in Station B
   curl -X POST http://localhost:3000/api/members \
     -H "Content-Type: application/json" \
     -H "X-Station-Id: station-B-id" \
     -d '{
       "name": "Member B1",
       "stationId": "station-B-id"
     }'
   ```

2. **Fetch Members for Station A**
   ```bash
   curl http://localhost:3000/api/members \
     -H "X-Station-Id: station-A-id"
   ```

3. **Fetch Members for Station B**
   ```bash
   curl http://localhost:3000/api/members \
     -H "X-Station-Id: station-B-id"
   ```

4. **Verify Results**
   - Station A response should ONLY include Member A1
   - Station B response should ONLY include Member B1
   - **If both show all members:** API filtering is broken (CRITICAL BUG)

### Expected Results

- ✅ **Expected:** API properly filters members by `X-Station-Id` header
- ❌ **Bug:** If API returns all members regardless of header

---

## Summary of Test Results

| Test Case | Status | Severity | Expected Result | Actual Result |
|-----------|--------|----------|-----------------|---------------|
| Test 1: WebSocket Event Visibility | ❌ FAIL | CRITICAL | No cross-brigade events | All events broadcast globally |
| Test 2: Truck Check Updates | ❌ FAIL | HIGH | No cross-brigade updates | All updates broadcast globally |
| Test 3: Offline Cache Contamination | ❌ FAIL | HIGH | Station-scoped cache | Global cache keys |
| Test 4: Activity Changes | ❌ FAIL | CRITICAL | No cross-brigade updates | All updates broadcast globally |
| Test 5: Station Management | ⚠️ REVIEW | MEDIUM | TBD: Admin/brigade/global? | All clients notified |
| Test 6: Offline Queue Context | ⚠️ REVIEW | MEDIUM | Actions preserve stationId | May not include stationId |
| Test 7: Member API Filtering | ✅ PASS | N/A | Filtered by X-Station-Id | Likely working (verify) |

---

## Post-Fix Verification

After implementing fixes, re-run ALL test cases and verify:

- [ ] Test 1: Browser B does NOT receive events from Browser A
- [ ] Test 2: Browser B does NOT receive truck check updates from Browser A
- [ ] Test 3: Cache keys include `station-${stationId}:` prefix
- [ ] Test 4: Browser B does NOT receive activity updates from Browser A
- [ ] Test 5: Station management events follow intended broadcast strategy
- [ ] Test 6: Queued actions include and validate `stationId`
- [ ] Test 7: API filtering continues to work correctly

---

## Automated Test Script

For easier reproduction, use this automated test script:

```bash
#!/bin/bash
# File: test-brigade-isolation.sh

echo "🔍 Testing Brigade Data Separation..."

BACKEND_URL="http://localhost:3000"

# Test 1: Check WebSocket events
echo "Test 1: WebSocket Event Isolation"
echo "→ Open 2 browser windows and check consoles for cross-brigade events"
echo "→ Expected: Each browser only sees its own station's events"
read -p "Press Enter to continue..."

# Test 2: Check offline cache keys
echo "Test 2: Offline Cache Isolation"
echo "→ Open DevTools → Application → IndexedDB → station-manager-db → cached-data"
echo "→ Expected: Cache keys should include station context (e.g., 'station-123:members')"
read -p "Press Enter to continue..."

# Test 3: Check API filtering
echo "Test 3: API Filtering"
echo "→ Fetching members for different stations..."

STATION_A=$(curl -s ${BACKEND_URL}/api/stations | jq -r '.[0].id')
STATION_B=$(curl -s ${BACKEND_URL}/api/stations | jq -r '.[1].id')

echo "Station A members:"
curl -s ${BACKEND_URL}/api/members -H "X-Station-Id: ${STATION_A}" | jq

echo "Station B members:"
curl -s ${BACKEND_URL}/api/members -H "X-Station-Id: ${STATION_B}" | jq

echo "→ Expected: Each station should only see its own members"

echo "✅ Manual verification required for WebSocket and cache tests"
```

---

**Document Status:** READY FOR USE  
**Last Updated:** 2026-02-07
