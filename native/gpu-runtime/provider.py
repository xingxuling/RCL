"""RBC execution on an actual AMD FP64 OpenCL device, with no CPU VM fallback.

Host work is strict binary decoding, OpenCL transport, and reconstruction of
device-produced values/transaction snapshots. Every predicate and commit
decision executes in the generic GPU interpreter. Root hashes are computed
separately by the caller from these returned snapshots.
"""
import base64
import ctypes
import hashlib
import importlib.util
import json
import math
import os
import pathlib
import struct
import sys
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = ROOT / 'native/tensor-engine/amd_opencl_bf16_provider.py'
SPEC = importlib.util.spec_from_file_location('rcl_gpu_transport', BASE)
transport = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = transport
SPEC.loader.exec_module(transport)
VALUE_COUNT, VALUE_BYTES, TX_PART_LIMIT, RECORD_LIMIT = 262144, 32, 128, 64
SUPPORTED_OPS = set(range(35)) | {44, 47}
BUILTIN_ARITY = {4: 1, 12: 0, 13: 2, 14: 2}
ERRORS = {
    1: 'RCL_GPU_VALUE_LIMIT', 2: 'RCL_NATIVE_SEQUENCE_INDEX', 3: 'RCL_GPU_INSTRUCTION_LIMIT',
    4: 'RCL_GPU_STACK_LIMIT', 5: 'RCL_NATIVE_STACK_UNDERFLOW', 6: 'RCL_NATIVE_ARITHMETIC_TYPE',
    7: 'RCL_GPU_ZERO_DIVISOR', 8: 'RCL_NATIVE_JUMP_RANGE', 9: 'RCL_GPU_BUILTIN_TYPE',
    10: 'RCL_GPU_BUILTIN_UNSUPPORTED', 11: 'RCL_GPU_CALL_FRAME', 12: 'RCL_GPU_OPCODE_UNSUPPORTED',
    13: 'RCL_STATE_MISSING', 14: 'RCL_GPU_DIRECT_STORE_DURING_TX_UNSUPPORTED',
    15: 'RCL_NATIVE_WARRANT_CONDITION_TYPE', 16: 'RCL_NATIVE_WARRANT_LIMIT',
    17: 'RCL_NATIVE_TX_NESTED', 18: 'RCL_NATIVE_TX_REQUIRED', 19: 'RCL_AUTHORITY_DENIED',
    20: 'RCL_GPU_TRANSACTION_PART_LIMIT', 21: 'RCL_REALITY_BOUND_BROKEN',
    22: 'RCL_GPU_RECORD_LIMIT', 23: 'RCL_GPU_UNFINISHED_EXECUTION',
}


def reject(code):
    raise RuntimeError(code)


