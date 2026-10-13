"""Actual independent NumPy/SciPy observer. It owns no RCL execution or admission."""
import hashlib
import inspect
import json
import math
import os
from pathlib import Path
import struct
import sys
import time
import numpy as np
import scipy
from scipy import stats


def describe(path):
    path = Path(path)
    return {"path": str(path.resolve()), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def binding():
    import numpy._core._multiarray_umath as multiarray
    return {"kind": "ACTUAL_NUMPY_SCIPY_FLOAT64", "processPid": os.getpid(),
            "python": sys.version, "executable": describe(sys.executable),
            "numpyVersion": np.__version__, "scipyVersion": scipy.__version__,
            "modules": [describe(np.__file__), describe(multiarray.__file__),
                        describe(scipy.__file__), describe(stats.linregress.__code__.co_filename),
                        describe(inspect.unwrap(stats.linregress).__code__.co_filename)],
            "worker": describe(__file__), "authorityGranted": False}


def vector_hash(values):
    return hashlib.sha256(b"".join(struct.pack(">d", value) for value in values)).hexdigest()


def observe(values):
    if not isinstance(values, list) or not 1 <= len(values) <= 256:
        raise ValueError("SCIENCE_VECTOR_SIZE")
    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in values):
        raise ValueError("SCIENCE_VECTOR_FINITE")
    data = np.asarray(values, dtype=np.float64)
    centered = data - data[0]
    regression = stats.linregress(np.arange(data.size, dtype=np.float64), centered) if data.size > 1 else None
    return {"count": int(data.size), "mean": float(data[0] + np.mean(centered)), "variance": float(np.var(centered, ddof=0)),
            "minimum": float(np.min(data)), "maximum": float(np.max(data)),
            "slope": float(regression.slope) if regression else 0.0,
            "intercept": float(data[0] + regression.intercept) if regression else float(data[0])}


if "--binding" in sys.argv:
    print(json.dumps(binding(), allow_nan=False), flush=True)
    sys.exit(0)
print(json.dumps({"status": "READY", "binding": binding()}, allow_nan=False), flush=True)
for line in sys.stdin:
    request = {}
    try:
        request = json.loads(line)
        if request.get("operation") == "close":
            break
        if request.get("operation") != "observe":
            raise ValueError("SCIENCE_OPERATION")
        values = request["values"]
        started = time.perf_counter_ns()
        result = observe(values)
        print(json.dumps({"status": "OK", "id": request["id"], "processPid": os.getpid(),
                          "vectorHash": vector_hash(values), "result": result,
                          "elapsedNs": time.perf_counter_ns() - started}, allow_nan=False), flush=True)
    except Exception as error:
        print(json.dumps({"status": "ERROR", "id": request.get("id"), "processPid": os.getpid(),
                          "code": str(error)}, allow_nan=False), flush=True)
