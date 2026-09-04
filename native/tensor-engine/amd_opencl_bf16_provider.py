#!/usr/bin/env python3
"""Bounded AMD OpenCL lowerer for the canonical RCL BF16 matmul profile.

This file owns no tensor semantics. It only lowers the exact BF16 bit payload
and the RCL-defined FP32-accumulating matmul into an OpenCL kernel. Unsupported
backends and unavailable devices fail closed; there is deliberately no CPU
fallback.
"""

from __future__ import annotations

import ctypes
import hashlib
import json
import os
import struct
import sys
from typing import Any


REQUEST_FORMAT = "rcl.opencl-bf16-matmul-request.v0.1"
RESULT_FORMAT = "rcl.opencl-bf16-matmul-result.v0.1"
GRADIENT_REQUEST_FORMAT = "rcl.opencl-bf16-matmul-gradient-request.v0.1"
GRADIENT_RESULT_FORMAT = "rcl.opencl-bf16-matmul-gradient-result.v0.1"
ADAMW_REQUEST_FORMAT = "rcl.opencl-adamw-update-request.v0.1"
ADAMW_RESULT_FORMAT = "rcl.opencl-adamw-update-result.v0.1"
MASKED_SOFTMAX_REQUEST_FORMAT = "rcl.opencl-bf16-masked-softmax-request.v0.1"
MASKED_SOFTMAX_RESULT_FORMAT = "rcl.opencl-bf16-masked-softmax-result.v0.1"
BATCH_REQUEST_FORMAT = "rcl.opencl-amd-batch-request.v0.1"
BATCH_RESULT_FORMAT = "rcl.opencl-amd-batch-result.v0.1"
SESSION_CLOSE_REQUEST_FORMAT = "rcl.opencl-amd-session-close-request.v0.1"
SESSION_CLOSE_RESULT_FORMAT = "rcl.opencl-amd-session-close-result.v0.1"
TENSOR_RESIDENCY_REQUEST_FORMAT = "rcl.opencl-amd-tensor-residency-request.v0.1"
TENSOR_RESIDENCY_RESULT_FORMAT = "rcl.opencl-amd-tensor-residency-result.v0.1"
BACKEND = "opencl-amd"
MAX_DIMENSION = 64
MAX_ELEMENTS = 4096
MAX_BATCH_REQUESTS = 64
SESSION_BUFFER_ARENA_MODE = "session-arena-v0.1"
TENSOR_RESIDENCY_MODE = "tensor-residency-v0.1"
MAX_ARENA_BUFFERS = 64
MAX_ARENA_BYTES = 2 * 1024 * 1024
MAX_RESIDENT_TENSORS = 64
MAX_RESIDENT_BYTES = 2 * 1024 * 1024
MAX_GRAPH_OPERATIONS = 8
MAX_GRAPH_BYTES = 2 * 1024 * 1024

CL_SUCCESS = 0
CL_DEVICE_NOT_FOUND = -1
CL_PLATFORM_NOT_FOUND_KHR = -1001
CL_DEVICE_TYPE_GPU = 1 << 2
CL_PLATFORM_NAME = 0x0902
CL_PLATFORM_VENDOR = 0x0903
CL_DEVICE_NAME = 0x102B
CL_DEVICE_VENDOR = 0x102C
CL_DRIVER_VERSION = 0x102D
CL_DEVICE_VERSION = 0x102F
CL_DEVICE_EXTENSIONS = 0x1030
CL_CONTEXT_PLATFORM = 0x1084
CL_MEM_READ_ONLY = 1
CL_MEM_WRITE_ONLY = 2
CL_MEM_READ_WRITE = 0
CL_MEM_COPY_HOST_PTR = 1 << 5
CL_PROGRAM_BUILD_LOG = 0x1183

CLInt = ctypes.c_int32
CLUint = ctypes.c_uint32
CLUlong = ctypes.c_uint64
CLSize = ctypes.c_size_t
CLBool = CLUint
CLHandle = ctypes.c_void_p


class ProviderError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def fail(code: str, message: str) -> ProviderError:
    return ProviderError(code, message)


def check(code: int, operation: str) -> None:
    if code != CL_SUCCESS:
        raise fail(
            "RCL_OPENCL_EXECUTION_FAILED",
            f"{operation} returned OpenCL error {code}",
        )


def parse_bits(values: Any, label: str) -> list[int]:
    if not isinstance(values, list):
        raise fail("RCL_OPENCL_BF16_BITS", f"{label} must be an array")
    parsed: list[int] = []
    for value in values:
        if not isinstance(value, str) or len(value) != 4 or value.lower() != value:
            raise fail(
                "RCL_OPENCL_BF16_BITS",
                f"{label} must use four lowercase hexadecimal digits",
            )
        try:
            bits = int(value, 16)
        except ValueError as error:
            raise fail("RCL_OPENCL_BF16_BITS", f"invalid {label} bits {value}") from error
        if bits & 0x7F80 == 0x7F80:
            raise fail(
                "RCL_OPENCL_BF16_NONFINITE",
                f"{label} contains non-finite BF16 bits",
            )
        parsed.append(bits)
    return parsed


def bf16_value(bits: int) -> float:
    return ctypes.c_float.from_buffer_copy(
        ctypes.c_uint32(bits << 16)
    ).value


def f32_bits(value: float) -> int:
    return struct.unpack(">I", struct.pack(">f", ctypes.c_float(value).value))[0]


def f32_value(bits: int) -> float:
    return struct.unpack(">f", struct.pack(">I", bits))[0]


def parse_f32_bits(values: Any, label: str, expected: int | None = None) -> list[float]:
    if not isinstance(values, list):
        raise fail("RCL_OPENCL_F32_BITS", f"{label} must be an array")
    if expected is not None and len(values) != expected:
        raise fail("RCL_OPENCL_SHAPE", f"{label} length must be {expected}")
    parsed: list[float] = []
    for value in values:
        if not isinstance(value, str) or len(value) != 8 or value.lower() != value:
            raise fail("RCL_OPENCL_F32_BITS", f"{label} must use eight lowercase hexadecimal digits")
        try:
            bits = int(value, 16)
        except ValueError as error:
            raise fail("RCL_OPENCL_F32_BITS", f"invalid {label} bits {value}") from error
        number = f32_value(bits)
        if not (number == number and abs(number) != float("inf")):
            raise fail("RCL_OPENCL_F32_NONFINITE", f"{label} contains non-finite FP32 bits")
        parsed.append(number)
    return parsed


def bits_hex(bits: int) -> str:
    return f"{bits:04x}"


def tensor_value_root(dtype: str, shape: list[int], bits: list[str]) -> str:
    """Compute the RCL-owned value root used to bind a resident Tensor."""
    digest = hashlib.sha256()
    digest.update(b"rcl.tensor.value-residency.v0.1\0")
    digest.update(dtype.encode("ascii"))
    digest.update(b"\0")
    digest.update(struct.pack("<Q", len(shape)))
    for dimension in shape:
        digest.update(struct.pack("<Q", dimension))
    for value in bits:
        digest.update(value.encode("ascii"))
        digest.update(b"\0")
    return f"sha256:{digest.hexdigest()}"


KERNEL = r"""
#pragma OPENCL FP_CONTRACT OFF
uint rcl_bf16_rne(float value) {
  uint bits = as_uint(value);
  uint lsb = (bits >> 16) & 1;
  return (bits + 0x7fff + lsb) >> 16;
}
float rcl_bf16_to_f32(ushort bits) { return as_float(((uint)bits) << 16); }
__kernel void rcl_bf16_matmul(
    __global const ushort* left,
    __global const ushort* right,
    __global ushort* output,
    uint rows,
    uint columns,
    uint shared
) {
  uint row = get_global_id(0);
  uint column = get_global_id(1);
  if (row >= rows || column >= columns) return;
  float accumulator = 0.0f;
  for (uint inner = 0; inner < shared; inner++) {
    accumulator += rcl_bf16_to_f32(left[row * shared + inner])
                 * rcl_bf16_to_f32(right[inner * columns + column]);
  }
  output[row * columns + column] = (ushort)rcl_bf16_rne(accumulator);
}

__kernel void rcl_bf16_matmul_grad_left(
    __global const ushort* right,
    __global const float* upstream,
    __global float* output,
    uint rows,
    uint columns,
    uint shared,
    uint right_width
) {
  uint row = get_global_id(0);
  uint column = get_global_id(1);
  if (row >= rows || column >= columns) return;
  float accumulator = 0.0f;
  for (uint inner = 0; inner < shared; inner++) {
    accumulator += upstream[row * shared + inner]
                 * rcl_bf16_to_f32(right[column * right_width + inner]);
  }
  output[row * columns + column] = accumulator;
}

__kernel void rcl_bf16_matmul_grad_right(
    __global const ushort* left,
    __global const float* upstream,
    __global float* output,
    uint rows,
    uint columns,
    uint shared,
    uint left_width
) {
  uint row = get_global_id(0);
  uint column = get_global_id(1);
  if (row >= rows || column >= columns) return;
  float accumulator = 0.0f;
  for (uint inner = 0; inner < shared; inner++) {
    accumulator += rcl_bf16_to_f32(left[inner * left_width + row])
                 * upstream[inner * columns + column];
  }
  output[row * columns + column] = accumulator;
}

__kernel void rcl_bf16_masked_softmax(
    __global const ushort* logits,
    __global const ushort* mask,
    __global ushort* output,
    uint rows,
    uint columns
) {
  uint row = get_global_id(0);
  if (row >= rows) return;
  float maximum = -3.402823466e+38f;
  for (uint column = 0; column < columns; column++) {
    float value = rcl_bf16_to_f32(logits[row * columns + column])
                + rcl_bf16_to_f32(mask[row * columns + column]);
    maximum = fmax(maximum, value);
  }
  float sum = 0.0f;
  for (uint column = 0; column < columns; column++) {
    float value = rcl_bf16_to_f32(logits[row * columns + column])
                + rcl_bf16_to_f32(mask[row * columns + column]);
    sum += exp(value - maximum);
  }
  for (uint column = 0; column < columns; column++) {
    float value = rcl_bf16_to_f32(logits[row * columns + column])
                + rcl_bf16_to_f32(mask[row * columns + column]);
    output[row * columns + column] = (ushort)rcl_bf16_rne(exp(value - maximum) / sum);
  }
}

__kernel void rcl_adamw_update(
    __global const float* master,
    __global const float* gradient,
    __global const float* first,
    __global const float* second,
    __global float* next_master,
    __global float* next_first,
    __global float* next_second,
    uint length,
    float beta1,
    float beta2,
    float bias1,
    float bias2,
    float learning_rate,
    float decay,
    float epsilon,
    float clip
) {
  uint index = get_global_id(0);
  if (index >= length) return;
  volatile float grad = clamp(gradient[index], -clip, clip);
  volatile float beta1_complement = 1.0f - beta1;
  volatile float beta2_complement = 1.0f - beta2;
  volatile float first_product = beta1 * first[index];
  volatile float gradient_first_product = beta1_complement * grad;
  volatile float next_m = first_product + gradient_first_product;
  volatile float second_product = beta2 * second[index];
  volatile float gradient_second_product = beta2_complement * grad * grad;
  volatile float next_v = second_product + gradient_second_product;
  volatile float bias_corrected_first = next_m / bias1;
  volatile float bias_corrected_second = next_v / bias2;
  volatile float direction = bias_corrected_first / (sqrt(bias_corrected_second) + epsilon);
  volatile float decayed_weight = master[index] * decay;
  volatile float gradient_step = learning_rate * direction;
  volatile float next_weight = decayed_weight - gradient_step;
  next_master[index] = next_weight;
  next_first[index] = next_m;
  next_second[index] = next_v;
}
"""


