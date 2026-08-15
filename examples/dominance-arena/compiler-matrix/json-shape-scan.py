payload = '{"name":"rcl","version":1,"features":["text","sequence"]}'
required = ['"name":"rcl"', '"version":1', '"features":[']
print(len(payload) if all(fragment in payload for fragment in required) else -1)
