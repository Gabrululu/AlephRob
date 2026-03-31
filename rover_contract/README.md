# AlephRob - Mars Rover Mission — GenLayer Validator

Autonomous Mars rover that validates geological samples using AI consensus on GenLayer Bradbury testnet.

## Architecture

- **Webots simulator** — Sojourner rover navigates Mars terrain, detects and collects geological samples
- **GenLayer Intelligent Contract** — Each sample is validated by 5 AI validators using Optimistic Democracy
- **Dashboard** — Real-time mission status showing on-chain decisions

## How it works

1. Rover explores terrain using odometry-based navigation
2. When a sample is detected, coordinates are submitted to the smart contract
3. GenLayer validators run an LLM prompt to evaluate scientific value
4. Consensus decision (APPROVED/REJECTED) is recorded on-chain
5. Dashboard shows live mission status

## Contract

- **Network:** GenLayer Bradbury Testnet
- **Address:** `0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb`
- **Explorer:** https://explorer-bradbury.genlayer.com/address/0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb

## Transactions

| Sample | TX Hash | Decision |
|--------|---------|----------|
| #1 (0.07, -0.82) | `0x8bfbec...` | APPROVED |
| #2 (0.62, -0.34) | `0x630b27...` | APPROVED |
| #3 (-0.09, 0.30) | `0x655bdd...` | APPROVED |

## Tech stack

- Webots R2025a (robot simulation)
- Python (rover controller)
- GenLayer Intelligent Contract (AI consensus validation)
- HTML/JS dashboard

## Run
```bash
# Serve dashboard
python -m http.server 8080

# Submit sample to GenLayer
genlayer write 0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb submit_sample --args "sample_id" "x" "y" "confidence"
```