def decode_bytecode(data):
    if len(data) < 36 or data[:4] != b'RCLB':
        reject('RCL_GPU_BYTECODE_TRUNCATED')
    major, minor, flags, program, root, string_count, number_count, count, reserved = struct.unpack_from('<HH7I', data, 4)
    if major != 1 or minor not in {1, 2, 3} or flags != 0 or reserved != 0:
        reject('RCL_GPU_BYTECODE_FEATURE_UNSUPPORTED')
    if not 0 < count <= 100000 or not 0 < string_count <= 2048 or number_count > 65536:
        reject('RCL_GPU_INPUT_LIMIT')
    strings, offset = [], 36
    for _ in range(string_count):
        if offset + 4 > len(data):
            reject('RCL_GPU_BYTECODE_TRUNCATED')
        length = struct.unpack_from('<I', data, offset)[0]
        offset += 4
        if length > 1048576 or offset + length > len(data):
            reject('RCL_GPU_BYTECODE_TRUNCATED')
        text = data[offset:offset + length].decode('utf-8', errors='strict')
        if '\0' in text:
            reject('RCL_NATIVE_TEXT_NUL_UNSUPPORTED')
        strings.append(text)
        offset += length
    if offset + number_count * 8 + count * 16 != len(data):
        reject('RCL_GPU_BYTECODE_LENGTH')
    numbers = struct.unpack_from('<' + 'd' * number_count, data, offset)
    if any(not math.isfinite(value) for value in numbers):
        reject('RCL_GPU_NONFINITE_CONSTANT')
    offset += number_count * 8
    instructions = []
    pool = lambda value: 0 <= value < string_count
    for index in range(count):
        op, feature, pad, a, b, c = struct.unpack_from('<BBH3i', data, offset + index * 16)
        if op not in SUPPORTED_OPS:
            reject('RCL_GPU_OPCODE_UNSUPPORTED:' + str(op))
        if pad or feature not in ({0, 1} if op in {22, 23} else {0}):
            reject('RCL_GPU_INSTRUCTION_FLAGS')
        if minor < 3 and (op == 47 or (op == 22 and feature)) or minor < 2 and op == 44:
            reject('RCL_GPU_BYTECODE_FEATURE_VERSION')
        if op in {20, 21, 33} and not 0 <= a < count:
            reject('RCL_GPU_JUMP_RANGE')
        if op == 1 and not 0 <= a < number_count:
            reject('RCL_GPU_CONSTANT_RANGE')
        if op in {3, 4, 5, 25, 28} and not pool(a):
            reject('RCL_GPU_STRING_RANGE')
        if op in {22, 24} and not all(pool(value) for value in (a, b, c)):
            reject('RCL_GPU_STRING_RANGE')
        if op == 23 and (a not in {0, 1} or not pool(b) or not pool(c)):
            reject('RCL_GPU_TRANSACTION_OPERAND')
        if op == 26 and a not in {0, 1} or op == 2 and a not in {0, 1}:
            reject('RCL_GPU_BOOLEAN_OPERAND')
        if op == 30 and (a not in BUILTIN_ARITY or b != BUILTIN_ARITY[a]):
            reject('RCL_GPU_BUILTIN_UNSUPPORTED_OR_ARITY')
        if op == 32 and not 0 <= a < 16384 or op == 33 and not 0 <= b < 16384:
            reject('RCL_GPU_CALL_OPERAND')
        if op == 47 and (a or b or c):
            reject('RCL_GPU_INSTRUCTION_OPERAND')
        instructions.append((op, feature, a, b, c))
    if not pool(program) or not pool(root):
        reject('RCL_GPU_HEADER_POOL_RANGE')
    return instructions, numbers, strings, strings[root]


