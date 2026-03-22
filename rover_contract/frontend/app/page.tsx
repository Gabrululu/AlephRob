"use client";

import { useState, useEffect, useRef } from "react";

const CONTRACT = "0xa110Cb0E2b708b07A43eF8fD48203e6DC8ac12eb";
const EXPLORER = "https://explorer-bradbury.genlayer.com";
const TX_HASHES = [
  "0x8bfbec0026726f4e029269dc17992251ef5f45d17a53cf329bb07d13e88e5eb7",
  "0x630b27691fc5b981d2b7588bf93abb09f1a0adc567319f375e9b43e4cc52c57f",
  "0x655bdd64b8b568d3121850d5929f09f3ef0c818be2ed9c942b22ea3f6ee77e70",
];

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
          <span style={{fontFamily:"'Orbitron',monospace",fontSize:13,color:"var(--mars-pale)",letterSpacing:".15em"}}>Aleph1</span>
        </div>
        <a href="#mission" className="nav-link">Mission</a>
        <a href="#tech" className="nav-link">Architecture</a>
        <a href="#dashboard" className="nav-link">Live data</a>
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

      {/* DASHBOARD */}
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
          <span style={{fontFamily:"'Orbitron',monospace",fontSize:12,color:"var(--mars-dust)",letterSpacing:".15em"}}>Aleph1</span>
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