def _library() -> ctypes.CDLL:
    try:
        if os.name == "nt":
            return ctypes.WinDLL("OpenCL.dll")
        return ctypes.CDLL("libOpenCL.so.1")
    except OSError as error:
        raise fail(
            "RCL_OPENCL_BACKEND_UNAVAILABLE",
            "OpenCL loader library is unavailable; silent CPU fallback is forbidden",
        ) from error


class OpenCL:
    def __init__(self) -> None:
        self.library = _library()
        self.platform_ids = self._fn(
            "clGetPlatformIDs",
            CLInt,
            [CLUint, ctypes.POINTER(CLHandle), ctypes.POINTER(CLUint)],
        )
        self.platform_info = self._fn(
            "clGetPlatformInfo",
            CLInt,
            [CLHandle, CLUint, CLSize, ctypes.c_void_p, ctypes.POINTER(CLSize)],
        )
        self.device_ids = self._fn(
            "clGetDeviceIDs",
            CLInt,
            [CLHandle, CLUlong, CLUint, ctypes.POINTER(CLHandle), ctypes.POINTER(CLUint)],
        )
        self.device_info = self._fn(
            "clGetDeviceInfo",
            CLInt,
            [CLHandle, CLUint, CLSize, ctypes.c_void_p, ctypes.POINTER(CLSize)],
        )
        self.create_context = self._fn(
            "clCreateContext",
            CLHandle,
            [
                ctypes.POINTER(ctypes.c_ssize_t),
                CLUint,
                ctypes.POINTER(CLHandle),
                ctypes.c_void_p,
                ctypes.c_void_p,
                ctypes.POINTER(CLInt),
            ],
        )
        self.create_command_queue = self._fn(
            "clCreateCommandQueue",
            CLHandle,
            [CLHandle, CLHandle, CLUlong, ctypes.POINTER(CLInt)],
        )
        self.create_program = self._fn(
            "clCreateProgramWithSource",
            CLHandle,
            [
                CLHandle,
                CLUint,
                ctypes.POINTER(ctypes.c_char_p),
                ctypes.POINTER(CLSize),
                ctypes.POINTER(CLInt),
            ],
        )
        self.build_program = self._fn(
            "clBuildProgram",
            CLInt,
            [CLHandle, CLUint, ctypes.POINTER(CLHandle), ctypes.c_char_p, ctypes.c_void_p, ctypes.c_void_p],
        )
        self.program_build_info = self._fn(
            "clGetProgramBuildInfo",
            CLInt,
            [CLHandle, CLHandle, CLUint, CLSize, ctypes.c_void_p, ctypes.POINTER(CLSize)],
        )
        self.create_kernel = self._fn(
            "clCreateKernel",
            CLHandle,
            [CLHandle, ctypes.c_char_p, ctypes.POINTER(CLInt)],
        )
        self.create_buffer = self._fn(
            "clCreateBuffer",
            CLHandle,
            [CLHandle, CLUlong, CLSize, ctypes.c_void_p, ctypes.POINTER(CLInt)],
        )
        self.set_kernel_arg = self._fn(
            "clSetKernelArg",
            CLInt,
            [CLHandle, CLUint, CLSize, ctypes.c_void_p],
        )
        self.enqueue_kernel = self._fn(
            "clEnqueueNDRangeKernel",
            CLInt,
            [
                CLHandle,
                CLHandle,
                CLUint,
                ctypes.POINTER(CLSize),
                ctypes.POINTER(CLSize),
                ctypes.POINTER(CLSize),
                CLUint,
                ctypes.c_void_p,
                ctypes.c_void_p,
            ],
        )
        self.enqueue_write = self._fn(
            "clEnqueueWriteBuffer",
            CLInt,
            [
                CLHandle,
                CLHandle,
                CLBool,
                CLSize,
                CLSize,
                ctypes.c_void_p,
                CLUint,
                ctypes.c_void_p,
                ctypes.c_void_p,
            ],
        )
        self.enqueue_read = self._fn(
            "clEnqueueReadBuffer",
            CLInt,
            [
                CLHandle,
                CLHandle,
                CLBool,
                CLSize,
                CLSize,
                ctypes.c_void_p,
                CLUint,
                ctypes.c_void_p,
                ctypes.c_void_p,
            ],
        )
        self.finish = self._fn("clFinish", CLInt, [CLHandle])
        self.release_mem = self._fn("clReleaseMemObject", CLInt, [CLHandle])
        self.release_kernel = self._fn("clReleaseKernel", CLInt, [CLHandle])
        self.release_program = self._fn("clReleaseProgram", CLInt, [CLHandle])
        self.release_queue = self._fn("clReleaseCommandQueue", CLInt, [CLHandle])
        self.release_context = self._fn("clReleaseContext", CLInt, [CLHandle])

    def _fn(self, name: str, restype: Any, argtypes: list[Any]) -> Any:
        try:
            function = getattr(self.library, name)
        except AttributeError as error:
            raise fail(
                "RCL_OPENCL_SYMBOL_UNAVAILABLE",
                f"OpenCL symbol {name} is unavailable",
            ) from error
        function.restype = restype
        function.argtypes = argtypes
        return function

    def info_string(self, function: Any, handle: CLHandle, key: int) -> str:
        size = CLSize()
        check(function(handle, key, 0, None, ctypes.byref(size)), "OpenCL info size")
        buffer = ctypes.create_string_buffer(max(1, size.value))
        check(
            function(handle, key, len(buffer), ctypes.cast(buffer, ctypes.c_void_p), None),
            "OpenCL info data",
        )
        return buffer.raw.rstrip(b"\0").decode("utf-8", errors="replace")

    def device_receipt(self, platform: CLHandle, device: CLHandle) -> dict[str, str]:
        return {
            "platformName": self.info_string(self.platform_info, platform, CL_PLATFORM_NAME),
            "platformVendor": self.info_string(self.platform_info, platform, CL_PLATFORM_VENDOR),
            "deviceName": self.info_string(self.device_info, device, CL_DEVICE_NAME),
            "deviceVendor": self.info_string(self.device_info, device, CL_DEVICE_VENDOR),
            "deviceVersion": self.info_string(self.device_info, device, CL_DEVICE_VERSION),
            "driverVersion": self.info_string(self.device_info, device, CL_DRIVER_VERSION),
            "extensions": self.info_string(self.device_info, device, CL_DEVICE_EXTENSIONS),
        }

    def build_log(self, program: CLHandle, device: CLHandle) -> str:
        size = CLSize()
        if self.program_build_info(
            program, device, CL_PROGRAM_BUILD_LOG, 0, None, ctypes.byref(size)
        ) != CL_SUCCESS:
            return "unavailable"
        buffer = ctypes.create_string_buffer(max(1, size.value))
        if self.program_build_info(
            program,
            device,
            CL_PROGRAM_BUILD_LOG,
            len(buffer),
            ctypes.cast(buffer, ctypes.c_void_p),
            None,
        ) != CL_SUCCESS:
            return "unavailable"
        return buffer.raw.rstrip(b"\0").decode("utf-8", errors="replace")


