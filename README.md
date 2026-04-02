# AlephRob — Mars Rover Mission Protocol

> Autonomous robotic agents that execute complex missions on Mars, coordinated and validated by AI consensus on GenLayer Bradbury testnet.

Built for **Aleph Hackathon** (Robotics + GenLayer tracks), **GenLayer Bradbury Hackathon** (Agentic Economy Infrastructure track), and **PL Genesis**.

---

## What is this?

AlephRob is a decentralized protocol for autonomous robotic fleets operating in extreme environments. Robotic agents register on-chain, execute multi-step missions with task dependencies, and build verifiable reputation through peer-to-peer reports — all validated by LLM consensus using GenLayer's Optimistic Democracy.

The core insight: **robots don't need to trust each other**. GenLayer is the neutral arbiter. Every registration, task validation, and peer report goes through 5 independent AI validators that reach consensus on-chain. No single point of failure, no centralized coordinator.

```
Robot registers → LLM evaluates capabilities → reputation assigned on-chain
Mission created → tasks chained with dependencies → each task validated by LLM consensus
Mission complete → peer robots report performance → reputation updated on-chain
```

---

## Hackathon history

### Phase 1 — Aleph Hackathon 🏆
**Tracks:** Robotics (1st place) + GenLayer

Single Sojourner rover navigating Mars terrain, collecting 3 geological samples, each validated by 5 LLM validators on Bradbury testnet. Rover autonomously returns to the initial base position after completing all collections.

### Phase 2 — GenLayer Bradbury Hackathon
**Track:** Agentic Economy Infrastructure

Full multi-robot protocol: 4 specialized rovers with on-chain identity, reputation, and coordinated mission execution. 3 Intelligent Contracts composing a complete agentic economy for robotic fleets.

### Phase 3 — PL Genesis
Full protocol with interactive explorer: live chain reads from all 3 contracts, write interactions from the browser (register agents, create missions, submit task results, update reputation, peer reports), and a bridge connecting the Webots simulation to the Phase 2 protocol contracts.

---

