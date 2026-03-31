from controller import Supervisor
import math
import json

# ── CONFIGURACIÓN ──────────────────────────────────────────────────────────────
MAX_SPEED     = 0.6   # rad/s — límite hardware Sojourner
ARRIVAL_DIST  = 0.20  # m
STUCK_STEPS   = 150   # ticks entre cheques (~2.4 s a 16 ms/tick)
STUCK_MIN_MOV = 0.01  # m mínimo de desplazamiento por intervalo
LOG_FILE      = "mission_log.json"

SAMPLE_COLORS = {1: "cyan", 2: "yellow", 3: "green"}

# ── INICIALIZACIÓN ─────────────────────────────────────────────────────────────
robot      = Supervisor()
timestep   = int(robot.getBasicTimeStep())
rover_node = robot.getSelf()

left_wheels  = [robot.getDevice(f"{n}LeftWheel")  for n in ["Front", "Middle", "Back"]]
right_wheels = [robot.getDevice(f"{n}RightWheel") for n in ["Front", "Middle", "Back"]]
for m in left_wheels + right_wheels:
    m.setPosition(float('inf'))
    m.setVelocity(0.0)

mission = {
    "samples_collected": 0,
    "samples_found": [],
    "state": "IDLE",
    "telemetry": {"current_pos": {"x": 0, "y": 0}}
}

# ── PRIMITIVAS ─────────────────────────────────────────────────────────────────
def set_speed(left, right):
    for m in left_wheels:  m.setVelocity(max(-MAX_SPEED, min(MAX_SPEED, left)))
    for m in right_wheels: m.setVelocity(max(-MAX_SPEED, min(MAX_SPEED, right)))

def stop(): set_speed(0, 0)

def tick():
    if robot.step(timestep) == -1: exit()

def get_pos():
    p = rover_node.getPosition()
    return p[0], p[1]

def get_heading():
    """
    Heading real desde la matriz de orientación del cuerpo del rover.
    getOrientation() devuelve R (local→world) en row-major.
    La primera columna [m0, m3, m6] es el eje local +X en global (dirección adelante).
    heading = atan2(componente Y global, componente X global).
    """
    m = rover_node.getOrientation()
    return math.atan2(m[3], m[0])

def normalize(a):
    while a >  math.pi: a -= 2 * math.pi
    while a < -math.pi: a += 2 * math.pi
    return a

def save_mission():
    try:
        x, y = get_pos()
        mission["telemetry"]["current_pos"] = {"x": round(x, 3), "y": round(y, 3)}
        with open(LOG_FILE, "w") as f:
            json.dump(mission, f, indent=2)
    except: pass

# ── NAVEGACIÓN ─────────────────────────────────────────────────────────────────
# Convención de giro del Sojourner (verificada con calibración en hackathon):
#   L > R  →  giro ANTIHORARIO (heading aumenta)  ←  set_speed(+, -)
#   R > L  →  giro HORARIO     (heading disminuye) ←  set_speed(-, +)
#
# Error > 0 → objetivo a la izquierda → necesitamos aumentar heading → L > R.