def select_amd_device(cl: OpenCL) -> tuple[CLHandle, CLHandle]:
    count = CLUint()
    code = cl.platform_ids(0, None, ctypes.byref(count))
    if code == CL_PLATFORM_NOT_FOUND_KHR:
        raise fail(
            "RCL_OPENCL_BACKEND_UNAVAILABLE",
            "OpenCL loader has no installed platform; silent CPU fallback is forbidden",
        )
    check(code, "clGetPlatformIDs:count")
    if count.value == 0:
        raise fail(
            "RCL_OPENCL_BACKEND_UNAVAILABLE",
            "no OpenCL platform is available; silent CPU fallback is forbidden",
        )
    platforms = (CLHandle * count.value)()
    check(
        cl.platform_ids(count.value, platforms, None),
        "clGetPlatformIDs:data",
    )
    for platform in platforms:
        device_count = CLUint()
        code = cl.device_ids(platform, CL_DEVICE_TYPE_GPU, 0, None, ctypes.byref(device_count))
        if code == CL_DEVICE_NOT_FOUND:
            continue
        check(code, "clGetDeviceIDs:count")
        if device_count.value == 0:
            continue
        devices = (CLHandle * device_count.value)()
        check(
            cl.device_ids(platform, CL_DEVICE_TYPE_GPU, device_count.value, devices, None),
            "clGetDeviceIDs:data",
        )
        for device in devices:
            vendor = cl.info_string(cl.device_info, device, CL_DEVICE_VENDOR).lower()
            if "advanced micro devices" in vendor or "amd" in vendor:
                return CLHandle(platform), CLHandle(device)
    raise fail(
        "RCL_OPENCL_AMD_DEVICE_REQUIRED",
        "no AMD OpenCL GPU device was found; silent CPU fallback is forbidden",
    )


class OpenCLRuntime:
    """One bounded OpenCL context/program reused by a provider session."""

    def __init__(self, buffer_mode: str | None = None) -> None:
        if buffer_mode not in {None, SESSION_BUFFER_ARENA_MODE, TENSOR_RESIDENCY_MODE}:
            raise fail(
                "RCL_OPENCL_BUFFER_ALLOCATION_MODE_UNSUPPORTED",
                f"unsupported OpenCL buffer allocation mode {buffer_mode}",
            )
        self.cl = OpenCL()
        self.platform, self.device = select_amd_device(self.cl)
        self.device_info = self.cl.device_receipt(self.platform, self.device)
        self.buffer_mode = buffer_mode
        self.buffer_pool: dict[tuple[int, int], list[CLHandle]] = {}
        self.pooled_buffer_count = 0
        self.pooled_bytes = 0
        self.peak_pooled_buffers = 0
        self.peak_pooled_bytes = 0
        self.allocation_count = 0
        self.allocation_bytes = 0
        self.reuse_count = 0
        self.release_count = 0
        self.resident_tensors: dict[str, dict[str, Any]] = {}
        self.resident_bytes = 0
        self.tensor_bind_count = 0
        self.tensor_residency_hit_count = 0
        self.tensor_replacement_count = 0
        self.tensor_host_to_device_transfers = 0
        self.tensor_device_to_host_transfers = 0
        self.tensor_release_count = 0
        self.context = self.queue = self.program = None
        try:
            properties = (ctypes.c_ssize_t * 3)(CL_CONTEXT_PLATFORM, self.platform.value, 0)
            code = CLInt()
            self.context = self.cl.create_context(
                properties,
                1,
                ctypes.byref(self.device),
                None,
                None,
                ctypes.byref(code),
            )
            check(code.value, "clCreateContext")
            self.queue = self.cl.create_command_queue(
                self.context,
                self.device,
                0,
                ctypes.byref(code),
            )
            check(code.value, "clCreateCommandQueue")
            source = KERNEL.encode("utf-8")
            source_array = (ctypes.c_char_p * 1)(source)
            lengths = (CLSize * 1)(len(source))
            self.program = self.cl.create_program(
                self.context,
                1,
                source_array,
                lengths,
                ctypes.byref(code),
            )
            check(code.value, "clCreateProgramWithSource")
            build_code = self.cl.build_program(
                self.program,
                1,
                ctypes.byref(self.device),
                b"-cl-fp32-correctly-rounded-divide-sqrt",
                None,
                None,
            )
            if build_code != CL_SUCCESS:
                raise fail(
                    "RCL_OPENCL_KERNEL_BUILD",
                    "clBuildProgram returned OpenCL error "
                    f"{build_code}; build log: {self.cl.build_log(self.program, self.device)}",
                )
        except Exception:
            self.close()
            raise

    def arena_enabled(self) -> bool:
        return self.buffer_mode == SESSION_BUFFER_ARENA_MODE

    def tensor_residency_enabled(self) -> bool:
        return self.buffer_mode == TENSOR_RESIDENCY_MODE

    def acquire_buffer(self, flags: int, size: int) -> CLHandle:
        key = (flags, size)
        pooled = self.buffer_pool.get(key)
        if pooled:
            buffer = pooled.pop()
            if not pooled:
                del self.buffer_pool[key]
            self.pooled_buffer_count -= 1
            self.pooled_bytes -= size
            self.reuse_count += 1
            return buffer
        code = CLInt()
        buffer = self.cl.create_buffer(
            self.context,
            flags,
            size,
            None,
            ctypes.byref(code),
        )
        check(code.value, "clCreateBuffer:arena")
        self.allocation_count += 1
        self.allocation_bytes += size
        return buffer

    def recycle_buffer(self, buffer: CLHandle, flags: int, size: int) -> None:
        if (
            self.arena_enabled()
            and self.pooled_buffer_count < MAX_ARENA_BUFFERS
            and self.pooled_bytes + size <= MAX_ARENA_BYTES
        ):
            self.buffer_pool.setdefault((flags, size), []).append(buffer)
            self.pooled_buffer_count += 1
            self.pooled_bytes += size
            self.peak_pooled_buffers = max(self.peak_pooled_buffers, self.pooled_buffer_count)
            self.peak_pooled_bytes = max(self.peak_pooled_bytes, self.pooled_bytes)
            return
        self.cl.release_mem(buffer)
        self.release_count += 1

    def bind_resident_tensor(
        self,
        identity: str,
        value_root: str,
        dtype: str,
        shape: list[int],
        bits: list[int] | None,
        replace: bool = False,
        previous_value_root: str | None = None,
    ) -> str:
        if not self.tensor_residency_enabled():
            raise fail(
                "RCL_OPENCL_TENSOR_RESIDENCY_UNAVAILABLE",
                "Tensor value residency requires the tensor-residency-v0.1 session mode",
            )
        existing = self.resident_tensors.get(identity)
        if existing is not None:
            if existing["valueRoot"] == value_root:
                if dtype != existing["dtype"] or shape != existing["shape"]:
                    raise fail(
                        "RCL_OPENCL_TENSOR_IDENTITY_MISMATCH",
                        f"resident Tensor {identity} changed dtype or shape without a new identity",
                    )
                if bits is not None and tensor_value_root(dtype, shape, [bits_hex(value) for value in bits]) != value_root:
                    raise fail(
                        "RCL_OPENCL_TENSOR_VALUE_ROOT_MISMATCH",
                        f"resident Tensor {identity} bits do not match valueRoot",
                    )
                self.tensor_residency_hit_count += 1
                return "elided"
            if not replace or previous_value_root != existing["valueRoot"]:
                raise fail(
                    "RCL_OPENCL_TENSOR_VALUE_STALE",
                    f"resident Tensor {identity} has a different valueRoot; explicit replacement is required",
                )
            if bits is None:
                raise fail(
                    "RCL_OPENCL_TENSOR_VALUE_BITS_REQUIRED",
                    f"resident Tensor {identity} replacement requires value bits",
                )
            self._release_resident_tensor(identity)
            self.tensor_replacement_count += 1

        if bits is None:
            raise fail(
                "RCL_OPENCL_TENSOR_VALUE_BITS_REQUIRED",
                f"resident Tensor {identity} requires value bits for its first binding",
            )
        if tensor_value_root(dtype, shape, [bits_hex(value) for value in bits]) != value_root:
            raise fail(
                "RCL_OPENCL_TENSOR_VALUE_ROOT_MISMATCH",
                f"resident Tensor {identity} bits do not match valueRoot",
            )
        size = len(bits) * ctypes.sizeof(ctypes.c_uint16)
        if len(self.resident_tensors) >= MAX_RESIDENT_TENSORS:
            raise fail(
                "RCL_OPENCL_TENSOR_RESIDENCY_LIMIT",
                f"resident Tensor count exceeds {MAX_RESIDENT_TENSORS}",
            )
        if self.resident_bytes + size > MAX_RESIDENT_BYTES:
            raise fail(
                "RCL_OPENCL_TENSOR_RESIDENCY_LIMIT",
                f"resident Tensor bytes exceed {MAX_RESIDENT_BYTES}",
            )
        code = CLInt()
        flags = CL_MEM_READ_ONLY
        buffer = self.cl.create_buffer(
            self.context,
            flags,
            size,
            None,
            ctypes.byref(code),
        )
        check(code.value, "clCreateBuffer:tensor-residency")
        try:
            host_data = (ctypes.c_uint16 * len(bits))(*bits)
            check(
                self.cl.enqueue_write(
                    self.queue,
                    buffer,
                    1,
                    0,
                    size,
                    ctypes.cast(host_data, ctypes.c_void_p),
                    0,
                    None,
                    None,
                ),
                "clEnqueueWriteBuffer:tensor-residency",
            )
            check(self.cl.finish(self.queue), "clFinish:tensor-residency-upload")
        except Exception:
            self.cl.release_mem(buffer)
            raise
        self.resident_tensors[identity] = {
            "buffer": buffer,
            "flags": flags,
            "size": size,
            "dtype": dtype,
            "shape": list(shape),
            "valueRoot": value_root,
        }
        self.resident_bytes += size
        self.allocation_count += 1
        self.allocation_bytes += size
        self.tensor_bind_count += 1
        self.tensor_host_to_device_transfers += 1
        return "uploaded"

    def resident_tensor(self, identity: str, value_root: str) -> dict[str, Any]:
        if not self.tensor_residency_enabled():
            raise fail(
                "RCL_OPENCL_TENSOR_RESIDENCY_UNAVAILABLE",
                "Tensor value residency requires the tensor-residency-v0.1 session mode",
            )
        resident = self.resident_tensors.get(identity)
        if resident is None:
            raise fail(
                "RCL_OPENCL_TENSOR_NOT_RESIDENT",
                f"Tensor {identity} is not resident in this session",
            )
        if resident["valueRoot"] != value_root:
            raise fail(
                "RCL_OPENCL_TENSOR_VALUE_STALE",
                f"resident Tensor {identity} valueRoot does not match the requested value",
            )
        return resident

    def _release_resident_tensor(self, identity: str) -> None:
        resident = self.resident_tensors.pop(identity, None)
        if resident is None:
            raise fail(
                "RCL_OPENCL_TENSOR_NOT_RESIDENT",
                f"Tensor {identity} is not resident in this session",
            )
        self.cl.release_mem(resident["buffer"])
        self.release_count += 1
        self.tensor_release_count += 1
        self.resident_bytes -= resident["size"]

    def release_resident_tensor(self, identity: str, value_root: str) -> None:
        self.resident_tensor(identity, value_root)
        self._release_resident_tensor(identity)

    def session_stats(self) -> dict[str, Any]:
        return {
            "bufferAllocationMode": self.buffer_mode or "per-kernel-v0.1",
            "bufferAllocationCount": self.allocation_count,
            "bufferAllocationBytes": self.allocation_bytes,
            "bufferReuseCount": self.reuse_count,
            "bufferReleaseCount": self.release_count,
            "pooledBufferCount": self.pooled_buffer_count,
            "pooledBytes": self.pooled_bytes,
            "peakPooledBuffers": self.peak_pooled_buffers,
            "peakPooledBytes": self.peak_pooled_bytes,
            "maxArenaBuffers": MAX_ARENA_BUFFERS,
            "maxArenaBytes": MAX_ARENA_BYTES,
            "tensorValueResidency": self.tensor_residency_enabled(),
            "residentTensorCount": len(self.resident_tensors),
            "residentBytes": self.resident_bytes,
            "maxResidentTensors": MAX_RESIDENT_TENSORS,
            "maxResidentBytes": MAX_RESIDENT_BYTES,
            "tensorBindCount": self.tensor_bind_count,
            "tensorResidencyHitCount": self.tensor_residency_hit_count,
            "tensorReplacementCount": self.tensor_replacement_count,
            "tensorHostToDeviceTransfers": self.tensor_host_to_device_transfers,
            "tensorDeviceToHostTransfers": self.tensor_device_to_host_transfers,
            "tensorReleaseCount": self.tensor_release_count,
        }

    def close(self) -> None:
        for resident in self.resident_tensors.values():
            self.cl.release_mem(resident["buffer"])
            self.release_count += 1
            self.tensor_release_count += 1
        self.resident_tensors.clear()
        self.resident_bytes = 0
        for pooled in self.buffer_pool.values():
            for buffer in pooled:
                self.cl.release_mem(buffer)
                self.release_count += 1
        self.buffer_pool.clear()
        self.pooled_buffer_count = 0
        self.pooled_bytes = 0
        if self.program is not None:
            self.cl.release_program(self.program)
            self.program = None
        if self.queue is not None:
            self.cl.release_queue(self.queue)
            self.queue = None
        if self.context is not None:
            self.cl.release_context(self.context)
            self.context = None


