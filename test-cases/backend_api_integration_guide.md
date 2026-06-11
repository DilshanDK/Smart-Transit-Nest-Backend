# Smart Transit System — Frontend API Integration Guide

This guide is designed for frontend developers building the **Passenger Mobile App (Flutter)**, **Driver Mobile App (Flutter)**, and the **Company Admin Web Portal (Next.js)**. It outlines how to connect to the backend, authenticate, handle token rotation, consume APIs, and hook into real-time WebSockets.

---

## 🌐 1. Environment & Global Configuration

### Base URL
*   **Local Development:** `http://localhost:5000`
*   **Production:** (Configured via deployment domain, e.g., `https://api.smarttransit.example.com`)

### Authentication Header
Most endpoints require a JSON Web Token (JWT) in the `Authorization` header:
```http
Authorization: Bearer <your_access_token>
```

---

## 🔑 2. Authentication Flows & Token Management

All roles authenticate using `/auth/*` endpoints. Upon successful login/registration, the backend returns:
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "user": {
    "id": "6472f8a1...",
    "email": "user@example.com",
    "fullName": "User Name"
  }
}
```

### 🔄 JWT Token Rotation (Front-End Interceptor)
`accessToken` expires in **15 minutes**. `refreshToken` expires in **7 days**.
*   **Tip for Flutter/Next.js:** Implement a network client interceptor (e.g., using Dio in Flutter or Axios in React). If an API call fails with a `401 Unauthorized` status, intercept the request, call the corresponding refresh endpoint to get a new token pair, store them, and replay the original request.

#### Refresh Passenger Token
*   **Method / URL:** `POST /auth/passenger/refresh`
*   **Headers:** `Authorization: Bearer <expired_access_token>`
*   **Request Body:**
    ```json
    { "refreshToken": "<stored_refresh_token>" }
    ```

#### Refresh Driver Token
*   **Method / URL:** `POST /auth/driver/refresh`
*   **Headers:** `Authorization: Bearer <expired_access_token>`
*   **Request Body:**
    ```json
    { "refreshToken": "<stored_refresh_token>" }
    ```

#### Refresh Company Token
*   **Method / URL:** `POST /auth/company/refresh`
*   **Headers:** `Authorization: Bearer <expired_access_token>`
*   **Request Body:**
    ```json
    { "refreshToken": "<stored_refresh_token>" }
    ```

---

## 📱 3. Passenger Mobile App Integration (`passenger` role)

### 1. Register Passenger
*   **URL:** `POST /auth/passenger/register`
*   **Body:**
    ```json
    {
      "email": "passenger@test.com",
      "fullName": "John Doe",
      "password": "securepassword123"
    }
    ```

### 2. Login Passenger
*   **URL:** `POST /auth/passenger/login`
*   **Body:**
    ```json
    {
      "email": "passenger@test.com",
      "password": "securepassword123"
    }
    ```

### 3. Get Wallet Balance & Details
*   **URL:** `GET /auth/me`
*   **Headers:** `Authorization: Bearer {{passenger_accessToken}}`
*   **Response:**
    ```json
    {
      "role": "passenger",
      "user": {
        "id": "6472f8a1...",
        "fullName": "John Doe",
        "email": "passenger@test.com",
        "walletBalance": "1000.00" // Note: Returned as string/decimal representation
      }
    }
    ```

### 4. Create Stripe Payment Intent (Wallet Top-Up)
*   **URL:** `POST /payment/intent`
*   **Headers:** `Authorization: Bearer {{passenger_accessToken}}`
*   **Body:**
    ```json
    { "amount": 500 } // Amount in LKR
    ```
*   **Response:**
    ```json
    {
      "clientSecret": "pi_3M2e...", // Pass this to the Stripe Mobile SDK Payment Sheet
      "id": "pi_3M2e..."
    }
    ```

### 5. Dev/Sandbox Wallet Top-Up (No Stripe needed for testing)
*   **URL:** `POST /payment/sandbox-credit`
*   **Headers:** `Authorization: Bearer {{passenger_accessToken}}`
*   **Body:**
    ```json
    { "amount": 1000 }
    ```
*   **Response (201 Created):**
    ```json
    { "message": "Sandbox wallet credited successfully", "newBalance": 1000 }
    ```

### 6. Get Transaction History
*   **URL:** `GET /payment/transactions`
*   **Headers:** `Authorization: Bearer {{passenger_accessToken}}`
*   **Response:**
    ```json
    [
      {
        "_id": "6475a8b2...",
        "type": "WALLET_TOPUP",
        "amount": "1000.00",
        "createdAt": "2026-06-11T12:00:00.000Z"
      },
      {
        "_id": "6475c911...",
        "type": "JOURNEY_DEDUCTION",
        "amount": "120.00",
        "journeyId": "6475c900...",
        "createdAt": "2026-06-11T12:30:00.000Z"
      }
    ]
    ```

### 7. Generate Boarding QR Code
*   **URL:** `GET /journey/qr-token`
*   **Headers:** `Authorization: Bearer {{passenger_accessToken}}`
*   **Response (200 OK):**
    ```json
    {
      "qrToken": "eyJhbGciOiJIUzI1NiIsIn..." // Encrypted JWT payload containing passenger ID
    }
    ```
*   **Front-End Integration:** Generate a QR code using this token string. Refresh the token by invoking this endpoint **every 30 seconds** (the token has a 30s TTL on the backend to prevent reuse/screenshots).

### 8. Get Active Journey Status
*   **URL:** `GET /journey/active`
*   **Headers:** `Authorization: Bearer {{passenger_accessToken}}`
*   **Response (200 OK if in transit):**
    ```json
    {
      "_id": "6475c900...",
      "status": "IN_PROGRESS",
      "routeId": "120",
      "startTimestamp": "2026-06-11T12:25:00.000Z",
      "startLocation": { "type": "Point", "coordinates": [79.8612, 6.9271] }
    }
    ```
    *   *If no active journey:* Returns `null` or a `404 Not Found` response.

---

## 🚏 4. Driver Mobile App Integration (`driver` role)

The driver app behaves like an IoT hardware terminal that scans passenger credentials (QR codes or NFC cards) and transmits GPS coordinates.

### 1. Shift Bind (Verification)
Before the driver can start a shift, they must choose a bus registration number.
*   **URL:** `POST /auth/driver/verify`
*   **Body:**
    ```json
    {
      "driverId": "6472e911...",
      "busRegistration": "WP-GA-9021"
    }
    ```
*   **Response:** Returns access and refresh token pair.

### 2. Start Shift
*   **URL:** `POST /driver/shift/start`
*   **Headers:** `Authorization: Bearer {{driver_accessToken}}`
*   **Response (201):**
    ```json
    { "message": "Shift started. GPS tracking active." }
    ```

### 3. Tap-On / Tap-Off (Scan QR/NFC)
Called when a passenger scans their QR code at the bus entry or exit scanner.
*   **URL:** `POST /journey/tap`
*   **Headers:** `Authorization: Bearer {{driver_accessToken}}`
*   **Body:**
    ```json
    {
      "token": "eyJhbGciOiJIUz...", // The passenger's scanned QR token (or NFC UID string)
      "mode": "QR", // 'QR' or 'NFC'
      "latitude": 6.9271,
      "longitude": 79.8612
    }
    ```
*   **Response (Boarding - Tap-On):**
    ```json
    {
      "event": "TAP_ON",
      "passengerName": "John Doe",
      "message": "Boarding success"
    }
    ```
*   **Response (Alighting - Tap-Off):**
    ```json
    {
      "event": "TAP_OFF",
      "passengerName": "John Doe",
      "fare": 120.00,
      "message": "Journey completed"
    }
    ```
*   **Error: Insufficient Balance (402 Payment Required):**
    ```json
    {
      "statusCode": 402,
      "message": "Insufficient wallet balance"
    }
    ```
    *   **Feedback Integration:** Play a standard success chime (green UI screen) on `200/201 OK`, and play an error buzzer (red UI screen) on `402 Payment Required` or `400 Bad Request`.

### 4. End Shift
*   **URL:** `POST /driver/shift/end`
*   **Headers:** `Authorization: Bearer {{driver_accessToken}}`
*   **Response (201):**
    ```json
    { "message": "Shift ended. GPS tracking disabled." }
    ```

---

## 🏢 5. Company Web Admin Portal (`company` role)

Used by bus line operators to view analytics, manage drivers, and track payouts.

### 1. Register Company
*   **URL:** `POST /auth/company/register`
*   **Body:**
    ```json
    {
      "companyName": "Express Transit",
      "email": "admin@expresstransit.com",
      "password": "securepassword123"
    }
    ```

### 2. Login Company
*   **URL:** `POST /auth/company/login`
*   **Body:**
    ```json
    {
      "email": "admin@expresstransit.com",
      "password": "securepassword123"
    }
    ```

### 3. Create a Driver Account
*   **URL:** `POST /company/drivers`
*   **Headers:** `Authorization: Bearer {{company_accessToken}}`
*   **Body:**
    ```json
    {
      "fullName": "David Driver",
      "email": "david@expresstransit.com",
      "licenseNumber": "DL-55442A",
      "password": "defaultdriverpassword" // Optional
    }
    ```

### 4. List Company Drivers
*   **URL:** `GET /company/drivers`
*   **Headers:** `Authorization: Bearer {{company_accessToken}}`
*   **Response:** Array of drivers (excluding credential hashes).

### 5. Get Dashboard KPIs & Balances
*   **URL:** `GET /company/stats`
*   **Headers:** `Authorization: Bearer {{company_accessToken}}`
*   **Response:**
    ```json
    {
      "dailyRevenue": 4820.00,
      "activeDrivers": 3,
      "activeBuses": 3,
      "totalJourneys": 45,
      "pendingLedgerBalance": 12500.50, // Unpaid balance to be transferred at midnight
      "isOnboarded": true // Connect account linked status
    }
    ```

### 6. Get Active Fleet Status
*   **URL:** `GET /company/fleet`
*   **Headers:** `Authorization: Bearer {{company_accessToken}}`
*   **Response:**
    ```json
    [
      {
        "busRegistration": "WP-GA-9021",
        "driverName": "David Driver",
        "driverId": "6472e911...",
        "lastActive": "2026-06-11T12:55:00.000Z"
      }
    ]
    ```

### 7. Export Revenue Reports (CSV Download)
*   **URL:** `GET /company/reports/export?from=2026-06-01&to=2026-06-11` (from and to are optional date parameters)
*   **Headers:** `Authorization: Bearer {{company_accessToken}}`
*   **Response:** Triggers file attachment download. CSV format with headers:
    `Journey ID,Driver Name,Route ID,Start Coordinates,End Coordinates,Start Time,End Time,Distance (Km),Fare (LKR)`

### 8. Manual Payout Trigger (Test Override)
Triggers immediate Stripe transfer payout of the pending ledger balance.
*   **URL:** `POST /company/payout/trigger`
*   **Headers:** `Authorization: Bearer {{company_accessToken}}`
*   **Response (201):**
    ```json
    { "message": "Nightly payout process triggered successfully" }
    ```

---

## 📡 6. Real-Time Telemetry & Tracking (Socket.io WebSockets)

### WebSocket Connection details:
*   **Path:** `/tracking` (e.g. `ws://localhost:5000/tracking`)
*   **Auth:** Pass `token` in client connection headers/auth configuration:
    ```javascript
    const socket = io('http://localhost:5000/tracking', {
      auth: { token: accessToken }
    });
    ```

