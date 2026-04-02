"use client";

import { useState, useEffect, useRef } from "react";

const CONTRACT = "0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb";
const EXPLORER = "https://explorer-bradbury.genlayer.com";
const TX_HASHES = [
  "0x8bfbec0026726f4e029269dc17992251ef5f45d17a53cf329bb07d13e88e5eb7",
  "0x630b27691fc5b981d2b7588bf93abb09f1a0adc567319f375e9b43e4cc52c57f",
  "0x655bdd64b8b568d3121850d5929f09f3ef0c818be2ed9c942b22ea3f6ee77e70",
];

// ── Hardcoded protocol data ────────────────────────────────────────────────────

const AGENT_REGISTRY   = "0xf39101cB9A2CD4224d0143f812B9c6CB012edDAe";
const MISSION_FACTORY  = "0xfdca4ab91E9c49f4f466F47F5adB9e34B3Eb5Ed6";
const REP_LEDGER       = "0x857aB4021C393872DcB5b7e7091f24330f2ef913";

const ROVERS = [
  {
    id: "rover-explorer-01", name: "Sojourner-X", type: "EXPLORER", rep: 78,
    tx: "0xb8165cee977592dea42c657a4953dab3cdecb6fd2713f6c02630d6b900535dfc",
  },
  {
    id: "rover-collector-01", name: "Curiosity-C", type: "COLLECTOR", rep: 72,
    tx: "0xc915b8348014b24f7b22baa757a2d29364790bcbe4b518940b0e0c3493929c07",
  },
  {
    id: "rover-analyst-01", name: "Ingenuity-A", type: "ANALYST", rep: 85,
    tx: "0xe5b4fae5b924fb42668901951383e901e6c996f0889204659d6b768cb9f2efa6",
  },
  {
    id: "rover-transporter-01", name: "Perseverance-T", type: "TRANSPORTER", rep: 68,
    tx: "0xcb73376e2e86c0e9ebf8b14ae2614ac946ba589fb5889a30bacb9164f8aa99f9",
  },
];

const TASKS = [
  {
    id: "task-explore-01", type: "EXPLORE", rover: "Sojourner-X",
    status: "COMPLETED",
    result: "Terrain mapped at (-0.82, 0.07). 3 geological targets identified.",
  },
  {
    id: "task-collect-01", type: "COLLECT", rover: "Curiosity-C",
    status: "COMPLETED",
    result: "Sample extracted, 12.3g basaltic rock. Confidence 0.91.",
  },
  {
    id: "task-analyze-01", type: "ANALYZE", rover: "Ingenuity-A",
    status: "COMPLETED",
    result: "48% pyroxene, 31% plagioclase, 21% olivine. Volcanic origin.",
  },
  {
    id: "task-transport-01", type: "TRANSPORT", rover: "Perseverance-T",
    status: "COMPLETED",
    result: "Sample C-07 delivered to base station. Chain of custody intact.",
  },
];

const REPORTS = [
  {
    id: "report-001", reporter: "Sojourner-X", target: "Curiosity-C",
    task: "task-collect-01", outcome: "SUCCESS",
    verdict: "Sample extraction precise and complete under dust storm conditions.",
    tx: "0x06b6048df4c78dcb007985a04335058e2ca941ae7649936f4efb1d141efe86e6",
  },
  {
    id: "report-002", reporter: "Curiosity-C", target: "Ingenuity-A",
    task: "task-analyze-01", outcome: "SUCCESS",
    verdict: "Spectrometry completed ahead of schedule with exceptional mineral detail.",
    tx: "0xc45b119b0abd7f93cb05d3b1fad51fe8fb250b0697d50d0b29ae3e6524ca91f9",
  },
  {
    id: "report-003", reporter: "Ingenuity-A", target: "Perseverance-T",
    task: "task-transport-01", outcome: "SUCCESS",
    verdict: "Autonomous transport maintained full chain of custody over rough terrain.",
    tx: "0x0e6e3ecd01f4b2f87bf0171f0b45339a255c1f9a18c070c65140e9ac7e70c638",
  },
  {
    id: "report-004", reporter: "Perseverance-T", target: "Sojourner-X",
    task: "task-explore-01", outcome: "SUCCESS",
    verdict: "Terrain mapping accurate with all 3 geological points precisely identified.",
    tx: "0x03ca784343cd239cc6482cd133156c2493864479c093ae3bb15eb411f99ebc02",
  },
];