def go_to(tx, ty, label="OBJETIVO"):
    print(f"\n[NAV] → {label}  ({tx:.2f}, {ty:.2f})")
    mission["state"] = f"NAV_{label.split()[0].upper()}"

    check_pos = get_pos()
    stuck_n   = 0

    for step in range(12000):
        tick()
        cx, cy = get_pos()
        d      = math.sqrt((tx - cx)**2 + (ty - cy)**2)

        if d < ARRIVAL_DIST:
            stop()
            print(f"  [OK] alcanzado  (d={d:.3f} m)")
            return True

        heading      = get_heading()
        target_angle = math.atan2(ty - cy, tx - cx)
        error        = normalize(target_angle - heading)

        # ── detector de atasco ────────────────────────────────────────────────
        if step > 0 and step % STUCK_STEPS == 0:
            progress = math.sqrt((cx - check_pos[0])**2 + (cy - check_pos[1])**2)
            if progress < STUCK_MIN_MOV:
                stuck_n += 1
            else:
                stuck_n = 0
            check_pos = (cx, cy)
            save_mission()

            if stuck_n >= 3:
                print("  [!] Atascado — maniobra de escape")
                set_speed(-MAX_SPEED, -MAX_SPEED)
                for _ in range(80): tick()
                spin = MAX_SPEED * 0.8
                # error > 0 → objetivo a la izquierda → L > R para antihorario
                if error > 0:
                    set_speed(spin, -spin)
                else:
                    set_speed(-spin, spin)
                for _ in range(60): tick()
                stuck_n   = 0
                check_pos = get_pos()
                continue

        # ── control proporcional ──────────────────────────────────────────────
        if abs(error) > 0.25:
            # Giro en sitio.
            # error > 0 → L > R → set_speed(+spd, -spd) → antihorario ✓
            # error < 0 → R > L → set_speed(-spd, +spd) → horario     ✓
            spd = MAX_SPEED * 0.8
            if error > 0:
                set_speed( spd, -spd)
            else:
                set_speed(-spd,  spd)
        else:
            # Avance con corrección lateral.
            # error > 0 → L > R → set_speed(fwd+corr, fwd-corr) → antihorario ✓
            # error < 0 → R > L → set_speed(fwd+corr, fwd-corr) con corr<0    ✓
            fwd        = min(MAX_SPEED, max(MAX_SPEED * 0.4, d * 2.0))
            correction = min(MAX_SPEED * 0.35, max(-MAX_SPEED * 0.35, error * 1.2))
            set_speed(fwd + correction, fwd - correction)

    stop()
    return False

# ── ARRANQUE ───────────────────────────────────────────────────────────────────
# Esperar que la física se estabilice; luego registrar posición y heading reales.
for _ in range(15): tick()

start_x, start_y = get_pos()
print(f"[INIT] Inicio: ({start_x:.3f}, {start_y:.3f})  "
      f"heading: {math.degrees(get_heading()):.1f}°")

# ── LEER MUESTRAS DEL MUNDO (sin moverlas) ────────────────────────────────────
SAMPLES = []
for i in range(1, 4):
    node = robot.getFromDef(f"SAMPLE_{i}")
    if node:
        pos = node.getField("translation").getSFVec3f()
        SAMPLES.append({"id": i, "x": pos[0], "y": pos[1],
                         "color": SAMPLE_COLORS[i], "node": node})

print(f"\n[MISIÓN] {len(SAMPLES)} muestras detectadas:")
for s in SAMPLES:
    cx, cy = get_pos()
    d = math.sqrt((s["x"] - cx)**2 + (s["y"] - cy)**2)
    print(f"  SAMPLE_{s['id']} ({s['color']})  pos=({s['x']:.2f},{s['y']:.2f})  d={d:.2f}m")
print(f"[MISIÓN] Retorno al: ({start_x:.3f}, {start_y:.3f})")

# ── MISIÓN: recoger cada muestra en orden de proximidad ───────────────────────
def dist_now(s):
    cx, cy = get_pos()
    return math.sqrt((s["x"] - cx)**2 + (s["y"] - cy)**2)

for s in sorted(SAMPLES, key=dist_now):
    print(f"\n[MISIÓN] → SAMPLE_{s['id']} ({s['color']})")
    if go_to(s["x"], s["y"], f"SAMPLE_{s['id']} ({s['color']})"):
        for _ in range(20): tick()   # pausa de recogida
        mission["samples_collected"] += 1
        mission["samples_found"].append({
            "id": s["id"], "color": s["color"],
            "pos": {"x": round(s["x"], 2), "y": round(s["y"], 2)},
            "time": round(robot.getTime(), 1)
        })
        try:
            if s["node"]: s["node"].remove()
        except: pass
        print(f"  [RECOGIDA] SAMPLE_{s['id']} ({s['color']})")
        save_mission()
    else:
        print(f"  [FALLO] No se alcanzó SAMPLE_{s['id']}")

# ── RETORNO AL ORIGEN ─────────────────────────────────────────────────────────
n = mission["samples_collected"]
print(f"\n[MISIÓN] {n}/3 recolectadas. "
      f"Regresando a ({start_x:.2f}, {start_y:.2f})...")
if go_to(start_x, start_y, "ORIGEN"):
    mission["state"] = "COMPLETE"
    print("[FIN] Rover en origen. Misión completada con éxito.")
else:
    mission["state"] = "FAILED_RETURN"
    print("[ERROR] No se pudo alcanzar el origen.")

save_mission()
while robot.step(timestep) != -1: stop()