def run_opencl_kernel(
    kernel_name: str,
    input_specs: list[tuple[str, list[int] | list[float]]],
    output_specs: list[tuple[str, int]],
    scalar_specs: list[tuple[Any, int | float]],
    global_size: tuple[int, ...],
    runtime: OpenCLRuntime | None = None,
) -> tuple[dict[str, str], list[list[int] | list[float]]]:
    owned_runtime = runtime is None
    active_runtime = runtime or OpenCLRuntime()
    cl = active_runtime.cl
    kernel = None
    buffers: list[tuple[CLHandle, int, int]] = []
    host_outputs: list[Any] = []
    completed = False
    try:
        code = CLInt()
        kernel = cl.create_kernel(active_runtime.program, kernel_name.encode("ascii"), ctypes.byref(code))
        check(code.value, f"clCreateKernel:{kernel_name}")

        for kind, values in input_specs:
            array_type = ctypes.c_uint16 if kind == "u16" else ctypes.c_float
            host_data = (array_type * len(values))(*values)
            size = ctypes.sizeof(host_data)
            flags = CL_MEM_READ_ONLY
            if active_runtime.arena_enabled():
                buffer = active_runtime.acquire_buffer(flags, size)
                buffers.append((buffer, flags, size))
                check(
                    cl.enqueue_write(
                        active_runtime.queue,
                        buffer,
                        1,
                        0,
                        size,
                        ctypes.cast(host_data, ctypes.c_void_p),
                        0,
                        None,
                        None,
                    ),
                    f"clEnqueueWriteBuffer:{kernel_name}:{kind}",
                )
            else:
                buffer = cl.create_buffer(
                    active_runtime.context,
                    flags | CL_MEM_COPY_HOST_PTR,
                    size,
                    ctypes.cast(host_data, ctypes.c_void_p),
                    ctypes.byref(code),
                )
                check(code.value, f"clCreateBuffer:input:{kind}")
                active_runtime.allocation_count += 1
                active_runtime.allocation_bytes += size
                buffers.append((buffer, flags, size))

        for kind, length in output_specs:
            array_type = ctypes.c_uint16 if kind == "u16" else ctypes.c_float
            host_data = (array_type * length)()
            size = ctypes.sizeof(host_data)
            flags = CL_MEM_WRITE_ONLY
            if active_runtime.arena_enabled():
                buffer = active_runtime.acquire_buffer(flags, size)
            else:
                buffer = cl.create_buffer(
                    active_runtime.context,
                    flags,
                    size,
                    None,
                    ctypes.byref(code),
                )
                check(code.value, f"clCreateBuffer:output:{kind}")
                active_runtime.allocation_count += 1
                active_runtime.allocation_bytes += size
            buffers.append((buffer, flags, size))
            host_outputs.append(host_data)

        for index, (buffer, _, _) in enumerate(buffers):
            argument = CLHandle(buffer)
            check(
                cl.set_kernel_arg(kernel, index, ctypes.sizeof(argument), ctypes.byref(argument)),
                f"clSetKernelArg:buffer:{index}",
            )
        for index, (scalar_type, value) in enumerate(scalar_specs, start=len(buffers)):
            argument = scalar_type(value)
            check(
                cl.set_kernel_arg(kernel, index, ctypes.sizeof(argument), ctypes.byref(argument)),
                f"clSetKernelArg:scalar:{index}",
            )

        global_values = (CLSize * len(global_size))(*global_size)
        check(
            cl.enqueue_kernel(active_runtime.queue, kernel, len(global_size), None, global_values, None, 0, None, None),
            f"clEnqueueNDRangeKernel:{kernel_name}",
        )
        check(cl.finish(active_runtime.queue), f"clFinish:{kernel_name}")
        for index, (host_data, (_, length)) in enumerate(zip(host_outputs, output_specs)):
            output_buffer = buffers[len(input_specs) + index][0]
            check(
                cl.enqueue_read(
                    active_runtime.queue,
                    output_buffer,
                    1,
                    0,
                    ctypes.sizeof(host_data),
                    ctypes.cast(host_data, ctypes.c_void_p),
                    0,
                    None,
                    None,
                ),
                f"clEnqueueReadBuffer:{kernel_name}:{index}",
            )
            check(cl.finish(active_runtime.queue), f"clFinish:read:{kernel_name}:{index}")
            if len(host_data) != length:
                raise fail("RCL_OPENCL_SHAPE", f"OpenCL output length mismatch for {kernel_name}")
        completed = True
        return active_runtime.device_info, [list(host_data) for host_data in host_outputs]
    finally:
        for buffer, flags, size in reversed(buffers):
            if completed and active_runtime.arena_enabled():
                active_runtime.recycle_buffer(buffer, flags, size)
            else:
                cl.release_mem(buffer)
                active_runtime.release_count += 1
        if kernel is not None:
            cl.release_kernel(kernel)
        if owned_runtime:
            active_runtime.close()


def _residency_identity(request: dict[str, Any], field: str) -> str:
    value = request.get(field)
    if not isinstance(value, str) or not value or len(value) > 256:
        raise fail("RCL_OPENCL_TENSOR_IDENTITY", f"{field} must be a non-empty identity string")
    return value


def _residency_root(request: dict[str, Any], field: str) -> str:
    value = request.get(field)
    if (
        not isinstance(value, str)
        or len(value) != 71
        or not value.startswith("sha256:")
        or any(character not in "0123456789abcdef" for character in value[7:])
    ):
        raise fail("RCL_OPENCL_TENSOR_VALUE_ROOT", f"{field} must be a canonical sha256 value root")
    return value


def _residency_shape(request: dict[str, Any], field: str = "shape") -> list[int]:
    shape = request.get(field)
    if (
        not isinstance(shape, list)
        or len(shape) != 2
        or any(not isinstance(value, int) or isinstance(value, bool) for value in shape)
        or any(value < 1 or value > MAX_DIMENSION for value in shape)
    ):
        raise fail("RCL_OPENCL_TENSOR_SHAPE", f"{field} must be a rank-2 shape within 1..={MAX_DIMENSION}")
    return [int(value) for value in shape]


def _residency_dtype(request: dict[str, Any]) -> str:
    dtype = request.get("dtype")
    if dtype != "bf16":
        raise fail("RCL_OPENCL_TENSOR_DTYPE", "resident Tensor dtype must be bf16")
    return dtype


