const mongoose = require('mongoose');
require('dotenv').config();
const https = require('https');

async function testConnection() {
  console.log('=== SMART TRANSIT SYSTEM: ENV DIAGNOSTICS ===\n');

  // 1. MONGODB TEST
  const useProd = process.env.USE_PROD_DB === 'true';
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
  console.log(`[MongoDB] Connecting to ${useProd ? 'PRODUCTION' : 'DEVELOPMENT'} database...`);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ [MongoDB] Connection successful!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ [MongoDB] Connection failed:', error.message);
  }

  // 2. REDIS TEST
  console.log('\n[Redis] Testing connection...');
  if (!process.env.REDIS_URL) {
    console.log('⚠️ [Redis] REDIS_URL not set.');
  } else {
    try {
      const redisUrl = new URL(process.env.REDIS_URL);
      const host = redisUrl.hostname;
      const port = redisUrl.port || 6379;
      
      await new Promise((resolve) => {
        const net = require('net');
        const client = new net.Socket();
        
        client.setTimeout(2000); // 2 second timeout
        
        client.connect(port, host, () => {
          console.log(`✅ [Redis] Connection successful! (Server running on ${host}:${port})`);
          client.destroy();
          resolve();
        });
        
        client.on('error', (err) => {
          console.error(`❌ [Redis] Connection failed: Not connected! (Ensure Docker is running) - ${err.message}`);
          client.destroy();
          resolve();
        });
        
        client.on('timeout', () => {
          console.error('❌ [Redis] Connection timed out.');
          client.destroy();
          resolve();
        });
      });
    } catch (e) {
      console.error('❌ [Redis] REDIS_URL format is invalid.');
    }
  }

  // 3. STRIPE TEST
  console.log('\n[Stripe] Testing API Key...');
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.includes('replace_with')) {
    console.log('⚠️ [Stripe] Skipping. Key is missing or using placeholder.');
  } else {
    console.log('✅ [Stripe] Key is set! (Real verification requires the Stripe SDK)');
  }

  // 4. GOOGLE MAPS TEST
  console.log('\n[Google Maps] Testing API Key...');
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!mapsKey || mapsKey.includes('replace_with')) {
    console.log('⚠️ [Google Maps] Skipping. Key is missing or using placeholder.');
  } else {
    console.log('⏳ [Google Maps] Pinging Google Servers...');
    await new Promise((resolve) => {
      https.get(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=Colombo&destinations=Kandy&key=${mapsKey}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const result = JSON.parse(data);
          if (result.error_message) {
            console.error(`❌ [Google Maps] Key rejected: ${result.error_message}`);
          } else {
            console.log('✅ [Google Maps] Key is valid and authorized!');
          }
          resolve();
        });
      }).on('error', (err) => {
        console.error('❌ [Google Maps] Network error:', err.message);
        resolve();
      });
    });
  }

  // 5. FIREBASE TEST
  console.log('\n[Firebase] Testing Credentials...');
  const fcmProjectId = process.env.FIREBASE_PROJECT_ID;
  const fcmEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  if (!fcmProjectId || fcmProjectId.includes('replace_with') || !fcmEmail || fcmEmail.includes('replace_with')) {
    console.log('⚠️ [Firebase] Skipping. Credentials are missing or using placeholder.');
  } else {
    console.log(`✅ [Firebase] Configured for project: ${fcmProjectId}`);
  }

  console.log('\n=============================================');
  console.log('Diagnostics complete!');
  process.exit(0);
}

testConnection();
