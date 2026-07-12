const http = require('http');
const io = require('socket.io-client');

const BASE_URL = 'http://localhost:4000';
const ROUTE_ID = '138';
const BUS_NUMBER = 'WP-GA-9021';
const DRIVER_ID = '6a2ae7021b458c1812eb89d3';

// Coordinates along Route 138 (Maharagama to Pettah)
const COORDINATES = [
  { lat: 6.8512, lng: 79.9212, speed: 0, heading: 0, status: 'IDLE', label: 'Maharagama Terminal' },
  { lat: 6.8620, lng: 79.9100, speed: 40, heading: 305, status: 'ACTIVE', label: 'Near Wattegedara' },
  { lat: 6.8748, lng: 79.8920, speed: 45, heading: 310, status: 'ACTIVE', label: 'Nugegoda Junction' },
  { lat: 6.8833, lng: 79.8833, speed: 20, heading: 315, status: 'ACTIVE', label: 'Kirulapone' },
  { lat: 6.8920, lng: 79.8720, speed: 50, heading: 320, status: 'ACTIVE', label: 'Havelock Town' },
  { lat: 6.9015, lng: 79.8615, speed: 30, heading: 330, status: 'ACTIVE', label: 'Tummulla' },
  { lat: 6.9120, lng: 79.8580, speed: 35, heading: 345, status: 'ACTIVE', label: 'Kollupitiya' },
  { lat: 6.9240, lng: 79.8550, speed: 25, heading: 350, status: 'ACTIVE', label: 'Galle Face' },
  { lat: 6.9360, lng: 79.8510, speed: 5, heading: 5, status: 'ACTIVE', label: 'Pettah Central Bus Stand' }
];

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runSimulation() {
  console.log('🏁 Starting Real-Time Telemetry Simulation...\n');

  let driverToken, passengerToken;

  // 1. Authenticate Driver & Bind Shift
  try {
    console.log('🔑 Authenticating Driver...');
    const driverRes = await makeRequest('POST', '/auth/driver/verify', {
      driverId: DRIVER_ID,
      busRegistration: BUS_NUMBER
    });
    
    if (driverRes.statusCode !== 200 && driverRes.statusCode !== 201) {
      throw new Error(`Driver auth failed: ${JSON.stringify(driverRes.body)}`);
    }
    driverToken = driverRes.body.accessToken;
    console.log('✅ Driver authenticated and shift bound successfully.');
  } catch (err) {
    console.error('❌ Driver verification error:', err.message);
    process.exit(1);
  }

  // 2. Authenticate Passenger
  try {
    console.log('🔑 Authenticating Passenger...');
    const passengerRes = await makeRequest('POST', '/auth/passenger/login', {
      email: 'passenger@test.com',
      password: 'Password123'
    });

    if (passengerRes.statusCode !== 200 && passengerRes.statusCode !== 201) {
      throw new Error(`Passenger auth failed: ${JSON.stringify(passengerRes.body)}`);
    }
    passengerToken = passengerRes.body.accessToken;
    console.log('✅ Passenger authenticated successfully.');
  } catch (err) {
    console.error('❌ Passenger login error:', err.message);
    process.exit(1);
  }

  console.log('\n📡 Establishing WebSocket Connections...');

  // 3. Connect Passenger WebSockets & Join Room
  const passengerSocket = io(`${BASE_URL}/tracking`, {
    transports: ['websocket'],
    auth: { token: passengerToken }
  });

  passengerSocket.on('connect', () => {
    console.log('📱 Passenger Socket Connected. Joining Route Room...');
    passengerSocket.emit('join_route', { routeId: ROUTE_ID }, (res) => {
      console.log(`✅ Passenger joined room route_${ROUTE_ID}:`, res);
    });
  });

  passengerSocket.on('bus_moved', (data) => {
    console.log(`\n🔔 [Passenger App Received] Bus Moved:`);
    console.log(`   🚍 Bus: ${data.busNumber} (Driver ID: ${data.driverId})`);
    console.log(`   📍 Location: ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`);
    console.log(`   🧭 Heading: ${data.heading}° | Speed: ${data.speed} km/h | Status: ${data.status}`);
    console.log(`   ⏰ Updated: ${data.updatedAt}`);
  });

  // 4. Connect Driver WebSockets
  const driverSocket = io(`${BASE_URL}/tracking`, {
    transports: ['websocket'],
    auth: { token: driverToken }
  });

  driverSocket.on('connect', () => {
    console.log('🎛️ Driver Socket Connected. Commencing GPS Broadcast stream...\n');
    startGpsBroadcasting(driverSocket);
  });

  driverSocket.on('connect_error', (err) => {
    console.error('❌ Driver socket connection error:', err.message);
  });

  passengerSocket.on('connect_error', (err) => {
    console.error('❌ Passenger socket connection error:', err.message);
  });
}

function startGpsBroadcasting(socket) {
  let index = 0;
  
  const interval = setInterval(() => {
    if (index >= COORDINATES.length) {
      console.log('\n🏁 Finished Route 138 path simulation. Restarting from terminal...');
      index = 0;
    }

    const coord = COORDINATES[index];
    console.log(`\n🛰️ [Driver GPS Broadcast] ${coord.label}: emitting ${coord.lat}, ${coord.lng}`);

    socket.emit('driver_location', {
      routeId: ROUTE_ID,
      busNumber: BUS_NUMBER,
      latitude: coord.lat,
      longitude: coord.lng,
      speed: coord.speed,
      heading: coord.heading,
      status: coord.status
    }, (ack) => {
      if (ack && ack.ok) {
        console.log('   ✅ Location ingested by server.');
      } else {
        console.log('   ⚠️ Location ingestion acknowledgment failed or was not received.');
      }
    });

    index++;
  }, 4000);

  // Stop simulation after 40 seconds
  setTimeout(() => {
    clearInterval(interval);
    console.log('\n🛑 Telemetry simulation duration finished. Closing connections...');
    socket.disconnect();
    process.exit(0);
  }, 40000);
}

runSimulation();
