import json
import time
import os
import asyncio
from pathlib import Path

# Path al mission_log del controlador de Webots
MISSION_LOG = Path("D:/Webots/projects/robots/nasa/controllers/rover_explorer/mission_log.json")
PENDING = Path("D:/Webots/projects/robots/nasa/controllers/rover_explorer/pending_submission.json")
SUBMITTED_LOG = Path("submissions.json")

submitted_ids = set()

def load_submitted():
    if SUBMITTED_LOG.exists():
        data = json.loads(SUBMITTED_LOG.read_text())
        return set(data.get("submitted", []))
    return set()

def save_submitted(ids):
    SUBMITTED_LOG.write_text(json.dumps({"submitted": list(ids)}))

async def submit_to_genlayer(sample: dict) -> str:
    """Llamar al contrato GenLayer con la muestra."""
    from genlayer import GenLayerClient
    
    # Leer address del contrato
    addr_file = Path("contract_address.txt")
    if not addr_file.exists():
        print("[BRIDGE] contract_address.txt no encontrado — deploy primero")
        return "ERROR"
    
    contract_address = addr_file.read_text().strip()
    
    print(f"[BRIDGE] Enviando muestra #{sample['id']} al contrato {contract_address}")
    
    try:
        client = GenLayerClient(
            rpc_url="https://rpc-bradbury.genlayer.com",
            private_key=os.environ.get("PRIVATE_KEY", "")
        )
        
        result = await client.call_contract(
            contract_address=contract_address,
            method="submit_sample",
            args=[
                str(sample["id"]),
                str(sample["x"]),
                str(sample["y"]),
                str(sample.get("confidence", "0.85"))
            ]
        )
        
        print(f"[BRIDGE] Muestra #{sample['id']} → decisión: {result}")
        return result
        
    except Exception as e:
        print(f"[BRIDGE] Error: {e}")
        return "ERROR"

def watch_and_submit():
    global submitted_ids
    submitted_ids = load_submitted()
    print("[BRIDGE] Watching for new samples...")
    print(f"[BRIDGE] Log path: {MISSION_LOG}")
    
    while True:
        try:
            if MISSION_LOG.exists():
                data = json.loads(MISSION_LOG.read_text())
                samples = data.get("samples_found", [])
                
                for sample in samples:
                    sid = str(sample["id"])
                    if sid not in submitted_ids:
                        print(f"[BRIDGE] Nueva muestra detectada: #{sid}")
                        result = asyncio.run(submit_to_genlayer(sample))
                        submitted_ids.add(sid)
                        save_submitted(submitted_ids)
                        print(f"[BRIDGE] Resultado on-chain: {result}")
                        
        except Exception as e:
            print(f"[BRIDGE] Watch error: {e}")
        
        time.sleep(2)

if __name__ == "__main__":
    watch_and_submit()