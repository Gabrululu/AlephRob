// AlephRob — GenLayer Bradbury client
// Primary: genlayer-js createClient
// Fallback: direct gen_call via fetch (used when createPublicClient unavailable or import fails)

const RPC_URL = "https://rpc-bradbury.genlayer.com";

// Consensus contract addresses — same chain ID (4221) as testnetAsimov in genlayer-js
const CONSENSUS_MAIN_ADDRESS  = "0xe30293d600fF9B2C865d91307826F28006A458f4";
const CONSENSUS_DATA_ADDRESS  = "0x2a50afD9d3E0ACC824aC4850d7B4c5561aB5D27a";

// Minimal ABI — only the addTransaction function needed for write calls
const CONSENSUS_MAIN_ABI = [
  {
    inputs: [
      { internalType: "address", name: "recipient",            type: "address" },
      { internalType: "uint256", name: "numOfInitialValidators", type: "uint256" },
      { internalType: "uint256", name: "maxRotations",         type: "uint256" },
      { internalType: "bytes",   name: "txData",               type: "bytes"   },
      { internalType: "bool",    name: "leaderOnly",           type: "bool"    },
    ],
    name: "addTransaction",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export const BRADBURY_CHAIN = {
  id: 4221,
  name: "GenLayer Bradbury Testnet",
  rpcUrls: { default: { http: [RPC_URL] } },
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  blockExplorers: { default: { name: "Bradbury Explorer", url: "https://explorer-bradbury.genlayer.com" } },
  testnet: true,
  consensusMainContract: { address: CONSENSUS_MAIN_ADDRESS as `0x${string}`, abi: CONSENSUS_MAIN_ABI },
  consensusDataContract: { address: CONSENSUS_DATA_ADDRESS as `0x${string}`, abi: [] },
  defaultNumberOfInitialValidators: 5,
  defaultConsensusMaxRotations: 3,
};

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
// The package name is split so Turbopack does not statically bundle it — it may
// not be installed in all deploy environments. All reads fall back to genCallFetch.
const _GL_PKG = ["genlayer", "js"].join("-");

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
      const mod = await import(/* webpackIgnore: true */ _GL_PKG) as Record<string, unknown>;
      const createClient =
        (mod.createPublicClient ?? mod.createClient) as Function | undefined;
      if (typeof createClient !== "function") throw new Error("createClient not found");
      _client = createClient({
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

// ── MissionFactory extra reads ─────────────────────────────────────────────────

export interface FactoryStats {
  total_missions: number | bigint;
  total_tasks: number | bigint;
  completed_missions: number | bigint;
  failed_missions: number | bigint;
  protocol: string;
}

export interface CanStartResult {
  can_start: boolean;
  reason: string;
  task_status: string;
  dependency_status: string;
}

export async function getTask(taskId: string): Promise<TaskData> {
  return read(CONTRACTS.MISSION_FACTORY, "get_task", [taskId]) as Promise<TaskData>;
}

export async function getFactoryStats(): Promise<FactoryStats> {
  return read(CONTRACTS.MISSION_FACTORY, "get_factory_stats") as Promise<FactoryStats>;
}

export async function canStartTask(taskId: string): Promise<CanStartResult> {
  return read(CONTRACTS.MISSION_FACTORY, "can_start_task", [taskId]) as Promise<CanStartResult>;
}

// ── AgentRegistry extra reads ──────────────────────────────────────────────────

export async function getAgentsByOwner(ownerAddress: string): Promise<string[]> {
  return read(CONTRACTS.AGENT_REGISTRY, "get_agents_by_owner", [ownerAddress]) as Promise<string[]>;
}

export async function isEligible(agentId: string, minReputation: number): Promise<boolean> {
  return read(CONTRACTS.AGENT_REGISTRY, "is_eligible", [agentId, minReputation]) as Promise<boolean>;
}

// ── ReputationLedger extra reads ───────────────────────────────────────────────

export interface AgentReputation {
  agent_id: string;
  current_reputation: number | bigint;
  total_reports_received: number | bigint;
  accepted_reports: number | bigint;
  last_report_id: string;
}

export async function getAgentReputation(agentId: string): Promise<AgentReputation> {
  return read(CONTRACTS.REPUTATION_LEDGER, "get_agent_reputation", [agentId]) as Promise<AgentReputation>;
}

export async function getAgentReports(agentId: string): Promise<ReportData[]> {
  return read(CONTRACTS.REPUTATION_LEDGER, "get_agent_reports", [agentId]) as Promise<ReportData[]>;
}

// ── Write helpers ─────────────────────────────────────────────────────────────

async function _glClient(extra: Record<string, unknown> = {}): Promise<Record<string, Function>> {
  const mod = await import(/* webpackIgnore: true */ _GL_PKG) as Record<string, unknown>;
  const createClientFn = mod.createClient as (cfg: unknown) => Record<string, unknown>;
  return createClientFn({ chain: BRADBURY_CHAIN, ...extra }) as Record<string, Function>;
}

async function _execWrite(client: Record<string, Function>, account: unknown, address: string, functionName: string, args: unknown[]): Promise<string> {
  const writeContractMethod = client.writeContract as (args: unknown) => Promise<string>;
  return writeContractMethod({ account, address: address as `0x${string}`, functionName, args, value: 0n });
}

// ── Write — private key ────────────────────────────────────────────────────────

export async function writeContractFn(
  privateKey: `0x${string}`,
  address: string,
  functionName: string,
  args: unknown[] = []
): Promise<string> {
  const mod = await import(/* webpackIgnore: true */ _GL_PKG) as Record<string, unknown>;
  const createAccountFn = mod.createAccount as (pk: `0x${string}`) => unknown;
  const account = createAccountFn(privateKey);
  const client = await _glClient();
  return _execWrite(client, account, address, functionName, args);
}

// ── Write — MetaMask / EIP-1193 provider ──────────────────────────────────────

export async function writeContractWithProvider(
  provider: unknown,          // window.ethereum
  accountAddress: `0x${string}`,
  address: string,
  functionName: string,
  args: unknown[] = []
): Promise<string> {
  const client = await _glClient({ provider, account: accountAddress });
  return _execWrite(client, accountAddress, address, functionName, args);
}

// ── MetaMask connection helpers ───────────────────────────────────────────────

export interface WalletConnection {
  address: `0x${string}`;
  provider: unknown;
}

export async function connectMetaMask(): Promise<WalletConnection> {
  const ethereum = (window as unknown as Record<string, unknown>).ethereum;
  if (!ethereum) throw new Error("MetaMask not detected. Install the MetaMask extension.");

  // Request account access
  const accounts = await (ethereum as { request: (a: unknown) => Promise<string[]> })
    .request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) throw new Error("No accounts returned.");

  // Add / switch to Bradbury network
  try {
    await (ethereum as { request: (a: unknown) => Promise<void> }).request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x107D" }],
    });
  } catch (switchErr: unknown) {
    // Error 4902 = chain not added yet
    const code = (switchErr as { code?: number })?.code;
    if (code === 4902) {
      await (ethereum as { request: (a: unknown) => Promise<void> }).request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x107D",
          chainName: "GenLayer Bradbury Testnet",
          rpcUrls: [RPC_URL],
          nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
          blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
        }],
      });
    } else {
      throw switchErr;
    }
  }

  return { address: accounts[0] as `0x${string}`, provider: ethereum };
}