def run_tensor_residency_bind(
    request: dict[str, Any],
    runtime: OpenCLRuntime,
) -> dict[str, Any]:
    if request.get("backend") != BACKEND:
        raise fail("RCL_OPENCL_BACKEND_UNAVAILABLE", "requested backend is not opencl-amd; silent CPU fallback is forbidden")
    identity = _residency_identity(request, "tensorIdentity")
    value_root = _residency_root(request, "valueRoot")
    dtype = _residency_dtype(request)
    shape = _residency_shape(request)
    if request.get("access", "read-only") != "read-only":
        raise fail("RCL_OPENCL_TENSOR_ACCESS", "resident Tensor bindings are read-only")
    bits_value = request.get("bits")
    bits = None if bits_value is None else parse_bits(bits_value, f"Tensor {identity}")
    if bits is not None and len(bits) != shape[0] * shape[1]:
        raise fail("RCL_OPENCL_TENSOR_SHAPE", f"Tensor {identity} bit payload length does not match shape")
    replace = request.get("replace", False)
    if not isinstance(replace, bool):
        raise fail("RCL_OPENCL_TENSOR_REPLACEMENT", "replace must be boolean")
    previous_value_root = request.get("previousValueRoot")
    if previous_value_root is not None and (
        not isinstance(previous_value_root, str)
        or len(previous_value_root) != 71
        or not previous_value_root.startswith("sha256:")
        or any(character not in "0123456789abcdef" for character in previous_value_root[7:])
    ):
        raise fail("RCL_OPENCL_TENSOR_VALUE_ROOT", "previousValueRoot must be a canonical sha256 value root")
    transfer = runtime.bind_resident_tensor(
        identity,
        value_root,
        dtype,
        shape,
        bits,
        replace,
        previous_value_root,
    )
    return {
        "format": TENSOR_RESIDENCY_RESULT_FORMAT,
        "status": "PASS_LOCAL_GPU_TENSOR_RESIDENCY_CANDIDATE",
        "backend": BACKEND,
        "gpuExecuted": True,
        "operation": "bind",
        "tensorIdentity": identity,
        "valueRoot": value_root,
        "transfer": transfer,
        "resident": True,
        "device": runtime.device_info,
    }


def run_tensor_residency_release(
    request: dict[str, Any],
    runtime: OpenCLRuntime,
) -> dict[str, Any]:
    if request.get("backend") != BACKEND:
        raise fail("RCL_OPENCL_BACKEND_UNAVAILABLE", "requested backend is not opencl-amd; silent CPU fallback is forbidden")
    identity = _residency_identity(request, "tensorIdentity")
    value_root = _residency_root(request, "valueRoot")
    runtime.release_resident_tensor(identity, value_root)
    return {
        "format": TENSOR_RESIDENCY_RESULT_FORMAT,
        "status": "PASS_LOCAL_GPU_TENSOR_RESIDENCY_CANDIDATE",
        "backend": BACKEND,
        "gpuExecuted": True,
        "operation": "release",
        "tensorIdentity": identity,
        "valueRoot": value_root,
        "resident": False,
        "device": runtime.device_info,
    }


def run_tensor_residency_matmul(
    request: dict[str, Any],
    runtime: OpenCLRuntime,
) -> dict[str, Any]:
    if request.get("backend") != BACKEND:
        raise fail("RCL_OPENCL_BACKEND_UNAVAILABLE", "requested backend is not opencl-amd; silent CPU fallback is forbidden")
    if request.get("readback") is not True:
        raise fail(
            "RCL_OPENCL_TENSOR_READBACK_REQUIRED",
            "the bounded Tensor residency candidate requires an explicit output readback",
        )
    left_identity = _residency_identity(request, "leftTensorIdentity")
    right_identity = _residency_identity(request, "rightTensorIdentity")
    left_root = _residency_root(request, "leftValueRoot")
    right_root = _residency_root(request, "rightValueRoot")
    rows_value = request.get("rows")
    columns_value = request.get("columns")
    shared_value = request.get("shared")
    dimensions = [rows_value, columns_value, shared_value]
    if any(not isinstance(value, int) or isinstance(value, bool) for value in dimensions):
        raise fail("RCL_OPENCL_TENSOR_SHAPE", "resident matmul dimensions must be integers")
    rows, columns, shared = dimensions
    if any(value < 1 or value > MAX_DIMENSION for value in dimensions):
        raise fail("RCL_OPENCL_TENSOR_SHAPE", f"resident matmul dimensions must be within 1..={MAX_DIMENSION}")
    left = runtime.resident_tensor(left_identity, left_root)
    right = runtime.resident_tensor(right_identity, right_root)
    if left["dtype"] != "bf16" or right["dtype"] != "bf16":
        raise fail("RCL_OPENCL_TENSOR_DTYPE", "resident matmul inputs must be bf16")
    if left["shape"] != [rows, shared] or right["shape"] != [shared, columns]:
        raise fail("RCL_OPENCL_TENSOR_SHAPE", "resident matmul input shapes do not match the request")
    output_identity = _residency_identity(request, "outputTensorIdentity")
    node_id = request.get("nodeId", output_identity)
    if not isinstance(node_id, str) or not node_id or len(node_id) > 256:
        raise fail("RCL_OPENCL_TENSOR_IDENTITY", "nodeId must be a non-empty identity string")

    cl = runtime.cl
    kernel = None
    output_buffer = None
    code = CLInt()
    output_size = rows * columns * ctypes.sizeof(ctypes.c_uint16)
    try:
        kernel = cl.create_kernel(runtime.program, b"rcl_bf16_matmul", ctypes.byref(code))
        check(code.value, "clCreateKernel:tensor-residency-matmul")
        output_buffer = cl.create_buffer(
            runtime.context,
            CL_MEM_WRITE_ONLY,
            output_size,
            None,
            ctypes.byref(code),
        )
        check(code.value, "clCreateBuffer:tensor-residency-output")
        buffers = [left["buffer"], right["buffer"], output_buffer]
        for index, buffer in enumerate(buffers):
            argument = CLHandle(buffer)
            check(
                cl.set_kernel_arg(kernel, index, ctypes.sizeof(argument), ctypes.byref(argument)),
                f"clSetKernelArg:tensor-residency:{index}",
            )
        for index, value in enumerate((rows, columns, shared), start=len(buffers)):
            argument = CLUint(value)
            check(
                cl.set_kernel_arg(kernel, index, ctypes.sizeof(argument), ctypes.byref(argument)),
                f"clSetKernelArg:tensor-residency:scalar:{index}",
            )
        global_values = (CLSize * 2)(rows, columns)
        check(
            cl.enqueue_kernel(runtime.queue, kernel, 2, None, global_values, None, 0, None, None),
            "clEnqueueNDRangeKernel:tensor-residency-matmul",
        )
        check(cl.finish(runtime.queue), "clFinish:tensor-residency-matmul")
        host_output = (ctypes.c_uint16 * (rows * columns))()
        check(
            cl.enqueue_read(
                runtime.queue,
                output_buffer,
                1,
                0,
                output_size,
                ctypes.cast(host_output, ctypes.c_void_p),
                0,
                None,
                None,
            ),
            "clEnqueueReadBuffer:tensor-residency-matmul",
        )
        check(cl.finish(runtime.queue), "clFinish:read:tensor-residency-matmul")
        output_bits = [int(value) for value in host_output]
        if any(bits & 0x7F80 == 0x7F80 for bits in output_bits):
            raise fail("RCL_OPENCL_BF16_NONFINITE", "resident OpenCL BF16 output is non-finite")
        runtime.allocation_count += 1
        runtime.allocation_bytes += output_size
        runtime.release_count += 1
        runtime.tensor_device_to_host_transfers += 1
    finally:
        if output_buffer is not None:
            cl.release_mem(output_buffer)
        if kernel is not None:
            cl.release_kernel(kernel)
    output_hex = [bits_hex(bits) for bits in output_bits]
    digest = hashlib.sha256()
    digest.update(b"rcl.opencl-bf16-tensor-residency-matmul-v0.1\0")
    digest.update(runtime.device_info["deviceName"].encode("utf-8"))
    digest.update(node_id.encode("utf-8"))
    digest.update(left_identity.encode("utf-8"))
    digest.update(left_root.encode("ascii"))
    digest.update(right_identity.encode("utf-8"))
    digest.update(right_root.encode("ascii"))
    digest.update(output_identity.encode("utf-8"))
    for bits in output_hex:
        digest.update(bits.encode("ascii"))
    return {
        "format": TENSOR_RESIDENCY_RESULT_FORMAT,
        "status": "PASS_LOCAL_GPU_TENSOR_RESIDENCY_CANDIDATE",
        "backend": BACKEND,
        "gpuExecuted": True,
        "operation": "matmul",
        "nodeId": node_id,
        "leftTensorIdentity": left_identity,
        "rightTensorIdentity": right_identity,
        "outputTensorIdentity": output_identity,
        "outputBits": output_hex,
        "executionRoot": digest.hexdigest(),
        "readback": True,
        "device": runtime.device_info,
    }


def _graph_node_id(node: dict[str, Any]) -> str:
    value = node.get("nodeId")
    if not isinstance(value, str) or not value or len(value) > 256:
        raise fail("RCL_OPENCL_TENSOR_GRAPH_IDENTITY", "graph nodeId must be a non-empty identity string")
    return value


def _graph_resource_id(node: dict[str, Any]) -> str:
    return _residency_identity(node, "outputResource")


