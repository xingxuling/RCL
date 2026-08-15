import json

payload = '{ "features": [ "text", "sequence" ], "name": "rcl", "version": 1 }'
print(json.dumps(json.loads(payload), separators=(",", ":"), ensure_ascii=False))