class Runtime:
    def __init__(self):
        self.context = self.queue = self.program = None
        self.cl = transport.OpenCL()
        self.platform, self.device = transport.select_amd_device(self.cl)
        self.receipt = self.cl.device_receipt(self.platform, self.device)
        if 'cl_khr_fp64' not in self.receipt['extensions'].split():
            reject('RCL_GPU_FP64_REQUIRED')
        self.token, self.instance = str(uuid.uuid4()), 0
        kernel = (ROOT / 'native/gpu-runtime/rcl-stack-vm.cl').read_bytes()
        self.kernel_hash = hashlib.sha256(kernel).hexdigest()
        try:
            code = transport.CLInt()
            properties = (ctypes.c_ssize_t * 3)(transport.CL_CONTEXT_PLATFORM, self.platform.value, 0)
            self.context = self.cl.create_context(properties, 1, ctypes.byref(self.device), None, None, ctypes.byref(code))
            transport.check(code.value, 'clCreateContext')
            self.queue = self.cl.create_command_queue(self.context, self.device, 0, ctypes.byref(code))
            transport.check(code.value, 'clCreateCommandQueue')
            array = (ctypes.c_char_p * 1)(kernel)
            lengths = (transport.CLSize * 1)(len(kernel))
            self.program = self.cl.create_program(self.context, 1, array, lengths, ctypes.byref(code))
            transport.check(code.value, 'clCreateProgramWithSource')
            result = self.cl.build_program(self.program, 1, ctypes.byref(self.device), b'-cl-std=CL1.2', None, None)
            if result != 0:
                reject('RCL_GPU_KERNEL_BUILD:' + self.cl.build_log(self.program, self.device))
        except Exception:
            self.close()
            raise

    def identity(self):
        return {'device': self.receipt, 'kernelHash': self.kernel_hash, 'processPid': os.getpid(),
                'contextToken': self.token, 'cpuExecutionFallback': False,
                'executionOwner': 'RCL_OPENCL_RBC_STACK_VM'}

    def close(self):
        for field, release in [('program', self.cl.release_program), ('queue', self.cl.release_queue), ('context', self.cl.release_context)]:
            handle = getattr(self, field)
            if handle:
                release(handle)
                setattr(self, field, None)

    def execute(self, request):
        data = base64.b64decode(request['bytecode'], validate=True)
        if len(data) > 8 * 1024 * 1024:
            reject('RCL_GPU_INPUT_LIMIT')
        artifact_hash = hashlib.sha256(data).hexdigest()
        if artifact_hash != request['artifactHash']:
            reject('RCL_GPU_ARTIFACT_HASH')
        instructions, numbers, strings, source_root = decode_bytecode(data)
        if source_root != request['sourceRoot']:
            reject('RCL_GPU_SOURCE_ROOT_MISMATCH')
        code_bytes = b''.join(struct.pack('<5i', *item) for item in instructions)
        number_bytes = struct.pack('<' + 'd' * len(numbers), *numbers) if numbers else bytes(8)
        text, positions = bytearray(), []
        for item in strings:
            encoded = item.encode('utf-8')
            positions.extend([len(text), len(encoded)])
            text.extend(encoded)
        string_bytes = struct.pack('<' + 'i' * len(positions), *positions)
        record_stride = 8 + TX_PART_LIMIT * 6 + len(strings) * 2
        buffers, code, kernel = [], transport.CLInt(), None

        def allocate(data=None, size=None):
            # OpenCL's RW bit is 1. The reused transport's legacy constants
            # are not used for access flags in this interpreter.
            owner = ctypes.create_string_buffer(data) if data is not None else None
            handle = self.cl.create_buffer(self.context, 1 | (transport.CL_MEM_COPY_HOST_PTR if owner else 0),
                len(data) if owner else size, ctypes.cast(owner, ctypes.c_void_p) if owner else None, ctypes.byref(code))
            transport.check(code.value, 'clCreateBuffer')
            buffers.append(handle)
            return transport.CLHandle(handle)

        def read(handle, size):
            out = ctypes.create_string_buffer(size)
            transport.check(self.cl.enqueue_read(self.queue, handle, 1, 0, size, ctypes.cast(out, ctypes.c_void_p), 0, None, None), 'clEnqueueReadBuffer')
            return out.raw

        try:
            kernel = self.cl.create_kernel(self.program, b'rcl_execute', ctypes.byref(code))
            transport.check(code.value, 'clCreateKernel')
            bcode, bnum, bstrings = allocate(code_bytes), allocate(number_bytes), allocate(string_bytes)
            btext, bvalues = allocate(bytes(text) or bytes(1)), allocate(size=VALUE_COUNT * VALUE_BYTES)
            bstate, bresult = allocate(size=len(strings) * 4), allocate(size=(7 + 256 * 3) * 4)
            brecords = allocate(size=RECORD_LIMIT * record_stride * 4)
            args = [bcode, transport.CLInt(len(instructions)), bnum, bstrings, btext, transport.CLInt(len(strings)), bvalues, bstate, bresult, brecords]
            for index, value in enumerate(args):
                transport.check(self.cl.set_kernel_arg(kernel, index, ctypes.sizeof(value), ctypes.byref(value)), 'clSetKernelArg')
            size, started = (transport.CLSize * 1)(1), time.perf_counter()
            transport.check(self.cl.enqueue_kernel(self.queue, kernel, 1, None, size, None, 0, None, None), 'clEnqueueNDRangeKernel')
            transport.check(self.cl.finish(self.queue), 'clFinish')
            elapsed = (time.perf_counter() - started) * 1000
            self.instance += 1
            error, used, steps, frames, stack, record_count, warrant_count = struct.unpack('<7i', read(bresult, 28))
            if error:
                reject(ERRORS.get(error, 'RCL_GPU_VM_REJECTED:' + str(error)))
            if not 0 < used <= VALUE_COUNT or not 0 <= record_count <= RECORD_LIMIT:
                reject('RCL_GPU_RESULT_LIMIT')
            values = read(bvalues, used * VALUE_BYTES)

            def fields(identifier):
                if not 0 <= identifier < used:
                    reject('RCL_GPU_RESULT_VALUE_RANGE')
                return struct.unpack_from('<5i4xd', values, identifier * VALUE_BYTES)

            def value(identifier, depth=0):
                if depth > 256:
                    reject('RCL_GPU_RESULT_DEPTH_LIMIT')
                kind, first, length, parent, tail, number = fields(identifier)
                if kind == 0:
                    return None
                if kind == 1:
                    if not math.isfinite(number):
                        reject('RCL_GPU_NONFINITE_RESULT')
                    return number
                if kind == 2:
                    return bool(number)
                if kind == 3:
                    if first < 0 or length < 0 or first + length > len(text):
                        reject('RCL_GPU_RESULT_TEXT_RANGE')
                    return bytes(text[first:first + length]).decode('utf-8')
                if kind == 4:
                    if not 0 <= length <= VALUE_COUNT:
                        reject('RCL_GPU_RESULT_SEQUENCE_RANGE')
                    output, cursor = [], identifier
                    for remaining in range(length, 0, -1):
                        item = fields(cursor)
                        if item[0] != 4 or item[2] != remaining:
                            reject('RCL_GPU_RESULT_SEQUENCE_LINK')
                        output.append(value(item[4], depth + 1))
                        cursor = item[3]
                    if fields(cursor)[0:3:2] != (4, 0):
                        reject('RCL_GPU_RESULT_SEQUENCE_LINK')
                    output.reverse()
                    return output
                reject('RCL_GPU_RESULT_TYPE')

            def state(ids):
                return {key: value(identifier) for key, identifier in zip(strings, ids) if identifier != 0}

            state_ids = struct.unpack('<' + 'i' * len(strings), read(bstate, len(strings) * 4))
            records = []
            if record_count:
                trace = struct.unpack('<' + 'i' * (record_count * record_stride), read(brecords, record_count * record_stride * 4))
                for index in range(record_count):
                    base = index * record_stride
                    mode, rule, actor, rule_kind, change_count, need_count, witness_count, at = trace[base:base + 8]
                    if mode not in {0, 1} or any(not 0 <= count <= TX_PART_LIMIT for count in (change_count, need_count, witness_count)):
                        reject('RCL_GPU_RESULT_RECORD_RANGE')
                    changes = []
                    for i in range(change_count):
                        target, before, after = trace[base + 8 + i * 3:base + 11 + i * 3]
                        changes.append({'target': strings[target], 'before': value(before), 'after': value(after), 'source': 'alter'})
                    need_at, witness_at, state_at = base + 8 + TX_PART_LIMIT * 3, base + 8 + TX_PART_LIMIT * 5, base + 8 + TX_PART_LIMIT * 6
                    records.append({'mode': mode, 'rule': strings[rule], 'actor': strings[actor], 'ruleKind': rule_kind,
                        'changes': changes, 'needs': [{'capability': strings[trace[need_at + i * 2]], 'target': strings[trace[need_at + i * 2 + 1]]} for i in range(need_count)],
                        'witnesses': [strings[trace[witness_at + i]] for i in range(witness_count)], 'instructionAtCommit': at,
                        'beforeState': state(trace[state_at:state_at + len(strings)]),
                        'afterState': state(trace[state_at + len(strings):state_at + len(strings) * 2])})
            warrant_ids = struct.unpack('<' + 'i' * (7 + warrant_count * 3), read(bresult, (7 + warrant_count * 3) * 4))[7:]
            warrants = [{'subject': strings[warrant_ids[i * 3]], 'capability': strings[warrant_ids[i * 3 + 1]], 'target': strings[warrant_ids[i * 3 + 2]]} for i in range(warrant_count)]
            return {'ok': True, 'state': state(state_ids), 'records': records, 'warrants': warrants, 'executedInstructions': steps,
                'kernelMs': elapsed, 'sourceRoot': source_root, 'artifactHash': artifact_hash,
                'nonce': request['nonce'], 'instance': self.instance, 'warrantCount': warrant_count,
                'openclCalls': {'clEnqueueNDRangeKernel': 1, 'clFinish': 1, 'clEnqueueReadBuffer': 5 if record_count else 4},
                'stateRootOwner': 'HOST_HASHES_DEVICE_PRODUCED_VALUES', **self.identity()}
        finally:
            if kernel:
                self.cl.release_kernel(kernel)
            for handle in reversed(buffers):
                self.cl.release_mem(handle)


def main():
    runtime = None
    try:
        runtime = Runtime()
        print(json.dumps({'ready': True, 'pythonExecutable': sys.executable, 'pythonVersion': sys.version.split()[0], **runtime.identity()}), flush=True)
        for line in sys.stdin:
            request = {}
            try:
                request = json.loads(line)
                print(json.dumps(runtime.execute(request), allow_nan=False), flush=True)
            except Exception as error:
                print(json.dumps({'ok': False, 'error': str(error), 'nonce': request.get('nonce'), **runtime.identity()}), flush=True)
    finally:
        if runtime:
            runtime.close()


if __name__ == '__main__':
    main()