def _graph_dimensions(node: dict[str, Any]) -> tuple[int, int, int]:
    values = [node.get("rows"), node.get("columns"), node.get("shared")]
    if any(not isinstance(value, int) or isinstance(value, bool) for value in values):
        raise fail("RCL_OPENCL_TENSOR_GRAPH_SHAPE", "graph matmul dimensions must be integers")
    rows, columns, shared = values
    if any(value < 1 or value > MAX_DIMENSION for value in values):
        raise fail(
            "RCL_OPENCL_TENSOR_GRAPH_SHAPE",
            f"graph matmul dimensions must be within 1..={MAX_DIMENSION}",
        )
    return rows, columns, shared


def _graph_input(
    node: dict[str, Any],
    side: str,
    runtime: OpenCLRuntime,
    resources: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any], str]:
    resource_field = f"{side}Resource"
    tensor_field = f"{side}TensorIdentity"
    root_field = f"{side}ValueRoot"
    if resource_field in node:
        if tensor_field in node or root_field in node:
            raise fail(
                "RCL_OPENCL_TENSOR_GRAPH_INPUT",
                f"{side} input cannot mix a resource reference with a Tensor identity",
            )
        resource_id = _residency_identity(node, resource_field)
        resource = resources.get(resource_id)
        if resource is None:
            raise fail(
                "RCL_OPENCL_TENSOR_GRAPH_RESOURCE",
                f"{side} resource {resource_id} is not available at this graph point",
            )
        return resource, resource_id
    identity = _residency_identity(node, tensor_field)
    value_root = _residency_root(node, root_field)
    return runtime.resident_tensor(identity, value_root), f"tensor:{identity}:{value_root}"


def run_tensor_residency_graph(
    request: dict[str, Any],
    runtime: OpenCLRuntime,
) -> dict[str, Any]:
    if request.get("backend") != BACKEND:
        raise fail(
            "RCL_OPENCL_BACKEND_UNAVAILABLE",
            "requested backend is not opencl-amd; silent CPU fallback is forbidden",
        )
    nodes = request.get("nodes")
    if (
        not isinstance(nodes, list)
        or len(nodes) < 2
        or len(nodes) > MAX_GRAPH_OPERATIONS
        or any(not isinstance(node, dict) for node in nodes)
    ):
        raise fail(
            "RCL_OPENCL_TENSOR_GRAPH_LIMIT",
            f"graph nodes must contain 2..={MAX_GRAPH_OPERATIONS} objects",
        )
    resources: dict[str, dict[str, Any]] = {}
    receipts: list[dict[str, Any]] = []
    output_bits: list[int] | None = None
    output_resource = ""
    digest = hashlib.sha256()
    digest.update(b"rcl.opencl-bf16-tensor-graph-residency-v0.1\0")
    digest.update(runtime.device_info["deviceName"].encode("utf-8"))
    try:
        for index, node in enumerate(nodes):
            node_id = _graph_node_id(node)
            output_resource = _graph_resource_id(node)
            if output_resource in resources:
                raise fail(
                    "RCL_OPENCL_TENSOR_GRAPH_RESOURCE",
                    f"graph outputResource {output_resource} is duplicated",
                )
            readback = node.get("readback", False)
            if not isinstance(readback, bool):
                raise fail("RCL_OPENCL_TENSOR_GRAPH_READBACK", "graph readback must be boolean")
            if index < len(nodes) - 1 and readback:
                raise fail(
                    "RCL_OPENCL_TENSOR_GRAPH_READBACK",
                    "only the final graph node may request a readback",
                )
            if index == len(nodes) - 1 and readback is not True:
                raise fail(
                    "RCL_OPENCL_TENSOR_GRAPH_READBACK",
                    "the final graph node requires an explicit readback",
                )
            rows, columns, shared = _graph_dimensions(node)
            left, left_ref = _graph_input(node, "left", runtime, resources)
            right, right_ref = _graph_input(node, "right", runtime, resources)
            if left.get("dtype") != "bf16" or right.get("dtype") != "bf16":
                raise fail("RCL_OPENCL_TENSOR_DTYPE", "graph matmul inputs must be bf16")
            if left.get("shape") != [rows, shared] or right.get("shape") != [shared, columns]:
                raise fail(
                    "RCL_OPENCL_TENSOR_GRAPH_SHAPE",
                    f"graph node {node_id} input shapes do not match its dimensions",
                )
            output_size = rows * columns * ctypes.sizeof(ctypes.c_uint16)
            if output_size > MAX_GRAPH_BYTES:
                raise fail("RCL_OPENCL_TENSOR_GRAPH_LIMIT", "graph output exceeds the bounded byte budget")
            cl = runtime.cl
            kernel = None
            output_buffer = None
            try:
                code = CLInt()
                kernel = cl.create_kernel(runtime.program, b"rcl_bf16_matmul", ctypes.byref(code))
                check(code.value, "clCreateKernel:tensor-graph-residency")
                output_buffer = cl.create_buffer(
                    runtime.context,
                    CL_MEM_READ_WRITE,
                    output_size,
                    None,
                    ctypes.byref(code),
                )
                check(code.value, "clCreateBuffer:tensor-graph-residency-output")
                runtime.allocation_count += 1
                runtime.allocation_bytes += output_size
                buffers = [left["buffer"], right["buffer"], output_buffer]
                for argument_index, buffer in enumerate(buffers):
                    argument = CLHandle(buffer)
                    check(
                        cl.set_kernel_arg(
                            kernel,
                            argument_index,
                            ctypes.sizeof(argument),
                            ctypes.byref(argument),
                        ),
                        f"clSetKernelArg:tensor-graph-residency:{argument_index}",
                    )
                for argument_index, value in enumerate((rows, columns, shared), start=len(buffers)):
                    argument = CLUint(value)
                    check(
                        cl.set_kernel_arg(
                            kernel,
                            argument_index,
                            ctypes.sizeof(argument),
                            ctypes.byref(argument),
                        ),
                        f"clSetKernelArg:tensor-graph-residency:scalar:{argument_index}",
                    )
                global_values = (CLSize * 2)(rows, columns)
                check(
                    cl.enqueue_kernel(runtime.queue, kernel, 2, None, global_values, None, 0, None, None),
                    "clEnqueueNDRangeKernel:tensor-graph-residency",
                )
                check(cl.finish(runtime.queue), "clFinish:tensor-graph-residency")
                resources[output_resource] = {
                    "buffer": output_buffer,
                    "size": output_size,
                    "dtype": "bf16",
                    "shape": [rows, columns],
                    "resourceId": output_resource,
                }
                output_buffer = None
                if readback:
                    host_output = (ctypes.c_uint16 * (rows * columns))()
                    check(
                        cl.enqueue_read(
                            runtime.queue,
                            resources[output_resource]["buffer"],
                            1,
                            0,
                            output_size,
                            ctypes.cast(host_output, ctypes.c_void_p),
                            0,
                            None,
                            None,
                        ),
                        "clEnqueueReadBuffer:tensor-graph-residency-final",
                    )
                    check(cl.finish(runtime.queue), "clFinish:read:tensor-graph-residency-final")
                    output_bits = [int(value) for value in host_output]
                    if any(bits & 0x7F80 == 0x7F80 for bits in output_bits):
                        raise fail("RCL_OPENCL_BF16_NONFINITE", "graph OpenCL BF16 output is non-finite")
                    runtime.tensor_device_to_host_transfers += 1
                digest.update(node_id.encode("utf-8"))
                digest.update(output_resource.encode("utf-8"))
                digest.update(left_ref.encode("utf-8"))
                digest.update(right_ref.encode("utf-8"))
                digest.update(bytes((rows, columns, shared)))
                receipts.append({
                    "nodeId": node_id,
                    "operation": "matmul",
                    "left": left_ref,
                    "right": right_ref,
                    "outputResource": output_resource,
                    "shape": [rows, columns],
                    "readback": readback,
                    "deviceResidentAfter": index < len(nodes) - 1,
                })
            except Exception:
                if output_buffer is not None:
                    cl.release_mem(output_buffer)
                    runtime.release_count += 1
                raise
            finally:
                if kernel is not None:
                    cl.release_kernel(kernel)
    finally:
        for resource in resources.values():
            runtime.cl.release_mem(resource["buffer"])
            runtime.release_count += 1
        resources.clear()
    if output_bits is None:
        raise fail("RCL_OPENCL_TENSOR_GRAPH_READBACK", "graph did not produce a final readback")
    output_hex = [bits_hex(bits) for bits in output_bits]
    for bits in output_hex:
        digest.update(bits.encode("ascii"))
    return {
        "format": TENSOR_RESIDENCY_RESULT_FORMAT,
        "status": "PASS_LOCAL_GPU_TENSOR_RESIDENCY_CANDIDATE",
        "backend": BACKEND,
        "gpuExecuted": True,
        "operation": "graph",
        "nodes": receipts,
        "outputResource": output_resource,
        "outputBits": output_hex,
        "executionRoot": digest.hexdigest(),
        "readback": True,
        "intermediateReadbackCount": 0,
        "finalReadbackCount": 1,
        "resourceCount": len(receipts),
        "releasedResourceCount": len(receipts),
        "device": runtime.device_info,
    }


def run_tensor_residency(
    request: dict[str, Any],
    runtime: OpenCLRuntime,
) -> dict[str, Any]:
    if request.get("format") != TENSOR_RESIDENCY_REQUEST_FORMAT:
        raise fail("RCL_OPENCL_REQUEST_FORMAT", "unsupported OpenCL Tensor residency request format")
    if not runtime.tensor_residency_enabled():
        raise fail(
            "RCL_OPENCL_TENSOR_RESIDENCY_UNAVAILABLE",
            "Tensor value residency requires the tensor-residency-v0.1 session mode",
        )
    operation = request.get("operation")
    if operation == "bind":
        return run_tensor_residency_bind(request, runtime)
    if operation == "release":
        return run_tensor_residency_release(request, runtime)
    if operation == "matmul":
        return run_tensor_residency_matmul(request, runtime)
    if operation == "graph":
        return run_tensor_residency_graph(request, runtime)
    raise fail("RCL_OPENCL_TENSOR_OPERATION", "Tensor residency operation must be bind, matmul, graph or release")


