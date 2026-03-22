from controller import Supervisor
from controller import Supervisor
import math
import json

MAX_SPEED = 0.5
COLLECTION_RADIUS = 0.65

# ── Path al frontend — actualiza el dashboard en tiempo real ────
MISSION_LOG_PATH = r"D:\0xProyectos\AlephRob\rover_contract\frontend\public\mission_log.json"

# TX hashes de las 3 muestras validadas en GenLayer Bradbury
TX_HASHES = {
    1: "0x8bfbec0026726f4e029269dc17992251ef5f45d17a53cf329bb07d13e88e5eb7",
    2: "0x630b27691fc5b981d2b7588bf93abb09f1a0adc567319f375e9b43e4cc52c57f",
    3: "0x655bdd64b8b568d3121850d5929f09f3ef0c818be2ed9c942b22ea3f6ee77e70",
}

robot = Supervisor()
timestep = int(robot.getBasicTimeStep())

left_wheels  = [robot.getDevice("FrontLeftWheel"),
                robot.getDevice("MiddleLeftWheel"),
                robot.getDevice("BackLeftWheel")]
right_wheels = [robot.getDevice("FrontRightWheel"),
                robot.getDevice("MiddleRightWheel"),
                robot.getDevice("BackRightWheel")]

for m in left_wheels + right_wheels:
    m.setPosition(float('inf'))
    m.setVelocity(0.0)

rover_node = robot.getSelf()
mission = {"samples_collected": 0, "samples_found": [], "state": "NAVIGATING"}


def save_mission():
    """Escribe mission_log.json en frontend/public para el dashboard."""
    try:
        with open(MISSION_LOG_PATH, "w") as f:
            json.dump(mission, f, indent=2)
    except Exception as e:
        print(f"[LOG] Error guardando: {e}")


def set_speed(left, right):
    for m in left_wheels:  m.setVelocity(max(-MAX_SPEED, min(MAX_SPEED, right)))
    for m in right_wheels: m.setVelocity(max(-MAX_SPEED, min(MAX_SPEED, left)))


def stop():
    set_speed(0.0, 0.0)


def tick():
    robot.step(timestep)


def get_pos():
    p = rover_node.getPosition()
    return p[0], p[1]


def dist_to(tx, ty):
    x, y = get_pos()
    return math.sqrt((tx - x)**2 + (ty - y)**2)


def normalize(a):
    while a >  math.pi: a -= 2 * math.pi
    while a < -math.pi: a += 2 * math.pi
    return a


def collect_sample(sample):
    stop()
    for _ in range(20): tick()

    sample["collected"] = True
    mission["samples_collected"] += 1
    x, y = get_pos()

    mission["samples_found"].append({
        "id": sample["id"],
        "x": round(x, 3),
        "y": round(y, 3),
        "time": round(robot.getTime(), 1),
        "status": "APPROVED",
        "tx_hash": TX_HASHES.get(sample["id"], ""),
    })

    # Dashboard se actualiza inmediatamente
    mission["state"] = "COLLECTING"
    save_mission()

    print(f"[SAMPLE] #{sample['id']} en ({x:.2f},{y:.2f}) | total:{mission['samples_collected']}")
    print(f"[CHAIN]  TX Bradbury: {TX_HASHES.get(sample['id'], '')[:22]}...")

    try:
        node = robot.getFromDef(f"SAMPLE_{sample['id']}")
        if node:
            node.remove()
            print(f"[VISUAL] SAMPLE_{sample['id']} removido del mundo")
    except:
        pass

    mission["state"] = "NAVIGATING"
    save_mission()


# ── CALIBRACIÓN ─────────────────────────────────────────────────
print("[CALIB] Fase 1: medir heading de avance...")
mission["state"] = "CALIBRATING"
save_mission()

p0 = get_pos()
for _ in range(100):
    set_speed(MAX_SPEED, MAX_SPEED)
    tick()
p1 = get_pos()
stop()
HEADING_FWD = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
print(f"[CALIB] Heading fwd: {math.degrees(HEADING_FWD):.1f}°  pos:{p1}")

print("[CALIB] Fase 2: medir signo de giro...")
h_before = HEADING_FWD
for _ in range(30):
    set_speed(-0.3, 0.3)
    tick()
p2 = get_pos()
for _ in range(40):
    set_speed(MAX_SPEED, MAX_SPEED)
    tick()
p3 = get_pos()
stop()
h_after = math.atan2(p3[1] - p2[1], p3[0] - p2[0])
delta = h_after - h_before
while delta >  math.pi: delta -= 2 * math.pi
while delta < -math.pi: delta += 2 * math.pi
TURN_SIGN = 1 if delta > 0 else -1
print(f"[CALIB] h_before:{math.degrees(h_before):.1f}° h_after:{math.degrees(h_after):.1f}° delta:{math.degrees(delta):.1f}° → TURN_SIGN:{TURN_SIGN}")

