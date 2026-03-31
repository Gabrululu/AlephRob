from controller import Supervisor
import math
import json
import os

# ── CONFIGURACIÓN ──────────────────────────────────────────────
MAX_SPEED = 0.5
COLLECTION_RADIUS = 0.65
LOG_FILE = "mission_log.json"

# ── INICIALIZACIÓN ──────────────────────────────────────────────
robot = Supervisor()
timestep = int(robot.getBasicTimeStep())
rover_node = robot.getSelf()

left_wheels = [robot.getDevice(f"{n}LeftWheel") for n in ["Front", "Middle", "Back"]]
right_wheels = [robot.getDevice(f"{n}RightWheel") for n in ["Front", "Middle", "Back"]]

for m in left_wheels + right_wheels:
    m.setPosition(float('inf'))
    m.setVelocity(0.0)

mission = {
    "samples_collected": 0, 
    "samples_found": [], 
    "state": "IDLE",
    "telemetry": {"battery": 100.0, "current_pos": {"x": 0, "y": 0}}
}

# ── FUNCIONES MOTORAS Y APOYO ──────────────────────────────────
def set_speed(left, right):
    for m in left_wheels:  m.setVelocity(max(-MAX_SPEED, min(MAX_SPEED, left)))
    for m in right_wheels: m.setVelocity(max(-MAX_SPEED, min(MAX_SPEED, right)))

def stop(): set_speed(0, 0)

def tick():
    if robot.step(timestep) == -1: exit()

def get_pos():
    p = rover_node.getPosition()
    return p[0], p[1]

def dist_to(tx, ty):
    x, y = get_pos()
    return math.sqrt((tx-x)**2 + (ty-y)**2)

def normalize(a):
    while a >  math.pi: a -= 2*math.pi
    while a < -math.pi: a += 2*math.pi
    return a

def save_mission():
    try:
        x, y = get_pos()
        mission["telemetry"]["current_pos"] = {"x": round(x, 3), "y": round(y, 3)}
        with open(LOG_FILE, "w") as f:
            json.dump(mission, f, indent=2)
    except: pass

# ── NAVEGACIÓN (LÓGICA CORE) ───────────────────────────────────
def go_to(tx, ty, label="OBJETIVO"):
    global current_heading
    mission["state"] = f"NAVIGATING_TO_{label.upper()}"
    print(f"\n[NAV] Rumbo a {label} en ({tx}, {ty})")

    last_pos = get_pos()
    stuck_counter = 0

    for step in range(8000): # Límite de pasos para evitar bucles infinitos
        tick()
        cur_x, cur_y = get_pos()
        d = math.sqrt((tx - cur_x)**2 + (ty - cur_y)**2)
        target_angle = math.atan2(ty - cur_y, tx - cur_x)
        error = normalize(target_angle - current_heading)

        if step % 50 == 0:
            dist_moved = math.sqrt((cur_x - last_pos[0])**2 + (cur_y - last_pos[1])**2)
            if dist_moved < 0.01: stuck_counter += 1
            else: stuck_counter = 0
            last_pos = (cur_x, cur_y)
            save_mission()

        if stuck_counter > 3:
            print(" [!] Atascado. Maniobra de escape...")
            set_speed(-0.4, -0.4); [tick() for _ in range(60)]
            set_speed(0.4 * TURN_SIGN, -0.4 * TURN_SIGN); [tick() for _ in range(40)]
            stuck_counter = 0
            continue

        if d < 0.18: 
            stop()
            print(f" [OK] {label} alcanzado.")
            return True
        
        if abs(error) > 0.25:
            vel = 0.35 * (1.0 if error > 0 else -1.0) * TURN_SIGN
            set_speed(-vel, vel)
            current_heading = normalize(current_heading + (vel * 0.04 * TURN_SIGN))
        else:
            spd = max(0.2, min(MAX_SPEED, d))
            correction = error * 0.6 * TURN_SIGN
            set_speed(spd - correction, spd + correction)
            
            dx, dy = cur_x - last_pos[0], cur_y - last_pos[1]
            if math.sqrt(dx**2 + dy**2) > 0.001:
                current_heading = math.atan2(dy, dx)
    return False

# ── FASE DE CALIBRACIÓN ────────────────────────────────────────
print("[CALIB] Iniciando...")
p0 = get_pos()
for _ in range(100): set_speed(MAX_SPEED, MAX_SPEED); tick()
p1 = get_pos()
HEADING_FWD = math.atan2(p1[1]-p0[1], p1[0]-p0[0])

# Determinar signo de giro
h_before = HEADING_FWD
for _ in range(30): set_speed(-0.3, 0.3); tick()
p2 = get_pos()
for _ in range(40): set_speed(MAX_SPEED, MAX_SPEED); tick()
p3 = get_pos()
h_after = math.atan2(p3[1]-p2[1], p3[0]-p2[0])
TURN_SIGN = 1 if normalize(h_after - h_before) > 0 else -1

# Volver al origen para posicionar muestras
for _ in range(170): set_speed(-MAX_SPEED, -MAX_SPEED); tick()
stop()
ox, oy = get_pos()
current_heading = HEADING_FWD

# Configurar Muestras
af, al, ar = HEADING_FWD, HEADING_FWD + math.pi/2, HEADING_FWD - math.pi/2
SAMPLE_LOCATIONS = [
    {"id":1, "x":round(ox+1.5*math.cos(af),2), "y":round(oy+1.5*math.sin(af),2), "collected":False},
    {"id":2, "x":round(ox+1.0*math.cos(af)+0.8*math.cos(al),2), "y":round(oy+1.0*math.sin(af)+0.8*math.sin(al),2), "collected":False},
    {"id":3, "x":round(ox+1.0*math.cos(af)+0.8*math.cos(ar),2), "y":round(oy+1.0*math.sin(af)+0.8*math.sin(ar),2), "collected":False},
]

for s in SAMPLE_LOCATIONS:
    try:
        node = robot.getFromDef(f"SAMPLE_{s['id']}")
        if node: node.getField("translation").setSFVec3f([s["x"], s["y"], 0.15])
    except: pass

# ── EJECUCIÓN DE LA MISIÓN ──────────────────────────────────────
print(f"\n[MISIÓN] Calibración OK. TURN_SIGN: {TURN_SIGN}")

# 1. Recolectar todas las muestras
for s in sorted(SAMPLE_LOCATIONS, key=lambda x: dist_to(x["x"], x["y"])):
    if go_to(s["x"], s["y"], f"Muestra #{s['id']}"):
        # Lógica de recolección
        stop(); [tick() for _ in range(30)]
        mission["samples_collected"] += 1
        mission["samples_found"].append({"id": s['id'], "time": round(robot.getTime(),1)})
        try:
            node = robot.getFromDef(f"SAMPLE_{s['id']}")
            if node: node.remove()
        except: pass
        save_mission()

# 2. Regresar a la base (0,0)
print("\n[MISIÓN] Recolección completada. Regresando a la base...")
if go_to(ox, oy, "BASE_ORIGEN"):
    mission["state"] = "COMPLETE"
    print("\n[SISTEMA] Rover en base. Apagando sistemas.")
else:
    mission["state"] = "FAILED_RETURN"
    print("\n[ERROR] No se pudo alcanzar la base.")

save_mission()
while robot.step(timestep) != -1: stop()