import requests
import json

CONTRACT_ADDRESS = "0x4f2E0Ad079dFf16ce511E91707b0858dCd095EEb"
RPC_URL = "https://rpc-bradbury.genlayer.com"

r = requests.post(RPC_URL, json={
    "jsonrpc": "2.0",
    "method": "eth_blockNumber",
    "params": [],
    "id": 1
})
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:500]}")