def gradient_dimensions(request: dict[str, Any]) -> tuple[int, int, int, int]:
    values = [request.get("leftRows"), request.get("leftColumns"), request.get("rightRows"), request.get("rightColumns")]
    if any(not isinstance(value, int) or isinstance(value, bool) for value in values):
        raise fail("RCL_OPENCL_SHAPE", "gradient matrix dimensions must be integers")
    left_rows, left_columns, right_rows, right_columns = values
    if any(value < 1 or value > MAX_DIMENSION for value in values):
        raise fail("RCL_OPENCL_SHAPE", "gradient matrix dimensions must be within 1..=64")
    if left_columns != right_rows:
        raise fail("RCL_OPENCL_SHAPE", "gradient matrix inner dimensions do not match")
    return left_rows, left_columns, right_rows, right_columns


def gradient_result(
    operation: str,
    device: dict[str, str],
    output: list[float],
    rows: int,
    columns: int,
) -> dict[str, Any]:
    output_hex = [f"{f32_bits(value):08x}" for value in output]
    digest = hashlib.sha256()
    digest.update(b"rcl.opencl-bf16-matmul-gradient-v0.1\0")
    digest.update(operation.encode("ascii"))
    digest.update(device["deviceName"].encode("utf-8"))
    for bits in output_hex:
        digest.update(bits.encode("ascii"))
    return {
        "format": GRADIENT_RESULT_FORMAT,
        "status": "PASS_LOCAL_GPU_GRADIENT_REFERENCE_CANDIDATE",
        "backend": BACKEND,
        "gpuExecuted": True,
        "gpuClaim": False,
        "operation": operation,
        "device": device,
        "shape": [rows, columns],
        "outputBits": output_hex,
        "outputData": [f32_value(int(bits, 16)) for bits in output_hex],
        "executionRoot": digest.hexdigest(),
    }


def run_gradient(
    request: dict[str, Any],
    runtime: OpenCLRuntime | None = None,
) -> dict[str, Any]:
    if request.get("format") != GRADIENT_REQUEST_FORMAT:
        raise fail("RCL_OPENCL_REQUEST_FORMAT", "unsupported OpenCL BF16 gradient request format")
    if request.get("backend") != BACKEND:
        raise fail("RCL_OPENCL_BACKEND_UNAVAILABLE", "requested backend is not opencl-amd; silent CPU fallback is forbidden")
    operation = request.get("operation")
    if operation not in ("left-gradient", "right-gradient"):
        raise fail("RCL_OPENCL_OPERATION", "gradient operation must be left-gradient or right-gradient")
    left_rows, left_columns, right_rows, right_columns = gradient_dimensions(request)
    left = parse_bits(request.get("leftBits"), "left",)
    right = parse_bits(request.get("rightBits"), "right")
    upstream = parse_f32_bits(request.get("upstreamF32Bits"), "upstream", left_rows * right_columns)
    if len(left) != left_rows * left_columns or len(right) != right_rows * right_columns:
        raise fail("RCL_OPENCL_SHAPE", "BF16 bit payload length does not match gradient matrix shape")
    if operation == "left-gradient":
        rows, columns, shared = left_rows, left_columns, right_columns
        device, outputs = run_opencl_kernel(
            "rcl_bf16_matmul_grad_left",
            [("u16", right), ("f32", upstream)],
            [("f32", rows * columns)],
            [(CLUint, rows), (CLUint, columns), (CLUint, shared), (CLUint, right_columns)],
            (rows, columns),
            runtime,
        )
    else:
        rows, columns, shared = left_columns, right_columns, left_rows
        device, outputs = run_opencl_kernel(
            "rcl_bf16_matmul_grad_right",
            [("u16", left), ("f32", upstream)],
            [("f32", rows * columns)],
            [(CLUint, rows), (CLUint, columns), (CLUint, shared), (CLUint, left_columns)],
            (rows, columns),
            runtime,
        )
    return gradient_result(operation, device, outputs[0], rows, columns)


def run_adamw(
    request: dict[str, Any],
    runtime: OpenCLRuntime | None = None,
) -> dict[str, Any]:
    if request.get("format") != ADAMW_REQUEST_FORMAT:
        raise fail("RCL_OPENCL_REQUEST_FORMAT", "unsupported OpenCL AdamW request format")
    if request.get("backend") != BACKEND:
        raise fail("RCL_OPENCL_BACKEND_UNAVAILABLE", "requested backend is not opencl-amd; silent CPU fallback is forbidden")
    length = request.get("length")
    if not isinstance(length, int) or isinstance(length, bool) or length < 1 or length > MAX_ELEMENTS:
        raise fail("RCL_OPENCL_SHAPE", f"AdamW length must be within 1..={MAX_ELEMENTS}")
    master = parse_f32_bits(request.get("masterBits"), "master", length)
    gradient = parse_f32_bits(request.get("gradientBits"), "gradient", length)
    first = parse_f32_bits(request.get("firstMomentBits"), "firstMoment", length)
    second = parse_f32_bits(request.get("secondMomentBits"), "secondMoment", length)
    scalar_names = ["beta1", "beta2", "bias1", "bias2", "learningRate", "decay", "epsilon", "gradientClip"]
    scalars: dict[str, float] = {}
    for name in scalar_names:
        value = request.get(name)
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not (value == value and abs(value) != float("inf")):
            raise fail("RCL_OPENCL_F32_NONFINITE", f"AdamW scalar {name} must be finite")
        scalars[name] = float(value)
    if scalars["bias1"] <= 0 or scalars["bias2"] <= 0 or scalars["learningRate"] <= 0 or scalars["epsilon"] <= 0 or scalars["gradientClip"] <= 0:
        raise fail("RCL_OPENCL_ADAMW_CONFIG", "AdamW positive scalars are required")
    device, outputs = run_opencl_kernel(
        "rcl_adamw_update",
        [("f32", master), ("f32", gradient), ("f32", first), ("f32", second)],
        [("f32", length), ("f32", length), ("f32", length)],
        [
            (CLUint, length),
            (ctypes.c_float, scalars["beta1"]),
            (ctypes.c_float, scalars["beta2"]),
            (ctypes.c_float, scalars["bias1"]),
            (ctypes.c_float, scalars["bias2"]),
            (ctypes.c_float, scalars["learningRate"]),
            (ctypes.c_float, scalars["decay"]),
            (ctypes.c_float, scalars["epsilon"]),
            (ctypes.c_float, scalars["gradientClip"]),
        ],
        (length,),
        runtime,
    )
    output_hex = [[f"{f32_bits(value):08x}" for value in output] for output in outputs]
    digest = hashlib.sha256()
    digest.update(b"rcl.opencl-adamw-update-v0.1\0")
    digest.update(device["deviceName"].encode("utf-8"))
    for values in output_hex:
        for bits in values:
            digest.update(bits.encode("ascii"))
    return {
        "format": ADAMW_RESULT_FORMAT,
        "status": "PASS_LOCAL_GPU_ADAMW_REFERENCE_CANDIDATE",
        "backend": BACKEND,
        "gpuExecuted": True,
        "gpuClaim": False,
        "device": device,
        "masterBits": output_hex[0],
        "firstMomentBits": output_hex[1],
        "secondMomentBits": output_hex[2],
        "masterData": [f32_value(int(bits, 16)) for bits in output_hex[0]],
        "firstMomentData": [f32_value(int(bits, 16)) for bits in output_hex[1]],
        "secondMomentData": [f32_value(int(bits, 16)) for bits in output_hex[2]],
        "executionRoot": digest.hexdigest(),
    }


