# ALEPH-1 — Mars Rover Mission

> Autonomous geological sample collection on Mars, validated by AI consensus on GenLayer Bradbury testnet.

Built for **Aleph Hackathon 2026** — Robotics + GenLayer tracks.

---

## What is this?

ALEPH-1 is an end-to-end autonomous robotics mission where a simulated Mars rover collects geological samples, and each sample is validated on-chain by a decentralized network of AI validators using GenLayer's Optimistic Democracy consensus.

The key insight: instead of a simple `if/else` to decide if a sample is valid, we use **5 LLM validators that independently evaluate each sample** and reach consensus. The decision is immutable, auditable, and trustless.

```
Rover navigates Mars → detects sample → submits to GenLayer →
5 AI validators reach consensus → APPROVED stored on Bradbury testnet
```

---

## Demo

**Live dashboard:** [localhost:3000](http://localhost:3000) (run frontend locally)

**Contract on Bradbury:** [`0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb`](https://explorer-bradbury.genlayer.com/address/0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb)

| Sample | Coordinates | GenLayer TX | Decision |
|--------|------------|-------------|----------|
| #1 | (0.07, -0.82) | [0x8bfbec...](https://explorer-bradbury.genlayer.com/tx/0x8bfbec0026726f4e029269dc17992251ef5f45d17a53cf329bb07d13e88e5eb7) | APPROVED |
| #2 | (0.62, -0.34) | [0x630b27...](https://explorer-bradbury.genlayer.com/tx/0x630b27691fc5b981d2b7588bf93abb09f1a0adc567319f375e9b43e4cc52c57f) | APPROVED |
| #3 | (-0.09, 0.30) | [0x655bdd...](https://explorer-bradbury.genlayer.com/tx/0x655bdd64b8b568d3121850d5929f09f3ef0c818be2ed9c942b22ea3f6ee77e70) | APPROVED |

---

## Architecture

```
┌─────────────────────┐     mission_log.json      ┌──────────────────────┐
│   Webots R2025a      │ ─────────────────────────▶│   Next.js Dashboard  │
│   Sojourner Rover    │                            │   localhost:3000     │
│   Python controller  │                            └──────────────────────┘
└────────┬────────────┘
         │ genlayer write submit_sample
         ▼
┌─────────────────────────────────────────────────────┐
│              GenLayer Bradbury Testnet               │
│                                                     │
│   Intelligent Contract: RoverMission.py             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│   │Validator1│  │Validator2│  │Validator3│  ...×5  │
│   │  LLM     │  │  LLM     │  │  LLM     │         │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│        └─────────────┴─────────────┘                │
│              Optimistic Democracy                    │
│              Equivalence Principle                   │
│              → APPROVED / REJECTED                  │
└─────────────────────────────────────────────────────┘
```

---

## Project structure

```
aleph1-mars-rover/
├── contracts/
│   └── rover_mission.py          # GenLayer Intelligent Contract
├── deploy/
│   └── deployScript.ts           # Bradbury deploy script
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Landing + live dashboard
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── public/
│       └── mission_log.json      # Written by rover in real time
├── webots/
│   └── worlds/
│       └── sojourner.wbt         # Mars simulation world
├── controllers/
│   └── rover_explorer/
│       └── rover_explorer.py     # Autonomous rover controller
├── bridge.py                     # Python bridge Webots → GenLayer
├── mission_log.json              # Mission state log
├── contract_address.txt          # Deployed contract address
└── README.md
```

---

## How it works

### 1. Robot simulation (Webots)

The NASA Sojourner rover is simulated in Webots R2025a on a Mars terrain world. The Python controller implements a full **Perceive → Decide → Act** control loop:

- **Perceive** — GPS position via `Supervisor.getPosition()`, heading via odometry
- **Decide** — State machine: `CALIBRATING → NAVIGATING → COLLECTING → COMPLETE`
- **Act** — Differential drive control with 6 wheels, stuck detection and escape maneuvers

The rover auto-calibrates its heading on startup by measuring actual movement direction, then navigates to 3 geological sample points (yellow spheres). When a sample is reached, it is removed from the world visually.

### 2. Intelligent Contract (GenLayer)

Each collected sample is submitted to the `RoverMission` Intelligent Contract deployed on Bradbury testnet:

```python
@gl.public.write
def submit_sample(self, sample_id: str, x: str, y: str, confidence: str) -> str:
    decision = self._evaluate_sample(x, y, confidence)
    # decision = gl.eq_principle.strict_eq(get_decision)
    # → 5 validators run LLM independently, reach consensus
    ...
    return decision  # "APPROVED" or "REJECTED"
```

The LLM prompt evaluates:
- Are coordinates within valid Mars terrain range?
- Is sensor confidence above 0.5?
- Does the location show geological interest?

### 3. Live dashboard (Next.js)

The rover controller writes `mission_log.json` directly to `frontend/public/` on every event. The Next.js frontend polls this file every 3 seconds and updates the dashboard in real time — no backend required.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Robot simulation | Webots R2025a |
| Rover controller | Python 3.13 |
| Blockchain | GenLayer Bradbury Testnet |
| Intelligent Contract | Python (GenLayer SDK) |
| AI consensus | Optimistic Democracy + Equivalence Principle |
| Frontend | Next.js 16, TypeScript |
| Deploy | GenLayer CLI |

---

## Quickstart

### Prerequisites

- [Webots R2025a](https://cyberbotics.com/)
- [Node.js 18+](https://nodejs.org/)
- [GenLayer CLI](https://github.com/genlayerlabs/genlayer-cli) — `npm install -g genlayer`
- Python 3.11+

### 1. Run the simulation

```bash
# Open Webots and load the world
# File → Open World → webots/worlds/sojourner.wbt

# The rover controller runs automatically
# mission_log.json is written to frontend/public/ in real time
```

### 2. Run the frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 3. Submit samples to GenLayer (optional — already done)

```bash
genlayer network set testnet-bradbury
genlayer write 0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb submit_sample \
  --args "sample_1" "007" "082" "085"
```

### 4. Deploy your own contract

```bash
genlayer network set testnet-bradbury
genlayer account create --name default
genlayer deploy --contract contracts/rover_mission.py
```

---

## GenLayer track requirements

| Requirement | Status |
|------------|--------|
| Intelligent Contract | ✅ `contracts/rover_mission.py` |
| Optimistic Democracy | ✅ 5 validators, `resultName: AGREE` |
| Equivalence Principle | ✅ `gl.eq_principle.strict_eq(get_decision)` |
| Deploy on Testnet Bradbury | ✅ `0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb` |

## Robotics track requirements

| Requirement | Status |
|------------|--------|
| Navigate without collisions | ✅ Odometry + stuck detection |
| Detect points of interest | ✅ 3 geological samples (yellow spheres) |
| Move toward detected points | ✅ Autonomous navigation loop |
| Complete at least 1 collection | ✅ 3/3 samples collected |
| Multiple samples (bonus) | ✅ 3 samples |
| Return to base (bonus) | ⬜ Not implemented |
| Sensors used | ✅ GPS (`Supervisor.getPosition()`), orientation |
| Autonomous navigation algorithm | ✅ Heading calibration + PD controller |
| Obstacle avoidance | ✅ Stuck detection + escape maneuver |
| Movement control | ✅ Differential drive, 6 wheels |

---

## Simulation specs

| Parameter | Value |
|-----------|-------|
| Simulator | Webots R2025a |
| World | sojourner.wbt (Mars terrain) |
| Robot | NASA Sojourner (6-wheel rover) |
| Map size | ~10m × 10m |
| Obstacles | 6 rocks |
| Samples | 3 yellow spheres |
| Collection radius | 0.65m |
| Max speed | 0.5 m/s |
| Gravity | 3.73 m/s² (Mars) |

---

## Contract

```
Network:  GenLayer Bradbury Testnet (Chain ID: 4221)
Address:  0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb
Explorer: https://explorer-bradbury.genlayer.com/address/0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb
```

---

## Team

Built solo for Aleph Hackathon 2026.

---

*ALEPH-1 — Where planetary exploration meets decentralized AI consensus.*