function typeColor(t: string): { bg: string; border: string; text: string } {
  switch (t) {
    case "EXPLORER":    return { bg: "rgba(55,138,221,.15)",  border: "rgba(55,138,221,.4)",  text: "#6ab4ff" };
    case "COLLECTOR":   return { bg: "rgba(196,98,45,.15)",   border: "rgba(196,98,45,.4)",   text: "#c4622d" };
    case "ANALYST":     return { bg: "rgba(130,90,180,.15)",  border: "rgba(130,90,180,.4)",  text: "#a06ad4" };
    case "TRANSPORTER": return { bg: "rgba(29,158,117,.15)",  border: "rgba(29,158,117,.4)",  text: "#1d9e75" };
    default:            return { bg: "rgba(138,90,58,.1)",    border: "rgba(138,90,58,.3)",   text: "#8a5a3a" };
  }
}

// ── Original interfaces ────────────────────────────────────────────────────────

interface Sample {
  id: string;
  x: string;
  y: string;
  time: number;
  status: string;
  tx_hash?: string;
}

interface MissionData {
  samples_collected: number;
  samples_found: Sample[];
  state: string;
}

// ── Original hooks & components ───────────────────────────────────────────────

function useTypingEffect(text: string, speed = 25) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return displayed;
}

function MarsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.45 + 0.08,
      });
    }
    let frame: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(196,98,45," + p.a + ")";
        ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.55 }}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Home() {
  const [mission, setMission] = useState<MissionData | null>(null);
  const [tick, setTick] = useState(0);
  const subtitle = useTypingEffect(
    "Autonomous geological validation via AI consensus on GenLayer Bradbury",
    22
  );

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/mission_log.json?t=" + Date.now());
        const data = await r.json();
        setMission(data);
      } catch { /* waiting */ }
    };
    load();
    const iv = setInterval(() => {
      load();
      setTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const approved =
    mission?.samples_found?.filter((s) => s.status === "APPROVED").length ?? 0;
  const complete = mission?.state === "COMPLETE";

  const thStyle: React.CSSProperties = {
    padding: "10px 24px",
    textAlign: "left",
    fontSize: 10,
    color: "rgba(138,90,58,0.65)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 400,
    fontFamily: "'Space Mono', monospace",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Orbitron:wght@400;700;900&display=swap');
        :root {
          --mars-deep:#0d0502; --mars-dark:#1a0a06; --mars-mid:#2d1408;
          --mars-surface:#3d1e0c; --mars-dust:#8a5a3a; --mars-sand:#c4966a;
          --mars-glow:#c4622d; --mars-bright:#e8844a; --mars-pale:#f0d4b4;
          --mars-white:#fdf0e0; --green-signal:#4aff8a;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'Space Mono',monospace;background:var(--mars-deep);color:var(--mars-sand);overflow-x:hidden}
        body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px);pointer-events:none;z-index:9999}
        ::selection{background:var(--mars-glow);color:var(--mars-deep)}
        a{color:var(--mars-glow);text-decoration:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes scanH{0%{transform:translateY(-100%)}100%{transform:translateY(110vh)}}
        @keyframes pulseRing{0%{box-shadow:0 0 0 0 rgba(196,98,45,.6)}70%{box-shadow:0 0 0 10px rgba(196,98,45,0)}100%{box-shadow:0 0 0 0 rgba(196,98,45,0)}}
        @keyframes rotateRing{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes glitch{0%{clip-path:inset(20% 0 60% 0);transform:translate(-3px,0)}33%{clip-path:inset(50% 0 20% 0);transform:translate(3px,0)}66%{clip-path:inset(10% 0 70% 0);transform:translate(-1px,0)}100%{clip-path:inset(0);transform:translate(0)}}
        @keyframes pulseAmber{0%,100%{box-shadow:0 0 0 0 rgba(255,184,74,.5)}70%{box-shadow:0 0 0 8px rgba(255,184,74,0)}}
        .fade1{animation:fadeUp .7s .1s ease both}
        .fade2{animation:fadeUp .7s .25s ease both}
        .fade3{animation:fadeUp .7s .4s ease both}
        .fade4{animation:fadeUp .7s .55s ease both}
        .cursor::after{content:'█';animation:blink 1s step-end infinite}
        .scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(196,98,45,.12),transparent);animation:scanH 7s linear infinite;pointer-events:none}
        .nav-link{color:var(--mars-dust);font-size:11px;letter-spacing:.1em;text-transform:uppercase;transition:color .2s}
        .nav-link:hover{color:var(--mars-glow)}
        .metric-card{transition:all .2s;cursor:default}
        .metric-card:hover{border-color:var(--mars-glow) !important;transform:translateY(-2px)}
        .sample-row:hover{background:rgba(45,20,8,.5)}
        .tx-link:hover{color:var(--mars-bright) !important}
        .cta-primary:hover{background:var(--mars-bright) !important}
        .cta-secondary:hover{border-color:var(--mars-glow) !important;color:var(--mars-pale) !important}
        .arch-card:hover .arch-num{color:rgba(196,98,45,.15) !important}
        .rover-card:hover{border-color:var(--mars-glow) !important;transform:translateY(-2px);transition:all .2s}
        .rep-row:hover{background:rgba(45,20,8,.5)}
      `}</style>

      {/* NAV */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:100,
        background:"rgba(13,5,2,.88)",backdropFilter:"blur(14px)",
        borderBottom:"1px solid rgba(196,98,45,.18)",
        padding:"0 40px",display:"flex",alignItems:"center",height:56,gap:32,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginRight:"auto"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"var(--mars-glow)",animation:"pulseRing 2s infinite"}}/>
          <span style={{fontFamily:"'Orbitron',monospace",fontSize:13,color:"var(--mars-pale)",letterSpacing:".15em"}}>AlephRob</span>
        </div>
        <a href="#mission" className="nav-link">Mission</a>
        <a href="#tech" className="nav-link">Architecture</a>
        <a href="#fleet" className="nav-link">Fleet</a>
        <a href="#dashboard" className="nav-link">Live data</a>
        <a href="/protocol" className="nav-link">Protocol</a>
        <a href={EXPLORER+"/address/"+CONTRACT} target="_blank" rel="noreferrer" className="nav-link" style={{color:"var(--mars-glow)"}}>
          Explorer ↗
        </a>
      </nav>

      {/* HERO */}
      <section id="mission" style={{
        position:"relative",minHeight:"100vh",
        display:"flex",flexDirection:"column",justifyContent:"center",
        padding:"120px 40px 100px",overflow:"hidden",
      }}>
        <MarsCanvas/>
        <div className="scan-line"/>
        <div style={{
          position:"absolute",right:-30,top:"50%",transform:"translateY(-50%)",
          fontFamily:"'Orbitron',monospace",
          fontSize:"clamp(80px,15vw,210px)",
          color:"rgba(196,98,45,.035)",fontWeight:900,
          userSelect:"none",pointerEvents:"none",lineHeight:1,
        }}>MARS</div>

        <div style={{position:"relative",maxWidth:820}}>
          <div className="fade1" style={{
            fontSize:11,letterSpacing:".24em",color:"var(--mars-glow)",
            marginBottom:20,display:"flex",alignItems:"center",gap:10,
          }}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"var(--mars-glow)",animation:"pulseRing 2s infinite",display:"inline-block"}}/>
            MISSION STATUS: {complete?"COMPLETE":"ACTIVE"} — BRADBURY TESTNET
          </div>

          <h1 className="fade2" style={{
            fontFamily:"'Orbitron',monospace",
            fontSize:"clamp(36px,6.5vw,84px)",fontWeight:900,
            color:"var(--mars-white)",lineHeight:1.04,letterSpacing:"-.01em",marginBottom:28,
          }}>
            Autonomous
            <br/>
            <span style={{color:"var(--mars-glow)"}}>Mars Rover</span>
            <br/>
            Mission
          </h1>

          <p className="fade3 cursor" style={{
            fontSize:14,color:"var(--mars-dust)",lineHeight:1.85,
            maxWidth:580,marginBottom:44,minHeight:52,
          }}>
            {subtitle}
          </p>

          <div className="fade4" style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            <a href="#dashboard" className="cta-primary" style={{
              display:"inline-flex",alignItems:"center",gap:8,
              background:"var(--mars-glow)",color:"var(--mars-deep)",
              padding:"13px 30px",borderRadius:4,
              fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,
              letterSpacing:".1em",textTransform:"uppercase",transition:"background .2s",
            }}>View live data ↓</a>
            <a href={EXPLORER+"/address/"+CONTRACT} target="_blank" rel="noreferrer" className="cta-secondary" style={{
              display:"inline-flex",alignItems:"center",gap:8,
              border:"1px solid rgba(196,98,45,.38)",color:"var(--mars-sand)",
              padding:"13px 30px",borderRadius:4,
              fontFamily:"'Space Mono',monospace",fontSize:12,
              letterSpacing:".1em",textTransform:"uppercase",transition:"all .2s",
            }}>Contract on Bradbury ↗</a>
          </div>
        </div>

        <div style={{
          position:"absolute",bottom:40,left:40,right:40,
          display:"flex",gap:48,
          borderTop:"1px solid rgba(196,98,45,.12)",paddingTop:24,
        }}>
          {[
            {label:"Validators",value:"5"},
            {label:"Consensus",value:"AGREE"},
            {label:"Samples validated",value:approved+" / 3"},
            {label:"Network",value:"Bradbury"},
          ].map((s)=>(
            <div key={s.label}>
              <div style={{fontSize:10,color:"var(--mars-dust)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:5}}>{s.label}</div>
              <div style={{fontSize:20,color:"var(--mars-pale)",fontFamily:"'Orbitron',monospace",fontWeight:700}}>{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section id="tech" style={{
        padding:"100px 40px",
        background:"var(--mars-dark)",
        borderTop:"1px solid rgba(196,98,45,.12)",
      }}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:10,color:"var(--mars-glow)",letterSpacing:".2em",textTransform:"uppercase",marginBottom:14}}>System architecture</div>
          <h2 style={{fontFamily:"'Orbitron',monospace",fontSize:"clamp(24px,4vw,50px)",color:"var(--mars-pale)",fontWeight:700,marginBottom:56,lineHeight:1.15}}>
            How it works
          </h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:1,background:"rgba(196,98,45,.08)"}}>
            {[
              {step:"01",tag:"Webots R2025a",title:"Rover navigates",desc:"Sojourner rover autonomously explores Mars terrain in Webots simulation using odometry-based navigation and real-time obstacle detection."},
              {step:"02",tag:"Python controller",title:"Sample detected",desc:"When the rover reaches a geological point of interest, coordinates and sensor confidence are captured, logged and queued for validation."},
              {step:"03",tag:"Optimistic Democracy",title:"AI consensus",desc:"5 GenLayer validators independently run an LLM prompt evaluating the scientific value of the sample using the Equivalence Principle."},
              {step:"04",tag:"Intelligent Contract",title:"On-chain decision",desc:"Validators reach consensus. The final decision — APPROVED or REJECTED — is recorded permanently on Bradbury testnet with full auditability."},
            ].map((card)=>(
              <div key={card.step} className="arch-card" style={{background:"var(--mars-dark)",padding:"36px 30px",position:"relative",overflow:"hidden"}}>
                <div className="arch-num" style={{
                  position:"absolute",top:20,right:20,
                  fontFamily:"'Orbitron',monospace",fontSize:52,fontWeight:900,
                  color:"rgba(196,98,45,.06)",lineHeight:1,transition:"color .3s",
                }}>{card.step}</div>
                <div style={{
                  display:"inline-block",
                  background:"rgba(196,98,45,.09)",border:"1px solid rgba(196,98,45,.22)",
                  color:"var(--mars-glow)",fontSize:10,letterSpacing:".1em",
                  padding:"3px 10px",borderRadius:3,marginBottom:16,textTransform:"uppercase",
                }}>{card.tag}</div>
                <h3 style={{fontFamily:"'Orbitron',monospace",fontSize:16,fontWeight:700,color:"var(--mars-pale)",marginBottom:12}}>{card.title}</h3>
                <p style={{fontSize:13,color:"var(--mars-dust)",lineHeight:1.75}}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEW: AGENT FLEET ── */}
      <section id="fleet" style={{
        padding:"100px 40px",
        borderTop:"1px solid rgba(196,98,45,.12)",
      }}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:10,color:"var(--mars-glow)",letterSpacing:".2em",textTransform:"uppercase",marginBottom:14}}>
            Agent fleet — registered rovers
          </div>
          <h2 style={{fontFamily:"'Orbitron',monospace",fontSize:"clamp(24px,4vw,50px)",color:"var(--mars-pale)",fontWeight:700,marginBottom:16,lineHeight:1.15}}>
            Active agents
          </h2>
          <div style={{fontSize:12,color:"var(--mars-dust)",marginBottom:48}}>
            AgentRegistry ·{" "}
            <a href={EXPLORER+"/address/"+AGENT_REGISTRY} target="_blank" rel="noreferrer" style={{color:"var(--mars-glow)",fontFamily:"'Space Mono',monospace",fontSize:11}}>
              {AGENT_REGISTRY.slice(0,10)}…{AGENT_REGISTRY.slice(-6)}
            </a>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>
            {ROVERS.map((rover) => {
              const tc = typeColor(rover.type);
              return (
                <div key={rover.id} className="rover-card" style={{
                  background:"var(--mars-mid)",border:"1px solid rgba(196,98,45,.22)",
                  borderRadius:6,padding:"24px 22px",display:"flex",flexDirection:"column",gap:16,
                }}>
                  {/* Header */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:"var(--mars-pale)",marginBottom:4}}>
                        {rover.name}
                      </div>
                      <div style={{fontSize:9,color:"var(--mars-dust)",letterSpacing:".06em"}}>{rover.id}</div>
                    </div>
                    <span style={{
                      background:tc.bg,border:`1px solid ${tc.border}`,color:tc.text,
                      fontSize:9,letterSpacing:".12em",padding:"3px 8px",
                      borderRadius:3,textTransform:"uppercase" as const,fontWeight:700,flexShrink:0,
                    }}>
                      {rover.type}
                    </span>
                  </div>

                  {/* Reputation */}
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                      <span style={{fontSize:9,color:"var(--mars-dust)",letterSpacing:".1em",textTransform:"uppercase" as const}}>Reputation</span>
                      <span style={{fontFamily:"'Orbitron',monospace",fontSize:24,fontWeight:700,color:tc.text}}>{rover.rep}</span>
                    </div>
                    <div style={{height:4,background:"rgba(196,98,45,.1)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${rover.rep}%`,background:tc.text,borderRadius:2}}/>
                    </div>
                  </div>

                  {/* Status + TX */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{
                      background:"rgba(74,255,138,.08)",border:"1px solid rgba(74,255,138,.2)",
                      color:"#4aff8a",fontSize:9,letterSpacing:".12em",
                      padding:"3px 8px",borderRadius:3,textTransform:"uppercase" as const,fontWeight:700,
                    }}>
                      ACTIVE
                    </span>
                    <a
                      href={EXPLORER+"/tx/"+rover.tx}
                      target="_blank" rel="noreferrer"
                      className="tx-link"
                      style={{fontSize:10,color:"var(--mars-glow)",fontFamily:"'Space Mono',monospace"}}
                    >
                      {rover.tx.slice(0,8)}…{rover.tx.slice(-6)}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── NEW: MISSION TIMELINE ── */}
      <section id="olympus" style={{
        padding:"100px 40px",
        background:"var(--mars-dark)",
        borderTop:"1px solid rgba(196,98,45,.12)",
      }}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:10,color:"var(--mars-glow)",letterSpacing:".2em",textTransform:"uppercase",marginBottom:14}}>
            Active mission — olympus-01
          </div>
          <h2 style={{fontFamily:"'Orbitron',monospace",fontSize:"clamp(24px,4vw,50px)",color:"var(--mars-pale)",fontWeight:700,marginBottom:16,lineHeight:1.15}}>
            Geological survey
          </h2>
          <div style={{fontSize:12,color:"var(--mars-dust)",marginBottom:48}}>
            MissionFactory ·{" "}
            <a href={EXPLORER+"/address/"+MISSION_FACTORY} target="_blank" rel="noreferrer" style={{color:"var(--mars-glow)",fontFamily:"'Space Mono',monospace",fontSize:11}}>
              {MISSION_FACTORY.slice(0,10)}…{MISSION_FACTORY.slice(-6)}
            </a>
          </div>

          {/* Progress bar */}
          <div style={{marginBottom:48}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
              <span style={{fontSize:10,color:"var(--mars-dust)",letterSpacing:".12em",textTransform:"uppercase" as const}}>Mission progress</span>
              <span style={{fontFamily:"'Orbitron',monospace",fontSize:13,color:"var(--mars-pale)"}}>4 / 4 tasks completed</span>
            </div>
            <div style={{height:4,background:"rgba(196,98,45,.1)",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:"100%",background:"var(--mars-glow)",borderRadius:2}}/>
            </div>
          </div>

          {/* Timeline */}
          <div style={{display:"flex",gap:40,flexWrap:"wrap" as const}}>
            {/* Left: vertical timeline */}
            <div style={{flex:"1 1 420px",minWidth:280,position:"relative"}}>
              {TASKS.map((task, i) => {
                const isLast = i === TASKS.length - 1;
                const done = task.status === "COMPLETED";
                const live = task.status === "IN_PROGRESS";
                const statusColor = done ? "#4aff8a" : live ? "#ffb84a" : "var(--mars-dust)";
                const shortResult = task.result.length > 80 ? task.result.slice(0, 77) + "…" : task.result;
                return (
                  <div key={task.id} style={{display:"flex",gap:16,position:"relative"}}>
                    {/* Connector */}
                    {!isLast && (
                      <div style={{
                        position:"absolute",left:4,top:14,bottom:-8,width:2,
                        background: done ? "var(--mars-glow)" : "rgba(196,98,45,.3)",
                        transition:"background .4s",
                      }}/>
                    )}
                    {/* Dot */}
                    <div style={{
                      flexShrink:0,width:10,height:10,borderRadius:"50%",
                      background:statusColor,marginTop:5,zIndex:1,
                      boxShadow: done ? "0 0 6px rgba(196,98,45,.6)" : "none",
                    }}/>
                    {/* Content */}
                    <div style={{paddingBottom:isLast?0:28,flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" as const}}>
                        <span style={{
                          fontSize:10,color:"var(--mars-glow)",letterSpacing:".12em",
                          textTransform:"uppercase" as const,
                        }}>{task.type}</span>
                        <span style={{fontSize:10,color:"var(--mars-dust)"}}>·</span>
                        <span style={{fontSize:11,color:"var(--mars-pale)"}}>{task.id}</span>
                      </div>
                      <div style={{fontSize:12,color:"var(--mars-dust)",marginBottom:6}}>{task.rover}</div>
                      <div style={{
                        display:"inline-flex",alignItems:"center",gap:5,
                        padding:"2px 8px",borderRadius:3,marginBottom:8,
                        background: done?"rgba(74,255,138,.06)":live?"rgba(255,184,74,.06)":"rgba(138,90,58,.06)",
                        border:`1px solid ${done?"rgba(74,255,138,.2)":live?"rgba(255,184,74,.2)":"rgba(138,90,58,.2)"}`,
                      }}>
                        <span style={{
                          width:5,height:5,borderRadius:"50%",background:statusColor,display:"inline-block",
                          animation: live ? "pulseAmber 2s infinite" : "none",
                        }}/>
                        <span style={{fontSize:9,color:statusColor,letterSpacing:".1em",fontWeight:700}}>
                          {task.status}
                        </span>
                      </div>
                      <div style={{fontSize:11,color:"var(--mars-dust)",lineHeight:1.6}}>{shortResult}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: mission complete badge */}
            <div style={{flex:"0 0 auto",display:"flex",alignItems:"center"}}>
              <div style={{
                padding:"24px 32px",borderRadius:6,textAlign:"center" as const,
                background:"rgba(74,255,138,.04)",border:"1px solid rgba(74,255,138,.25)",
              }}>
                <div style={{fontSize:9,color:"#4aff8a",letterSpacing:".2em",textTransform:"uppercase" as const,marginBottom:10}}>
                  All tasks validated on-chain
                </div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,fontWeight:700,color:"#4aff8a",letterSpacing:".08em"}}>
                  MISSION COMPLETE
                </div>
                <div style={{fontSize:10,color:"var(--mars-dust)",marginTop:8}}>mission-olympus-01</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NEW: REPUTATION LEDGER ── */}
      <section id="ledger" style={{
        padding:"100px 40px",
        borderTop:"1px solid rgba(196,98,45,.12)",
      }}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:10,color:"var(--mars-glow)",letterSpacing:".2em",textTransform:"uppercase",marginBottom:14}}>
            Peer-to-peer reputation — bradbury
          </div>
          <h2 style={{fontFamily:"'Orbitron',monospace",fontSize:"clamp(24px,4vw,50px)",color:"var(--mars-pale)",fontWeight:700,marginBottom:16,lineHeight:1.15}}>
            Performance reports
          </h2>
          <div style={{fontSize:12,color:"var(--mars-dust)",marginBottom:48}}>
            ReputationLedger ·{" "}
            <a href={EXPLORER+"/address/"+REP_LEDGER} target="_blank" rel="noreferrer" style={{color:"var(--mars-glow)",fontFamily:"'Space Mono',monospace",fontSize:11}}>
              {REP_LEDGER.slice(0,10)}…{REP_LEDGER.slice(-6)}
            </a>
          </div>

          <div style={{background:"var(--mars-mid)",border:"1px solid rgba(196,98,45,.22)",borderRadius:6,overflow:"hidden"}}>
            {/* Table header */}
            <div style={{
              padding:"13px 24px",borderBottom:"1px solid rgba(196,98,45,.12)",
              display:"flex",alignItems:"center",gap:10,
              fontSize:10,color:"var(--mars-dust)",letterSpacing:".14em",textTransform:"uppercase" as const,
            }}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"var(--mars-glow)",display:"inline-block"}}/>
              Reputation log — AI-validated peer reports
            </div>
            <table style={{width:"100%",borderCollapse:"collapse" as const}}>
              <thead>
                <tr style={{background:"rgba(0,0,0,.18)"}}>
                  {["Reporter → Target","Task","Outcome","LLM Verdict","Transaction"].map(h=>(
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REPORTS.map((r) => (
                  <tr key={r.id} className="rep-row" style={{borderTop:"1px solid rgba(196,98,45,.07)"}}>
                    <td style={{padding:"14px 24px"}}>
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"var(--mars-pale)"}}>
                        {r.reporter} → {r.target}
                      </div>
                      <div style={{fontSize:9,color:"var(--mars-dust)",marginTop:2}}>{r.id}</div>
                    </td>
                    <td style={{padding:"14px 24px",fontSize:11,color:"var(--mars-sand)",fontFamily:"'Space Mono',monospace"}}>
                      {r.task}
                    </td>
                    <td style={{padding:"14px 24px"}}>
                      <span style={{
                        display:"inline-flex",alignItems:"center",gap:6,
                        padding:"4px 12px",borderRadius:3,fontSize:11,
                        fontFamily:"'Space Mono',monospace",letterSpacing:".06em",
                        background:"rgba(74,255,138,.07)",color:"#4aff8a",
                        border:"1px solid rgba(74,255,138,.22)",
                      }}>
                        <span style={{width:5,height:5,borderRadius:"50%",background:"currentColor",display:"inline-block"}}/>
                        {r.outcome}
                      </span>
                    </td>
                    <td style={{padding:"14px 24px",fontSize:11,color:"var(--mars-dust)",maxWidth:280}}>
                      {r.verdict}
                    </td>
                    <td style={{padding:"14px 24px",fontSize:11,fontFamily:"'Space Mono',monospace"}}>
                      <a href={EXPLORER+"/tx/"+r.tx} target="_blank" rel="noreferrer" className="tx-link" style={{color:"var(--mars-glow)"}}>
                        {r.tx.slice(0,8)}…{r.tx.slice(-6)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Stats footer */}
            <div style={{
              padding:"13px 24px",borderTop:"1px solid rgba(196,98,45,.12)",
              display:"flex",gap:32,flexWrap:"wrap" as const,
              fontSize:10,color:"var(--mars-dust)",letterSpacing:".1em",textTransform:"uppercase" as const,
            }}>
              <span>4 reports submitted</span>
              <span style={{color:"#4aff8a"}}>4 accepted</span>
              <span style={{marginLeft:"auto",color:"var(--mars-pale)"}}>
                Acceptance rate:{" "}
                <span style={{fontFamily:"'Orbitron',monospace",color:"#4aff8a"}}>100%</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD (original) */}
      <section id="dashboard" style={{padding:"100px 40px",borderTop:"1px solid rgba(196,98,45,.12)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:10,color:"var(--mars-glow)",letterSpacing:".2em",textTransform:"uppercase",marginBottom:14}}>Live mission data</div>
          <h2 style={{fontFamily:"'Orbitron',monospace",fontSize:"clamp(24px,4vw,50px)",color:"var(--mars-pale)",fontWeight:700,marginBottom:40,lineHeight:1.15}}>
            Mission dashboard
          </h2>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}}>
            {[
              {label:"Mission status",value:complete?"COMPLETE":mission?.state??"ACTIVE",color:complete?"var(--mars-glow)":"var(--mars-pale)"},
              {label:"Samples collected",value:mission?mission.samples_collected+" / 3":"— / 3",color:"var(--mars-pale)"},
              {label:"Validated on-chain",value:String(approved),color:"var(--mars-bright)"},
            ].map((m)=>(
              <div key={m.label} className="metric-card" style={{
                background:"var(--mars-mid)",border:"1px solid rgba(196,98,45,.22)",borderRadius:6,padding:"20px 24px",
              }}>
                <div style={{fontSize:10,color:"var(--mars-dust)",letterSpacing:".14em",textTransform:"uppercase",marginBottom:10}}>{m.label}</div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:30,color:m.color,fontWeight:700}}>{m.value}</div>
              </div>
            ))}
          </div>

          <div style={{background:"var(--mars-mid)",border:"1px solid rgba(196,98,45,.22)",borderRadius:6,overflow:"hidden",marginBottom:16}}>
            <div style={{
              padding:"13px 24px",borderBottom:"1px solid rgba(196,98,45,.12)",
              fontSize:10,color:"var(--mars-dust)",letterSpacing:".14em",textTransform:"uppercase",
              display:"flex",alignItems:"center",gap:10,
            }}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"var(--mars-glow)",display:"inline-block"}}/>
              Geological sample log — AI validation results
              <span style={{marginLeft:"auto",color:"var(--mars-surface)",fontSize:10}}>
                auto-refresh {tick%2===0?"●":"○"}
              </span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"rgba(0,0,0,.18)"}}>
                  <th style={thStyle}>Sample</th>
                  <th style={thStyle}>Coordinates (m)</th>
                  <th style={thStyle}>Mission time</th>
                  <th style={thStyle}>GenLayer decision</th>
                  <th style={thStyle}>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {!mission||mission.samples_found.length===0?(
                  <tr>
                    <td colSpan={5} style={{padding:"32px 24px",color:"var(--mars-surface)",fontSize:13}}>
                      Awaiting rover telemetry...
                    </td>
                  </tr>
                ):(
                  mission.samples_found.map((s,i)=>{
                    const txHash=s.tx_hash||TX_HASHES[i]||"";
                    return (
                      <tr key={s.id} className="sample-row" style={{borderTop:"1px solid rgba(196,98,45,.07)"}}>
                        <td style={{padding:"14px 24px",fontFamily:"'Orbitron',monospace",fontSize:12,color:"var(--mars-sand)"}}>#{s.id}</td>
                        <td style={{padding:"14px 24px",fontSize:13,color:"var(--mars-sand)",fontFamily:"'Space Mono',monospace"}}>({s.x}, {s.y})</td>
                        <td style={{padding:"14px 24px",fontSize:13,color:"var(--mars-dust)"}}>{s.time}s</td>
                        <td style={{padding:"14px 24px"}}>
                          <span style={{
                            display:"inline-flex",alignItems:"center",gap:6,
                            padding:"4px 12px",borderRadius:3,fontSize:11,
                            fontFamily:"'Space Mono',monospace",letterSpacing:".06em",
                            background:s.status==="APPROVED"?"rgba(74,255,138,.07)":"rgba(255,80,80,.07)",
                            color:s.status==="APPROVED"?"#4aff8a":"#ff6060",
                            border:"1px solid "+(s.status==="APPROVED"?"rgba(74,255,138,.22)":"rgba(255,80,80,.22)"),
                          }}>
                            <span style={{width:5,height:5,borderRadius:"50%",background:"currentColor",display:"inline-block"}}/>
                            {s.status}
                          </span>
                        </td>
                        <td style={{padding:"14px 24px",fontSize:11,fontFamily:"'Space Mono',monospace"}}>
                          {txHash?(
                            <a href={EXPLORER+"/tx/"+txHash} target="_blank" rel="noreferrer" className="tx-link" style={{color:"var(--mars-glow)"}}>
                              {txHash.slice(0,8)+"…"+txHash.slice(-6)}
                            </a>
                          ):"—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{
            background:"var(--mars-mid)",border:"1px solid rgba(196,98,45,.22)",
            borderRadius:6,padding:"20px 24px",
            display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",
          }}>
            <div style={{
              width:36,height:36,borderRadius:"50%",
              border:"2px solid var(--mars-glow)",
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
              animation:"rotateRing 8s linear infinite",
            }}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"var(--mars-glow)"}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"var(--mars-dust)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>Intelligent Contract — Bradbury Testnet</div>
              <a href={EXPLORER+"/address/"+CONTRACT} target="_blank" rel="noreferrer" style={{fontSize:12,color:"var(--mars-glow)",fontFamily:"'Space Mono',monospace"}}>
                {CONTRACT}
              </a>
            </div>
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div style={{fontSize:10,color:"var(--mars-dust)",marginBottom:4}}>Validators</div>
              <div style={{fontSize:13,color:"var(--mars-pale)",fontFamily:"'Orbitron',monospace"}}>5 / 5 AGREE</div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop:"1px solid rgba(196,98,45,.12)",padding:"30px 40px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16,
        background:"var(--mars-dark)",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontFamily:"'Orbitron',monospace",fontSize:12,color:"var(--mars-dust)",letterSpacing:".15em"}}>AlephRob</span>
          <span style={{fontSize:11,color:"rgba(138,90,58,.45)"}}>Built for Aleph Hackathon </span>
        </div>
        <div style={{display:"flex",gap:24}}>
          <a href={EXPLORER+"/address/"+CONTRACT} target="_blank" rel="noreferrer" style={{fontSize:11,color:"var(--mars-dust)",letterSpacing:".08em"}}>Contract ↗</a>
          <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer" style={{fontSize:11,color:"var(--mars-dust)",letterSpacing:".08em"}}>GenLayer docs ↗</a>
        </div>
      </footer>
    </>
  );
}
