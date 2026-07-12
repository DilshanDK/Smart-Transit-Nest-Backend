# ⚙️ Smart Transit System - Backend API

This repository contains the core backend API for the Smart Transit System, built with **NestJS**, **MongoDB**, and **Redis**. It handles the primary business logic, real-time communications, database management, and integrations with third-party services like Stripe and Firebase.

## 🚀 Features
- **Real-Time Engine:** High-frequency socket connections via `Socket.io` to manage live GPS broadcasting between drivers and passengers.
- **Digital Ticketing:** Secure generation and validation logic for dynamic QR codes.
- **Payments Integration:** Endpoints integrated with **Stripe** to create payment intents for ticket purchases and wallet top-ups.
- **Authentication:** Secure user and driver authentication using **Passport (JWT)**.
- **Push Notifications:** Integration with **Firebase Admin** to dispatch real-time alerts.
- **Caching & Throttling:** Optimized performance using **Redis (ioredis)**.

## 💻 Tech Stack
- **Framework:** NestJS (Node.js, TypeScript)
- **Database:** MongoDB (Mongoose)
- **Caching:** Redis
- **WebSockets:** Socket.io
- **Integrations:** Stripe, Firebase Admin

## 🛠️ Installation & Setup

1. **Clone the repository**
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add the necessary keys (MongoDB URI, Redis URL, JWT Secret, Stripe Secret Key, Firebase Service Account).
4. **Run the application (Development)**
   ```bash
   npm run start:dev
   ```
The API will typically run on `http://localhost:3000`.
