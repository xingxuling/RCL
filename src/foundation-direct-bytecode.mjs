import { compileReality } from './compiler.mjs';
import { tryCompileRealityToBytecode } from './bytecode.mjs';
import { lowerDeclaredFoundationToCore } from './foundation-direct-lowering.mjs';
import { lowerFoundationQuantitiesForNativeBytecode } from './foundation-quantity-native-lowering.mjs';

export const FOUNDATION_DIRECT_BYTECODE_FORMAT = 'taowind.rcl-foundation-direct-bytecode.v0.2';

export function tryCompileFoundationRealityToBytecode(sourceOrProgram, options = {}) {
  try {
    const compileSource = options.compileSource ?? compileReality;
    const compileBytecode = options.compileBytecode ?? tryCompileRealityToBytecode;
    const program = typeof sourceOrProgram === 'string' ? compileSource(sourceOrProgram) : sourceOrProgram;
    const lowering = lowerDeclaredFoundationToCore(program, options);
    const quantityLowering = lowerFoundationQuantitiesForNativeBytecode(lowering.program);
    const result = compileBytecode(quantityLowering.program);
    return {
      ...result,
      program: result?.ok ? lowering.program : result?.program ?? null,
      foundationDirectLowering: {
        format: FOUNDATION_DIRECT_BYTECODE_FORMAT,
        lowered: lowering.lowered,
        diagnostics: lowering.diagnostics,
        summary: lowering.summary,
        truthBoundary: lowering.truthBoundary,
      },
      foundationQuantityNativeLowering: {
        format: quantityLowering.format,
        version: quantityLowering.version,
        summary: quantityLowering.summary,
        truthBoundary: quantityLowering.truthBoundary,
      },
    };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [{
        code: error?.code ?? 'RCL_FOUNDATION_DIRECT_LOWERING_FAILURE',
        message: error?.message ?? String(error),
        details: error?.details ?? {},
      }],
      program: null,
      bytecode: null,
      foundationDirectLowering: null,
      foundationQuantityNativeLowering: null,
    };
  }
}
