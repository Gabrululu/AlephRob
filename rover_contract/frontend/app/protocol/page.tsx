"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CONTRACTS,
  getRegistryStats,
  getAgent,
  getAgentsByOwner,
  isEligible,
  getMission,
  getTask,
  getFactoryStats,
  canStartTask,
  getLedgerStats,
  getReport,
  getAgentReputation,
  getAgentReports,
  writeContractFn,
  writeContractWithProvider,
  connectMetaMask,
  type AgentData,
  type MissionData,
  type TaskData,
  type LedgerStats,
  type RegistryStats,
  type FactoryStats,
  type CanStartResult,
  type ReportData,
  type AgentReputation,
} from "@/lib/genlayer/contracts";

const EXPLORER      = "https://explorer-bradbury.genlayer.com";
const KNOWN_AGENTS  = ["rover-explorer-01","rover-collector-01","rover-analyst-01","rover-transporter-01"];
const KNOWN_MISSION = "mission-olympus-01";
const KNOWN_REPORTS = ["report-001","report-002","report-003","report-004"];

// ── Wallet state ───────────────────────────────────────────────────────────────

type WalletState =
  | { type: "metamask";   address: `0x${string}`; provider: unknown }
  | { type: "privateKey"; key: `0x${string}` }
  | null;

async function execWrite(
  wallet: WalletState,
  address: string,
  method: string,
  args: unknown[] = [],
): Promise<string> {
  if (!wallet) throw new Error("No wallet connected.");
  if (wallet.type === "metamask")
    return writeContractWithProvider(wallet.provider, wallet.address, address, method, args);
  return writeContractFn(wallet.key, address, method, args);
}

// ── helpers ────────────────────────────────────────────────────────────────────

function toNum(v: number | bigint | undefined | null): number {
  if (v == null) return 0;
  return typeof v === "bigint" ? Number(v) : v;
}
function shortAddr(a: string) { return a.slice(0,10)+"…"+a.slice(-6); }
function shortHash(h: string) { return h.slice(0,8)+"…"+h.slice(-6); }

function typeColor(t: string) {
  switch (t) {
    case "EXPLORER":    return { bg:"rgba(55,138,221,.15)",  border:"rgba(55,138,221,.4)",  text:"#6ab4ff" };
    case "COLLECTOR":   return { bg:"rgba(196,98,45,.15)",   border:"rgba(196,98,45,.4)",   text:"#c4622d" };
    case "ANALYST":     return { bg:"rgba(130,90,180,.15)",  border:"rgba(130,90,180,.4)",  text:"#a06ad4" };
    case "TRANSPORTER": return { bg:"rgba(29,158,117,.15)",  border:"rgba(29,158,117,.4)",  text:"#1d9e75" };
    default:            return { bg:"rgba(138,90,58,.1)",    border:"rgba(138,90,58,.3)",   text:"#8a5a3a" };
  }
}

function taskStatusColor(s: string) {
  if (s === "COMPLETED")   return "#4aff8a";
  if (s === "IN_PROGRESS") return "#ffb84a";
  if (s === "FAILED")      return "#ff6060";
  return "var(--mars-dust)";
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize:10, color:"var(--mars-dust)", letterSpacing:".12em", textTransform:"uppercase", marginBottom:6 }}>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width:"100%", padding:"10px 14px",
        background:"rgba(0,0,0,.3)", border:"1px solid rgba(196,98,45,.28)",
        borderRadius:4, color:"var(--mars-pale)",
        fontFamily:"'Space Mono',monospace", fontSize:12, outline:"none",
      }}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { label: string; value: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{
        width:"100%", padding:"10px 14px",
        background:"rgba(13,5,2,.95)", border:"1px solid rgba(196,98,45,.28)",
        borderRadius:4, color:"var(--mars-pale)",
        fontFamily:"'Space Mono',monospace", fontSize:12, outline:"none",
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Btn({ children, onClick, disabled, variant = "primary" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
}) {
  const bg =
    variant === "primary" ? (disabled ? "rgba(196,98,45,.3)" : "var(--mars-glow)") :
    variant === "danger"  ? (disabled ? "rgba(255,80,80,.2)"  : "rgba(255,80,80,.75)") :
    "transparent";
  const color =
    variant === "primary" ? (disabled ? "rgba(253,240,224,.4)" : "var(--mars-deep)") :
    variant === "danger"  ? "#fdf0e0" :
    "var(--mars-sand)";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:"11px 22px", background:bg,
      border: variant === "ghost" ? "1px solid rgba(196,98,45,.4)" : "none",
      color, borderRadius:4,
      fontFamily:"'Space Mono',monospace", fontSize:11, fontWeight:700,
      letterSpacing:".08em", textTransform:"uppercase" as const,
      cursor: disabled ? "not-allowed" : "pointer", transition:"all .15s",
      flexShrink:0,
    }}>
      {children}
    </button>
  );
}

function TxList({ hashes, error }: { hashes: string[]; error?: string }) {
  if (!hashes.length && !error) return null;
  return (
    <div style={{
      marginTop:14, padding:"12px 16px", borderRadius:4,
      background: error ? "rgba(255,80,80,.05)" : "rgba(74,255,138,.05)",
      border: `1px solid ${error ? "rgba(255,80,80,.25)" : "rgba(74,255,138,.25)"}`,
    }}>
      {error ? (
        <span style={{ fontSize:12, color:"#ff6060", fontFamily:"'Space Mono',monospace" }}>{error}</span>
      ) : hashes.map((h, i) => (
        <div key={h} style={{ fontSize:12, fontFamily:"'Space Mono',monospace", marginBottom: i < hashes.length-1 ? 6 : 0 }}>
          <span style={{ color:"#4aff8a" }}>TX {i+1} → </span>
          <a href={`${EXPLORER}/tx/${h}`} target="_blank" rel="noreferrer" style={{ color:"var(--mars-glow)" }}>{shortHash(h)}</a>
          <span style={{ color:"var(--mars-dust)", fontSize:10 }}> · waiting for validators…</span>
        </div>
      ))}
    </div>
  );
}

function CliCmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <div style={{ marginTop:14, background:"rgba(0,0,0,.4)", border:"1px solid rgba(196,98,45,.15)", borderRadius:4, overflow:"hidden" }}>
      <div style={{
        padding:"6px 14px", borderBottom:"1px solid rgba(196,98,45,.1)",
        fontSize:9, color:"var(--mars-dust)", letterSpacing:".12em", textTransform:"uppercase",
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <span>CLI equivalent</span>
        <button onClick={copy} style={{ background:"none", border:"none", cursor:"pointer", color: copied ? "#4aff8a" : "var(--mars-glow)", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:".1em" }}>
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre style={{ margin:0, padding:"12px 14px", overflowX:"auto", fontSize:11, color:"var(--mars-sand)", fontFamily:"'Space Mono',monospace", whiteSpace:"pre-wrap" as const, wordBreak:"break-all" as const }}>
        {cmd}
      </pre>
    </div>
  );
}

function SectionHead({ tag, title, addr }: { tag: string; title: string; addr: string }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ fontSize:9, color:"var(--mars-glow)", letterSpacing:".2em", textTransform:"uppercase", marginBottom:8 }}>{tag}</div>
      <h2 style={{ fontFamily:"'Orbitron',monospace", fontSize:"clamp(18px,2.5vw,30px)", color:"var(--mars-pale)", fontWeight:700, marginBottom:8, lineHeight:1.2 }}>
        {title}
      </h2>
      <a href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer"
        style={{ fontSize:10, color:"var(--mars-glow)", fontFamily:"'Space Mono',monospace" }}>
        {shortAddr(addr)}
      </a>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background:"var(--mars-mid)", border:"1px solid rgba(196,98,45,.22)", borderRadius:6, padding:"16px 20px" }}>
      <div style={{ fontSize:9, color:"var(--mars-dust)", letterSpacing:".12em", textTransform:"uppercase", marginBottom:8 }}>{label}</div>
      <div style={{ fontFamily:"'Orbitron',monospace", fontSize:24, color:"var(--mars-pale)", fontWeight:700 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"var(--mars-dust)", marginTop:4 }}>{sub}</div>}
    </div>
  );
}

// ── Shared: wallet check banner ────────────────────────────────────────────────

