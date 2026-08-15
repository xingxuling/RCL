payload = "  RCL Beats Python  "
normalized = payload.strip().lower()
print(len(normalized) if "rcl" in normalized and "python" in normalized else -1)
