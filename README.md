# Auto Motor Control Dashboard

A modern React-based web dashboard to remotely control, monitor, and sequence water taps and a main pump motor using an ESP32 over MQTT.

## Features

- **Real-Time Remote Control**: Instantly flip the main motor ON or OFF via the web interface.
- **Dynamic Tap Sequencing**: Configure timers for 3 individual taps (Front, Back, and Down). The ESP32 will automatically sequence them one after another.
- **Live Status Feed**: See real-time connection status to the HiveMQ Cloud broker.
- **Drag & Drop Reordering**: Drag the tap cards to change the sequence order.
- **Animated Visual Feedback**: Tap valve images dynamically rotate when the physical tap begins opening to match hardware flow.
- **Cloud Database (PostgreSQL)**: Stores user configuration reliably via a Netlify Serverless Function backend.

## Tech Stack

- **Frontend**: React (Vite)
- **Styling**: CSS (Modern Glassmorphism)
- **IoT Communication**: MQTT (HiveMQ Cloud via Paho MQTT Client)
- **Backend API**: Netlify Serverless Functions (`motor-api.js`)
- **Database**: PostgreSQL (pg)

## Getting Started Locally

### Prerequisites
- Node.js installed
- A PostgreSQL database URL (e.g., Supabase, Aiven, or Neon)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (this file is git-ignored to protect your secrets) and add your database URL:
```env
DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require
```

### 3. Run the Development Server
Since the backend uses Netlify Functions, use the Netlify CLI to run both the React app and the serverless backend locally:
```bash
npx netlify dev
```
The app will be running at `http://localhost:8888`.

## Deploying to Netlify

This project is fully ready to be deployed to Netlify in production.

1. Push this repository to GitHub.
2. In your [Netlify Dashboard](https://app.netlify.com/), click **Add new site** > **Import an existing project** and select your repo.
3. Under **Site Settings > Environment Variables**, add your `DATABASE_URL` string.
4. Deploy the site!

Alternatively, you can deploy straight from your terminal using:
```bash
netlify deploy --prod
```

## Hardware Note
This dashboard is designed to pair with an ESP32 connected to a PCA9685 Servo Driver. The ESP32 firmware should subscribe to `home/servo/command` and publish to `home/servo/status`.
