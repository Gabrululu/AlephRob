# Aleph1 Rover Dashboard

Next.js frontend for the Aleph1 mission demo. The UI shows mission status, sample validation progress, and links to GenLayer explorer resources.

## Setup

1. Install dependencies:

**Using bun:**
```bash
bun install
```

**Using npm:**
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` - deployed rover mission contract address
   - `NEXT_PUBLIC_GENLAYER_RPC_URL` - GenLayer RPC URL (default: https://studio.genlayer.com/api)

## Development

**Using bun:**
```bash
bun dev
```

**Using npm:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

**Using bun:**
```bash
bun run build
bun start
```

**Using npm:**
```bash
npm run build
npm start
```

## Features

- **Mission hero**: Aleph1 narrative and mission state.
- **Architecture section**: Rover -> controller -> validators -> intelligent contract flow.
- **Live telemetry**: Polls [public/mission_log.json](public/mission_log.json).
- **Explorer integration**: Quick links to deployed contract and transactions.
