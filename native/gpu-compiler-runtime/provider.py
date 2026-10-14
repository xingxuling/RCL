"""Resumable RBC interpreter on AMD OpenCL; CPU performs transport only.

The optional compiler_input.source is an immutable uploaded Text value. The
supplied RBC compiler owns lexing, parsing, validation, hashing and emission.
Output selection never executes or repairs a compiler on the host.
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
SPEC = importlib.util.spec_from_file_location('rcl_gpu_compiler_transport', ROOT / 'native/tensor-engine/amd_opencl_bf16_provider.py')
transport = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = transport
SPEC.loader.exec_module(transport)
VALUE_CAPACITY, TEXT_CAPACITY, INDEX_CAPACITY = 2097152, 67108864, 33554432
STACK_CAPACITY, FRAME_CAPACITY, TX_CAPACITY, RECORD_CAPACITY = 131072, 32768, 128, 64
INSTRUCTION_BUDGET = 300000000
BUILTIN_ARITY = {1:2, 2:2, 3:2, 4:1, 5:1, 6:1, 7:1, 8:1, 9:2, 10:2, 11:1,
                 12:0, 13:2, 14:2, 15:2, 16:3, 17:1, 18:1, 19:1, 20:1, 21:4,
                 46:4, 62:2, 63:1, 64:1, 65:1, 66:1, 67:1, 68:1, 69:1, 70:1}
ERRORS = {1:'RCL_GPU_VALUE_LIMIT', 2:'RCL_NATIVE_SEQUENCE_INDEX', 3:'RCL_GPU_INSTRUCTION_LIMIT',
          4:'RCL_GPU_STACK_LIMIT', 5:'RCL_NATIVE_STACK_UNDERFLOW', 6:'RCL_NATIVE_ARITHMETIC_TYPE',
          7:'RCL_GPU_ZERO_DIVISOR', 8:'RCL_NATIVE_JUMP_RANGE', 9:'RCL_GPU_BUILTIN_TYPE',
          10:'RCL_GPU_BUILTIN_UNSUPPORTED', 11:'RCL_GPU_CALL_FRAME', 12:'RCL_GPU_OPCODE_UNSUPPORTED',
          13:'RCL_STATE_MISSING', 14:'RCL_GPU_DIRECT_STORE_DURING_TX_UNSUPPORTED',
          15:'RCL_NATIVE_WARRANT_CONDITION_TYPE', 16:'RCL_NATIVE_WARRANT_LIMIT',
          17:'RCL_NATIVE_TX_NESTED', 18:'RCL_NATIVE_TX_REQUIRED', 19:'RCL_AUTHORITY_DENIED',
          20:'RCL_GPU_TRANSACTION_PART_LIMIT', 21:'RCL_REALITY_BOUND_BROKEN',
          22:'RCL_GPU_RECORD_LIMIT', 23:'RCL_GPU_UNFINISHED_EXECUTION', 24:'RCL_GPU_TEXT_LIMIT',
          25:'RCL_TEXT_SLICE', 26:'RCL_SEMANTIC_ASSERT', 27:'RCL_GPU_PROVIDER_DENIED',
          28:'RCL_SPAN', 29:'RCL_BYTE_RANGE', 30:'RCL_BYTE_HEX', 31:'RCL_NUMBER_FROM_TEXT'}


def reject(code):
    raise RuntimeError(code)


class Value(ctypes.Structure):
    _fields_ = [(name, ctypes.c_int32) for name in ('type','refs','first','length','parent','tail','cache','aux')] + [('number', ctypes.c_double)]


class Frame(ctypes.Structure):
    _fields_ = [(name, ctypes.c_int32) for name in ('return_pc','base','argc')]


HEADER_NAMES = ('pc','sp','fp','steps','error','halted','initialized','source_value',
                'active','projected','mode','rule','actor','rule_kind','changes','needs','witnesses','records','warrants',
                'diagnostic_code','diagnostic_detail','diagnostic_line','diagnostic_column')


class Machine(ctypes.Structure):
    _fields_ = [(name, ctypes.c_int32) for name in HEADER_NAMES] + [
        ('stack', ctypes.c_int32 * STACK_CAPACITY), ('frames', Frame * FRAME_CAPACITY),
        ('warrant', ctypes.c_int32 * (256 * 3)), ('change', ctypes.c_int32 * (TX_CAPACITY * 3)),
        ('need', ctypes.c_int32 * (TX_CAPACITY * 2)), ('witness', ctypes.c_int32 * TX_CAPACITY),
        ('byte_value', ctypes.c_int32 * 256), ('empty_value', ctypes.c_int32),
        ('true_value', ctypes.c_int32), ('false_value', ctypes.c_int32)]


def decode_bytecode(data):
    if len(data) < 36 or data[:4] != b'RCLB':
        reject('RCL_GPU_BYTECODE_TRUNCATED')
    major, minor, flags, program, root, ns, nn, count, reserved = struct.unpack_from('<HH7I', data, 4)
    if major != 1 or minor not in {1,2,3} or flags or reserved:
        reject('RCL_GPU_BYTECODE_FEATURE_UNSUPPORTED')
    if not 0 < count <= 100000 or not 0 < ns <= 2048 or nn > 65536:
        reject('RCL_GPU_INPUT_LIMIT')
    strings, at = [], 36
    for _ in range(ns):
        if at + 4 > len(data):
            reject('RCL_GPU_BYTECODE_TRUNCATED')
        length = struct.unpack_from('<I', data, at)[0]
        at += 4
        if length > 1048576 or at + length > len(data):
            reject('RCL_GPU_BYTECODE_TRUNCATED')
        value = data[at:at+length].decode('utf-8', errors='strict')
        if '\0' in value:
            reject('RCL_NATIVE_TEXT_NUL_UNSUPPORTED')
        strings.append(value)
        at += length
    if at + nn * 8 + count * 16 != len(data):
        reject('RCL_GPU_BYTECODE_LENGTH')
    numbers = struct.unpack_from('<' + 'd' * nn, data, at)
    if any(not math.isfinite(v) for v in numbers):
        reject('RCL_GPU_NONFINITE_CONSTANT')
    at += nn * 8
    instructions = []
    pool = lambda v: 0 <= v < ns
    for i in range(count):
        op, feature, pad, a, b, c = struct.unpack_from('<BBH3i', data, at+i*16)
        if op not in set(range(36)) | {44,47}:
            reject('RCL_GPU_OPCODE_UNSUPPORTED:' + str(op))
        if pad or feature not in ({0,1} if op in {22,23,35} else {0}):
            reject('RCL_GPU_INSTRUCTION_FLAGS')
        if (minor < 3 and (op == 47 or op == 22 and feature)) or minor < 2 and op == 44:
            reject('RCL_GPU_BYTECODE_FEATURE_VERSION')
        if op in {20,21,33} and not 0 <= a < count:
            reject('RCL_GPU_JUMP_RANGE')
        if op == 1 and not 0 <= a < nn:
            reject('RCL_GPU_CONSTANT_RANGE')
        if op in {3,4,5,25,28} and not pool(a):
            reject('RCL_GPU_STRING_RANGE')
        if op in {22,24} or op == 35 and not feature:
            if not all(pool(v) for v in (a,b,c)):
                reject('RCL_GPU_STRING_RANGE')
        if op == 35 and feature and (a or b or c):
            reject('RCL_GPU_PROVIDER_OPERAND')
        if op == 23 and (a not in {0,1} or not pool(b) or not pool(c)):
            reject('RCL_GPU_TRANSACTION_OPERAND')
        if op in {2,26} and a not in {0,1}:
            reject('RCL_GPU_BOOLEAN_OPERAND')
        if op == 30 and (a not in BUILTIN_ARITY or b != BUILTIN_ARITY[a]):
            reject('RCL_GPU_BUILTIN_UNSUPPORTED_OR_ARITY')
        if op == 32 and not 0 <= a < STACK_CAPACITY or op == 33 and not 0 <= b < STACK_CAPACITY:
            reject('RCL_GPU_CALL_OPERAND')
        if op == 47 and (a or b or c):
            reject('RCL_GPU_INSTRUCTION_OPERAND')
        instructions.append((op,feature,a,b,c))
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
        kernel = (ROOT / 'native/gpu-compiler-runtime/rcl-compiler-stack-vm.cl').read_bytes()
        self.kernel_hash = hashlib.sha256(kernel).hexdigest()
        try:
            code = transport.CLInt()
            properties = (ctypes.c_ssize_t * 3)(transport.CL_CONTEXT_PLATFORM, self.platform.value, 0)
            self.context = self.cl.create_context(properties, 1, ctypes.byref(self.device), None, None, ctypes.byref(code))
            transport.check(code.value, 'clCreateContext')
            self.queue = self.cl.create_command_queue(self.context, self.device, 0, ctypes.byref(code))
            transport.check(code.value, 'clCreateCommandQueue')
            source, lengths = (ctypes.c_char_p * 1)(kernel), (transport.CLSize * 1)(len(kernel))
            self.program = self.cl.create_program(self.context, 1, source, lengths, ctypes.byref(code))
            transport.check(code.value, 'clCreateProgramWithSource')
            status = self.cl.build_program(self.program, 1, ctypes.byref(self.device), b'-cl-std=CL1.2', None, None)
            if status:
                reject('RCL_GPU_KERNEL_BUILD:' + self.cl.build_log(self.program, self.device))
        except Exception:
            self.close()
            raise

    def identity(self):
        return {'device': self.receipt, 'kernelHash': self.kernel_hash, 'processPid': os.getpid(),
                'contextToken': self.token, 'cpuExecutionFallback': False,
                'executionOwner': 'RCL_OPENCL_RESUMABLE_RBC_COMPILER_VM'}

    def close(self):
        for name, release in [('program',self.cl.release_program),('queue',self.cl.release_queue),('context',self.cl.release_context)]:
            handle = getattr(self,name)
            if handle:
                release(handle)
                setattr(self,name,None)

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
        quantum = request.get('quantum',200000)
        if not isinstance(quantum,int) or isinstance(quantum,bool) or not 1 <= quantum <= 1000000:
            reject('RCL_GPU_QUANTUM_LIMIT')
        mode = request.get('mode','execute')
        if mode not in {'execute','compile'}:
            reject('RCL_GPU_MODE')
        source = request.get('compilerSource')
        if source is not None and not isinstance(source,str):
            reject('RCL_GPU_PROVIDER_INPUT_TYPE')
        if mode == 'compile' and source is None:
            reject('RCL_GPU_PROVIDER_INPUT_REQUIRED')
        encoded_source = source.encode('utf-8') if source is not None else None
        if encoded_source is not None and (len(encoded_source)>1048576 or b'\0' in encoded_source):
            reject('RCL_GPU_PROVIDER_INPUT_LIMIT')
        input_hash = hashlib.sha256(encoded_source).hexdigest() if encoded_source is not None else None
        if encoded_source is not None and request.get('compilerSourceHash') != input_hash:
            reject('RCL_GPU_PROVIDER_INPUT_HASH')
        code_bytes = b''.join(struct.pack('<5i',*i) for i in instructions)
        number_bytes = struct.pack('<'+'d'*len(numbers),*numbers) if numbers else bytes(8)
        text, positions = bytearray(), []
        for item in strings:
            encoded = item.encode('utf-8')
            positions.extend([len(text),len(encoded)])
            text.extend(encoded)
        source_offset, source_length = len(text), -1
        if encoded_source is not None:
            source_length = len(encoded_source)
            text.extend(encoded_source)
        if len(text)+16 >= TEXT_CAPACITY:
            reject('RCL_GPU_TEXT_LIMIT')
        string_bytes = struct.pack('<'+'i'*len(positions),*positions)
        stride = 8 + TX_CAPACITY*6 + len(strings)*2
        buffers, kernels, code = [], [], transport.CLInt()
        calls = {'clEnqueueNDRangeKernel':0,'clFinish':0,'clEnqueueReadBuffer':0,'clEnqueueWriteBuffer':0}

        def allocate(data=None,size=None):
            owner = ctypes.create_string_buffer(data) if data is not None else None
            handle = self.cl.create_buffer(self.context,1 | (transport.CL_MEM_COPY_HOST_PTR if owner else 0),
                len(data) if owner else size,ctypes.cast(owner,ctypes.c_void_p) if owner else None,ctypes.byref(code))
            transport.check(code.value,'clCreateBuffer')
            handle = transport.CLHandle(handle)
            buffers.append(handle)
            return handle

        def read(handle,size,offset=0):
            if size == 0:
                return b''
            owner = ctypes.create_string_buffer(size)
            transport.check(self.cl.enqueue_read(self.queue,handle,1,offset,size,ctypes.cast(owner,ctypes.c_void_p),0,None,None),'clEnqueueReadBuffer')
            calls['clEnqueueReadBuffer'] += 1
            return owner.raw

        def kernel(name,args):
            handle = self.cl.create_kernel(self.program,name.encode('ascii'),ctypes.byref(code))
            transport.check(code.value,'clCreateKernel')
            kernels.append(handle)
            for index,arg in enumerate(args):
                transport.check(self.cl.set_kernel_arg(handle,index,ctypes.sizeof(arg),ctypes.byref(arg)),'clSetKernelArg')
            return handle

        def dispatch(handle):
            size = (transport.CLSize * 1)(1)
            transport.check(self.cl.enqueue_kernel(self.queue,handle,1,None,size,None,0,None,None),'clEnqueueNDRangeKernel')
            calls['clEnqueueNDRangeKernel'] += 1
            transport.check(self.cl.finish(self.queue),'clFinish')
            calls['clFinish'] += 1

        def header():
            return dict(zip(HEADER_NAMES,struct.unpack('<23i',read(bmachine,92))))

        def check_header(h):
            if h['error']:
                if h['error'] == 26:
                    def diagnostic_text(identifier):
                        v = Value.from_buffer_copy(read(bvalues,40,identifier*40))
                        if v.type != 3 or v.first < 0 or v.length < 0 or v.first+v.length > TEXT_CAPACITY:
                            reject('RCL_GPU_DIAGNOSTIC_TYPE')
                        return read(btext,v.length,v.first).decode('utf-8',errors='strict')
                    reject(diagnostic_text(h['diagnostic_code']) + ': ' + diagnostic_text(h['diagnostic_detail'])
                        + ' at ' + str(h['diagnostic_line']) + ':' + str(h['diagnostic_column']))
                reject(ERRORS.get(h['error'],'RCL_GPU_VM_REJECTED:'+str(h['error'])) + ':pc=' + str(h['pc']) + ':steps=' + str(h['steps']))

        try:
            bcode, bnum, bstrings = allocate(code_bytes),allocate(number_bytes),allocate(string_bytes)
            btext = allocate(size=TEXT_CAPACITY)
            owner = ctypes.create_string_buffer(bytes(text))
            transport.check(self.cl.enqueue_write(self.queue,btext,1,0,len(text),ctypes.cast(owner,ctypes.c_void_p),0,None,None),'clEnqueueWriteBuffer')
            calls['clEnqueueWriteBuffer'] += 1
            bvalues = allocate(size=VALUE_CAPACITY*ctypes.sizeof(Value))
            bstate, bsvalue = allocate(bytes(len(strings)*4)),allocate(size=len(strings)*4)
            bnvalue, bmachine = allocate(size=max(4,len(numbers)*4)),allocate(bytes(ctypes.sizeof(Machine)))
            bmeta, bindices, bscratch = allocate(bytes(128*4)),allocate(size=INDEX_CAPACITY*4),allocate(size=VALUE_CAPACITY*4)
            brecords = allocate(size=RECORD_CAPACITY*stride*4)
            vm = kernel('rcl_execute',[bcode,transport.CLInt(len(instructions)),bnum,transport.CLInt(len(numbers)),bstrings,
                transport.CLInt(len(strings)),btext,transport.CLInt(len(text)),transport.CLInt(source_offset),transport.CLInt(source_length),
                bvalues,bstate,bsvalue,bnvalue,bmachine,bmeta,bindices,bscratch,brecords,transport.CLInt(quantum)])
            batches, h, started, kernel_ms = [], {}, time.perf_counter(), 0
            while True:
                before = time.perf_counter()
                dispatch(vm)
                elapsed = (time.perf_counter()-before)*1000
                kernel_ms += elapsed
                h = header()
                batches.append({'steps':h['steps'],'pc':h['pc'],'ms':elapsed,'error':h['error']})
                if request.get('progress'):
                    print(json.dumps({'progress':True,'nonce':request.get('nonce'),**batches[-1]}),file=sys.stderr,flush=True)
                check_header(h)
                if h['halted']:
                    break
            self.instance += 1
            meta = struct.unpack('<128i',read(bmeta,512))
            if not 0 < meta[0] <= VALUE_CAPACITY or not 0 <= h['records'] <= RECORD_CAPACITY:
                reject('RCL_GPU_RESULT_LIMIT')
            state_ids = struct.unpack('<'+'i'*len(strings),read(bstate,len(strings)*4))
            # All flattening is device work; host reads the final immutable IDs.
            value_cache = {}

            def fields(identifier):
                if not 0 <= identifier < meta[0]:
                    reject('RCL_GPU_RESULT_VALUE_RANGE')
                if identifier not in value_cache:
                    value_cache[identifier] = Value.from_buffer_copy(read(bvalues,40,identifier*40))
                return value_cache[identifier]

            def sequence_ids(identifier):
                v = fields(identifier)
                if v.type != 4 or not 0 <= v.length <= VALUE_CAPACITY:
                    reject('RCL_GPU_RESULT_SEQUENCE_RANGE')
                if v.cache < 0:
                    flat = kernel('rcl_flatten',[bvalues,btext,bindices,bmeta,bscratch,bmachine,transport.CLInt(identifier)])
                    dispatch(flat)
                    check_header(header())
                    value_cache.pop(identifier,None)
                    v = fields(identifier)
                if v.cache < 0 or v.cache+v.length > INDEX_CAPACITY:
                    reject('RCL_GPU_RESULT_INDEX_RANGE')
                return struct.unpack('<'+'i'*v.length,read(bindices,v.length*4,v.cache*4))

            def value(identifier,depth=0):
                if depth > 256:
                    reject('RCL_GPU_RESULT_DEPTH_LIMIT')
                v = fields(identifier)
                if v.type == 0:
                    return None
                if v.type == 1:
                    if not math.isfinite(v.number):
                        reject('RCL_GPU_NONFINITE_RESULT')
                    return v.number
                if v.type == 2:
                    return bool(v.number)
                if v.type == 3:
                    if v.first < 0 or v.length < 0 or v.first+v.length > TEXT_CAPACITY:
                        reject('RCL_GPU_RESULT_TEXT_RANGE')
                    return read(btext,v.length,v.first).decode('utf-8',errors='strict')
                if v.type == 4:
                    return [value(i,depth+1) for i in sequence_ids(identifier)]
                if v.type == 5:
                    return {'offset':v.first,'line':v.length,'column':v.parent,'length':v.tail}
                reject('RCL_GPU_RESULT_TYPE')

            def state(ids):
                return {key:value(i) for key,i in zip(strings,ids) if i}

            common = {'ok':True,'executedInstructions':h['steps'],'kernelMs':kernel_ms,'elapsedMs':(time.perf_counter()-started)*1000,
                'batchCount':len(batches),'batches':batches,'sourceRoot':source_root,'artifactHash':artifact_hash,
                'compilerSourceHash':input_hash,'providerCalls':meta[6],'nonce':request['nonce'],'instance':self.instance,
                'valueArenaLive':meta[2],'valueArenaPeak':meta[3],'valueArenaBump':meta[0],
                'textArenaUsed':meta[4],'indexArenaUsed':meta[5],'openclCalls':calls,
                'stateRootOwner':'HOST_HASHES_DEVICE_PRODUCED_VALUES',**self.identity()}
            if mode == 'compile':
                output_key = request.get('outputState')
                if output_key is None:
                    output_key = 'compiler.output'
                    if 'compiler.output_state' in strings:
                        declared = state_ids[strings.index('compiler.output_state')]
                        if declared:
                            output_key = value(declared)
                if not isinstance(output_key,str) or output_key not in strings:
                    reject('RCL_GPU_COMPILER_OUTPUT_STATE')
                output = state_ids[strings.index(output_key)]
                ids = sequence_ids(output)
                # Read contiguous device byte values once, not per emitted byte.
                byte_ids = set(ids)
                blob = read(bvalues,meta[0]*40)
                numbers_by_id = {i:Value.from_buffer_copy(blob,i*40) for i in byte_ids}
                if any(v.type!=1 or not math.isfinite(v.number) or v.number!=int(v.number) or not 0<=v.number<=255 for v in numbers_by_id.values()):
                    reject('RCL_GPU_COMPILER_OUTPUT_BYTE')
                emitted = bytes(int(numbers_by_id[i].number) for i in ids)
                return {**common,'elapsedMs':(time.perf_counter()-started)*1000,'outputState':output_key,'outputBytes':base64.b64encode(emitted).decode('ascii'),
                    'outputHash':hashlib.sha256(emitted).hexdigest(),'outputLength':len(emitted),
                    'outputScope':'DEVICE_EMITTED_BYTE_SEQUENCE_ONLY'}
            records = []
            if h['records']:
                trace = struct.unpack('<'+'i'*(h['records']*stride),read(brecords,h['records']*stride*4))
                for i in range(h['records']):
                    base = i*stride
                    mode_id,rule,actor,kind,nc,nn,nw,step = trace[base:base+8]
                    if mode_id not in {0,1} or any(not 0<=n<=TX_CAPACITY for n in (nc,nn,nw)):
                        reject('RCL_GPU_RESULT_RECORD_RANGE')
                    changes = []
                    for j in range(nc):
                        target,before,after = trace[base+8+j*3:base+11+j*3]
                        changes.append({'target':strings[target],'before':value(before),'after':value(after),'source':'alter'})
                    na,wa,sa = base+8+TX_CAPACITY*3,base+8+TX_CAPACITY*5,base+8+TX_CAPACITY*6
                    records.append({'mode':mode_id,'rule':strings[rule],'actor':strings[actor],'ruleKind':kind,
                        'changes':changes,'needs':[{'capability':strings[trace[na+j*2]],'target':strings[trace[na+j*2+1]]} for j in range(nn)],
                        'witnesses':[strings[trace[wa+j]] for j in range(nw)],'instructionAtCommit':step,
                        'beforeState':state(trace[sa:sa+len(strings)]),'afterState':state(trace[sa+len(strings):sa+2*len(strings)])})
            machine = Machine.from_buffer_copy(read(bmachine,ctypes.sizeof(Machine)))
            warrants = [{'subject':strings[machine.warrant[i*3]],'capability':strings[machine.warrant[i*3+1]],'target':strings[machine.warrant[i*3+2]]} for i in range(h['warrants'])]
            return {**common,'state':state(state_ids),'records':records,'warrants':warrants,'warrantCount':h['warrants']}
        finally:
            for handle in reversed(kernels):
                self.cl.release_kernel(handle)
            for handle in reversed(buffers):
                self.cl.release_mem(handle)


def main():
    sys.stdin.reconfigure(encoding='utf-8',errors='strict')
    sys.stdout.reconfigure(encoding='utf-8',errors='strict')
    sys.stderr.reconfigure(encoding='utf-8',errors='strict')
    runtime = None
    try:
        runtime = Runtime()
        print(json.dumps({'ready':True,'pythonExecutable':sys.executable,'pythonVersion':sys.version.split()[0],
            'valueBytes':ctypes.sizeof(Value),'machineBytes':ctypes.sizeof(Machine),**runtime.identity()}),flush=True)
        for line in sys.stdin:
            if not line.strip():
                continue
            request = {}
            try:
                request = json.loads(line)
                print(json.dumps(runtime.execute(request),allow_nan=False),flush=True)
            except Exception as error:
                print(json.dumps({'ok':False,'error':str(error),'nonce':request.get('nonce'),**runtime.identity()}),flush=True)
    finally:
        if runtime:
            runtime.close()


if __name__ == '__main__':
    main()