function WalletRequired() {
  return (
    <div style={{ marginBottom:20, padding:"14px 18px", borderRadius:4, background:"rgba(255,184,74,.05)", border:"1px solid rgba(255,184,74,.2)", fontSize:12, color:"#ffb84a", fontFamily:"'Space Mono',monospace" }}>
      Connect a wallet above to send transactions.
    </div>
  );
}

// ── Tab: Chain State ────────────────────────────────────────────────────────────

function ChainStateTab() {
  const [regStats,    setRegStats]    = useState<RegistryStats | null>(null);
  const [factStats,   setFactStats]   = useState<FactoryStats  | null>(null);
  const [agents,      setAgents]      = useState<(AgentData | null)[]>([]);
  const [mission,     setMission]     = useState<MissionData | null>(null);
  const [ledger,      setLedger]      = useState<LedgerStats | null>(null);
  const [reports,     setReports]     = useState<(ReportData | null)[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [lastSync,    setLastSync]    = useState("");

  // Query state
  const [qAgentId,    setQAgentId]    = useState("");
  const [qMissionId,  setQMissionId]  = useState("");
  const [qTaskId,     setQTaskId]     = useState("");
  const [qReportsId,  setQReportsId]  = useState("");
  const [qOwner,      setQOwner]      = useState("");
  const [qAgent,      setQAgent]      = useState<AgentData | null | "error">(null);
  const [qMission,    setQMission]    = useState<MissionData | null | "error">(null);
  const [qTask,       setQTask]       = useState<TaskData & { can_start?: CanStartResult } | null | "error">(null);
  const [qAgentReps,  setQAgentReps]  = useState<ReportData[] | null | "error">(null);
  const [qAgentRep,   setQAgentRep]   = useState<AgentReputation | null | "error">(null);
  const [qOwnerList,  setQOwnerList]  = useState<string[] | null | "error">(null);

  const fetchAll = useCallback(async () => {
    const [rs, fs, ...agentArr] = await Promise.allSettled([
      getRegistryStats(),
      getFactoryStats(),
      ...KNOWN_AGENTS.map((id) => getAgent(id)),
    ]);
    if (rs.status === "fulfilled") setRegStats(rs.value);
    if (fs.status === "fulfilled") setFactStats(fs.value);
    setAgents(agentArr.map((r) => (r.status === "fulfilled" ? r.value : null)));

    const [ms, ls, ...repArr] = await Promise.allSettled([
      getMission(KNOWN_MISSION),
      getLedgerStats(),
      ...KNOWN_REPORTS.map((id) => getReport(id)),
    ]);
    if (ms.status === "fulfilled") setMission(ms.value);
    if (ls.status === "fulfilled") setLedger(ls.value);
    setReports(repArr.map((r) => (r.status === "fulfilled" ? r.value : null)));
    setLastSync(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30_000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const lookupAgent = async () => {
    if (!qAgentId.trim()) return;
    try { setQAgent(await getAgent(qAgentId.trim())); } catch { setQAgent("error"); }
  };
  const lookupMission = async () => {
    if (!qMissionId.trim()) return;
    try { setQMission(await getMission(qMissionId.trim())); } catch { setQMission("error"); }
  };
  const lookupTask = async () => {
    if (!qTaskId.trim()) return;
    try {
      const [td, cs] = await Promise.allSettled([getTask(qTaskId.trim()), canStartTask(qTaskId.trim())]);
      if (td.status === "fulfilled") {
        setQTask({ ...td.value, can_start: cs.status === "fulfilled" ? cs.value : undefined });
      } else { setQTask("error"); }
    } catch { setQTask("error"); }
  };
  const lookupAgentReports = async () => {
    if (!qReportsId.trim()) return;
    try {
      const [rep, reports] = await Promise.allSettled([
        getAgentReputation(qReportsId.trim()),
        getAgentReports(qReportsId.trim()),
      ]);
      setQAgentRep(rep.status === "fulfilled" ? rep.value : "error");
      setQAgentReps(reports.status === "fulfilled" ? reports.value : "error");
    } catch { setQAgentReps("error"); }
  };
  const lookupOwner = async () => {
    if (!qOwner.trim()) return;
    try { setQOwnerList(await getAgentsByOwner(qOwner.trim())); } catch { setQOwnerList("error"); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:52 }}>

      {/* Stats row */}
      <div>
        <div style={{ fontSize:9, color:"var(--mars-glow)", letterSpacing:".2em", textTransform:"uppercase", marginBottom:16 }}>Protocol stats</div>
        {loading ? (
          <div style={{ color:"var(--mars-dust)", fontSize:13 }}>Fetching chain state…</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
            <StatCard label="Registered agents" value={toNum(regStats?.total_registered)} />
            <StatCard label="Active agents"     value={toNum(regStats?.total_active)} />
            <StatCard label="Total missions"    value={toNum(factStats?.total_missions)} />
            <StatCard label="Completed"         value={toNum(factStats?.completed_missions)} />
            <StatCard label="Total tasks"       value={toNum(factStats?.total_tasks)} />
            <StatCard label="Reports accepted"  value={`${toNum(ledger?.total_accepted)} / ${toNum(ledger?.total_reports)}`} />
          </div>
        )}
      </div>

      {/* Agent fleet */}
      <div>
        <SectionHead tag="AgentRegistry" title="Registered agents" addr={CONTRACTS.AGENT_REGISTRY} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14 }}>
          {agents.map((a, i) => {
            if (!a) return (
              <div key={i} style={{ background:"var(--mars-mid)", border:"1px solid rgba(196,98,45,.12)", borderRadius:6, padding:"18px 20px", color:"var(--mars-dust)", fontSize:11 }}>
                {KNOWN_AGENTS[i]} — fetch error
              </div>
            );
            const tc = typeColor(a.rover_type);
            const rep = toNum(a.reputation);
            return (
              <div key={a.agent_id} style={{ background:"var(--mars-mid)", border:"1px solid rgba(196,98,45,.22)", borderRadius:6, padding:"18px 20px", display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontFamily:"'Orbitron',monospace", fontSize:13, fontWeight:700, color:"var(--mars-pale)", marginBottom:3 }}>{a.name}</div>
                    <div style={{ fontSize:9, color:"var(--mars-dust)" }}>{a.agent_id}</div>
                  </div>
                  <span style={{ background:tc.bg, border:`1px solid ${tc.border}`, color:tc.text, fontSize:9, letterSpacing:".1em", padding:"3px 8px", borderRadius:3, textTransform:"uppercase", fontWeight:700 }}>
                    {a.rover_type}
                  </span>
                </div>
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:9, color:"var(--mars-dust)", letterSpacing:".1em", textTransform:"uppercase" }}>Rep</span>
                    <span style={{ fontFamily:"'Orbitron',monospace", fontSize:18, color:tc.text, fontWeight:700 }}>{rep}</span>
                  </div>
                  <div style={{ height:3, background:"rgba(196,98,45,.1)", borderRadius:2 }}>
                    <div style={{ height:"100%", width:`${rep}%`, background:tc.text, borderRadius:2 }}/>
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10 }}>
                  <span style={{ color:"var(--mars-dust)" }}>✓ {toNum(a.missions_completed)} · ✗ {toNum(a.missions_failed)}</span>
                  <span style={{ color: a.status === "ACTIVE" ? "#4aff8a" : "#ff6060" }}>{a.status}</span>
                </div>
                {a.registration_notes && (
                  <div style={{ fontSize:10, color:"var(--mars-dust)", lineHeight:1.6, borderTop:"1px solid rgba(196,98,45,.1)", paddingTop:10 }}>
                    {a.registration_notes.slice(0,90)}{a.registration_notes.length > 90 ? "…" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mission + tasks */}
      <div>
        <SectionHead tag="MissionFactory" title="Active mission" addr={CONTRACTS.MISSION_FACTORY} />
        {mission ? (
          <div style={{ background:"var(--mars-mid)", border:"1px solid rgba(196,98,45,.22)", borderRadius:6, overflow:"hidden" }}>
            <div style={{ padding:"16px 22px", borderBottom:"1px solid rgba(196,98,45,.1)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:14, color:"var(--mars-pale)", fontWeight:700, marginBottom:4 }}>{mission.name}</div>
                <div style={{ fontSize:10, color:"var(--mars-dust)" }}>{mission.mission_id} · {mission.description}</div>
              </div>
              <span style={{
                padding:"4px 12px", borderRadius:3, fontSize:10, letterSpacing:".1em", fontWeight:700,
                background: mission.status === "COMPLETED" ? "rgba(74,255,138,.07)" : "rgba(255,184,74,.07)",
                border: `1px solid ${mission.status === "COMPLETED" ? "rgba(74,255,138,.25)" : "rgba(255,184,74,.25)"}`,
                color: mission.status === "COMPLETED" ? "#4aff8a" : "#ffb84a",
              }}>{mission.status}</span>
            </div>
            <div style={{ padding:"16px 22px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:9, color:"var(--mars-dust)", letterSpacing:".1em", textTransform:"uppercase" }}>Progress</span>
                <span style={{ fontSize:11, color:"var(--mars-pale)", fontFamily:"'Orbitron',monospace" }}>
                  {toNum(mission.tasks_completed)} / {toNum(mission.tasks_total)}
                </span>
              </div>
              <div style={{ height:3, background:"rgba(196,98,45,.1)", borderRadius:2, marginBottom:16 }}>
                <div style={{ height:"100%", width:`${toNum(mission.tasks_total) > 0 ? (toNum(mission.tasks_completed)/toNum(mission.tasks_total))*100 : 0}%`, background:"var(--mars-glow)", borderRadius:2 }}/>
              </div>
              {mission.tasks?.map((t) => (
                <div key={t.task_id} style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, marginBottom:8 }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, background:taskStatusColor(t.status) }}/>
                  <span style={{ color:"var(--mars-glow)", fontSize:9, letterSpacing:".1em", width:76, flexShrink:0 }}>{t.task_type}</span>
                  <span style={{ color:"var(--mars-pale)", flex:1 }}>{t.task_id}</span>
                  <span style={{ color:"var(--mars-dust)", fontSize:10 }}>{t.assigned_agent}</span>
                  <span style={{ color:taskStatusColor(t.status), fontSize:9, letterSpacing:".08em" }}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        ) : !loading ? (
          <div style={{ color:"var(--mars-dust)", fontSize:12 }}>Could not fetch {KNOWN_MISSION}</div>
        ) : null}
      </div>

      {/* Ledger */}
      <div>
        <SectionHead tag="ReputationLedger" title="Peer reports" addr={CONTRACTS.REPUTATION_LEDGER} />
        {reports.filter(Boolean).length > 0 && (
          <div style={{ background:"var(--mars-mid)", border:"1px solid rgba(196,98,45,.22)", borderRadius:6, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"rgba(0,0,0,.18)" }}>
                  {["Reporter → Target","Outcome","Delta","LLM Verdict","Accepted"].map((h) => (
                    <th key={h} style={{ padding:"10px 18px", textAlign:"left", fontSize:9, color:"rgba(138,90,58,.6)", letterSpacing:".1em", textTransform:"uppercase", fontFamily:"'Space Mono',monospace" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => r ? (
                  <tr key={r.report_id} style={{ borderTop:"1px solid rgba(196,98,45,.07)" }}>
                    <td style={{ padding:"12px 18px" }}>
                      <div style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:"var(--mars-pale)" }}>{r.reporter_agent} → {r.target_agent}</div>
                      <div style={{ fontSize:9, color:"var(--mars-dust)", marginTop:2 }}>{r.report_id}</div>
                    </td>
                    <td style={{ padding:"12px 18px" }}>
                      <span style={{ padding:"3px 10px", borderRadius:3, fontSize:10, background: r.outcome==="SUCCESS"?"rgba(74,255,138,.07)":"rgba(255,80,80,.07)", color: r.outcome==="SUCCESS"?"#4aff8a":"#ff6060", border:`1px solid ${r.outcome==="SUCCESS"?"rgba(74,255,138,.22)":"rgba(255,80,80,.22)"}` }}>{r.outcome}</span>
                    </td>
                    <td style={{ padding:"12px 18px", fontFamily:"'Orbitron',monospace", fontSize:12, color: r.reputation_delta > 0 ? "#4aff8a" : r.reputation_delta < 0 ? "#ff6060" : "var(--mars-dust)" }}>
                      {r.reputation_delta > 0 ? `+${r.reputation_delta}` : r.reputation_delta}
                    </td>
                    <td style={{ padding:"12px 18px", fontSize:11, color:"var(--mars-dust)", maxWidth:220 }}>
                      {(r.llm_verdict ?? "").slice(0,80)}{(r.llm_verdict?.length ?? 0) > 80 ? "…" : ""}
                    </td>
                    <td style={{ padding:"12px 18px", fontSize:10, color: r.accepted ? "#4aff8a" : "#ff6060", fontFamily:"'Space Mono',monospace" }}>
                      {r.accepted ? "YES" : "NO"}
                    </td>
                  </tr>
                ) : (
                  <tr key={i} style={{ borderTop:"1px solid rgba(196,98,45,.07)" }}>
                    <td colSpan={5} style={{ padding:"10px 18px", fontSize:11, color:"var(--mars-dust)" }}>{KNOWN_REPORTS[i]} — fetch error</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding:"10px 18px", borderTop:"1px solid rgba(196,98,45,.1)", fontSize:9, color:"var(--mars-dust)", letterSpacing:".1em", textTransform:"uppercase", display:"flex", gap:24 }}>
              <span>{toNum(ledger?.total_reports)} reports submitted</span>
              <span style={{ color:"#4aff8a" }}>{toNum(ledger?.total_accepted)} accepted</span>
              <span style={{ marginLeft:"auto", color:"var(--mars-pale)" }}>
                Acceptance: <span style={{ fontFamily:"'Orbitron',monospace", color:"#4aff8a" }}>{toNum(ledger?.acceptance_rate_pct)}%</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Query panel */}
      <div>
        <div style={{ fontSize:9, color:"var(--mars-glow)", letterSpacing:".2em", textTransform:"uppercase", marginBottom:20 }}>Query on-chain by ID</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:18 }}>

          {/* Agent lookup */}
          <QueryCard title="Agent">
            <div style={{ display:"flex", gap:8 }}>
              <Input value={qAgentId} onChange={setQAgentId} placeholder="rover-explorer-01" />
              <Btn onClick={lookupAgent} variant="ghost">Go</Btn>
            </div>
            {qAgent === "error" && <ErrMsg>Agent not found</ErrMsg>}
            {qAgent && qAgent !== "error" && (
              <MonoData rows={[
                ["name",   qAgent.name],
                ["type",   qAgent.rover_type],
                ["rep",    String(toNum(qAgent.reputation))],
                ["status", qAgent.status],
                ["missions", `${toNum(qAgent.missions_completed)} ✓ / ${toNum(qAgent.missions_failed)} ✗`],
                ["capabilities", qAgent.capabilities.slice(0,60)+(qAgent.capabilities.length>60?"…":"")],
              ]}/>
            )}
          </QueryCard>

          {/* Task lookup */}
          <QueryCard title="Task + eligibility">
            <div style={{ display:"flex", gap:8 }}>
              <Input value={qTaskId} onChange={setQTaskId} placeholder="task-explore-01" />
              <Btn onClick={lookupTask} variant="ghost">Go</Btn>
            </div>
            {qTask === "error" && <ErrMsg>Task not found</ErrMsg>}
            {qTask && qTask !== "error" && (
              <MonoData rows={[
                ["task_id",  qTask.task_id],
                ["type",     qTask.task_type],
                ["agent",    qTask.assigned_agent],
                ["status",   qTask.status],
                ["depends",  qTask.depends_on || "none"],
                ["can_start", qTask.can_start ? (qTask.can_start.can_start ? "YES" : `NO — ${qTask.can_start.reason}`) : "—"],
                ["notes",    (qTask.validation_notes||"—").slice(0,60)],
              ]}/>
            )}
          </QueryCard>

          {/* Mission lookup */}
          <QueryCard title="Mission">
            <div style={{ display:"flex", gap:8 }}>
              <Input value={qMissionId} onChange={setQMissionId} placeholder="mission-olympus-01" />
              <Btn onClick={lookupMission} variant="ghost">Go</Btn>
            </div>
            {qMission === "error" && <ErrMsg>Mission not found</ErrMsg>}
            {qMission && qMission !== "error" && (
              <MonoData rows={[
                ["name",    qMission.name],
                ["status",  qMission.status],
                ["tasks",   `${toNum(qMission.tasks_completed)} / ${toNum(qMission.tasks_total)}`],
                ["created", qMission.created_at],
                ["desc",    (qMission.description||"—").slice(0,60)],
              ]}/>
            )}
          </QueryCard>

          {/* Agent reputation + reports */}
          <QueryCard title="Agent reputation & reports">
            <div style={{ display:"flex", gap:8 }}>
              <Input value={qReportsId} onChange={setQReportsId} placeholder="rover-analyst-01" />
              <Btn onClick={lookupAgentReports} variant="ghost">Go</Btn>
            </div>
            {qAgentRep === "error" && <ErrMsg>Agent not found</ErrMsg>}
            {qAgentRep && qAgentRep !== "error" && (
              <MonoData rows={[
                ["current_rep",  String(toNum(qAgentRep.current_reputation))],
                ["reports_recv", String(toNum(qAgentRep.total_reports_received))],
                ["accepted",     String(toNum(qAgentRep.accepted_reports))],
              ]}/>
            )}
            {qAgentReps && qAgentReps !== "error" && qAgentReps.length > 0 && (
              <div style={{ marginTop:10, fontSize:10, color:"var(--mars-dust)" }}>
                {qAgentReps.map((r) => (
                  <div key={r.report_id} style={{ borderTop:"1px solid rgba(196,98,45,.08)", paddingTop:6, marginTop:6 }}>
                    <span style={{ color: r.accepted ? "#4aff8a" : "#ff6060" }}>{r.outcome}</span>
                    {" · "}<span style={{ color: r.reputation_delta >= 0 ? "#4aff8a" : "#ff6060" }}>{r.reputation_delta > 0 ? `+${r.reputation_delta}` : r.reputation_delta}</span>
                    {" · "}{r.reporter_agent}
                  </div>
                ))}
              </div>
            )}
            {qAgentReps && qAgentReps !== "error" && qAgentReps.length === 0 && (
              <div style={{ marginTop:8, fontSize:10, color:"var(--mars-dust)" }}>No reports received yet</div>
            )}
          </QueryCard>

          {/* Agents by owner */}
          <QueryCard title="Agents by owner address">
            <div style={{ display:"flex", gap:8 }}>
              <Input value={qOwner} onChange={setQOwner} placeholder="0x…" />
              <Btn onClick={lookupOwner} variant="ghost">Go</Btn>
            </div>
            {qOwnerList === "error" && <ErrMsg>Address not found</ErrMsg>}
            {qOwnerList && qOwnerList !== "error" && (
              qOwnerList.length === 0
                ? <div style={{ marginTop:8, fontSize:11, color:"var(--mars-dust)" }}>No agents for this address</div>
                : <div style={{ marginTop:10 }}>
                    {qOwnerList.map((id) => (
                      <div key={id} style={{ fontSize:11, color:"var(--mars-glow)", fontFamily:"'Space Mono',monospace", marginBottom:4 }}>{id}</div>
                    ))}
                  </div>
            )}
          </QueryCard>

        </div>
      </div>

      {lastSync && (
        <div style={{ fontSize:10, color:"rgba(138,90,58,.4)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>Last sync: {lastSync} · auto-refresh every 30s</span>
          <button onClick={fetchAll} style={{ background:"none", border:"none", color:"var(--mars-glow)", cursor:"pointer", fontSize:10, fontFamily:"'Space Mono',monospace" }}>
            ↻ refresh now
          </button>
        </div>
      )}
    </div>
  );
}

// small helpers for query cards
function QueryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:"var(--mars-mid)", border:"1px solid rgba(196,98,45,.22)", borderRadius:6, padding:"18px 20px", display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:11, color:"var(--mars-pale)", fontWeight:700 }}>{title}</div>
      {children}
    </div>
  );
}
function ErrMsg({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:11, color:"#ff6060", fontFamily:"'Space Mono',monospace" }}>{children}</div>;
}
function MonoData({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ fontSize:11, fontFamily:"'Space Mono',monospace", lineHeight:1.9 }}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <span style={{ color:"var(--mars-dust)" }}>{k}: </span>
          <span style={{ color:"var(--mars-sand)" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Register Agent ─────────────────────────────────────────────────────────

function RegisterAgentTab({ wallet }: { wallet: WalletState }) {
  const [agentId,       setAgentId]       = useState("");
  const [name,          setName]          = useState("");
  const [roverType,     setRoverType]     = useState("EXPLORER");
  const [capabilities,  setCapabilities]  = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [hashes,        setHashes]        = useState<string[]>([]);
  const [error,         setError]         = useState("");

  const submit = async () => {
    if (!agentId || !name || !capabilities) { setError("All fields required"); return; }
    if (!wallet) { setError("No wallet connected"); return; }
    setSubmitting(true); setError(""); setHashes([]);
    try {
      const h = await execWrite(wallet, CONTRACTS.AGENT_REGISTRY, "register_agent", [agentId, name, roverType, capabilities]);
      setHashes([h]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  };

  const cli = `genlayer network set testnet-bradbury\ngenlayer write ${CONTRACTS.AGENT_REGISTRY} register_agent \\\n  --args "${agentId||"<agent_id>"}" "${name||"<name>"}" "${roverType}" "${capabilities||"<capabilities>"}"`;

  return (
    <div style={{ maxWidth:560 }}>
      <Desc>Register a new robotic agent. The LLM evaluates whether the declared capabilities are coherent for the rover type and assigns an initial reputation score (50–80).</Desc>
      {!wallet && <WalletRequired />}
      <FormGrid>
        <Field label="Agent ID"><Input value={agentId} onChange={setAgentId} placeholder="my-rover-01"/></Field>
        <Field label="Name"><Input value={name} onChange={setName} placeholder="Perseverance-2"/></Field>
        <Field label="Rover type" wide>
          <Select value={roverType} onChange={setRoverType} options={[
            {label:"EXPLORER — terrain mapping, obstacle detection", value:"EXPLORER"},
            {label:"COLLECTOR — sample extraction, geological analysis", value:"COLLECTOR"},
            {label:"ANALYST — spectrometry, laboratory analysis", value:"ANALYST"},
            {label:"TRANSPORTER — cargo handling, chain of custody", value:"TRANSPORTER"},
          ]}/>
        </Field>
        <Field label="Declared capabilities" wide><Input value={capabilities} onChange={setCapabilities} placeholder="Autonomous navigation with LiDAR, stereo cameras, dust sensor…"/></Field>
      </FormGrid>
      <Btn onClick={submit} disabled={submitting || !wallet}>{submitting ? "Submitting…" : "Register agent →"}</Btn>
      <TxList hashes={hashes} error={error} />
      <CliCmd cmd={cli} />
    </div>
  );
}

// ── Tab: New Mission (create_mission + add_task chain) ─────────────────────────

function NewMissionTab({ wallet }: { wallet: WalletState }) {
  const [missionId, setMissionId] = useState("");
  const [mName,     setMName]     = useState("");
  const [desc,      setDesc]      = useState("");
  const [tasks, setTasks] = useState([
    { taskId:"", taskType:"EXPLORE",   taskDesc:"", agentId:"", minRep:"0", dependsOn:"" },
    { taskId:"", taskType:"COLLECT",   taskDesc:"", agentId:"", minRep:"0", dependsOn:"" },
    { taskId:"", taskType:"ANALYZE",   taskDesc:"", agentId:"", minRep:"0", dependsOn:"" },
    { taskId:"", taskType:"TRANSPORT", taskDesc:"", agentId:"", minRep:"0", dependsOn:"" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [progress,   setProgress]   = useState("");
  const [hashes,     setHashes]     = useState<string[]>([]);
  const [error,      setError]      = useState("");

  const upd = (i: number, key: string, val: string) =>
    setTasks((p) => p.map((t, idx) => idx === i ? { ...t, [key]: val } : t));

  const validTasks = tasks.filter((t) => t.taskId && t.taskDesc && t.agentId);

  const submit = async () => {
    if (!missionId || !mName) { setError("Mission ID and name required"); return; }
    if (!wallet) { setError("No wallet connected"); return; }
    setSubmitting(true); setError(""); setHashes([]); setProgress("");

    const collected: string[] = [];
    try {
      // Step 1: create_mission
      setProgress("Creating mission…");
      const h0 = await execWrite(wallet, CONTRACTS.MISSION_FACTORY, "create_mission", [missionId, mName, desc]);
      collected.push(h0);
      setHashes([...collected]);

      // Step 2: add_task for each valid task (sequential — dependencies matter)
      for (let i = 0; i < validTasks.length; i++) {
        const t = validTasks[i];
        setProgress(`Adding task ${i+1} / ${validTasks.length} — ${t.taskId}…`);
        const h = await execWrite(wallet, CONTRACTS.MISSION_FACTORY, "add_task", [
          missionId, t.taskId, t.taskType, t.taskDesc, t.agentId, t.minRep || "0", t.dependsOn,
        ]);
        collected.push(h);
        setHashes([...collected]);
      }
      setProgress("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSubmitting(false); }
  };

  const taskCli = validTasks.map((t, i) =>
    `# Task ${i+1}\ngenlayer write ${CONTRACTS.MISSION_FACTORY} add_task \\\n  --args "${missionId||"<id>"}" "${t.taskId||"<task_id>"}" "${t.taskType}" "${t.taskDesc||"<desc>"}" "${t.agentId||"<agent>"}" "${t.minRep||"0"}" "${t.dependsOn||""}"`
  ).join("\n\n");
  const cli = `# 1. Create mission\ngenlayer write ${CONTRACTS.MISSION_FACTORY} create_mission \\\n  --args "${missionId||"<id>"}" "${mName||"<name>"}" "${desc||"<desc>"}"\n\n${taskCli}`;

  return (
    <div style={{ maxWidth:720 }}>
      <Desc>Create a mission and chain its tasks on-chain in a single flow. Each task is sent as a separate transaction after the mission is created. Tasks with dependencies are submitted in order.</Desc>
      {!wallet && <WalletRequired />}
      <FormGrid>
        <Field label="Mission ID"><Input value={missionId} onChange={setMissionId} placeholder="mission-mons-02"/></Field>
        <Field label="Name"><Input value={mName} onChange={setMName} placeholder="Olympus Mons Survey II"/></Field>
        <Field label="Description" wide><Input value={desc} onChange={setDesc} placeholder="Deep geological survey of volcanic plain…"/></Field>
      </FormGrid>

      <div style={{ borderTop:"1px solid rgba(196,98,45,.15)", paddingTop:20, marginBottom:20 }}>
        <div style={{ fontSize:9, color:"var(--mars-glow)", letterSpacing:".14em", textTransform:"uppercase", marginBottom:14 }}>
          Task chain — {validTasks.length} / {tasks.length} ready
        </div>
        {tasks.map((t, i) => (
          <div key={i} style={{ background:"rgba(0,0,0,.2)", border:"1px solid rgba(196,98,45,.1)", borderRadius:4, padding:"14px 16px", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <span style={{ fontSize:9, color:"var(--mars-dust)", letterSpacing:".1em", textTransform:"uppercase" }}>Task {i+1}</span>
              {t.taskId && t.taskDesc && t.agentId && <span style={{ fontSize:9, color:"#4aff8a" }}>✓ ready</span>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:10, marginBottom:10 }}>
              <Field label="Task ID"><Input value={t.taskId} onChange={(v) => upd(i,"taskId",v)} placeholder={`task-step-0${i+1}`}/></Field>
              <Field label="Type">
                <Select value={t.taskType} onChange={(v) => upd(i,"taskType",v)} options={[
                  {label:"EXPLORE",value:"EXPLORE"},{label:"COLLECT",value:"COLLECT"},
                  {label:"ANALYZE",value:"ANALYZE"},{label:"TRANSPORT",value:"TRANSPORT"},
                ]}/>
              </Field>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:10 }}>
              <Field label="Description"><Input value={t.taskDesc} onChange={(v) => upd(i,"taskDesc",v)} placeholder="Map terrain sector…"/></Field>
              <Field label="Agent ID"><Input value={t.agentId} onChange={(v) => upd(i,"agentId",v)} placeholder="rover-explorer-01"/></Field>
              <Field label="Depends on"><Input value={t.dependsOn} onChange={(v) => upd(i,"dependsOn",v)} placeholder="task-id or empty"/></Field>
            </div>
          </div>
        ))}
        <Btn onClick={() => setTasks((p) => [...p, {taskId:"",taskType:"EXPLORE",taskDesc:"",agentId:"",minRep:"0",dependsOn:""}])} variant="ghost">+ Add task</Btn>
      </div>

      {progress && <div style={{ fontSize:11, color:"#ffb84a", fontFamily:"'Space Mono',monospace", marginBottom:10 }}>{progress}</div>}
      <Btn onClick={submit} disabled={submitting || !wallet}>
        {submitting ? "Sending…" : `Create mission + ${validTasks.length} task${validTasks.length !== 1 ? "s" : ""} →`}
      </Btn>
      <TxList hashes={hashes} error={error} />
      <CliCmd cmd={cli} />
    </div>
  );
}

// ── Tab: Start Task ─────────────────────────────────────────────────────────────

function StartTaskTab({ wallet }: { wallet: WalletState }) {
  const [taskId,   setTaskId]   = useState("");
  const [checking, setChecking] = useState(false);
  const [canStart, setCanStart] = useState<CanStartResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hashes,   setHashes]   = useState<string[]>([]);
  const [error,    setError]    = useState("");

  const check = async () => {
    if (!taskId.trim()) return;
    setChecking(true); setCanStart(null);
    try { setCanStart(await canStartTask(taskId.trim())); } catch { setCanStart(null); }
    finally { setChecking(false); }
  };

  const submit = async () => {
    if (!taskId) { setError("Task ID required"); return; }
    if (!wallet) { setError("No wallet connected"); return; }
    setSubmitting(true); setError(""); setHashes([]);
    try {
      const h = await execWrite(wallet, CONTRACTS.MISSION_FACTORY, "start_task", [taskId]);
      setHashes([h]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  };

  const cli = `genlayer write ${CONTRACTS.MISSION_FACTORY} start_task \\\n  --args "${taskId||"<task_id>"}"`;

  return (
    <div style={{ maxWidth:480 }}>
      <Desc>Mark a task as IN_PROGRESS. The contract verifies that the dependent task is COMPLETED before allowing the transition. Required before submitting a task result.</Desc>
      {!wallet && <WalletRequired />}
      <FormGrid>
        <Field label="Task ID" wide>
          <div style={{ display:"flex", gap:8 }}>
            <Input value={taskId} onChange={(v) => { setTaskId(v); setCanStart(null); }} placeholder="task-collect-01"/>
            <Btn onClick={check} disabled={checking} variant="ghost">{checking ? "…" : "Check"}</Btn>
          </div>
        </Field>
      </FormGrid>

      {canStart && (
        <div style={{
          marginBottom:16, padding:"12px 16px", borderRadius:4,
          background: canStart.can_start ? "rgba(74,255,138,.05)" : "rgba(255,184,74,.05)",
          border: `1px solid ${canStart.can_start ? "rgba(74,255,138,.25)" : "rgba(255,184,74,.25)"}`,
          fontSize:12, fontFamily:"'Space Mono',monospace",
        }}>
          <div style={{ color: canStart.can_start ? "#4aff8a" : "#ffb84a", marginBottom:4 }}>
            {canStart.can_start ? "✓ Ready to start" : "✗ Cannot start yet"}
          </div>
          <div style={{ fontSize:10, color:"var(--mars-dust)" }}>
            {canStart.reason} · task: {canStart.task_status} · dep: {canStart.dependency_status}
          </div>
        </div>
      )}

      <Btn onClick={submit} disabled={submitting || !wallet || (canStart !== null && !canStart.can_start)}>
        {submitting ? "Submitting…" : "Start task →"}
      </Btn>
      <TxList hashes={hashes} error={error} />
      <CliCmd cmd={cli} />
    </div>
  );
}

// ── Tab: Submit Task Result ─────────────────────────────────────────────────────

function SubmitTaskTab({ wallet }: { wallet: WalletState }) {
  const [missionId,  setMissionId]  = useState("");
  const [taskId,     setTaskId]     = useState("");
  const [agentName,  setAgentName]  = useState("");
  const [resultData, setResultData] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hashes,     setHashes]     = useState<string[]>([]);
  const [error,      setError]      = useState("");

  const submit = async () => {
    if (!missionId || !taskId || !agentName || !resultData) { setError("All fields required"); return; }
    if (!wallet) { setError("No wallet connected"); return; }
    setSubmitting(true); setError(""); setHashes([]);
    try {
      const h = await execWrite(wallet, CONTRACTS.MISSION_FACTORY, "submit_task_result", [missionId, taskId, agentName, resultData]);
      setHashes([h]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  };

  const cli = `genlayer write ${CONTRACTS.MISSION_FACTORY} submit_task_result \\\n  --args "${missionId||"<mission_id>"}" "${taskId||"<task_id>"}" "${agentName||"<agent_name>"}" "${resultData||"<result_data>"}"`;

  return (
    <div style={{ maxWidth:560 }}>
      <Desc>Submit a task result for LLM validation. The task must be IN_PROGRESS (call Start Task first). If COMPLETED, the next dependent task is automatically unlocked.</Desc>
      <div style={{ padding:"10px 16px", marginBottom:18, borderRadius:4, background:"rgba(255,184,74,.04)", border:"1px solid rgba(255,184,74,.15)", fontSize:11, color:"#ffb84a", fontFamily:"'Space Mono',monospace" }}>
        Flow: Start Task → Submit Task Result
      </div>
      {!wallet && <WalletRequired />}
      <FormGrid>
        <Field label="Mission ID"><Input value={missionId} onChange={setMissionId} placeholder="mission-olympus-01"/></Field>
        <Field label="Task ID"><Input value={taskId} onChange={setTaskId} placeholder="task-explore-01"/></Field>
        <Field label="Agent name" wide><Input value={agentName} onChange={setAgentName} placeholder="Sojourner-X"/></Field>
        <Field label="Result data" wide><Input value={resultData} onChange={setResultData} placeholder="Terrain mapped at (-0.82, 0.07). 3 geological targets identified…"/></Field>
      </FormGrid>
      <Btn onClick={submit} disabled={submitting || !wallet}>{submitting ? "Submitting…" : "Submit result →"}</Btn>
      <TxList hashes={hashes} error={error} />
      <CliCmd cmd={cli} />
    </div>
  );
}

// ── Tab: Update Reputation ──────────────────────────────────────────────────────

function UpdateReputationTab({ wallet }: { wallet: WalletState }) {
  const [agentId,  setAgentId]  = useState("");
  const [success,  setSuccess]  = useState(true);
  const [notes,    setNotes]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hashes,   setHashes]   = useState<string[]>([]);
  const [error,    setError]    = useState("");

  const submit = async () => {
    if (!agentId || !notes) { setError("Agent ID and performance notes required"); return; }
    if (!wallet) { setError("No wallet connected"); return; }
    setSubmitting(true); setError(""); setHashes([]);
    try {
      const h = await execWrite(wallet, CONTRACTS.AGENT_REGISTRY, "update_reputation", [agentId, success, notes]);
      setHashes([h]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  };

  const cli = `genlayer write ${CONTRACTS.AGENT_REGISTRY} update_reputation \\\n  --args "${agentId||"<agent_id>"}" "${success}" "${notes||"<performance_notes>"}"`;

  return (
    <div style={{ maxWidth:560 }}>
      <Desc>Update a rover's reputation after mission completion. The LLM evaluates performance notes to calculate the delta: +1 to +10 on success, -5 to -20 on failure. Agents below 20 rep are automatically suspended.</Desc>
      {!wallet && <WalletRequired />}
      <FormGrid>
        <Field label="Agent ID" wide><Input value={agentId} onChange={setAgentId} placeholder="rover-explorer-01"/></Field>
        <Field label="Mission outcome" wide>
          <div style={{ display:"flex", gap:12 }}>
            {([true, false] as const).map((v) => (
              <label key={String(v)} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:12, color: success === v ? "var(--mars-pale)" : "var(--mars-dust)" }}>
                <input type="radio" checked={success === v} onChange={() => setSuccess(v)}
                  style={{ accentColor:"var(--mars-glow)" }}/>
                {v ? "SUCCESS" : "FAILURE"}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Performance notes" wide><Input value={notes} onChange={setNotes} placeholder="Completed terrain mapping ahead of schedule, all 3 targets identified with high precision…"/></Field>
      </FormGrid>
      <Btn onClick={submit} disabled={submitting || !wallet} variant={success ? "primary" : "danger"}>
        {submitting ? "Submitting…" : `Update reputation (${success ? "success" : "failure"}) →`}
      </Btn>
      <TxList hashes={hashes} error={error} />
      <CliCmd cmd={cli} />
    </div>
  );
}

// ── Tab: Peer Report ────────────────────────────────────────────────────────────

function PeerReportTab({ wallet }: { wallet: WalletState }) {
  const [reporter,  setReporter]  = useState("");
  const [target,    setTarget]    = useState("");
  const [missionId, setMissionId] = useState("");
  const [taskId,    setTaskId]    = useState("");
  const [outcome,   setOutcome]   = useState("SUCCESS");
  const [quality,   setQuality]   = useState("");
  const [execTime,  setExecTime]  = useState("");
  const [envNotes,  setEnvNotes]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hashes,    setHashes]    = useState<string[]>([]);
  const [error,     setError]     = useState("");

  const submit = async () => {
    if (!reporter || !target || !quality) { setError("Reporter, target and result quality required"); return; }
    if (!wallet) { setError("No wallet connected"); return; }
    setSubmitting(true); setError(""); setHashes([]);
    try {
      const h = await execWrite(wallet, CONTRACTS.REPUTATION_LEDGER, "submit_report", [reporter, target, missionId, taskId, outcome, quality, execTime, envNotes]);
      setHashes([h]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  };

  const cli = `genlayer write ${CONTRACTS.REPUTATION_LEDGER} submit_report \\\n  --args "${reporter||"<reporter>"}" "${target||"<target>"}" "${missionId||"<mission_id>"}" "${taskId||"<task_id>"}" "${outcome}" "${quality||"<quality>"}" "${execTime||"<time>"}" "${envNotes||"<env>"}"`;

  return (
    <div style={{ maxWidth:580 }}>
      <Desc>Submit a peer-to-peer performance report. The LLM evaluates quality, environment conditions, timing and historical context. Suspicious or biased reports are rejected with delta = 0.</Desc>
      {!wallet && <WalletRequired />}
      <FormGrid>
        <Field label="Reporter agent"><Input value={reporter} onChange={setReporter} placeholder="rover-explorer-01"/></Field>
        <Field label="Target agent"><Input value={target} onChange={setTarget} placeholder="rover-collector-01"/></Field>
        <Field label="Mission ID"><Input value={missionId} onChange={setMissionId} placeholder="mission-olympus-01"/></Field>
        <Field label="Task ID"><Input value={taskId} onChange={setTaskId} placeholder="task-collect-01"/></Field>
        <Field label="Outcome" wide>
          <Select value={outcome} onChange={setOutcome} options={[
            {label:"SUCCESS — objective fully achieved",    value:"SUCCESS"},
            {label:"PARTIAL — objective partially achieved",value:"PARTIAL"},
            {label:"FAILURE — objective not achieved",      value:"FAILURE"},
          ]}/>
        </Field>
        <Field label="Result quality" wide><Input value={quality} onChange={setQuality} placeholder="Sample extraction was precise under harsh dust storm conditions…"/></Field>
        <Field label="Execution time"><Input value={execTime} onChange={setExecTime} placeholder="45 min, ahead of schedule"/></Field>
        <Field label="Environment notes"><Input value={envNotes} onChange={setEnvNotes} placeholder="Dust storm, low visibility"/></Field>
      </FormGrid>
      <Btn onClick={submit} disabled={submitting || !wallet}>{submitting ? "Submitting…" : "Submit report →"}</Btn>
      <TxList hashes={hashes} error={error} />
      <CliCmd cmd={cli} />
    </div>
  );
}

// ── small layout helpers ───────────────────────────────────────────────────────

function Desc({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize:12, color:"var(--mars-dust)", lineHeight:1.85, marginBottom:24 }}>{children}</p>;
}
function FormGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>{children}</div>;
}
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ── Tab: Admin (set_status) ─────────────────────────────────────────────────────

function AdminTab({ wallet }: { wallet: WalletState }) {
  const [agentId,    setAgentId]    = useState("");
  const [newStatus,  setNewStatus]  = useState("ACTIVE");
  const [submitting, setSubmitting] = useState(false);
  const [hashes,     setHashes]     = useState<string[]>([]);
  const [error,      setError]      = useState("");

  // Eligibility check
  const [checkAgentId, setCheckAgentId] = useState("");
  const [minRep,       setMinRep]       = useState("50");
  const [checking,     setChecking]     = useState(false);
  const [eligible,     setEligible]     = useState<boolean | null>(null);

  const submit = async () => {
    if (!agentId) { setError("Agent ID required"); return; }
    if (!wallet) { setError("No wallet connected"); return; }
    setSubmitting(true); setError(""); setHashes([]);
    try {
      const h = await execWrite(wallet, CONTRACTS.AGENT_REGISTRY, "set_status", [agentId, newStatus]);
      setHashes([h]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  };

  const checkEligibility = async () => {
    if (!checkAgentId.trim()) return;
    setChecking(true); setEligible(null);
    try {
      const result = await isEligible(checkAgentId.trim(), Number(minRep));
      setEligible(result);
    } catch { setEligible(null); }
    finally { setChecking(false); }
  };

  const statusColor = (s: string) =>
    s === "ACTIVE" ? "#4aff8a" : s === "SUSPENDED" ? "#ff6060" : "#ffb84a";

  const cli = `genlayer write ${CONTRACTS.AGENT_REGISTRY} set_status \\\n  --args "${agentId || "<agent_id>"}" "${newStatus}"`;

  return (
    <div style={{ maxWidth:640 }}>
      <Desc>
        Admin operations on registered agents. Only the agent owner can change its status.
        Use SUSPENDED to temporarily disable a rover, INACTIVE to deregister it.
      </Desc>

      {/* Set status */}
      <div style={{ marginBottom:40 }}>
        <div style={{ fontSize:10, color:"var(--mars-glow)", letterSpacing:".16em", textTransform:"uppercase", marginBottom:16 }}>
          Set agent status
        </div>
        {!wallet && <WalletRequired />}
        <FormGrid>
          <Field label="Agent ID"><Input value={agentId} onChange={setAgentId} placeholder="rover-explorer-01"/></Field>
          <Field label="New status">
            <div style={{ display:"flex", gap:0, borderRadius:4, overflow:"hidden", border:"1px solid rgba(196,98,45,.28)" }}>
              {(["ACTIVE", "INACTIVE", "SUSPENDED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  style={{
                    flex:1, padding:"10px 8px",
                    background: newStatus === s ? "rgba(196,98,45,.18)" : "transparent",
                    border:"none", borderRight: s !== "SUSPENDED" ? "1px solid rgba(196,98,45,.2)" : "none",
                    cursor:"pointer", fontFamily:"'Space Mono',monospace", fontSize:10,
                    color: newStatus === s ? statusColor(s) : "var(--mars-dust)",
                    letterSpacing:".08em", fontWeight: newStatus === s ? 700 : 400,
                    transition:"all .15s",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
        </FormGrid>

        <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:4, background:"rgba(0,0,0,.2)", border:"1px solid rgba(196,98,45,.1)", fontSize:11, color:"var(--mars-dust)", fontFamily:"'Space Mono',monospace" }}>
          <span style={{ color:"var(--mars-dust)" }}>Status rules: </span>
          <span style={{ color: statusColor("ACTIVE") }}>ACTIVE</span> — eligible for missions ·{" "}
          <span style={{ color: statusColor("INACTIVE") }}>INACTIVE</span> — not accepting tasks ·{" "}
          <span style={{ color: statusColor("SUSPENDED") }}>SUSPENDED</span> — blocked, rep &lt; 20
        </div>

        <Btn
          onClick={submit}
          disabled={submitting || !wallet}
          variant={newStatus === "SUSPENDED" ? "danger" : "primary"}
        >
          {submitting ? "Submitting…" : `Set status → ${newStatus}`}
        </Btn>
        <TxList hashes={hashes} error={error} />
        <CliCmd cmd={cli} />
      </div>

      {/* Eligibility check */}
      <div style={{ borderTop:"1px solid rgba(196,98,45,.15)", paddingTop:32 }}>
        <div style={{ fontSize:10, color:"var(--mars-glow)", letterSpacing:".16em", textTransform:"uppercase", marginBottom:16 }}>
          Check eligibility for mission
        </div>
        <Desc>Verify whether an agent meets the minimum reputation required for a task.</Desc>
        <FormGrid>
          <Field label="Agent ID">
            <Input value={checkAgentId} onChange={(v) => { setCheckAgentId(v); setEligible(null); }} placeholder="rover-explorer-01"/>
          </Field>
          <Field label="Min reputation required">
            <Input value={minRep} onChange={(v) => { setMinRep(v); setEligible(null); }} placeholder="50"/>
          </Field>
        </FormGrid>
        <Btn onClick={checkEligibility} disabled={checking} variant="ghost">
          {checking ? "Checking…" : "Check eligibility"}
        </Btn>

        {eligible !== null && (
          <div style={{
            marginTop:14, padding:"12px 16px", borderRadius:4,
            background: eligible ? "rgba(74,255,138,.05)" : "rgba(255,80,80,.05)",
            border: `1px solid ${eligible ? "rgba(74,255,138,.25)" : "rgba(255,80,80,.25)"}`,
            fontSize:13, fontFamily:"'Orbitron',monospace", fontWeight:700,
            color: eligible ? "#4aff8a" : "#ff6060",
          }}>
            {eligible ? "✓ ELIGIBLE" : "✗ NOT ELIGIBLE"}
            <span style={{ fontSize:10, color:"var(--mars-dust)", fontFamily:"'Space Mono',monospace", fontWeight:400, marginLeft:12 }}>
              min reputation: {minRep}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

type MainTab = "state" | "register" | "mission" | "start" | "task" | "reputation" | "report" | "admin";

const TABS: { id: MainTab; label: string; write: boolean }[] = [
  { id:"state",      label:"Chain state",       write:false },
  { id:"register",   label:"Register agent",    write:true  },
  { id:"mission",    label:"New mission",        write:true  },
  { id:"start",      label:"Start task",         write:true  },
  { id:"task",       label:"Submit result",      write:true  },
  { id:"reputation", label:"Update reputation",  write:true  },
  { id:"report",     label:"Peer report",        write:true  },
  { id:"admin",      label:"Admin",              write:true  },
];

export default function ProtocolPage() {
  const [mainTab,         setMainTab]         = useState<MainTab>("state");
  const [wallet,          setWallet]          = useState<WalletState>(null);
  const [connecting,      setConnecting]      = useState(false);
  const [connectErr,      setConnectErr]      = useState("");
  const [pkInput,         setPkInput]         = useState("");
  const [pkVisible,       setPkVisible]       = useState(false);
  const [showPkFallback,  setShowPkFallback]  = useState(false);

  const connected = wallet !== null;

  async function handleConnectMetaMask() {
    setConnecting(true);
    setConnectErr("");
    try {
      const { address, provider } = await connectMetaMask();
      setWallet({ type: "metamask", address, provider });
    } catch (e: unknown) {
      setConnectErr(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  function handleUsePk() {
    const key = pkInput.trim() as `0x${string}`;
    if (!key.startsWith("0x") || key.length !== 66) {
      setConnectErr("Invalid private key — must be 0x + 64 hex chars");
      return;
    }
    setWallet({ type: "privateKey", key });
    setConnectErr("");
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Orbitron:wght@400;700;900&display=swap');
        :root {
          --mars-deep:#0d0502; --mars-dark:#1a0a06; --mars-mid:#2d1408;
          --mars-surface:#3d1e0c; --mars-dust:#8a5a3a; --mars-sand:#c4966a;
          --mars-glow:#c4622d; --mars-bright:#e8844a; --mars-pale:#f0d4b4;
          --mars-white:#fdf0e0;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'Space Mono',monospace;background:var(--mars-deep);color:var(--mars-sand);overflow-x:hidden}
        body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.025) 2px,rgba(0,0,0,.025) 4px);pointer-events:none;z-index:9999}
        ::selection{background:var(--mars-glow);color:var(--mars-deep)}
        a{color:var(--mars-glow);text-decoration:none}
        input:focus,select:focus{border-color:rgba(196,98,45,.65) !important;box-shadow:0 0 0 2px rgba(196,98,45,.12)}
        input::placeholder{color:rgba(138,90,58,.4)}
        .nav-link{color:var(--mars-dust);font-size:11px;letter-spacing:.1em;text-transform:uppercase;transition:color .2s}
        .nav-link:hover,.nav-link.active{color:var(--mars-glow)}
        .tab-btn{background:none;border:none;cursor:pointer;padding:10px 16px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--mars-dust);border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap}
        .tab-btn:hover{color:var(--mars-pale)}
        .tab-btn.active{color:var(--mars-glow);border-bottom-color:var(--mars-glow)}
      `}</style>

      {/* NAV */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background:"rgba(13,5,2,.88)", backdropFilter:"blur(14px)", borderBottom:"1px solid rgba(196,98,45,.18)", padding:"0 40px", display:"flex", alignItems:"center", height:56, gap:32 }}>
        <a href="/" style={{ display:"flex", alignItems:"center", gap:10, marginRight:"auto", textDecoration:"none" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--mars-glow)" }}/>
          <span style={{ fontFamily:"'Orbitron',monospace", fontSize:13, color:"var(--mars-pale)", letterSpacing:".15em" }}>AlephRob</span>
        </a>
        <a href="/" className="nav-link">Mission</a>
        <a href="/protocol" className="nav-link active">Protocol</a>
        <a href={`${EXPLORER}/address/${CONTRACTS.AGENT_REGISTRY}`} target="_blank" rel="noreferrer" className="nav-link" style={{ color:"var(--mars-glow)" }}>Explorer ↗</a>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background: connected ? "#4aff8a" : "rgba(138,90,58,.4)" }}/>
          <span style={{ fontSize:10, color: connected ? "#4aff8a" : "var(--mars-dust)", letterSpacing:".08em" }}>
            {connected ? "wallet ready" : "no wallet"}
          </span>
        </div>
      </nav>

      <main style={{ paddingTop:56 }}>

        {/* Header */}
        <div style={{ padding:"52px 40px 36px", borderBottom:"1px solid rgba(196,98,45,.12)", background:"var(--mars-dark)" }}>
          <div style={{ maxWidth:1100, margin:"0 auto" }}>
            <div style={{ fontSize:9, color:"var(--mars-glow)", letterSpacing:".22em", textTransform:"uppercase", marginBottom:10 }}>AlephRob Protocol · Bradbury Testnet</div>
            <h1 style={{ fontFamily:"'Orbitron',monospace", fontSize:"clamp(26px,5vw,56px)", fontWeight:900, color:"var(--mars-white)", lineHeight:1.08, marginBottom:14 }}>
              Protocol Explorer
            </h1>
            <p style={{ fontSize:12, color:"var(--mars-dust)", maxWidth:540, lineHeight:1.8, marginBottom:24 }}>
              Live chain state from 3 Intelligent Contracts + write interactions: register agents, create missions, validate tasks and submit peer reports.
            </p>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
              {([["AgentRegistry", CONTRACTS.AGENT_REGISTRY], ["MissionFactory", CONTRACTS.MISSION_FACTORY], ["ReputationLedger", CONTRACTS.REPUTATION_LEDGER]] as const).map(([label, addr]) => (
                <div key={label}>
                  <div style={{ fontSize:9, color:"var(--mars-dust)", letterSpacing:".1em", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                  <a href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer" style={{ fontSize:10, color:"var(--mars-glow)", fontFamily:"'Space Mono',monospace" }}>{shortAddr(addr)}</a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div style={{ padding:"16px 40px", background:"rgba(196,98,45,.025)", borderBottom:"1px solid rgba(196,98,45,.1)" }}>
          <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
            <div style={{ fontSize:9, color:"var(--mars-dust)", letterSpacing:".1em", textTransform:"uppercase", flexShrink:0 }}>Testnet wallet</div>

            {wallet ? (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:"#4aff8a" }}/>
                  <span style={{ fontSize:10, color:"#4aff8a", fontFamily:"'Space Mono',monospace" }}>
                    {wallet.type === "metamask" ? `MetaMask · ${wallet.address.slice(0,6)}…${wallet.address.slice(-4)}` : `PK · ${wallet.key.slice(0,6)}…${wallet.key.slice(-4)}`}
                  </span>
                </div>
                <button onClick={() => { setWallet(null); setPkInput(""); setConnectErr(""); setShowPkFallback(false); }}
                  style={{ padding:"5px 12px", background:"none", border:"1px solid rgba(196,98,45,.35)", borderRadius:4, color:"var(--mars-dust)", fontFamily:"'Space Mono',monospace", fontSize:10, cursor:"pointer" }}>
                  disconnect
                </button>
              </>
            ) : (
              <>
                <button onClick={handleConnectMetaMask} disabled={connecting}
                  style={{ padding:"8px 18px", background:"var(--mars-glow)", border:"none", borderRadius:4, color:"var(--mars-deep)", fontFamily:"'Space Mono',monospace", fontSize:11, fontWeight:700, cursor:"pointer", opacity: connecting ? .6 : 1 }}>
                  {connecting ? "connecting…" : "Connect MetaMask"}
                </button>
                <button onClick={() => setShowPkFallback(v => !v)}
                  style={{ padding:"5px 10px", background:"none", border:"1px solid rgba(196,98,45,.28)", borderRadius:4, color:"var(--mars-dust)", fontFamily:"'Space Mono',monospace", fontSize:9, cursor:"pointer", letterSpacing:".06em" }}>
                  {showPkFallback ? "▲ hide" : "▼ private key"}
                </button>
              </>
            )}

            {connectErr && <span style={{ fontSize:10, color:"#ff6b6b" }}>{connectErr}</span>}
            {!wallet && <div style={{ marginLeft:"auto", fontSize:9, color:"rgba(138,90,58,.35)" }}>Required for write operations</div>}
          </div>

          {showPkFallback && !wallet && (
            <div style={{ maxWidth:1100, margin:"10px auto 0", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <div style={{ flex:"1 1 280px", maxWidth:400, position:"relative" }}>
                <input
                  type={pkVisible ? "text" : "password"}
                  value={pkInput}
                  onChange={(e) => setPkInput(e.target.value)}
                  placeholder="0x… private key (Bradbury testnet only)"
                  style={{ width:"100%", padding:"8px 40px 8px 12px", background:"rgba(0,0,0,.3)", border:"1px solid rgba(196,98,45,.28)", borderRadius:4, color:"var(--mars-pale)", fontFamily:"'Space Mono',monospace", fontSize:11, outline:"none" }}
                />
                <button onClick={() => setPkVisible(v => !v)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--mars-dust)", fontSize:10, fontFamily:"'Space Mono',monospace" }}>
                  {pkVisible ? "hide" : "show"}
                </button>
              </div>
              <button onClick={handleUsePk}
                style={{ padding:"8px 14px", background:"rgba(196,98,45,.18)", border:"1px solid rgba(196,98,45,.45)", borderRadius:4, color:"var(--mars-pale)", fontFamily:"'Space Mono',monospace", fontSize:10, cursor:"pointer" }}>
                use key
              </button>
              <span style={{ fontSize:9, color:"rgba(138,90,58,.35)" }}>Key never stored or sent to any server · testnet only</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ borderBottom:"1px solid rgba(196,98,45,.15)", padding:"0 40px", overflowX:"auto" }}>
          <div style={{ maxWidth:1100, margin:"0 auto", display:"flex" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setMainTab(t.id)} className={`tab-btn${mainTab === t.id ? " active" : ""}`}>
                {t.write && <span style={{ marginRight:5, fontSize:8, opacity:.5 }}>✎</span>}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"44px 40px 100px" }}>
          {mainTab === "state"      && <ChainStateTab />}
          {mainTab === "register"   && <RegisterAgentTab   wallet={wallet} />}
          {mainTab === "mission"    && <NewMissionTab       wallet={wallet} />}
          {mainTab === "start"      && <StartTaskTab        wallet={wallet} />}
          {mainTab === "task"       && <SubmitTaskTab        wallet={wallet} />}
          {mainTab === "reputation" && <UpdateReputationTab wallet={wallet} />}
          {mainTab === "report"     && <PeerReportTab       wallet={wallet} />}
          {mainTab === "admin"      && <AdminTab            wallet={wallet} />}
        </div>
      </main>

      <footer style={{ borderTop:"1px solid rgba(196,98,45,.12)", padding:"22px 40px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, background:"var(--mars-dark)" }}>
        <span style={{ fontFamily:"'Orbitron',monospace", fontSize:11, color:"var(--mars-dust)", letterSpacing:".15em" }}>AlephRob</span>
        <div style={{ display:"flex", gap:24 }}>
          <a href="/" style={{ fontSize:11, color:"var(--mars-dust)" }}>← Back to mission</a>
          <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer" style={{ fontSize:11, color:"var(--mars-dust)" }}>GenLayer docs ↗</a>
        </div>
      </footer>
    </>
  );
}
