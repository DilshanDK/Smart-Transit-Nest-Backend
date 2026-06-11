# Smart Transit System — Postman Testing Guide

This guide provides instructions and examples for testing the NestJS backend endpoints. It includes the API URL, headers, and request body formats for all endpoints, grouped by feature module.

---

## 🚀 Environment Setup

For local testing, the default backend base URL is `http://localhost:3000`. In Postman, you should define a collection variable or environment variable `baseUrl` set to `http://localhost:3000`.

### Global Headers
*   `Content-Type: application/json`
*   `Authorization: Bearer {{accessToken}}` (For protected endpoints)

---

## 🔑 Authentication Module

### 1. Passenger Registration
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/passenger/register`
*   **Headers:**
    *   `Content-Type: application/json`
*   **Request Body (JSON):**
    ```json
    {
      "email": "testpassenger@example.com",
      "fullName": "Test Passenger",
      "password": "passenger123"
    }
    ```
*   **Response (201 Created):**
    ```json
    {
      "message": "Passenger registered successfully",
      "accessToken": "eyJhbG...",
      "refreshToken": "eyJhbG...",
      "user": {
        "id": "6472f8a1...",
        "email": "testpassenger@example.com",
        "fullName": "Test Passenger",
        "walletBalance": 0
      }
    }
    ```

### 2. Passenger Login
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/passenger/login`
*   **Headers:**
    *   `Content-Type: application/json`
*   **Request Body (JSON):**
    ```json
    {
      "email": "testpassenger@example.com",
      "password": "passenger123"
    }
    ```
*   **Response (200 OK):**
    ```json
    {
      "accessToken": "eyJhbG...",
      "refreshToken": "eyJhbG...",
      "user": {
        "id": "6472f8a1...",
        "email": "testpassenger@example.com",
        "fullName": "Test Passenger",
        "walletBalance": 0
      }
    }
    ```

### 3. Passenger Token Refresh
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/passenger/refresh`
*   **Headers:**
    *   `Content-Type: application/json`
    *   `Authorization: Bearer {{passenger_accessToken}}`
*   **Request Body (JSON):**
    ```json
    {
      "refreshToken": "{{passenger_refreshToken}}"
    }
    ```

### 4. Bus Company Registration
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/company/register`
*   **Headers:**
    *   `Content-Type: application/json`
*   **Request Body (JSON):**
    ```json
    {
      "companyName": "Express Transit Ltd",
      "email": "admin@expresstransit.com",
      "password": "companypassword123"
    }
    ```

### 5. Bus Company Login
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/company/login`
*   **Headers:**
    *   `Content-Type: application/json`
*   **Request Body (JSON):**
    ```json
    {
      "email": "admin@expresstransit.com",
      "password": "companypassword123"
    }
    ```

### 6. Bus Company Token Refresh
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/company/refresh`
*   **Headers:**
    *   `Content-Type: application/json`
    *   `Authorization: Bearer {{company_accessToken}}`
*   **Request Body (JSON):**
    ```json
    {
      "refreshToken": "{{company_refreshToken}}"
    }
    ```

### 7. Driver Verification (Shift Bind)
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/driver/verify`
*   **Headers:**
    *   `Content-Type: application/json`
*   **Request Body (JSON):**
    ```json
    {
      "driverId": "{{driver_id}}",
      "busRegistration": "WP-GA-9021"
    }
    ```

### 8. Driver Token Refresh
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/driver/refresh`
*   **Headers:**
    *   `Content-Type: application/json`
    *   `Authorization: Bearer {{driver_accessToken}}`
*   **Request Body (JSON):**
    ```json
    {
      "refreshToken": "{{driver_refreshToken}}"
    }
    ```

### 9. User Profile (Me)
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/auth/me`
*   **Headers:**
    *   `Authorization: Bearer {{accessToken}}` (Supports any logged-in role)

### 10. Update Profile
*   **Method:** `PATCH`
*   **URL:** `{{baseUrl}}/auth/profile`
*   **Headers:**
    *   `Content-Type: application/json`
    *   `Authorization: Bearer {{accessToken}}`
*   **Request Body (JSON):**
    ```json
    {
      "fullName": "Updated Test Name",
      "email": "testpassenger_updated@example.com"
    }
    ```

### 11. Update FCM Token
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/fcm-token`
*   **Headers:**
    *   `Content-Type: application/json`
    *   `Authorization: Bearer {{accessToken}}` (Must be 'passenger' or 'driver')