def run_masked_softmax(
    request: dict[str, Any],
    runtime: OpenCLRuntime | None = None,
) -> dict[str, Any]:
    if request.get("format") != MASKED_SOFTMAX_REQUEST_FORMAT:
        raise fail("RCL_OPENCL_REQUEST_FORMAT", "unsupported OpenCL masked softmax request format")
    if request.get("backend") != BACKEND:
        raise fail("RCL_OPENCL_BACKEND_UNAVAILABLE", "requested backend is not opencl-amd; silent CPU fallback is forbidden")
    if request.get("operation") != "masked-softmax":
        raise fail("RCL_OPENCL_OPERATION", "masked softmax operation must be masked-softmax")
    if request.get("maskMode") != "additive":
        raise fail("RCL_OPENCL_MASK_MODE", "masked softmax requires an explicit additive mask mode")
    dimensions = [request.get("rows"), request.get("columns")]
    if any(not isinstance(value, int) or isinstance(value, bool) for value in dimensions):
        raise fail("RCL_OPENCL_SHAPE", "masked softmax dimensions must be integers")
    rows, columns = dimensions
    if any(value < 1 or value > MAX_DIMENSION for value in dimensions):
        raise fail("RCL_OPENCL_SHAPE", "masked softmax dimensions must be within 1..=64")
    logits = parse_bits(request.get("logitsBits"), "logits")
    mask = parse_bits(request.get("maskBits"), "mask")
    expected = rows * columns
    if len(logits) != expected or len(mask) != expected:
        raise fail("RCL_OPENCL_SHAPE", "masked softmax bit payload lengths must match rows*columns")
    for index, (logit_bits, mask_bits) in enumerate(zip(logits, mask)):
        combined = ctypes.c_float(bf16_value(logit_bits) + bf16_value(mask_bits)).value
        if not (combined == combined and abs(combined) != float("inf")):
            raise fail("RCL_OPENCL_F32_NONFINITE", f"masked softmax additive value at index {index} is non-finite")
    device, outputs = run_opencl_kernel(
        "rcl_bf16_masked_softmax",
        [("u16", logits), ("u16", mask)],
        [("u16", expected)],
        [(CLUint, rows), (CLUint, columns)],
        (rows,),
        runtime,
    )
    output_bits = [int(value) for value in outputs[0]]
    if any(bits & 0x7F80 == 0x7F80 for bits in output_bits):
        raise fail("RCL_OPENCL_BF16_NONFINITE", "OpenCL masked softmax output is non-finite")
    output_hex = [bits_hex(bits) for bits in output_bits]
    digest = hashlib.sha256()
    digest.update(b"rcl.opencl-bf16-masked-softmax-v0.1\0")
    digest.update(device["deviceName"].encode("utf-8"))
    digest.update(struct.pack("<II", rows, columns))
    for bits in logits:
        digest.update(bits_hex(bits).encode("ascii"))
    for bits in mask:
        digest.update(bits_hex(bits).encode("ascii"))
    for bits in output_hex:
        digest.update(bits.encode("ascii"))
    return {
        "format": MASKED_SOFTMAX_RESULT_FORMAT,
        "status": "PASS_LOCAL_GPU_MASKED_SOFTMAX_CANDIDATE",
        "backend": BACKEND,
        "gpuExecuted": True,
        "gpuClaim": False,
        "operation": "masked-softmax",
        "maskMode": "additive",
        "inputDtype": "bf16",
        "computeDtype": "f32",
        "outputDtype": "bf16",
        "rows": rows,
        "columns": columns,
        "device": device,
        "outputBits": output_hex,
        "outputData": [bf16_value(bits) for bits in output_bits],
        "executionRoot": digest.hexdigest(),
    }


def run_batch(
    request: dict[str, Any],
    runtime: OpenCLRuntime | None = None,
) -> dict[str, Any]:
    """Lower a bounded ordered batch through one persistent OpenCL runtime.

    The batch is only a transport/dispatch optimization. Each child operation
    still uses its own kernel and input/output buffers, and the child response
    roots remain the authoritative operation receipts.
    """
    if request.get("format") != BATCH_REQUEST_FORMAT:
        raise fail("RCL_OPENCL_REQUEST_FORMAT", "unsupported OpenCL batch request format")
    if request.get("backend") != BACKEND:
        raise fail("RCL_OPENCL_BACKEND_UNAVAILABLE", "requested backend is not opencl-amd; silent CPU fallback is forbidden")
    requests = request.get("requests")
    if not isinstance(requests, list) or not requests:
        raise fail("RCL_OPENCL_BATCH", "batch requests must be a non-empty array")
    if len(requests) > MAX_BATCH_REQUESTS:
        raise fail("RCL_OPENCL_BATCH", f"batch requests must contain at most {MAX_BATCH_REQUESTS} operations")
    if any(not isinstance(item, dict) for item in requests):
        raise fail("RCL_OPENCL_BATCH", "batch requests must contain JSON objects")
    responses = [run(item, runtime) for item in requests]
    digest = hashlib.sha256()
    digest.update(b"rcl.opencl-amd-batch-v0.1\0")
    for response in responses:
        root = response.get("executionRoot")
        if not isinstance(root, str):
            raise fail("RCL_OPENCL_BATCH", "batch child response omitted executionRoot")
        digest.update(root.encode("ascii"))
    return {
        "format": BATCH_RESULT_FORMAT,
        "status": "PASS_LOCAL_GPU_BATCH_REFERENCE_CANDIDATE",
        "backend": BACKEND,
        "gpuExecuted": True,
        "gpuClaim": False,
        "operationCount": len(responses),
        "responses": responses,
        "executionRoot": digest.hexdigest(),
    }


def run(request: dict[str, Any], runtime: OpenCLRuntime | None = None) -> dict[str, Any]:
    request_format = request.get("format")
    if request_format == TENSOR_RESIDENCY_REQUEST_FORMAT:
        if runtime is None:
            raise fail(
                "RCL_OPENCL_TENSOR_RESIDENCY_UNAVAILABLE",
                "Tensor value residency requires a persistent provider session",
            )
        return run_tensor_residency(request, runtime)
    if request_format == BATCH_REQUEST_FORMAT:
        return run_batch(request, runtime)
    if request_format == GRADIENT_REQUEST_FORMAT:
        return run_gradient(request, runtime)
    if request_format == ADAMW_REQUEST_FORMAT:
        return run_adamw(request, runtime)
    if request_format == MASKED_SOFTMAX_REQUEST_FORMAT:
        return run_masked_softmax(request, runtime)
    if request_format != REQUEST_FORMAT:
        raise fail("RCL_OPENCL_REQUEST_FORMAT", "unsupported OpenCL BF16 request format")
    if request.get("backend") != BACKEND:
        raise fail(
            "RCL_OPENCL_BACKEND_UNAVAILABLE",
            "requested backend is not opencl-amd; silent CPU fallback is forbidden",
        )
    dimensions = [request.get("rows"), request.get("columns"), request.get("shared")]
    if any(not isinstance(value, int) or isinstance(value, bool) for value in dimensions):
        raise fail("RCL_OPENCL_SHAPE", "matrix dimensions must be integers")
    rows, columns, shared = dimensions
    if any(value < 1 or value > MAX_DIMENSION for value in dimensions):
        raise fail("RCL_OPENCL_SHAPE", "matrix dimensions must be within 1..=64")
    left = parse_bits(request.get("leftBits"), "left")
    right = parse_bits(request.get("rightBits"), "right")
    if len(left) != rows * shared or len(right) != shared * columns:
        raise fail("RCL_OPENCL_SHAPE", "BF16 bit payload length does not match matrix shape")

    device, outputs = run_opencl_kernel(
        "rcl_bf16_matmul",
        [("u16", left), ("u16", right)],
        [("u16", rows * columns)],
        [(CLUint, rows), (CLUint, columns), (CLUint, shared)],
        (rows, columns),
        runtime,
    )
    output_bits = [int(value) for value in outputs[0]]
    if any(bits & 0x7F80 == 0x7F80 for bits in output_bits):
        raise fail("RCL_OPENCL_BF16_NONFINITE", "OpenCL BF16 output is non-finite")
    output_hex = [bits_hex(bits) for bits in output_bits]
    digest = hashlib.sha256()
    digest.update(b"rcl.opencl-bf16-matmul-v0.1\0")
    digest.update(device["deviceName"].encode("utf-8"))
    for bits in output_hex:
        digest.update(bits.encode("ascii"))
    return {
        "format": RESULT_FORMAT,
        "status": "PASS_LOCAL_GPU_REFERENCE_CANDIDATE",
        "backend": BACKEND,
        "gpuExecuted": True,
        "gpuClaim": False,
        "device": device,
        "outputBits": output_hex,
        "outputData": [bf16_value(bits) for bits in output_bits],
        "executionRoot": digest.hexdigest(),
    }


def serve_session(buffer_mode: str | None = None) -> int:
    """Serve newline-delimited requests while reusing one OpenCL runtime."""
    runtime: OpenCLRuntime | None = None
    for raw in sys.stdin:
        if not raw.strip():
            continue
        try:
            request = json.loads(raw)
            if runtime is None:
                runtime = OpenCLRuntime(buffer_mode)
            if request.get("format") == SESSION_CLOSE_REQUEST_FORMAT:
                runtime.close()
                response = {
                    "format": SESSION_CLOSE_RESULT_FORMAT,
                    "status": "PASS_LOCAL_GPU_SESSION_CLOSE_CANDIDATE",
                    "backend": BACKEND,
                    "closed": True,
                    "sessionStats": runtime.session_stats(),
                }
                runtime = None
            else:
                response = run(request, runtime)
        except ProviderError as error:
            response = {"status": "error", "code": error.code, "message": error.message}
            if error.code in {
                "RCL_OPENCL_BACKEND_UNAVAILABLE",
                "RCL_OPENCL_AMD_DEVICE_REQUIRED",
                "RCL_OPENCL_SYMBOL_UNAVAILABLE",
                "RCL_OPENCL_KERNEL_BUILD",
            }:
                if runtime is not None:
                    runtime.close()
                runtime = None
        except (OSError, json.JSONDecodeError, TypeError, ValueError) as error:
            response = {"status": "error", "code": "RCL_OPENCL_REQUEST", "message": str(error)}
        if runtime is not None:
            response["sessionStats"] = runtime.session_stats()
        print(json.dumps(response, separators=(",", ":"), ensure_ascii=False), flush=True)
    if runtime is not None:
        runtime.close()
    return 0


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "--session":
        if len(sys.argv) == 2:
            return serve_session()
        if len(sys.argv) == 4 and sys.argv[2] == "--buffer-mode":
            return serve_session(sys.argv[3])
        print(
            json.dumps({
                "status": "error",
                "code": "RCL_OPENCL_REQUEST",
                "message": "session accepts only --buffer-mode <mode>",
            }),
            file=sys.stderr,
        )
        return 2
    try:
        argument = sys.argv[1] if len(sys.argv) > 1 else "-"
        raw = sys.stdin.read() if argument == "-" else open(argument, encoding="utf-8").read()
        request = json.loads(raw)
        response = run(request)
        print(json.dumps(response, separators=(",", ":"), ensure_ascii=False))
        return 0
    except ProviderError as error:
        print(json.dumps({"status": "error", "code": error.code, "message": error.message}), file=sys.stderr)
        return 1
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as error:
        print(json.dumps({"status": "error", "code": "RCL_OPENCL_REQUEST", "message": str(error)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
