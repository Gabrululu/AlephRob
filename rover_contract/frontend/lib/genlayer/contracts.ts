// AlephRob — GenLayer Bradbury client
// Primary: genlayer-js createClient
// Fallback: direct gen_call via fetch (used when createPublicClient unavailable or import fails)

const RPC_URL = "https://rpc-bradbury.genlayer.com";

export const CONTRACTS = {
  AGENT_REGISTRY:    "0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe",
  MISSION_FACTORY:   "0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6",
  REPUTATION_LEDGER: "0x857aB4021C393872DcB5b7e7091f24330f2ef913",
} as const;

let _reqId = 0;

// ── Direct JSON-RPC fallback ───────────────────────────────────────────────────
async function genCallFetch(
  address: string,
  method: string,
  args: unknown[] = []
): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "gen_call",
      params: [{ to: address, data: { method, args } }, "latest"],
      id: ++_reqId,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "RPC error");
  return json.result;
}

// ── genlayer-js client (best-effort, falls back to fetch) ──────────────────────
let _client: unknown = null;
let _clientFailed = false;

async function tryGenlayerClient(
  address: string,
  functionName: string,
  args: unknown[] = []
): Promise<unknown> {
  if (_clientFailed) throw new Error("genlayer-js unavailable");
  try {
    if (!_client) {
      // genlayer-js exposes createClient, not createPublicClient — triggers fallback per spec
      // but we attempt it anyway in case a future version adds it
      const mod = await import("genlayer-js" as string);
      const createClient =
        (mod as Record<string, unknown>).createPublicClient ??
        (mod as Record<string, unknown>).createClient;
      if (typeof createClient !== "function") throw new Error("createPublicClient not found");
      _client = (createClient as Function)({
        chain: {
          id: 4221,
          name: "GenLayer Bradbury Testnet",
          rpcUrls: { default: { http: [RPC_URL] } },
          nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
          blockExplorers: { default: { name: "Bradbury Explorer", url: "https://explorer-bradbury.genlayer.com" } },
          testnet: true,
          consensusMainContract: null,
          consensusDataContract: null,
          defaultNumberOfInitialValidators: 5,
          defaultConsensusMaxRotations: 3,
        },
      });
    }
    const client = _client as Record<string, Function>;
    return await client.readContract({
      address: address as `0x${string}`,
      functionName,
      args,
    });
  } catch {
    _clientFailed = true;
    throw new Error("genlayer-js client failed");
  }
}

async function read(
  address: string,
  method: string,
  args: unknown[] = []
): Promise<unknown> {
  try {
    return await tryGenlayerClient(address, method, args);
  } catch {
    return genCallFetch(address, method, args);
  }
}

// ── Typed public API ───────────────────────────────────────────────────────────

export interface RegistryStats {
  total_registered: number | bigint;
  total_active: number | bigint;
  protocol: string;
  network: string;
}

export interface AgentData {
  agent_id: string;
  name: string;
  rover_type: string;
  capabilities: string;
  owner: string;
  reputation: number | bigint;
  missions_completed: number | bigint;
  missions_failed: number | bigint;
  status: string;
  registration_notes: string;
}

export interface TaskData {
  task_id: string;
  task_type: string;
  description: string;
  assigned_agent: string;
  min_reputation: number | bigint;
  depends_on: string;
  status: string;
  result_data: string;
  validation_notes: string;
}

export interface MissionData {
  mission_id: string;
  name: string;
  description: string;
  creator: string;
  status: string;
  tasks_completed: number | bigint;
  tasks_total: number | bigint;
  created_at: string;
  tasks: TaskData[];
}

export interface LedgerStats {
  total_reports: number | bigint;
  total_accepted: number | bigint;
  acceptance_rate_pct: number | bigint;
  agent_registry: string;
  mission_factory: string;
  protocol: string;
}

export interface ReportData {
  report_id: string;
  reporter_agent: string;
  target_agent: string;
  mission_id: string;
  task_id: string;
  outcome: string;
  result_quality: string;
  reputation_delta: number;
  llm_verdict: string;
  accepted: boolean;
}

export async function getRegistryStats(): Promise<RegistryStats> {
  return read(CONTRACTS.AGENT_REGISTRY, "get_registry_stats") as Promise<RegistryStats>;
}

export async function getAgent(agentId: string): Promise<AgentData> {
  return read(CONTRACTS.AGENT_REGISTRY, "get_agent", [agentId]) as Promise<AgentData>;
}

export async function getMission(id: string): Promise<MissionData> {
  return read(CONTRACTS.MISSION_FACTORY, "get_mission", [id]) as Promise<MissionData>;
}

export async function getLedgerStats(): Promise<LedgerStats> {
  return read(CONTRACTS.REPUTATION_LEDGER, "get_ledger_stats") as Promise<LedgerStats>;
}

export async function getReport(reportId: string): Promise<ReportData> {
  return read(CONTRACTS.REPUTATION_LEDGER, "get_report", [reportId]) as Promise<ReportData>;
}