*   **Request Body (JSON):**
    ```json
    {
      "token": "fcm_token_device_hash_value"
    }
    ```

### 12. Logout
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/auth/logout`
*   **Headers:**
    *   `Authorization: Bearer {{accessToken}}`

---

## 🏢 Bus Company Module

All endpoints under this module require `Authorization: Bearer {{company_accessToken}}`.

### 1. Create a Driver
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/company/drivers`
*   **Request Body (JSON):**
    ```json
    {
      "fullName": "David Driver",
      "email": "david.driver@expresstransit.com",
      "licenseNumber": "DL-998822A",
      "password": "driverpassword123"
    }
    ```

### 2. List Drivers
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/company/drivers`

### 3. Get Dashboard Statistics
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/company/stats`

### 4. Get Fleet Status
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/company/fleet`

### 5. Get Revenue Reports Grouped by Route
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/company/reports/by-route`

### 6. Trigger Nightly Payout (Manual Override / Test)
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/company/payout/trigger`
*   **Headers:**
    *   `Authorization: Bearer {{company_accessToken}}`
*   **Response (201 Created):**
    ```json
    {
      "message": "Nightly payout process triggered successfully"
    }
    ```

### 7. Export Revenue Reports (CSV)
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/company/reports/export?from=2026-06-01&to=2026-06-30` (from and to parameters are optional)
*   **Headers:**
    *   `Authorization: Bearer {{company_accessToken}}`
*   **Response (200 OK):**
    ```
    Content-Type: text/csv
    Content-Disposition: attachment; filename=company_revenue_report_2026-06-11.csv

    Journey ID,Driver Name,Route ID,Start Coordinates,End Coordinates,Start Time,End Time,Distance (Km),Fare (LKR)
    6472f8a1...,David Driver,120,"6.9271; 79.8612","6.9350; 79.8720",2026-06-11T12:00:00.000Z,2026-06-11T12:15:00.000Z,2.4,120
    ```

---

## 🚌 Driver Module

All endpoints under this module require `Authorization: Bearer {{driver_accessToken}}`.

### 1. Start Shift
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/driver/shift/start`

### 2. End Shift
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/driver/shift/end`

---

## 🗺️ Journey Module

### 1. Dynamic QR/NFC Boarding (Tap-On / Tap-Off)
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/journey/tap`
*   **Headers:**
    *   `Content-Type: application/json`
    *   `Authorization: Bearer {{driver_accessToken}}` (Called by the bus hardware terminal)
*   **Request Body (JSON):**
    ```json
    {
      "token": "{{passenger_qr_token}}",
      "mode": "QR",
      "latitude": 6.9271,
      "longitude": 79.8612
    }
    ```

### 2. Generate Passenger QR Code Token
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/journey/qr-token`
*   **Headers:**
    *   `Authorization: Bearer {{passenger_accessToken}}`

### 3. Get Active Journey
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/journey/active`
*   **Headers:**
    *   `Authorization: Bearer {{passenger_accessToken}}`

### 4. Get Passenger Journey History
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/journey/passenger/history`
*   **Headers:**
    *   `Authorization: Bearer {{passenger_accessToken}}`

---

## 💳 Payment Module

All passenger endpoints require `Authorization: Bearer {{passenger_accessToken}}`.

### 1. Create Stripe Payment Intent (Top-Up)
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/payment/intent`
*   **Request Body (JSON):**
    ```json
    {
      "amount": 20
    }
    ```

### 2. Sandbox Balance Credit (Development Test Top-Up)
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/payment/sandbox-credit`
*   **Request Body (JSON):**
    ```json
    {
      "amount": 1000
    }
    ```

### 3. Get Transaction History
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/payment/transactions`

### 4. Stripe Webhook (Anonymous)
*   **Method:** `POST`
*   **URL:** `{{baseUrl}}/webhooks/stripe`
*   **Headers:**
    *   `stripe-signature: t=123456,v1=abcde...`

---

## 📡 Tracking Module

### 1. Get Live Buses by Route ID
*   **Method:** `GET`
*   **URL:** `{{baseUrl}}/tracking/live?routeId=120`
*   **Headers:**
    *   `Authorization: Bearer {{accessToken}}`
