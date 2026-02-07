#!/bin/bash
# Brigade Data Separation Validation Script
# Run this script to perform basic validation of the fixes

echo "=================================================="
echo "Brigade Data Separation - Manual Validation Script"
echo "=================================================="
echo ""

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

echo "Configuration:"
echo "  Backend URL: $BACKEND_URL"
echo "  Frontend URL: $FRONTEND_URL"
echo ""

# Check if backend is running
echo "1. Checking backend health..."
if curl -s "${BACKEND_URL}/health" > /dev/null 2>&1; then
  echo "   ✅ Backend is running"
else
  echo "   ❌ Backend is NOT running. Start with: cd backend && npm run dev"
  exit 1
fi

# Check if frontend is running
echo ""
echo "2. Checking frontend availability..."
if curl -s "${FRONTEND_URL}" > /dev/null 2>&1; then
  echo "   ✅ Frontend is running"
else
  echo "   ⚠️  Frontend may not be running. Start with: cd frontend && npm run dev"
fi

# Get stations list
echo ""
echo "3. Fetching stations..."
STATIONS=$(curl -s "${BACKEND_URL}/api/stations" | jq -r '.[] | "\(.id) - \(.name) (Brigade: \(.brigadeName // "N/A"))"' 2>/dev/null)
if [ -n "$STATIONS" ]; then
  echo "   Available stations:"
  echo "$STATIONS" | sed 's/^/     /'
  STATION_COUNT=$(echo "$STATIONS" | wc -l)
  echo ""
  if [ "$STATION_COUNT" -lt 2 ]; then
    echo "   ⚠️  Only $STATION_COUNT station(s) found. Testing requires at least 2 stations."
    echo "   Create more stations via API or UI for comprehensive testing."
  else
    echo "   ✅ Found $STATION_COUNT stations (sufficient for testing)"
  fi
else
  echo "   ❌ Failed to fetch stations or no stations configured"
  exit 1
fi

echo ""
echo "=================================================="
echo "Manual Testing Instructions"
echo "=================================================="
echo ""
echo "Test 1: WebSocket Room Isolation"
echo "--------------------------------"
echo "1. Open Browser A: ${FRONTEND_URL}"
echo "2. Select Station A from the list above"
echo "3. Open DevTools Console (F12)"
echo "4. Run this script in console:"
echo ""
cat << 'EOF'
const socket = io('http://localhost:3000', { transports: ['websocket'] });
socket.on('connect', () => console.log('✅ Connected:', socket.id));
socket.on('joined-station', (d) => console.log('✅ Joined station:', d));
socket.on('checkin-update', (d) => console.log('📥 Checkin:', d));
socket.on('event-update', (d) => console.log('📥 Event:', d));
socket.on('activity-update', (d) => console.log('📥 Activity:', d));
EOF
echo ""
echo "5. Open Browser B (or incognito) with same steps but select Station B"
echo "6. In Browser A: Perform a check-in or create an event"
echo "7. EXPECTED: Browser B console should NOT show any messages"
echo "8. RESULT: [ ] PASS  [ ] FAIL"
echo ""

echo "Test 2: Offline Cache Isolation"
echo "--------------------------------"
echo "1. Open Browser A: ${FRONTEND_URL}"
echo "2. Select Station A"
echo "3. Navigate to Sign-In page (loads members)"
echo "4. Open DevTools → Application → IndexedDB → station-manager-db → cached-data"
echo "5. Verify cache keys START with 'station-' prefix"
echo "6. Switch to Station B"
echo "7. Verify NEW cache keys for Station B (different prefix)"
echo "8. Go offline (DevTools → Network → Offline)"
echo "9. Reload page"
echo "10. EXPECTED: Shows Station B data, NOT Station A data"
echo "11. RESULT: [ ] PASS  [ ] FAIL"
echo ""

echo "Test 3: Station Context in Queue"
echo "---------------------------------"
echo "1. Open Browser: ${FRONTEND_URL}"
echo "2. Select a station"
echo "3. Go offline (DevTools → Network → Offline)"
echo "4. Perform an action (e.g., check-in a member)"
echo "5. Open DevTools → Application → IndexedDB → station-manager-db → offline-queue"
echo "6. Inspect the queued action"
echo "7. EXPECTED: Action has 'stationId' field with correct station ID"
echo "8. RESULT: [ ] PASS  [ ] FAIL"
echo ""

echo "Test 4: Room Re-Join on Station Switch"
echo "---------------------------------------"
echo "1. Open Browser: ${FRONTEND_URL}"
echo "2. Open DevTools Console"
echo "3. Select Station A from dropdown"
echo "4. Look for console message: 'Joining station room: <station-A-id>'"
echo "5. Switch to Station B"
echo "6. Look for console message: 'Station changed, joining new room: <station-B-id>'"
echo "7. EXPECTED: Clear logs showing room transitions"
echo "8. RESULT: [ ] PASS  [ ] FAIL"
echo ""

echo "=================================================="
echo "Automated Backend Check"
echo "=================================================="
echo ""

# Extract station IDs
STATION_A=$(curl -s "${BACKEND_URL}/api/stations" | jq -r '.[0].id' 2>/dev/null)
STATION_B=$(curl -s "${BACKEND_URL}/api/stations" | jq -r '.[1].id' 2>/dev/null)

if [ -n "$STATION_A" ] && [ "$STATION_A" != "null" ]; then
  echo "Station A ID: $STATION_A"
  echo "Testing API filtering for Station A..."
  MEMBERS_A=$(curl -s -H "X-Station-Id: $STATION_A" "${BACKEND_URL}/api/members" | jq '. | length' 2>/dev/null)
  echo "  Members in Station A: ${MEMBERS_A:-0}"
fi

if [ -n "$STATION_B" ] && [ "$STATION_B" != "null" ]; then
  echo "Station B ID: $STATION_B"
  echo "Testing API filtering for Station B..."
  MEMBERS_B=$(curl -s -H "X-Station-Id: $STATION_B" "${BACKEND_URL}/api/members" | jq '. | length' 2>/dev/null)
  echo "  Members in Station B: ${MEMBERS_B:-0}"
fi

echo ""
echo "✅ Validation script complete!"
echo ""
echo "Next Steps:"
echo "1. Run the manual tests above"
echo "2. Document results in VALIDATION_REPORT.md"
echo "3. If all tests pass, ready for deployment"
echo "4. If any tests fail, review logs and code"
echo ""
echo "For detailed reproduction steps, see:"
echo "  docs/current_state/REPRODUCTION_TESTS.md"
echo ""