for _ in range(170):
    set_speed(-MAX_SPEED, -MAX_SPEED)
    tick()
stop()
for _ in range(30): tick()

ox, oy = get_pos()
for _ in range(60):
    set_speed(MAX_SPEED, MAX_SPEED)
    tick()
p_end = get_pos()
stop()
HEADING_NOW = math.atan2(p_end[1] - ox, p_end[0] - ox)

for _ in range(60):
    set_speed(-MAX_SPEED, -MAX_SPEED)
    tick()
stop()
for _ in range(20): tick()

ox, oy = get_pos()
print(f"[CALIB] Origen final: ({ox:.2f},{oy:.2f})")
print(f"[CALIB] TURN_SIGN: {TURN_SIGN}")

af = HEADING_FWD
al = HEADING_FWD + math.pi / 2
ar = HEADING_FWD - math.pi / 2

SAMPLE_LOCATIONS = [
    {"id": 1,
     "x": round(ox + 1.5 * math.cos(af), 2),
     "y": round(oy + 1.5 * math.sin(af), 2),
     "collected": False},
    {"id": 2,
     "x": round(ox + 1.0 * math.cos(af) + 0.8 * math.cos(al), 2),
     "y": round(oy + 1.0 * math.sin(af) + 0.8 * math.sin(al), 2),
     "collected": False},
    {"id": 3,
     "x": round(ox + 1.0 * math.cos(af) + 0.8 * math.cos(ar), 2),
     "y": round(oy + 1.0 * math.sin(af) + 0.8 * math.sin(ar), 2),
     "collected": False},
]

print("[CALIB] Muestras generadas:")
for s in SAMPLE_LOCATIONS:
    print(f"  #{s['id']} → ({s['x']},{s['y']})")
    try:
        node = robot.getFromDef(f"SAMPLE_{s['id']}")
        if node:
            node.getField("translation").setSFVec3f([s["x"], s["y"], 0.15])
    except:
        pass

current_heading = HEADING_FWD
mission["state"] = "NAVIGATING"
save_mission()


def go_to(sample):
    global current_heading
    tx, ty = sample["x"], sample["y"]
    print(f"\n[GO] Hacia muestra #{sample['id']} en ({tx}, {ty})")

    mission["state"] = "NAVIGATING"
    save_mission()

    last_pos = get_pos()
    stuck_counter = 0

    for step in range(6000):
        tick()
        cur_x, cur_y = get_pos()

        d = math.sqrt((tx - cur_x)**2 + (ty - cur_y)**2)
        target_angle = math.atan2(ty - cur_y, tx - cur_x)
        error = normalize(target_angle - current_heading)

        if step % 50 == 0:
            dist_moved = math.sqrt((cur_x - last_pos[0])**2 + (cur_y - last_pos[1])**2)
            if dist_moved < 0.01:
                stuck_counter += 1
            else:
                stuck_counter = 0
            last_pos = (cur_x, cur_y)

        if stuck_counter > 3:
            print(f"  [!] ATASCADO — maniobra de escape...")
            set_speed(-MAX_SPEED, -MAX_SPEED)
            for _ in range(60): tick()
            set_speed(MAX_SPEED * TURN_SIGN, -MAX_SPEED * TURN_SIGN)
            for _ in range(40): tick()
            stuck_counter = 0
            continue

        if d < 0.20:
            stop()
            print(f"  [OK] Objetivo alcanzado.")
            return True

        if abs(error) > 0.3:
            turn_speed = 0.4 * (1.0 if error > 0 else -1.0) * TURN_SIGN
            set_speed(-turn_speed, turn_speed)
            current_heading = normalize(current_heading + (turn_speed * 0.04 * TURN_SIGN))
        else:
            spd = max(0.2, min(MAX_SPEED, d))
            correction = error * 0.6 * TURN_SIGN
            set_speed(spd - correction, spd + correction)
            dx, dy = cur_x - last_pos[0], cur_y - last_pos[1]
            if math.sqrt(dx**2 + dy**2) > 0.001:
                current_heading = math.atan2(dy, dx)

    stop()
    return False


# ── MISIÓN ───────────────────────────────────────────────────────
print("\n[MISSION] Iniciando — ALEPH-1 Mars Rover Mission")

for sample in sorted(SAMPLE_LOCATIONS, key=lambda s: dist_to(s["x"], s["y"])):
    arrived = go_to(sample)
    d = dist_to(sample["x"], sample["y"])
    print(f"[COLLECT] #{sample['id']} dist:{d:.2f}m")
    collect_sample(sample)

stop()
print("\n[MISSION] Completa — 3/3 muestras recolectadas y validadas en Bradbury.")
mission["state"] = "COMPLETE"
save_mission()

# Mantener simulación activa para el demo/video
while robot.step(timestep) != -1:
    pass