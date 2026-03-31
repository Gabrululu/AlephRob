# AlephRob — Dashboard Frontend

Next.js dashboard for the AlephRob Mars Rover Mission Protocol. Displays the agent fleet, mission timeline, peer reputation ledger, and live rover telemetry — all linked to GenLayer Bradbury testnet.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
# Open http://localhost:3000
```

## Environment variables

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb
NEXT_PUBLIC_GENLAYER_RPC_URL=https://rpc-bradbury.genlayer.com
NEXT_PUBLIC_GENLAYER_CHAIN_ID=4221
NEXT_PUBLIC_GENLAYER_CHAIN_NAME=Genlayer Bradbury Testnet
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
```

## Build

```bash
npm run build
npm start
```

## Dashboard sections

| Section | ID | Content |
|---------|-----|---------|
| Hero | `#mission` | Mission status, animated Mars canvas, key metrics |
| Architecture | `#tech` | 4-step technical flow (Webots → Python → GenLayer → consensus) |
| Agent Fleet | `#fleet` | 4 registered rovers with type, reputation score, and registration TX |
| Geological Survey | `#olympus` | Mission timeline — 4 chained tasks with LLM validation notes |
| Reputation Ledger | `#ledger` | Peer-to-peer reports table with LLM verdicts and acceptance rate |
| Live Dashboard | `#dashboard` | Real-time telemetry from `public/mission_log.json`, auto-refresh 3s |

## Live telemetry

The rover controller (`rover_explorer.py`) writes `mission_log.json` directly to `frontend/public/` on every collection event. The dashboard polls this file every 3 seconds — no backend or WebSocket required.

Expected format:

```json
{
  "samples_collected": 3,
  "samples_found": [
    {
      "id": 1,
      "x": 0.07,
      "y": -0.82,
      "time": 45.2,
      "status": "APPROVED",
      "tx_hash": "0x8bfbec..."
    }
  ],
  "state": "COMPLETE"
}
```

## Protocol contracts shown

| Contract | Address |
|----------|---------|
| RoverMission | `0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb` |
| AgentRegistry | `0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe` |
| MissionFactory | `0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6` |
| ReputationLedger | `0x857aB4021C393872DcB5b7e7091f24330f2ef913` |

Explorer: https://explorer-bradbury.genlayer.com

## Design

- Palette: `#1a0a06` background, `#c4622d` Mars orange accent, `#f0d4b4` text, `#4aff8a` success green
- Fonts: `Orbitron` (titles), `Space Mono` (data and code)
- All styles inline — no Tailwind, no CSS modules
- Fully responsive, CSS animations, scanline overlay