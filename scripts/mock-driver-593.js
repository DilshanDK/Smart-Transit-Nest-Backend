const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:4000';
const ROUTE_ID = '593';
const BUS_NUMBER = 'WP-GA-9021';
const DRIVER_ID = '6480f8a1e12a459012345679';

// Helper for HTTP requests using fetch
async function apiCall(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const text = await response.text();
  try {
    return {
      status: response.status,
      data: JSON.parse(text)
    };
  } catch (e) {
    return {
      status: response.status,
      data: text
    };
  }
}

// Calculate bearing between two coordinates
function getBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

async function runMock() {
  console.log('🚍 Starting Mock Driver Telemetry (Matale to Kandy)...');

  // Load high-res route 593 coordinates
  const coordsPath = path.join(__dirname, 'route-593-highres.json');
  if (!fs.existsSync(coordsPath)) {
    console.error(`❌ Coordinates file not found at: ${coordsPath}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(coordsPath, 'utf8'));
  
  // Format is [ [lng, lat], [lng, lat], ... ]
  // We need to reverse it to simulate Matale to Kandy (since original is Kandy to Matale)
  const reversedData = [...rawData].reverse();
  const coordinates = reversedData.map(c => ({ lat: c[1], lng: c[0] }));
  console.log(`🗺️ Loaded and reversed ${coordinates.length} coordinates for Matale to Kandy simulation.`);

  // 1. Authenticate as Company
  console.log('🔑 Logging in as company...');
  const companyLogin = await apiCall('POST', '/auth/company/login', {
    email: 'company@test.com',
    password: 'password123'
  });

  if (companyLogin.status !== 200 && companyLogin.status !== 201) {
    console.error('❌ Company authentication failed:', companyLogin.data);
    process.exit(1);
  }
  const companyToken = companyLogin.data.accessToken;
  console.log('✅ Company logged in successfully.');

  // 2. Assign Driver to Route & Bus
  console.log(`📋 Assigning Driver ${DRIVER_ID} to Route ${ROUTE_ID} & Bus ${BUS_NUMBER}...`);
  const assignmentRes = await apiCall('POST', `/company/drivers/${DRIVER_ID}/assign`, {
    assignedRouteId: ROUTE_ID,
    currentBusRegistration: BUS_NUMBER
  }, companyToken);

  if (assignmentRes.status !== 200 && assignmentRes.status !== 201) {
    console.error('❌ Driver assignment failed:', assignmentRes.data);
    process.exit(1);
  }
  console.log('✅ Driver assigned successfully.');

  // 3. Authenticate Driver
  console.log('🔑 Logging in as driver...');
  const driverLogin = await apiCall('POST', '/auth/driver/verify', {
    loginInput: 'driver@test.com',
    password: 'password123'
  });

  if (driverLogin.status !== 200 && driverLogin.status !== 201) {
    console.error('❌ Driver authentication failed:', driverLogin.data);
    process.exit(1);
  }
  const driverToken = driverLogin.data.accessToken;
  console.log('✅ Driver logged in successfully.');

  // 4. Start Shift
  console.log('⏱️ Starting driver shift...');
  const shiftRes = await apiCall('POST', '/driver/shift/start', null, driverToken);
  if (shiftRes.status !== 200 && shiftRes.status !== 201) {
    console.error('❌ Failed to start shift:', shiftRes.data);
    process.exit(1);
  }
  console.log('✅ Shift started successfully.');

  // 5. Connect WebSocket
  console.log('📡 Connecting driver tracking socket...');
  const socket = io(`${BASE_URL}/tracking`, {
    transports: ['websocket'],
    auth: { token: driverToken }
  });

  socket.on('connect', () => {
    console.log('✅ WebSocket Connected! Commencing continuous location broadcast...');
    startBroadcasting(socket, coordinates);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ WebSocket connection error:', err.message);
  });
}

let broadcastInterval = null;

function startBroadcasting(socket, coordinates) {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    console.log('🔄 Reconnected. Resetting location broadcast loop...');
  }
  let index = 0;

  broadcastInterval = setInterval(() => {
    if (index >= coordinates.length) {
      console.log('\n🔄 Completed route simulation. Restarting from Matale...');
      index = 0;
    }

    const current = coordinates[index];
    const next = coordinates[index + 1] || coordinates[0];

    // Calculate heading/bearing
    const heading = getBearing(current.lat, current.lng, next.lat, next.lng);

    // Speed approximately 30-40 km/h
    const speed = 30 + Math.random() * 10;

    console.log(`[GPS Broadcast] Point ${index}/${coordinates.length} | Lat: ${current.lat.toFixed(5)} Lng: ${current.lng.toFixed(5)} | Speed: ${speed.toFixed(1)} km/h | Heading: ${heading.toFixed(1)}°`);

    socket.emit('driver_location', {
      routeId: ROUTE_ID,
      busNumber: BUS_NUMBER,
      latitude: current.lat,
      longitude: current.lng,
      speed,
      heading,
      status: 'ACTIVE'
    }, (ack) => {
      if (!ack || !ack.ok) {
        console.warn('⚠️ Server failed to acknowledge location update.');
      }
    });

    index++;
  }, 4000); // Send update every 4 seconds to match the UI smooth interpolation interval
}

runMock().catch(err => {
  console.error('❌ Script error:', err);
});
