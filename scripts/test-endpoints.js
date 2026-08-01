const http = require('http');

const BASE_URL = 'http://localhost:4000';

function makeRequest(method, path, body = null, token = null) {
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

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

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

async function runTests() {
  console.log('🧪 Starting API Authentication Tests using Seeded Credentials...\n');

  try {
    // 1. Passenger Login
    console.log('1️⃣ Testing Passenger Login (passenger@test.com)...');
    const passengerLogin = await makeRequest('POST', '/auth/passenger/login', {
      email: 'passenger@test.com',
      password: 'Password123'
    });
    console.log(`Response Status: ${passengerLogin.statusCode}`);
    console.log('Response Body:', JSON.stringify(passengerLogin.body, null, 2));
    
    let passengerToken = null;
    if (passengerLogin.statusCode === 200 || passengerLogin.statusCode === 201) {
      passengerToken = passengerLogin.body.accessToken;
      console.log('✅ Passenger Login Successful!');
    } else {
      console.log('❌ Passenger Login Failed!');
    }
    console.log('--------------------------------------------------\n');

    // 2. Company Login
    console.log('2️⃣ Testing Company Login (company@test.com)...');
    const companyLogin = await makeRequest('POST', '/auth/company/login', {
      email: 'company@test.com',
      password: 'Password123'
    });
    console.log(`Response Status: ${companyLogin.statusCode}`);
    console.log('Response Body:', JSON.stringify(companyLogin.body, null, 2));
    
    let companyToken = null;
    if (companyLogin.statusCode === 200 || companyLogin.statusCode === 201) {
      companyToken = companyLogin.body.accessToken;
      console.log('✅ Company Login Successful!');
    } else {
      console.log('❌ Company Login Failed!');
    }
    console.log('--------------------------------------------------\n');

    // 3. Driver Shift Verification (Using Seeded ID)
    // Driver ID is hardcoded in userseeder as a deterministic ID or we can find it
    // Wait, let's query the database to find driver@test.com's ID, or we can look up if there is a known driver ID.
    // In userseeder.js, MongoDB generated the driver ID: 6a2ae7021b458c1812eb89d3
    const seededDriverId = '6a2ae7021b458c1812eb89d3'; 
    console.log(`3️⃣ Testing Driver Shift Verification (ID: ${seededDriverId})...`);
    const driverVerify = await makeRequest('POST', '/auth/driver/verify', {
      driverId: seededDriverId,
      busRegistration: 'WP-GA-9021'
    });
    console.log(`Response Status: ${driverVerify.statusCode}`);
    console.log('Response Body:', JSON.stringify(driverVerify.body, null, 2));
    
    if (driverVerify.statusCode === 200 || driverVerify.statusCode === 201) {
      console.log('✅ Driver Verification Successful!');
    } else {
      console.log('❌ Driver Verification Failed!');
    }
    console.log('--------------------------------------------------\n');

    // 4. Passenger Profile Verification (Protected Endpoint)
    if (passengerToken) {
      console.log('4️⃣ Testing Get Current Profile (/auth/me) as Passenger...');
      const profile = await makeRequest('GET', '/auth/me', null, passengerToken);
      console.log(`Response Status: ${profile.statusCode}`);
      console.log('Response Body:', JSON.stringify(profile.body, null, 2));
      if (profile.statusCode === 200) {
        console.log('✅ Passenger Profile Retrieval Successful!');
      } else {
        console.log('❌ Passenger Profile Retrieval Failed!');
      }
      console.log('--------------------------------------------------\n');
    }

    // 5. Company Profile Verification (Protected Endpoint)
    if (companyToken) {
      console.log('5️⃣ Testing Get Current Profile (/auth/me) as Company...');
      const profile = await makeRequest('GET', '/auth/me', null, companyToken);
      console.log(`Response Status: ${profile.statusCode}`);
      console.log('Response Body:', JSON.stringify(profile.body, null, 2));
      if (profile.statusCode === 200) {
        console.log('✅ Company Profile Retrieval Successful!');
      } else {
        console.log('❌ Company Profile Retrieval Failed!');
      }
      console.log('--------------------------------------------------\n');
    }

  } catch (error) {
    console.error('❌ Error during request execution:', error.message);
    console.error('Ensure that your NestJS Backend is running on port 5000!');
  }
}

runTests();
