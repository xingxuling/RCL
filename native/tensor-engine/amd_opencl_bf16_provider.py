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
import sys
from typing import Any


REQUEST_FORMAT = "rcl.opencl-bf16-matmul-request.v0.1"
RESULT_FORMAT = "rcl.opencl-bf16-matmul-result.v0.1"
BACKEND = "opencl-amd"
MAX_DIMENSION = 64

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


def bits_hex(bits: int) -> str:
    return f"{bits:04x}"


KERNEL = r"""
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


def run(request: dict[str, Any]) -> dict[str, Any]:
    if request.get("format") != REQUEST_FORMAT:
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

    cl = OpenCL()
    platform, device = select_amd_device(cl)
    device_info = cl.device_receipt(platform, device)
    context = queue = program = kernel = left_buffer = right_buffer = output_buffer = None
    try:
        properties = (ctypes.c_ssize_t * 3)(CL_CONTEXT_PLATFORM, platform.value, 0)
        code = CLInt()
        context = cl.create_context(properties, 1, ctypes.byref(device), None, None, ctypes.byref(code))
        check(code.value, "clCreateContext")
        queue = cl.create_command_queue(context, device, 0, ctypes.byref(code))
        check(code.value, "clCreateCommandQueue")
        source = KERNEL.encode("utf-8")
        source_array = (ctypes.c_char_p * 1)(source)
        lengths = (CLSize * 1)(len(source))
        program = cl.create_program(context, 1, source_array, lengths, ctypes.byref(code))
        check(code.value, "clCreateProgramWithSource")
        build_code = cl.build_program(program, 1, ctypes.byref(device), None, None, None)
        if build_code != CL_SUCCESS:
            raise fail(
                "RCL_OPENCL_KERNEL_BUILD",
                f"clBuildProgram returned OpenCL error {build_code}; build log: {cl.build_log(program, device)}",
            )
        kernel = cl.create_kernel(program, b"rcl_bf16_matmul", ctypes.byref(code))
        check(code.value, "clCreateKernel")
        left_data = (ctypes.c_uint16 * len(left))(*left)
        right_data = (ctypes.c_uint16 * len(right))(*right)
        output_data = (ctypes.c_uint16 * (rows * columns))()
        left_buffer = cl.create_buffer(
            context,
            CL_MEM_READ_ONLY | CL_MEM_COPY_HOST_PTR,
            ctypes.sizeof(left_data),
            ctypes.cast(left_data, ctypes.c_void_p),
            ctypes.byref(code),
        )
        check(code.value, "clCreateBuffer:left")
        right_buffer = cl.create_buffer(
            context,
            CL_MEM_READ_ONLY | CL_MEM_COPY_HOST_PTR,
            ctypes.sizeof(right_data),
            ctypes.cast(right_data, ctypes.c_void_p),
            ctypes.byref(code),
        )
        check(code.value, "clCreateBuffer:right")
        output_buffer = cl.create_buffer(
            context,
            CL_MEM_WRITE_ONLY,
            ctypes.sizeof(output_data),
            None,
            ctypes.byref(code),
        )
        check(code.value, "clCreateBuffer:output")

        for index, buffer in enumerate((left_buffer, right_buffer, output_buffer)):
            argument = CLHandle(buffer)
            check(
                cl.set_kernel_arg(kernel, index, ctypes.sizeof(argument), ctypes.byref(argument)),
                f"clSetKernelArg:buffer:{index}",
            )
        for index, value in enumerate((rows, columns, shared), start=3):
            argument = CLUint(value)
            check(
                cl.set_kernel_arg(kernel, index, ctypes.sizeof(argument), ctypes.byref(argument)),
                f"clSetKernelArg:dimension:{index}",
            )
        global_size = (CLSize * 2)(rows, columns)
        check(
            cl.enqueue_kernel(queue, kernel, 2, None, global_size, None, 0, None, None),
            "clEnqueueNDRangeKernel",
        )
        check(cl.finish(queue), "clFinish")
        check(
            cl.enqueue_read(
                queue,
                output_buffer,
                1,
                0,
                ctypes.sizeof(output_data),
                ctypes.cast(output_data, ctypes.c_void_p),
                0,
                None,
                None,
            ),
            "clEnqueueReadBuffer",
        )
        check(cl.finish(queue), "clFinish:read")
        output_bits = [int(value) for value in output_data]
        if any(bits & 0x7F80 == 0x7F80 for bits in output_bits):
            raise fail("RCL_OPENCL_BF16_NONFINITE", "OpenCL BF16 output is non-finite")
        output_hex = [bits_hex(bits) for bits in output_bits]
        digest = hashlib.sha256()
        digest.update(b"rcl.opencl-bf16-matmul-v0.1\0")
        digest.update(device_info["deviceName"].encode("utf-8"))
        for bits in output_hex:
            digest.update(bits.encode("ascii"))
        return {
            "format": RESULT_FORMAT,
            "status": "PASS_LOCAL_GPU_REFERENCE_CANDIDATE",
            "backend": BACKEND,
            "gpuExecuted": True,
            "gpuClaim": False,
            "device": device_info,
            "outputBits": output_hex,
            "outputData": [bf16_value(bits) for bits in output_bits],
            "executionRoot": digest.hexdigest(),
        }
    finally:
        if output_buffer is not None:
            cl.release_mem(output_buffer)
        if right_buffer is not None:
            cl.release_mem(right_buffer)
        if left_buffer is not None:
            cl.release_mem(left_buffer)
        if kernel is not None:
            cl.release_kernel(kernel)
        if program is not None:
            cl.release_program(program)
        if queue is not None:
            cl.release_queue(queue)
        if context is not None:
            cl.release_context(context)


def main() -> int:
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
