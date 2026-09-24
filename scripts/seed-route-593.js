const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI =
  process.env.USE_PROD_DB === 'true'
    ? process.env.MONGODB_URI_PROD
    : process.env.MONGODB_URI_DEV;

// Exact A9 Highway coordinates from Kandy Goods Shed to Matale Bus Stand
// Tracing real vehicle driving road with accurate curves
const ROUTE_593_PATH = [
  [80.6337, 7.2906], // 1. Kandy Goods Shed / Clock Tower Terminal (0.0 km)
  [80.6346, 7.2922], // Kandy Post Office
  [80.6355, 7.2942], // Kandy Clock Tower Junction
  [80.6360, 7.2965], // D.S. Senanayake Veediya South
  [80.6358, 7.2995], // D.S. Senanayake Veediya North
  [80.6350, 7.3025], // Katugastota Road start (near Lake Round exit)
  [80.6338, 7.3060], // Mahaiyawa Railway Crossing
  [80.6322, 7.3090], // Mahaiyawa Junction
  [80.6308, 7.3125], // Poornawatte South
  [80.6295, 7.3160], // Poornawatte North
  [80.6272, 7.3195], // Gohagoda Road Junction
  [80.6245, 7.3225], // Katugastota Bridge Approach
  [80.6225, 7.3248], // 2. Katugastota Bridge & Junction (4.0 km)
  [80.6215, 7.3285], // Katugastota North / Kurunegala turn
  [80.6208, 7.3325], // Kahalla South
  [80.6205, 7.3360], // Kahalla Center
  [80.6202, 7.3400], // Kondadeniya South
  [80.6198, 7.3440], // Kondadeniya North
  [80.6190, 7.3485], // Ambatenna Junction
  [80.6189, 7.3530], // Thettapola
  [80.6188, 7.3580], // Bulugohotenna South
  [80.6188, 7.3620], // Bulugohotenna
  [80.6187, 7.3655], // Akurana South
  [80.6186, 7.3686], // 3. Akurana Town Center (10.9 km)
  [80.6180, 7.3715], // Akurana North
  [80.6170, 7.3745], // 7th Mile Post
  [80.6158, 7.3780], // Neerella Junction
  [80.6145, 7.3820], // Dunuvila Junction
  [80.6130, 7.3855], // Balakaduwa Approach
  [80.6115, 7.3890], // Balakaduwa Lower Pass
  [80.6095, 7.3930], // Pangollamada South
  [80.6090, 7.3940], // Pangollamada Center
  [80.6075, 7.3975], // Balakaduwa Incline
  [80.6062, 7.4010], // Balakaduwa Viewpoint
  [80.6050, 7.4045], // Balakaduwa Pass
  [80.6040, 7.4080], // Alawathugoda South
  [80.6033, 7.4111], // 4. Alawathugoda Town Center (16.5 km)
  [80.6030, 7.4145], // Alawathugoda North
  [80.6028, 7.4180], // Samarakoon Watte
  [80.6025, 7.4230], // Weragama
  [80.6028, 7.4270], // Weragama North
  [80.6035, 7.4310], // Ukuwela Road branch
  [80.6048, 7.4355], // Palapathwela South
  [80.6060, 7.4390], // Palapathwela
  [80.6075, 7.4425], // Palapathwela Junction
  [80.6094, 7.4475], // 5. Alwala (Elwala) Junction (21.7 km)
  [80.6110, 7.4505], // Kalalpitiya South
  [80.6125, 7.4535], // Kalalpitiya
  [80.6145, 7.4560], // Mandandawela South
  [80.6160, 7.4580], // Mandandawela Junction
  [80.6178, 7.4605], // Matale South / MC Boundary
  [80.6198, 7.4630], // Matale Goods Shed Road
  [80.6218, 7.4652], // Matale Main Street
  [80.6234, 7.4675], // 6. Matale Main Bus Stand (25.7 km)
];

const ROUTE_593_STOPS = [
  {
    name: 'Kandy',
    distanceFromStart: 0.0,
    location: {
      type: 'Point',
      coordinates: [80.6337, 7.2906],
    },
  },
  {
    name: 'Katugastota',
    distanceFromStart: 4.0,
    location: {
      type: 'Point',
      coordinates: [80.6225, 7.3248],
    },
  },
  {
    name: 'Akurana',
    distanceFromStart: 10.9,
    location: {
      type: 'Point',
      coordinates: [80.6186, 7.3686],
    },
  },
  {
    name: 'Alawathugoda',
    distanceFromStart: 16.5,
    location: {
      type: 'Point',
      coordinates: [80.6033, 7.4111],
    },
  },
  {
    name: 'Alwala (Elwala)',
    distanceFromStart: 21.7,
    location: {
      type: 'Point',
      coordinates: [80.6094, 7.4475],
    },
  },
  {
    name: 'Matale',
    distanceFromStart: 25.7,
    location: {
      type: 'Point',
      coordinates: [80.6234, 7.4675],
    },
  },
];

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

async function seed() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    console.log('🧹 Clearing old demo routes to ensure only Route 593 is active...');
    await RouteModel.deleteMany({});

    console.log('🚀 Inserting Route 593: Kandy - Matale...');
    const route593 = await RouteModel.create({
      routeId: '593',
      routeName: 'Kandy - Matale',
      startTerminal: 'Kandy',
      endTerminal: 'Matale',
      baseFare: 50.0,
      ratePerKm: 12.0,
      stops: ROUTE_593_STOPS,
      path: {
        type: 'LineString',
        coordinates: ROUTE_593_PATH,
      },
    });

    console.log(`✅ Route 593 created successfully! [ID: ${route593._id}]`);
    console.log(`   📍 Total Stops: ${route593.stops.length}`);
    route593.stops.forEach((s, idx) => {
      console.log(`      ${idx + 1}. ${s.name} (${s.distanceFromStart} km) -> [${s.location.coordinates.join(', ')}]`);
    });
    console.log(`   🛣️ Path Coordinates: ${route593.path.coordinates.length} driving points along A9 highway.`);

    await mongoose.disconnect();
    console.log('👋 Disconnected from database.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
