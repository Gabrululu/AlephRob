#!/usr/bin/env python3
"""
AlephRob Bridge — Webots → GenLayer Protocol
=============================================
Watches mission_log.json written by the Webots rover controller and submits
rover data on-chain through the AlephRob Protocol contracts.

Modes
-----
  Phase 1  Submit each geological sample to RoverMission.submit_sample
           (original Aleph Hackathon demo — backward compatible)

  Phase 2  Submit task results to MissionFactory and trigger reputation
           updates on AgentRegistry after mission completion

  Both     Run Phase 1 + Phase 2 submissions simultaneously

Usage
-----
  # Phase 1 (default)
  export PRIVATE_KEY=0x...
  python bridge.py

  # Phase 2
  python bridge.py --phase 2 --mission mission-olympus-01 --task task-explore-01 --agent Sojourner-X

  # Both
  python bridge.py --phase both

Environment variables
---------------------
  PRIVATE_KEY          Required. Bradbury testnet account private key.
  MISSION_LOG          Path to mission_log.json  (default: see DEFAULT_LOG_PATH)
  WATCH_INTERVAL       Seconds between polls     (default: 2)
  GENLAYER_NETWORK     GenLayer network name      (default: testnet-bradbury)

  # Phase 1
  ROVER_MISSION_ADDR   RoverMission contract address

  # Phase 2
  MISSION_FACTORY_ADDR MissionFactory contract address
  AGENT_REGISTRY_ADDR  AgentRegistry contract address
  PHASE2_MISSION_ID    Mission ID to submit results for
  PHASE2_TASK_ID       Task ID for the EXPLORE task
  PHASE2_AGENT_NAME    Rover name (e.g. Sojourner-X)
  PHASE2_AGENT_ID      Rover agent ID for reputation update
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ── Defaults ───────────────────────────────────────────────────────────────────

RPC_URL = "https://rpc-bradbury.genlayer.com"

# Try common paths for mission_log.json
_CANDIDATE_LOGS = [
    Path("frontend/public/mission_log.json"),
    Path("../nasa/controllers/rover_explorer/mission_log.json"),
    Path("D:/Webots/projects/robots/nasa/controllers/rover_explorer/mission_log.json"),
]

DEFAULT_LOG_PATH = next((p for p in _CANDIDATE_LOGS if p.exists()), Path("frontend/public/mission_log.json"))

CONTRACT_DEFAULTS = {
    "rover_mission":  "0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb",
    "agent_registry": "0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe",
    "mission_factory": "0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6",
}

SUBMISSIONS_FILE = Path("submissions.json")

# ── JSON-RPC reads ─────────────────────────────────────────────────────────────

_req_id = 0

def rpc_call(method: str, params: list) -> object:
    global _req_id
    _req_id += 1
    import requests
    resp = requests.post(
        RPC_URL,
        json={"jsonrpc": "2.0", "method": method, "params": params, "id": _req_id},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"RPC error: {data['error']}")
    return data["result"]


def read_contract(address: str, method: str, args: list = None) -> object:
    """Call a view method on a GenLayer contract."""
    return rpc_call("gen_call", [{"to": address, "data": {"method": method, "args": args or []}}, "latest"])


# ── CLI write wrapper ──────────────────────────────────────────────────────────

def genlayer_write(
    contract_address: str,
    method: str,
    args: list,
    network: str = "testnet-bradbury",
    dry_run: bool = False,
) -> str:
    """
    Send a write transaction via the genlayer CLI.
    Returns the transaction hash or 'DRY_RUN'.
    """
    cmd = [
        "genlayer", "write", contract_address, method,
        "--args", *[str(a) for a in args],
    ]

    print(f"  [TX] {method}({', '.join(str(a)[:30] for a in args)})")

    if dry_run:
        print(f"  [DRY-RUN] {' '.join(cmd)}")
        return "DRY_RUN"

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=180,
        )
        if result.returncode != 0:
            err = (result.stderr or result.stdout).strip()
            raise RuntimeError(err)
        out = result.stdout.strip()
        # Extract tx hash — genlayer CLI prints "Transaction hash: 0x..."
        for line in out.splitlines():
            if "0x" in line and len(line.split("0x")[-1]) >= 60:
                return "0x" + line.split("0x")[-1].strip()
        return out or "submitted"
    except FileNotFoundError:
        raise RuntimeError("genlayer CLI not found — install with: npm install -g genlayer")
    except subprocess.TimeoutExpired:
        raise RuntimeError("genlayer write timed out (180s)")


# ── Submission state ───────────────────────────────────────────────────────────

def load_submissions() -> dict:
    if SUBMISSIONS_FILE.exists():
        return json.loads(SUBMISSIONS_FILE.read_text())
    return {"phase1": [], "phase2": {}}


def save_submissions(state: dict) -> None:
    SUBMISSIONS_FILE.write_text(json.dumps(state, indent=2))


# ── Phase 1: RoverMission sample submission ────────────────────────────────────

def phase1_watch(
    log_path: Path,
    contract: str,
    interval: int,
    dry_run: bool,
) -> None:
    print(f"\n[Phase 1] RoverMission: {contract}")
    print(f"[Phase 1] Watching: {log_path}")
    print("[Phase 1] Press Ctrl+C to stop\n")

    state = load_submissions()
    submitted: set = set(state.get("phase1", []))

    while True:
        try:
            if log_path.exists():
                data = json.loads(log_path.read_text())
                samples = data.get("samples_found", [])

                for sample in samples:
                    sid = str(sample["id"])
                    if sid in submitted:
                        continue

                    print(f"[Phase 1] New sample #{sid} at ({sample['x']}, {sample['y']})")
                    try:
                        tx = genlayer_write(
                            contract, "submit_sample",
                            [str(sample["id"]), str(sample["x"]), str(sample["y"]),
                             str(sample.get("confidence", "0.85"))],
                            dry_run=dry_run,
                        )
                        print(f"[Phase 1] Sample #{sid} → TX: {tx}")
                        submitted.add(sid)
                        state["phase1"] = list(submitted)
                        save_submissions(state)
                    except Exception as e:
                        print(f"[Phase 1] Error submitting #{sid}: {e}")

        except (json.JSONDecodeError, OSError):
            pass
        except KeyboardInterrupt:
            print("\n[Phase 1] Stopped.")
            break

        time.sleep(interval)


# ── Phase 2: MissionFactory + AgentRegistry integration ───────────────────────

def phase2_build_result(samples: list, mission_state: str) -> str:
    """Build a human-readable result summary from the mission log."""
    approved = [s for s in samples if s.get("status") == "APPROVED"]
    coords = ", ".join(f"({s['x']}, {s['y']})" for s in approved)
    return (
        f"Exploration complete. {len(approved)} geological target(s) identified "
        f"at {coords}. Mission state: {mission_state}. "
        f"Samples validated on-chain via GenLayer consensus."
    )


def phase2_watch(
    log_path: Path,
    factory_addr: str,
    registry_addr: str,
    mission_id: str,
    task_id: str,
    agent_name: str,
    agent_id: str,
    interval: int,
    dry_run: bool,
) -> None:
    print(f"\n[Phase 2] MissionFactory: {factory_addr}")
    print(f"[Phase 2] AgentRegistry:  {registry_addr}")
    print(f"[Phase 2] Mission: {mission_id}  Task: {task_id}  Agent: {agent_name}")
    print(f"[Phase 2] Watching: {log_path}")
    print("[Phase 2] Press Ctrl+C to stop\n")

    state = load_submissions()
    p2 = state.setdefault("phase2", {})

    while True:
        try:
            if log_path.exists():
                data = json.loads(log_path.read_text())
                mission_state = data.get("state", "UNKNOWN")
                samples = data.get("samples_found", [])
                collected = data.get("samples_collected", 0)

                # Step A: start_task when rover begins navigating (first sample detected)
                if samples and not p2.get("task_started"):
                    print(f"[Phase 2] Rover active — starting task {task_id}")
                    try:
                        tx = genlayer_write(factory_addr, "start_task", [task_id], dry_run=dry_run)
                        print(f"[Phase 2] start_task → TX: {tx}")
                        p2["task_started"] = tx
                        state["phase2"] = p2
                        save_submissions(state)
                    except Exception as e:
                        print(f"[Phase 2] start_task error (may already be IN_PROGRESS): {e}")
                        p2["task_started"] = "skipped"
                        save_submissions(state)

                # Step B: submit_task_result when mission completes or all samples collected
                mission_done = mission_state == "COMPLETE" or collected >= 3
                if mission_done and p2.get("task_started") and not p2.get("task_result_submitted"):
                    result_data = phase2_build_result(samples, mission_state)
                    print(f"[Phase 2] Mission complete — submitting task result")
                    print(f"[Phase 2] Result: {result_data[:80]}…")
                    try:
                        tx = genlayer_write(
                            factory_addr, "submit_task_result",
                            [mission_id, task_id, agent_name, result_data],
                            dry_run=dry_run,
                        )
                        print(f"[Phase 2] submit_task_result → TX: {tx}")
                        p2["task_result_submitted"] = tx
                        state["phase2"] = p2
                        save_submissions(state)
                    except Exception as e:
                        print(f"[Phase 2] submit_task_result error: {e}")

                # Step C: update_reputation after task result is submitted
                if p2.get("task_result_submitted") and agent_id and not p2.get("reputation_updated"):
                    approved_count = len([s for s in samples if s.get("status") == "APPROVED"])
                    perf_notes = (
                        f"Sojourner rover completed terrain exploration: {approved_count}/3 "
                        f"geological samples validated on-chain. Mission state: {mission_state}."
                    )
                    print(f"[Phase 2] Updating reputation for {agent_id}")
                    try:
                        tx = genlayer_write(
                            registry_addr, "update_reputation",
                            [agent_id, "true", perf_notes],
                            dry_run=dry_run,
                        )
                        print(f"[Phase 2] update_reputation → TX: {tx}")
                        p2["reputation_updated"] = tx
                        state["phase2"] = p2
                        save_submissions(state)
                    except Exception as e:
                        print(f"[Phase 2] update_reputation error: {e}")

                # Done
                if p2.get("reputation_updated"):
                    print("[Phase 2] Protocol sequence complete. Stopping watcher.")
                    break

        except (json.JSONDecodeError, OSError):
            pass
        except KeyboardInterrupt:
            print("\n[Phase 2] Stopped.")
            break

        time.sleep(interval)


# ── Status command ─────────────────────────────────────────────────────────────

def cmd_status(args_ns) -> None:
    """Print live on-chain state for the deployed protocol contracts."""
    print("\n[Status] Querying Bradbury testnet…\n")

    contracts = {
        "AgentRegistry":    os.environ.get("AGENT_REGISTRY_ADDR",  CONTRACT_DEFAULTS["agent_registry"]),
        "MissionFactory":   os.environ.get("MISSION_FACTORY_ADDR", CONTRACT_DEFAULTS["mission_factory"]),
        "ReputationLedger": os.environ.get("REPUTATION_LEDGER_ADDR", "0x857aB4021C393872DcB5b7e7091f24330f2ef913"),
    }

    for name, addr in contracts.items():
        print(f"  {name} ({addr[:10]}…{addr[-6:]})")
        try:
            if name == "AgentRegistry":
                stats = read_contract(addr, "get_registry_stats")
                print(f"    registered: {stats.get('total_registered', '?')}  active: {stats.get('total_active', '?')}")
            elif name == "MissionFactory":
                stats = read_contract(addr, "get_factory_stats")
                print(f"    missions: {stats.get('total_missions', '?')}  completed: {stats.get('completed_missions', '?')}  tasks: {stats.get('total_tasks', '?')}")
            elif name == "ReputationLedger":
                stats = read_contract(addr, "get_ledger_stats")
                print(f"    reports: {stats.get('total_reports', '?')}  accepted: {stats.get('total_accepted', '?')}  rate: {stats.get('acceptance_rate_pct', '?')}%")
        except Exception as e:
            print(f"    error: {e}")
        print()

    # Known agents
    known = ["rover-explorer-01", "rover-collector-01", "rover-analyst-01", "rover-transporter-01"]
    reg_addr = contracts["AgentRegistry"]
    print("  Agents:")
    for aid in known:
        try:
            a = read_contract(reg_addr, "get_agent", [aid])
            print(f"    {aid:<28} rep={a.get('reputation','?'):>3}  status={a.get('status','?')}")
        except Exception:
            print(f"    {aid:<28} — not found")
    print()


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="AlephRob Bridge — Webots → GenLayer Protocol",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--phase",    default="1",     choices=["1", "2", "both"],
                        help="Protocol phase (default: 1)")
    parser.add_argument("--log",      type=Path,       default=None,
                        help=f"Path to mission_log.json (default: {DEFAULT_LOG_PATH})")
    parser.add_argument("--interval", type=int,        default=None,
                        help="Watch interval in seconds (default: 2)")
    parser.add_argument("--dry-run",  action="store_true",
                        help="Print CLI commands without executing them")
    parser.add_argument("--status",   action="store_true",
                        help="Print live on-chain state and exit")

    # Phase 2 overrides
    parser.add_argument("--mission",  default=None, help="Phase 2 mission ID")
    parser.add_argument("--task",     default=None, help="Phase 2 task ID")
    parser.add_argument("--agent",    default=None, help="Phase 2 agent name (e.g. Sojourner-X)")
    parser.add_argument("--agent-id", default=None, help="Phase 2 agent ID for reputation update")

    ns = parser.parse_args()

    # Status mode
    if ns.status:
        cmd_status(ns)
        return

    # Validate private key
    private_key = os.environ.get("PRIVATE_KEY", "")
    if not private_key and not ns.dry_run:
        print("ERROR: PRIVATE_KEY environment variable not set.")
        print("  export PRIVATE_KEY=0x<your_bradbury_testnet_key>")
        sys.exit(1)

    log_path  = ns.log or Path(os.environ.get("MISSION_LOG", str(DEFAULT_LOG_PATH)))
    interval  = ns.interval or int(os.environ.get("WATCH_INTERVAL", "2"))
    network   = os.environ.get("GENLAYER_NETWORK", "testnet-bradbury")

    print(f"\nAlephRob Bridge")
    print(f"  mode:     Phase {ns.phase}")
    print(f"  log:      {log_path}")
    print(f"  interval: {interval}s")
    print(f"  network:  {network}")
    if ns.dry_run:
        print(f"  DRY RUN — no transactions will be sent")

    if ns.phase in ("1", "both"):
        rover_mission = os.environ.get("ROVER_MISSION_ADDR", CONTRACT_DEFAULTS["rover_mission"])
        if ns.phase == "1":
            phase1_watch(log_path, rover_mission, interval, ns.dry_run)
        else:
            # Run Phase 1 + Phase 2 concurrently via threads
            import threading
            t1 = threading.Thread(
                target=phase1_watch,
                args=(log_path, rover_mission, interval, ns.dry_run),
                daemon=True,
            )
            t1.start()

    if ns.phase in ("2", "both"):
        factory_addr  = os.environ.get("MISSION_FACTORY_ADDR",  CONTRACT_DEFAULTS["mission_factory"])
        registry_addr = os.environ.get("AGENT_REGISTRY_ADDR",   CONTRACT_DEFAULTS["agent_registry"])
        mission_id    = ns.mission  or os.environ.get("PHASE2_MISSION_ID",  "mission-olympus-01")
        task_id       = ns.task     or os.environ.get("PHASE2_TASK_ID",     "task-explore-01")
        agent_name    = ns.agent    or os.environ.get("PHASE2_AGENT_NAME",  "Sojourner-X")
        agent_id      = ns.agent_id or os.environ.get("PHASE2_AGENT_ID",   "rover-explorer-01")

        phase2_watch(
            log_path, factory_addr, registry_addr,
            mission_id, task_id, agent_name, agent_id,
            interval, ns.dry_run,
        )

    if ns.phase == "both":
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[Bridge] Stopped.")


if __name__ == "__main__":
    main()