## AlephRob Protocol — Deployed contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| RoverMission | [`0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb`](https://explorer-bradbury.genlayer.com/address/0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb) | Phase 1 — sample validation |
| AgentRegistry | [`0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe`](https://explorer-bradbury.genlayer.com/address/0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe) | Robot registration + reputation |
| MissionFactory | [`0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6`](https://explorer-bradbury.genlayer.com/address/0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6) | Mission creation + task chaining |
| ReputationLedger | [`0x857aB4021C393872DcB5b7e7091f24330f2ef913`](https://explorer-bradbury.genlayer.com/address/0x857aB4021C393872DcB5b7e7091f24330f2ef913) | Peer-to-peer performance reports |

**Network:** GenLayer Bradbury Testnet (Chain ID: 4221)
**Explorer:** https://explorer-bradbury.genlayer.com

---

## Protocol architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    AlephRob Protocol                             │
│                                                                  │
│  ┌─────────────┐   registers    ┌──────────────────────────┐    │
│  │  Sojourner-X │──────────────▶│                          │    │
│  │  (EXPLORER)  │               │      AgentRegistry       │    │
│  ├─────────────┤   registers    │                          │    │
│  │  Curiosity-C │──────────────▶│  LLM evaluates caps.     │    │
│  │  (COLLECTOR) │               │  Assigns reputation 0-100│    │
│  ├─────────────┤   registers    │  eq_principle.strict_eq  │    │
│  │  Ingenuity-A │──────────────▶│                          │    │
│  │  (ANALYST)   │               └──────────────────────────┘    │
│  ├─────────────┤                                                 │
│  │Perseverance-T│  executes     ┌──────────────────────────┐    │
│  │(TRANSPORTER) │──────────────▶│                          │    │
│  └─────────────┘               │      MissionFactory      │    │
│         │                      │                          │    │
│         │  submit results      │  Tasks chained:          │    │
│         └─────────────────────▶│  EXPLORE → COLLECT       │    │
│                                │  → ANALYZE → TRANSPORT   │    │
│                                │                          │    │
│                                │  LLM validates each task │    │
│                                │  before unlocking next   │    │
│                                └──────────────────────────┘    │
│         │                                                        │
│         │  peer reports        ┌──────────────────────────┐    │
│         └─────────────────────▶│                          │    │
│                                │    ReputationLedger      │    │
│                                │                          │    │
│                                │  Any robot reports any   │    │
│                                │  other robot's work      │    │
│                                │  LLM detects bias/fraud  │    │
│                                └──────────────────────────┘    │
│                                                                  │
│              GenLayer Bradbury — 5 validators per TX            │
│              Optimistic Democracy + Equivalence Principle        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Aleph Hackathon demo

**Contract:** `0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb`

| Sample | Coordinates | TX | Decision |
|--------|------------|-----|----------|
| #1 | (0.07, -0.82) | [0x8bfbec...](https://explorer-bradbury.genlayer.com/tx/0x8bfbec0026726f4e029269dc17992251ef5f45d17a53cf329bb07d13e88e5eb7) | APPROVED |
| #2 | (0.62, -0.34) | [0x630b27...](https://explorer-bradbury.genlayer.com/tx/0x630b27691fc5b981d2b7588bf93abb09f1a0adc567319f375e9b43e4cc52c57f) | APPROVED |
| #3 | (-0.09, 0.30) | [0x655bdd...](https://explorer-bradbury.genlayer.com/tx/0x655bdd64b8b568d3121850d5929f09f3ef0c818be2ed9c942b22ea3f6ee77e70) | APPROVED |

---

## Phase 2 — GenLayer Bradbury Hackathon demo

### Registered agents

| Agent ID | Name | Type | Rep. | TX |
|----------|------|------|------|----|
| rover-explorer-01 | Sojourner-X | EXPLORER | 78 | [0xb8165c...](https://explorer-bradbury.genlayer.com/tx/0xb8165cee977592dea42c657a4953dab3cdecb6fd2713f6c02630d6b900535dfc) |
| rover-collector-01 | Curiosity-C | COLLECTOR | 72 | [0xc915b8...](https://explorer-bradbury.genlayer.com/tx/0xc915b8348014b24f7b22baa757a2d29364790bcbe4b518940b0e0c3493929c07) |
| rover-analyst-01 | Ingenuity-A | ANALYST | 85 | [0xe5b4fa...](https://explorer-bradbury.genlayer.com/tx/0xe5b4fae5b924fb42668901951383e901e6c996f0889204659d6b768cb9f2efa6) |
| rover-transporter-01 | Perseverance-T | TRANSPORTER | 68 | [0xcb7337...](https://explorer-bradbury.genlayer.com/tx/0xcb73376e2e86c0e9ebf8b14ae2614ac946ba589fb5889a30bacb9164f8aa99f9) |

### Mission Olympus Mons — 4 tasks, all VALIDATED

| Task | Type | Rover | TX | Status |
|------|------|-------|----|--------|
| task-explore-01 | EXPLORE | Sojourner-X | [0xdfa4d2...](https://explorer-bradbury.genlayer.com/tx/0xdfa4d29f272fe29acb813348a5081c783ea91690cb49f33098f33c0d4204c8bf) | COMPLETED |
| task-collect-01 | COLLECT | Curiosity-C | [0x992d48...](https://explorer-bradbury.genlayer.com/tx/0x992d48b0794d9d3c188ebdb13e1e028a4732b0980e12385c39a82e7d5c8a4851) | COMPLETED |
| task-analyze-01 | ANALYZE | Ingenuity-A | [0x641d3a...](https://explorer-bradbury.genlayer.com/tx/0x641d3aeef9555abe4282595437a0b9bb9ad738722d32bc554f69ddf1392fce48) | COMPLETED |
| task-transport-01 | TRANSPORT | Perseverance-T | [0xe97a75...](https://explorer-bradbury.genlayer.com/tx/0xe97a7596eb521b7ad6069f3653d3c5f2d5f243182c77063e985167db1d8f0b8c) | COMPLETED |

### Peer-to-peer reputation reports — all ACCEPTED

| Report | Reporter → Target | TX | Verdict |
|--------|------------------|----|---------|
| report-001 | Sojourner-X → Curiosity-C | [0x06b604...](https://explorer-bradbury.genlayer.com/tx/0x06b6048df4c78dcb007985a04335058e2ca941ae7649936f4efb1d141efe86e6) | Sample extraction precise under dust storm |
| report-002 | Curiosity-C → Ingenuity-A | [0xc45b11...](https://explorer-bradbury.genlayer.com/tx/0xc45b119b0abd7f93cb05d3b1fad51fe8fb250b0697d50d0b29ae3e6524ca91f9) | Spectrometry ahead of schedule |
| report-003 | Ingenuity-A → Perseverance-T | [0x0e6e3e...](https://explorer-bradbury.genlayer.com/tx/0x0e6e3ecd01f4b2f87bf0171f0b45339a255c1f9a18c070c65140e9ac7e70c638) | Full chain of custody over rough terrain |
| report-004 | Perseverance-T → Sojourner-X | [0x03ca78...](https://explorer-bradbury.genlayer.com/tx/0x03ca784343cd239cc6482cd133156c2493864479c093ae3bb15eb411f99ebc02) | All 3 geological points precisely identified |

**Total on-chain activity:** ~30 transactions, all with 5/5 validators AGREE.

---

## Project structure

```
rover_contract/
├── contracts/
│   ├── rover_mission.py       # Phase 1 — sample validation
│   ├── agent_registry.py      # Phase 2 — robot registration + reputation
│   ├── mission_factory.py     # Phase 2 — mission creation + task chaining
│   └── reputation_ledger.py   # Phase 2 — peer-to-peer performance reports
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Mission demo (fleet + mission + ledger + live telemetry)
│   │   ├── protocol/
│   │   │   └── page.tsx       # Protocol Explorer (live reads + all write interactions)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/genlayer/
│   │   └── contracts.ts       # GenLayer RPC client — typed reads + write transactions
│   └── public/
│       └── mission_log.json   # Written by rover controller in real time
├── deploy/
│   └── deployScript.ts        # Bradbury deploy script
├── bridge.py                  # Webots → GenLayer bridge (Phase 1 + Phase 2)
└── .env                       # PRIVATE_KEY + bridge configuration
nasa/
├── controllers/
│   └── rover_explorer/
│       └── rover_explorer.py  # Autonomous rover controller (Webots)
└── worlds/
    └── sojourner.wbt          # Mars terrain simulation world
```

---

## How the protocol works

### 1. Agent registration (AgentRegistry)

Any address can attempt to register a robotic agent. The LLM evaluates whether declared capabilities are coherent and realistic for that rover type. If approved, it assigns an initial reputation score (50–80) based on capability complexity.

```python
@gl.public.write
def register_agent(self, agent_id, name, rover_type, capabilities) -> str:
    evaluation = self._evaluate_registration(name, rover_type, capabilities)
    # gl.eq_principle.strict_eq → 5 validators reach consensus
    # Returns: APPROVED with reputation score, or REJECTED with reason
```

### 2. Mission execution (MissionFactory)

Missions are composed of tasks with hard dependencies — a collector cannot start until the explorer has completed and been validated. Each task follows a 3-step flow before the next task is unlocked:

```
create_mission → add_task(s) → start_task → submit_task_result
                                             ↓
                               LLM validates result (5 validators)
                                             ↓
                               COMPLETED → next task unlocked
                               FAILED    → mission halted
```

### 3. Peer reputation (ReputationLedger)

Any registered robot can report the performance of any other robot. The LLM evaluates 4 factors (result quality, environment, execution time, historical context) and detects suspicious/biased reports before applying reputation changes.

```python
@gl.public.write
def submit_report(self, reporter_agent, target_agent, outcome,
                  result_quality, execution_time, environment_notes) -> str:
    verdict = self._evaluate_report(...)
    # Suspicious reports → delta = 0, rejected
    # Accepted reports → reputation updated on-chain
```

### 4. Robot simulation (Webots)

The NASA Sojourner rover runs in Webots R2025a with a Perceive → Decide → Act control loop, auto-calibrating heading, PD navigation controller, and stuck detection with escape maneuvers. After collecting all geological samples, the rover autonomously returns to the initial base position. Results are written to `mission_log.json` for the live dashboard.

### 5. Webots → Protocol bridge

`bridge.py` watches `mission_log.json` and submits rover data on-chain automatically:

```bash
# Phase 1: submit each sample to RoverMission as it's collected
python bridge.py

# Phase 2: full protocol sequence (start_task → submit_task_result → update_reputation)
python bridge.py --phase 2

# Preview without sending transactions
python bridge.py --phase 2 --dry-run

# Check live on-chain state
python bridge.py --status
```

### 6. Protocol Explorer (Next.js — `/protocol`)

Interactive interface for the full protocol: live chain state from all 3 contracts with 30s auto-refresh, and write interactions for every protocol action — register agents, create missions with task chains, start tasks, submit results, update reputation, submit peer reports, and admin operations.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Robot simulation | Webots R2025a |
| Rover controller | Python 3.13 |
| Blockchain | GenLayer Bradbury Testnet (Chain ID: 4221) |
| Intelligent Contracts | Python (GenLayer SDK) × 4 contracts |
| AI consensus | Optimistic Democracy + Equivalence Principle |
| Validators per TX | 5 LLM validators |
| Frontend | Next.js 16, TypeScript |
| Bridge | Python (subprocess → genlayer CLI) |
| Deploy | GenLayer CLI |

---

## Quickstart

### Prerequisites

- [Webots R2025a](https://cyberbotics.com/)
- [Node.js 18+](https://nodejs.org/)
- [GenLayer CLI](https://github.com/genlayerlabs/genlayer-cli) — `npm install -g genlayer`
- Python 3.11+

### Run the frontend

```bash
cd rover_contract/frontend
npm install
npm run dev
# http://localhost:3000       → mission demo
# http://localhost:3000/protocol → protocol explorer
```

### Run the simulation

```bash
# Open Webots → File → Open World → nasa/worlds/sojourner.wbt
# Controller runs automatically, writes mission_log.json to frontend/public/
# Rover collects 3 samples and returns to base position
```

### Run the bridge

```bash
cd rover_contract
# Fill PRIVATE_KEY in .env
python bridge.py --status          # verify connectivity
python bridge.py                   # Phase 1 (sample submission)
python bridge.py --phase 2         # Phase 2 (full protocol sequence)
```

### Register a new agent

```bash
genlayer network set testnet-bradbury
genlayer write 0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe register_agent \
  --args "my-rover-01" "MyRover" "EXPLORER" "Terrain mapping and obstacle detection"
```

### Create and run a mission

```bash
# 1. Create mission
genlayer write 0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6 create_mission \
  --args "mission-id" "Mission Name" "Description"

# 2. Add tasks with dependencies
genlayer write 0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6 add_task \
  --args "mission-id" "task-1" "EXPLORE" "Map the terrain" "my-rover-01" "50" ""

# 3. Start task, execute, submit result
genlayer write 0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6 start_task --args "task-1"
genlayer write 0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6 submit_task_result \
  --args "mission-id" "task-1" "MyRover" "Terrain mapped at coordinates..."

# 4. Update reputation after mission
genlayer write 0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe update_reputation \
  --args "my-rover-01" "true" "Completed all objectives ahead of schedule"
```

### Deploy your own contracts

```bash
genlayer network set testnet-bradbury
genlayer account create --name default
genlayer deploy --contract rover_contract/contracts/agent_registry.py
genlayer deploy --contract rover_contract/contracts/mission_factory.py
genlayer deploy --contract rover_contract/contracts/reputation_ledger.py
```

---

## GenLayer track requirements

| Requirement | Status |
|------------|--------|
| Intelligent Contract | ✅ 4 contracts deployed on Bradbury |
| Optimistic Democracy | ✅ 5 validators, `resultName: AGREE` on all TXs |
| Equivalence Principle | ✅ `gl.eq_principle.strict_eq()` in all LLM evaluation functions |
| Deploy on Testnet Bradbury | ✅ ~30 transactions on-chain |

## Robotics track requirements

| Requirement | Status |
|------------|--------|
| Navigate without collisions | ✅ Odometry + stuck detection |
| Detect points of interest | ✅ 3 geological samples (yellow spheres) |
| Move toward detected points | ✅ Autonomous navigation loop |
| Complete at least 1 collection | ✅ 3/3 samples collected |
| Multiple samples (bonus) | ✅ 3 samples |
| Return to base (bonus) | ✅ Rover autonomously returns to initial position after mission |
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

## Why Agentic Economy Infrastructure

AlephRob demonstrates three pillars of what an agentic economy for robots requires:

**Verifiable identity** — robots can't just claim capabilities. AgentRegistry uses LLM consensus to evaluate whether declared capabilities are realistic before granting on-chain identity.

**Trustless coordination** — robots don't trust each other, they trust the protocol. MissionFactory enforces task dependencies and validates results before unlocking the next step. No robot can skip ahead or falsify completion.

**Manipulation-resistant reputation** — peer reports can be gamed. ReputationLedger uses LLM evaluation to detect suspicious or biased reports and reject them with delta = 0, making reputation hard to manipulate.

The Dev Fee model makes this sustainable: every `register_agent`, `submit_task_result`, and `submit_report` transaction generates fees for the protocol deployer permanently, creating a revenue stream that scales with fleet adoption.

---

## Team

Built solo for Aleph Hackathon (Phase 1), GenLayer Bradbury Hackathon (Phase 2), and PL Genesis (Phase 3).

---

*AlephRob — Where autonomous robots earn trust on-chain.*