### 1. Driver App: Transmitting Coordinates
Every **4 seconds**, the driver's phone sends the current location:
*   **Socket.io Event Emitted by Driver:** `driver_location`
*   **Payload Format:**
    ```json
    {
      "routeId": "120",
      "latitude": 6.9271,
      "longitude": 79.8612,
      "speed": 35.5,
      "heading": 180, // Angle degree direction (0 - 360)
      "status": "ACTIVE"
    }
    ```

### 2. Passenger / Web App: Live Map Tracking
To view bus movements in real-time, the frontend client joins a route room:
*   **Socket.io Event Emitted by Client to Join:** `join_route`
*   **Payload:**
    ```json
    { "routeId": "120" }
    ```
*   **Socket.io Event Listened to by Client:** `bus_moved`
*   **Payload Received:**
    ```json
    {
      "driverId": "6472e911...",
      "routeId": "120",
      "busNumber": "WP-GA-9021",
      "latitude": 6.9271,
      "longitude": 79.8612,
      "speed": 35.5,
      "heading": 180,
      "status": "ACTIVE",
      "etaToNextStop": null,
      "updatedAt": "2026-06-11T12:56:04.000Z"
    }
    ```
    *   **Tip for Map Rendering:** When receiving `bus_moved`, look up the marker for `driverId` on the map. If it exists, interpolate the position coordinates smoothly from the old LatLng to the new LatLng using an animation controller to avoid marker jumping. If it does not exist, add a new marker to the map.
