const mongoose = require('mongoose');
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI =
  process.env.USE_PROD_DB === 'true'
    ? process.env.MONGODB_URI_PROD
    : process.env.MONGODB_URI_DEV;

const STOPS = [
  {
    name: 'Kandy',
    distanceFromStart: 0.0,
    location: { type: 'Point', coordinates: [80.6337, 7.2906] },
  },
  {
    name: 'Katugastota',
    distanceFromStart: 4.0,
    location: { type: 'Point', coordinates: [80.6225, 7.3248] },
  },
  {
    name: 'Akurana',
    distanceFromStart: 10.9,
    location: { type: 'Point', coordinates: [80.6186, 7.3686] },
  },
  {
    name: 'Alawathugoda',
    distanceFromStart: 16.5,
    location: { type: 'Point', coordinates: [80.6033, 7.4111] },
  },
  {
    name: 'Alwala (Elwala)',
    distanceFromStart: 21.7,
    location: { type: 'Point', coordinates: [80.6094, 7.4475] },
  },
  {
    name: 'Matale',
    distanceFromStart: 25.7,
    location: { type: 'Point', coordinates: [80.6234, 7.4675] },
  },
];

function fetchHighResRoadPath() {
  return new Promise((resolve, reject) => {
    // Construct OSRM driving route URL connecting all 6 stops in sequence
    const coordsStr = STOPS.map(s => `${s.location.coordinates[0]},${s.location.coordinates[1]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    console.log(`🌐 Querying exact driving road network from routing engine...`);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 'Ok' && json.routes && json.routes[0]) {
            const rawCoords = json.routes[0].geometry.coordinates;
            console.log(`✅ Retrieved ${rawCoords.length} exact road geometry vertices!`);
            resolve(rawCoords);
          } else {
            reject(new Error(`Failed to get route: ${json.code}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const routeSchema = new mongoose.Schema(
  {
    routeId: { type: String, required: true, unique: true, uppercase: true },
    routeName: { type: String, required: true },
    startTerminal: { type: String, required: true },
    endTerminal: { type: String, required: true },
    baseFare: { type: Number, required: true },
    ratePerKm: { type: Number, required: true },
    stops: [
      {
        _id: false,
        name: { type: String, required: true },
        distanceFromStart: { type: Number, required: true },
        location: {
          type: { type: String, default: 'Point' },
          coordinates: { type: [Number], required: true },
        },
      },
    ],
    path: {
      type: { type: String, default: 'LineString' },
      coordinates: { type: [[Number]], default: [] },
    },
  },
  { timestamps: true, collection: 'routes' },
);

const RouteModel = mongoose.model('Route', routeSchema);

async function run() {
  try {
    const highResCoords = await fetchHighResRoadPath();

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    console.log('🧹 Updating Route 593 in database with high-resolution road path...');
    const result = await RouteModel.findOneAndUpdate(
      { routeId: '593' },
      {
        routeId: '593',
        routeName: 'Kandy - Matale',
        startTerminal: 'Kandy',
        endTerminal: 'Matale',
        baseFare: 50.0,
        ratePerKm: 12.0,
        stops: STOPS,
        path: {
          type: 'LineString',
          coordinates: highResCoords,
        },
      },
      { upsert: true, new: true }
    );

    console.log(`🎉 Route 593 successfully updated in MongoDB!`);
    console.log(`   📍 Stops: ${result.stops.length}`);
    console.log(`   🛣️ Total Road Vertices: ${result.path.coordinates.length} coordinates`);

    // Also write a formatted JSON backup for easy offline reuse
    const backupPath = path.join(__dirname, 'route-593-highres.json');
    fs.writeFileSync(backupPath, JSON.stringify(highResCoords));
    console.log(`💾 Saved high-resolution coordinate backup to ${backupPath}`);

    await mongoose.disconnect();
    console.log('👋 Done.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
