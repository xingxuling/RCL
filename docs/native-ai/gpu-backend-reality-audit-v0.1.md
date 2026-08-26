# GPU Backend Reality Audit v0.1

## Verdict

`REAL_GPU_PRESENT_RCL_BACKEND_NOT_IMPLEMENTED_CANDIDATE_BLOCKED`

The current Windows host has a real AMD Radeon(TM) 860M Graphics device and working Vulkan/OpenCL discovery. This is hardware evidence only. The RCL Tensor engine still exposes CPU reference organs and explicitly rejects GPU device intent; no GPU training or GPU semantic claim is admitted.

## Observed host evidence

| Probe | Observation | Ruling |
|---|---|---|
| WMI video controller | AMD Radeon(TM) 860M Graphics, vendor `0x1002`, device `0x1114`, driver `32.0.22024.3004` | real integrated GPU identity observed |
| Vulkan | API `1.4.313`, device API `1.4.325`, AMD proprietary driver `25.20.24.03 (LLPC)` | real Vulkan device discovery PASS |
| OpenCL | AMD Accelerated Parallel Processing, OpenCL C 2.0, driver `3661.0`, one GPU device | real OpenCL device discovery PASS |
| OpenCL precision | `cl_khr_fp16` observed; no BF16 extension observed in the device extension listing | BF16 must remain an explicit pack/unpack/reference policy |
| CUDA/ROCm tools | `nvidia-smi` and `rocminfo` not found | CUDA/ROCm path not available on this host |
| RCL source | `rcl-tensor-cpu-rust-v0.1` and `rcl-tensor-bf16-cpu-reference-v0.1`; GPU device intent fails closed | RCL GPU execution NOT IMPLEMENTED |

## Authority boundary

The physical device and driver are real, but they do not grant `GPU`, `VULKAN_GPU`, `OPENCL_BF16`, or training claims. A future backend must lower the RCL-owned generic Tensor/BF16 policy, execute on this device, and provide independent differential, device identity, failure, deterministic replay and exact checkpoint evidence. Software rendering, CPU emulation, or a host probe alone cannot close the gap.

## Next bounded candidate

Prefer an AMD OpenCL reference organ on this host because the runtime exposes one real GPU device and `cl_khr_fp16`. The first candidate should be limited to generic BF16 `add`, `mul`, `matmul`, FP32 accumulation, explicit BF16 pack/unpack, and CPU differential replay. It must fail closed when OpenCL is unavailable and must not silently route to the CPU organ. No model-special opcode or RCL semantic ownership transfer is allowed.

`RCL_GAP_GPU_EXECUTION` remains `BLOCKED`: hardware discovery is PASS, RCL backend execution is not.

## Reproduction

```text
Get-CimInstance Win32_VideoController
vulkaninfo --summary
clinfo -l
rg -n -i "cuda|rocm|vulkan|metal|gpu|accelerator|backend" native/tensor-engine
```

Evidence class: `DIAGNOSTIC_HOST_HARDWARE_ONLY`.
