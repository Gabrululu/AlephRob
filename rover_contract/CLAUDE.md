# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Quick commands

```bash
npm run deploy          # Deploy contracts via GenLayer CLI
npm run dev             # Start frontend dev server (cd frontend && npm run dev)
npm run build           # Build frontend for production
genlayer network        # Select network (studionet/localnet/testnet-bradbury)

# Bridge (root)
python bridge.py                          # Phase 1: watch mission_log → submit_sample
python bridge.py --phase 2               # Phase 2: start_task → submit_task_result → update_reputation
python bridge.py --phase both            # Both phases simultaneously
python bridge.py --status                # Print live on-chain state (no writes)
python bridge.py --dry-run --phase 2     # Preview CLI commands without executing
```

## Repository structure

```
contracts/
  rover_mission.py        # Phase 1 — sample validation (Aleph Hackathon)
  agent_registry.py       # Phase 2 — robot registration + LLM reputation
  mission_factory.py      # Phase 2 — mission creation + chained task validation
  reputation_ledger.py    # Phase 2 — peer-to-peer performance reports
frontend/
  app/
    page.tsx              # Main demo: fleet + mission + ledger + live telemetry (hardcoded TX data)
    protocol/page.tsx     # Protocol Explorer: live chain reads + all write interactions
  lib/genlayer/
    contracts.ts          # GenLayer JSON-RPC client — all read + write functions
  public/
    mission_log.json      # Written by rover controller in real time
deploy/
  deployScript.ts         # TypeScript deployment script for GenLayer CLI
bridge.py                 # Webots → GenLayer bridge (Phase 1 + Phase 2)
.env                      # PRIVATE_KEY + bridge config (copy from .env, fill PRIVATE_KEY)
```

## Deployed contracts — Bradbury testnet (Chain ID: 4221)

| Contract | Address |
|----------|---------|
| RoverMission | `0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb` |
| AgentRegistry | `0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe` |
| MissionFactory | `0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6` |
| ReputationLedger | `0x857aB4021C393872DcB5b7e7091f24330f2ef913` |

Explorer: https://explorer-bradbury.genlayer.com

## Development workflow

1. Set network: `genlayer network set testnet-bradbury`
2. Deploy a contract: `genlayer deploy --contract contracts/agent_registry.py`
3. Run frontend: `cd frontend && npm run dev`
   - `/`         → rover demo (mission + fleet + ledger + live telemetry)
   - `/protocol` → protocol explorer (live reads + all write interactions)
4. Bridge: fill `PRIVATE_KEY` in `.env`, then `python bridge.py [--phase 1|2|both]`

### Bridge environment
```bash
cp .env .env.local          # never commit .env.local
# edit PRIVATE_KEY=0x...
export $(cat .env.local | grep -v '#' | xargs)
python bridge.py --status   # verify chain connectivity
python bridge.py --dry-run  # preview without sending TXs
```

## Contract development

Contracts are Python files using the GenLayer SDK:

```python
from genlayer import *

class MyContract(gl.Contract):
    data: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.view
    def get(self, key: str) -> str:
        return self.data.get(key, "")

    @gl.public.write
    def set(self, key: str, value: str) -> str:
        self.data[key] = value
        return "ok"
```

**Decorators:**
- `@gl.public.view` — read-only, no state change
- `@gl.public.write` — state-modifying, creates a transaction
- `@gl.public.write.payable` — accepts GEN value

**Storage types:** `TreeMap`, `DynArray`, `u256`, `i32`, `bool`, `str`, `@allow_storage` for dataclasses

**LLM + Equivalence Principle pattern used in this project:**

```python
def _evaluate(self, input: str) -> dict:
    def get_decision() -> str:
        result = gl.nondet.exec_prompt(f"...", response_format="json")
        import json
        parsed = json.loads(result) if isinstance(result, str) else result
        # normalize and return as JSON string
        return f'{{"approved": {str(parsed["approved"]).lower()}}}'

    raw = gl.eq_principle.strict_eq(get_decision)
    import json
    return json.loads(raw)
```

## CLI interaction with deployed contracts

```bash
# Read state (view methods)
genlayer call CONTRACT_ADDRESS METHOD_NAME

# Write state (write methods) — all args as strings
genlayer write CONTRACT_ADDRESS METHOD_NAME --args "arg1" "arg2"

# Note: CLI has a bug with decimal numbers — pass "007" instead of "0.07"
# for coordinates when using genlayer write from the terminal
```

## Frontend patterns

- All sections in a single `frontend/app/page.tsx` — hero, architecture, fleet, mission, ledger, live dashboard
- Live telemetry: `frontend/public/mission_log.json` polled every 3s via `fetch`
- All styles are inline CSS — no Tailwind, no CSS modules
- Color palette: `#1a0a06` bg, `#c4622d` accent, `#f0d4b4` text, `#4aff8a` success
- Fonts: `'Orbitron'` for titles, `'Space Mono'` for data

---

## GenLayer SDK reference

> Full API: **https://sdk.genlayer.com/main/_static/ai/api.txt**
> Full docs: **https://docs.genlayer.com/full-documentation.txt**

### Web access

```python
gl.nondet.web.get(url: str, *, headers: dict = {}) -> Response
gl.nondet.web.render(url: str, *, mode: Literal['text', 'html', 'screenshot']) -> str | Image
```

### LLM access

```python
gl.nondet.exec_prompt(prompt: str) -> str
gl.nondet.exec_prompt(prompt: str, *, response_format: Literal['json']) -> dict
```

### Equivalence Principle

| Type | Use case | Method |
|------|----------|--------|
| Strict | Exact match required | `gl.eq_principle.strict_eq(fn)` |
| Comparative | Similar outputs acceptable | `gl.eq_principle.prompt_comparative(fn, principle)` |
| Non-comparative | Subjective assessments | `gl.eq_principle.prompt_non_comparative(fn, principle)` |

### Key docs

- [Intelligent Contracts intro](https://docs.genlayer.com/developers/intelligent-contracts/introduction)
- [Storage types](https://docs.genlayer.com/developers/intelligent-contracts/storage)
- [Deploying](https://docs.genlayer.com/developers/intelligent-contracts/deploying)
- [Crafting prompts](https://docs.genlayer.com/developers/intelligent-contracts/crafting-prompts)
- [Examples](https://docs.genlayer.com/developers/intelligent-contracts/examples/storage)
