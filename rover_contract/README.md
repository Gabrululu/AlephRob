# AlephRob — Mars Rover Mission Protocol

Autonomous robotic agents executing complex missions on Mars, coordinated and validated by AI consensus on GenLayer Bradbury testnet.

## What this is

AlephRob is a decentralized protocol for autonomous robotic fleets. Robots register on-chain with LLM-evaluated capabilities, execute multi-step missions with enforced task dependencies, and build verifiable reputation through peer-to-peer reports — all validated by GenLayer's Optimistic Democracy.

## Protocol contracts — Bradbury testnet

| Contract | Address | Purpose |
|----------|---------|---------|
| RoverMission | `0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb` | Phase 1 — sample validation |
| AgentRegistry | `0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe` | Robot registration + reputation |
| MissionFactory | `0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6` | Mission creation + task chaining |
| ReputationLedger | `0x857aB4021C393872DcB5b7e7091f24330f2ef913` | Peer-to-peer performance reports |

Explorer: https://explorer-bradbury.genlayer.com

## Architecture

```
Webots simulator (Sojourner rover)
  ↓ rover_explorer.py — Perceive → Decide → Act loop
  ↓ writes mission_log.json → frontend/public/

GenLayer Bradbury
  ↓ AgentRegistry    — 4 rovers registered, reputation assigned by LLM
  ↓ MissionFactory   — 4 chained tasks, each validated before next unlocks
  ↓ ReputationLedger — peer reports evaluated for bias by LLM

Next.js dashboard
  ↓ reads mission_log.json every 3s (live telemetry)
  ↓ shows fleet, mission timeline, reputation ledger
```

## Mission Olympus Mons — on-chain results

| Task | Rover | Type | Status |
|------|-------|------|--------|
| task-explore-01 | Sojourner-X | EXPLORE | COMPLETED |
| task-collect-01 | Curiosity-C | COLLECT | COMPLETED |
| task-analyze-01 | Ingenuity-A | ANALYZE | COMPLETED |
| task-transport-01 | Perseverance-T | TRANSPORT | COMPLETED |

## Phase 1 validated samples (RoverMission)

| Sample | Coordinates | TX | Decision |
|--------|------------|-----|----------|
| #1 | (0.07, -0.82) | `0x8bfbec...` | APPROVED |
| #2 | (0.62, -0.34) | `0x630b27...` | APPROVED |
| #3 | (-0.09, 0.30) | `0x655bdd...` | APPROVED |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Robot simulation | Webots R2025a |
| Rover controller | Python 3.13 |
| Blockchain | GenLayer Bradbury (Chain ID: 4221) |
| Intelligent Contracts | Python × 4 (GenLayer SDK) |
| AI consensus | Optimistic Democracy + Equivalence Principle |
| Frontend | Next.js 16, TypeScript |
| Deploy | GenLayer CLI |

## Run

```bash
# Frontend
cd frontend && npm install && npm run dev
# Open http://localhost:3000

# Deploy a contract
genlayer network set testnet-bradbury
genlayer deploy --contract contracts/agent_registry.py

# Register an agent
genlayer write 0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe register_agent \
  --args "rover-id" "RoverName" "EXPLORER" "Terrain mapping and obstacle detection"

# Submit a task result
genlayer write 0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6 submit_task_result \
  --args "mission-id" "task-id" "RoverName" "Result description here"

# Phase 1 — submit a sample
genlayer write 0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb submit_sample \
  --args "sample_1" "007" "082" "085"
```

## Built for

- **Aleph Hackathon 2026** — Robotics (1st place) + GenLayer tracks
- **GenLayer Hackathon 2026** — Agentic Economy Infrastructure track