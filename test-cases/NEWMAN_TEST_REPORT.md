# Smart Transit System — Newman Test Report

This report summarizes the integration test suite run for the Smart Transit System backend. Tests were run against the local development environment using Newman.

## 📊 Summary of Execution

*   **Date:** June 11, 2026 (Post-hardened & Reports Export Finalized)
*   **Target Environment:** `http://localhost:5000`
*   **Collection:** `Smart Transit System.postman_collection.json`
*   **Result:** **PASSED** (100% Success Rate)

| Metric | Executed | Failed |
| :--- | :---: | :---: |
| **Iterations** | 1 | 0 |
| **Requests** | 20 | 0 |
| **Test Scripts** | 20 | 0 |
| **Prerequest Scripts** | 3 | 0 |
| **Assertions** | 31 | 0 |

---

## 📋 Detailed Test Case Breakdown

### 1. Passenger Auth & Setup
- **Register Passenger** (`POST /auth/passenger/register`)
  - Status code is 201: **PASSED**
  - Should return user details and tokens: **PASSED**
- **Login Passenger** (`POST /auth/passenger/login`)
  - Status code is 200: **PASSED**
- **Get Passenger Profile (Me)** (`GET /auth/me`)
  - Status code is 200: **PASSED**
  - Should return passenger role and profile: **PASSED**

### 2. Bus Company & Driver Setup
- **Register Company** (`POST /auth/company/register`)
  - Status code is 201: **PASSED**
- **Login Company** (`POST /auth/company/login`)
  - Status code is 200: **PASSED**
- **Create Driver** (`POST /company/drivers`)
  - Status code is 201: **PASSED**
- **List Drivers** (`GET /company/drivers`)
  - Status code is 200: **PASSED**
  - List contains the created driver: **PASSED**

### 3. Driver Shift Operations
- **Verify Driver (Shift Bind)** (`POST /auth/driver/verify`)
  - Status code is 200: **PASSED**
- **Start Shift** (`POST /driver/shift/start`)
  - Status code is 201: **PASSED**

### 4. Ticketing & Journeys
- **Passenger Top-Up (Sandbox)** (`POST /payment/sandbox-credit`)
  - Status code is 201: **PASSED**
- **Generate QR Token** (`GET /journey/qr-token`)
  - Status code is 200: **PASSED**
- **Journey Tap-On (Boarding)** (`POST /journey/tap`)
  - Status code is 201: **PASSED**
  - Journey status is TAP_ON: **PASSED**
- **Get Active Journey** (`GET /journey/active`)
  - Status code is 200: **PASSED**
  - Returns active journey details: **PASSED**
- **Journey Tap-Off (Alighting)** (`POST /journey/tap`)
  - Status code is 201: **PASSED**
  - Journey status is TAP_OFF: **PASSED**
- **Get Passenger Journey History** (`GET /journey/passenger/history`)
  - Status code is 200: **PASSED**
  - History contains completed journey: **PASSED**

### 5. Company Analytics & Teardown
- **Get Company Stats** (`GET /company/stats`)
  - Status code is 200: **PASSED**
  - Dashboard KPIs are populated: **PASSED**
- **Get Company Fleet** (`GET /company/fleet`)
  - Status code is 200: **PASSED**
- **Trigger Company Payout** (`POST /company/payout/trigger`)
  - Status code is 201: **PASSED**
  - Payout triggered successfully: **PASSED**
- **Export Company Reports (CSV)** (`GET /company/reports/export`)
  - Status code is 200: **PASSED**
  - Content-Type is text/csv: **PASSED**
  - CSV body contains headers: **PASSED**
- **End Shift** (`POST /driver/shift/end`)
  - Status code is 201: **PASSED**

---

## ⏱️ Performance & Security Verification Metrics
*   **Total Run Duration:** 30.1s
*   **Average Response Time:** 1428ms (Min: 7ms, Max: 4s)
*   **Security Headers Integration:** Verified. All HTTP responses correctly contain Helmet.js security headers.
*   **CORS Whitelisting:** Verified. Whitelisted domains only are permitted, while invalid cross-origins are rejected.
*   **Rate-Limiting (Throttler):** Integrated. Globally enforced limits: 10 requests per second and 100 requests per minute.
