require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const mongoUri = process.env.MONGODB_URI_DEV;

async function seed() {
  console.log('🌱 Starting User Database Seeder...');
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI_DEV is not defined in the environment or .env file');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to MongoDB Database...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected successfully.');

    const db = mongoose.connection.db;

    // Define Collections
    const passengersCollection = db.collection('passengers');
    const companiesCollection = db.collection('bus_companies');
    const driversCollection = db.collection('drivers');

    // Deterministic IDs
    const passengerId = new mongoose.Types.ObjectId('6a2ae9aee7a176694e054ae1');
    const companyId = new mongoose.Types.ObjectId('6a2ae9afe7a176694e054ae2');
    const driverId = new mongoose.Types.ObjectId('6a2ae7021b458c1812eb89d3');

    // Credentials & info to seed
    const testPassword = 'Password123';
    console.log(`🔐 Hashing password "${testPassword}"...`);
    const passwordHash = await bcrypt.hash(testPassword, 12);

    const passengerEmail = 'passenger@test.com';
    const companyEmail = 'company@test.com';
    const driverEmail = 'driver@test.com';

    // --- 1. SEED PASSENGER ---
    console.log(`🧹 Cleaning existing test passenger (${passengerEmail})...`);
    await passengersCollection.deleteMany({ email: passengerEmail });

    console.log(`📝 Inserting test passenger...`);
    const passengerRes = await passengersCollection.insertOne({
      _id: passengerId,
      passengerId: 'PA-TEST99',
      email: passengerEmail,
      fullName: 'John Passenger',
      passwordHash: passwordHash,
      walletBalance: mongoose.Types.Decimal128.fromString('1500.00'),
      nfcUid: 'NFC-PASS-9999',
      stripeCustomerId: null,
      googleId: null,
      appleId: null,
      refreshTokenHash: null,
      fcmToken: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`✅ Passenger seeded with deterministic ID = ${passengerId}`);

    // --- 2. SEED BUS COMPANY ---
    console.log(`🧹 Cleaning existing test company (${companyEmail})...`);
    await companiesCollection.deleteMany({ email: companyEmail });

    console.log(`📝 Inserting test company...`);
    const companyRes = await companiesCollection.insertOne({
      _id: companyId,
      companyId: 'CO-TEST99',
      companyName: 'City Transit Operators',
      email: companyEmail,
      passwordHash: passwordHash,
      stripeConnectAccountId: 'acct_123fakeconnect',
      pendingLedgerBalance: mongoose.Types.Decimal128.fromString('0.00'),
      isOnboarded: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`✅ Company seeded with deterministic ID = ${companyId}`);

    // --- 3. SEED DRIVER ---
    console.log(`🧹 Cleaning existing test driver (${driverEmail})...`);
    await driversCollection.deleteMany({ email: driverEmail });

    console.log(`📝 Inserting test driver (linked to company: ${companyId})...`);
    const driverRes = await driversCollection.insertOne({
      _id: driverId,
      driverId: 'DR-TEST99',
      email: driverEmail,
      fullName: 'Dave Driver',
      passwordHash: passwordHash,
      licenseNumber: 'DL-987654321',
      companyId: companyId,
      isOnShift: false,
      currentBusRegistration: null,
      refreshTokenHash: null,
      fcmToken: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`✅ Driver seeded with deterministic ID = ${driverId}`);

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

seed();
