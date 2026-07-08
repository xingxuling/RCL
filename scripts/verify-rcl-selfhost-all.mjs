#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'output', 'selfhost');
const outputPath = path.join(outputDir, 'selfhost-summary.json');
const nativeBoundaryReportPath = path.join(outputDir, 'native-windows-boundary.json');

const stages = [
  { id: 'stage0', script: 'verify-rcl-selfhost-stage0.mjs', report: 'stage0-verification.json' },
  { id: 'stage1', script: 'verify-rcl-selfhost-stage1.mjs', report: 'stage1-verification.json' },
  { id: 'stage2', script: 'verify-rcl-selfhost-stage2.mjs', report: 'stage2-verification.json' },
  { id: 'stage3', script: 'verify-rcl-selfhost-stage3.mjs', report: 'stage3-verification.json' },
  { id: 'stage4', script: 'verify-rcl-selfhost-stage4.mjs', report: 'stage4-verification.json' },
  { id: 'stage5', script: 'verify-rcl-selfhost-stage5.mjs', report: 'stage5-verification.json' },
  { id: 'stage6', script: 'verify-rcl-selfhost-stage6.mjs', report: 'stage6-verification.json' },
  { id: 'stage7', script: 'verify-rcl-selfhost-stage7.mjs', report: 'stage7-verification.json' },
  { id: 'stage8', script: 'verify-rcl-selfhost-stage8.mjs', report: 'stage8-verification.json' },
  { id: 'stage9', script: 'verify-rcl-selfhost-stage9.mjs', report: 'stage9-verification.json' },
  { id: 'stage10', script: 'verify-rcl-selfhost-stage10.mjs', report: 'stage10-verification.json' },
  { id: 'stage11', script: 'verify-rcl-selfhost-stage11.mjs', report: 'stage11-verification.json' },
  { id: 'stage12', script: 'verify-rcl-selfhost-stage12.mjs', report: 'stage12-verification.json' },
  { id: 'stage13', script: 'verify-rcl-selfhost-stage13.mjs', report: 'stage13-verification.json' },
  { id: 'stage14', script: 'verify-rcl-selfhost-stage14.mjs', report: 'stage14-verification.json' },
  { id: 'stage15', script: 'verify-rcl-selfhost-stage15.mjs', report: 'stage15-verification.json' },
  { id: 'stage16', script: 'verify-rcl-selfhost-stage16.mjs', report: 'stage16-verification.json' },
  { id: 'stage17', script: 'verify-rcl-selfhost-stage17.mjs', report: 'stage17-verification.json' },
  { id: 'stage18', script: 'verify-rcl-selfhost-stage18.mjs', report: 'stage18-verification.json' },
  { id: 'stage19', script: 'verify-rcl-selfhost-stage19.mjs', report: 'stage19-verification.json' },
  { id: 'stage20', script: 'verify-rcl-selfhost-stage20.mjs', report: 'stage20-verification.json' },
  { id: 'stage21', script: 'verify-rcl-selfhost-stage21.mjs', report: 'stage21-verification.json' },
  { id: 'stage22', script: 'verify-rcl-selfhost-stage22.mjs', report: 'stage22-verification.json' },
  { id: 'stage23', script: 'verify-rcl-selfhost-stage23.mjs', report: 'stage23-verification.json' },
  { id: 'stage24', script: 'verify-rcl-selfhost-stage24.mjs', report: 'stage24-verification.json' },
  { id: 'stage25', script: 'verify-rcl-selfhost-stage25.mjs', report: 'stage25-verification.json' },
  { id: 'stage26', script: 'verify-rcl-selfhost-stage26.mjs', report: 'stage26-verification.json' },
  { id: 'stage27', script: 'verify-rcl-selfhost-stage27.mjs', report: 'stage27-verification.json' },
  { id: 'stage28', script: 'verify-rcl-selfhost-stage28.mjs', report: 'stage28-verification.json' },
  { id: 'stage29', script: 'verify-rcl-selfhost-stage29.mjs', report: 'stage29-verification.json' },
  { id: 'stage30', script: 'verify-rcl-selfhost-stage30.mjs', report: 'stage30-verification.json' },
  { id: 'stage31', script: 'verify-rcl-selfhost-stage31.mjs', report: 'stage31-verification.json' },
  { id: 'stage32', script: 'verify-rcl-selfhost-stage32.mjs', report: 'stage32-verification.json' },
  { id: 'stage33', script: 'verify-rcl-selfhost-stage33.mjs', report: 'stage33-verification.json' },
  { id: 'stage34', script: 'verify-rcl-selfhost-stage34.mjs', report: 'stage34-verification.json' },
  { id: 'stage35', script: 'verify-rcl-selfhost-stage35.mjs', report: 'stage35-verification.json' },
  { id: 'stage36', script: 'verify-rcl-selfhost-stage36.mjs', report: 'stage36-verification.json' },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const nativeBoundaryRun = spawnSync(process.execPath, [path.join(root, 'scripts', 'verify-native-windows-boundary.mjs')], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const nativeBoundaryReport = fs.existsSync(nativeBoundaryReportPath) ? readJson(nativeBoundaryReportPath) : null;
const nativeWindowsVerified = nativeBoundaryRun.status === 0
  && nativeBoundaryReport?.status === 'NATIVE_WINDOWS_VERIFIED'
  && nativeBoundaryReport?.probes?.defaultNativeRun?.ok === true;

const results = [];

for (const stage of stages) {
  const startedAt = new Date().toISOString();
  const run = spawnSync(process.execPath, [path.join(root, 'scripts', stage.script)], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const finishedAt = new Date().toISOString();
  const reportPath = path.join(outputDir, stage.report);
  const report = fs.existsSync(reportPath) ? readJson(reportPath) : null;
  results.push({
    id: stage.id,
    script: `scripts/${stage.script}`,
    report: `output/selfhost/${stage.report}`,
    exitCode: run.status,
    ok: run.status === 0 && report?.ok === true,
    stageStatus: report?.stageStatus ?? null,
    startedAt,
    finishedAt,
    stderr: run.stderr.trim(),
  });
}

const payload = {
  ok: results.every(result => result.ok),
  format: 'rcl.selfhost.summary.v1',
  executionMode: 'sequential',
  stages: results,
  currentVerifiedCeiling: results.every(result => result.ok)
    ? 'stage36_rcl_owned_comparison_operator_lowering_subset'
    : 'incomplete',
  boundary: {
    fullSelfHosting: false,
    jsRuntimeStillRequired: true,
    nativeWindowsVerified,
    nativeWindowsStillBlocked: !nativeWindowsVerified,
    fixedPointSourceMaterialization: true,
    fixedPointSelfCompilationWitness: true,
    rclArtifactEmitsCompilerRbc: true,
    rclStructuredArtifactReencodesCompilerRbc: true,
    rclOwnedCompilerSourceToArtifactTransformation: true,
    rclOwnedRuleBytecodeSubset: true,
    rclOwnedRuleBytecodePlanSubset: true,
    rclOwnedRuntimeBytecodeInterpreterSubset: true,
    rclOwnedRuntimeControlFlowArithmeticSubset: true,
    rclOwnedRuntimeStateLogicSubset: true,
    rclOwnedRuntimeTransactionSubset: true,
    rclOwnedRuntimeCallsBuiltinsProviderSubset: true,
    rclOwnedRuntimeTypedValuesSubset: true,
    rclOwnedRuntimeHistoryRootPreimageSubset: true,
    rclOwnedRuntimeRootHashingBuiltinSubset: true,
    rclOwnedRuntimeErrorPathSubset: true,
    rclOwnedRuntimeProviderErrorPathSubset: true,
    rclOwnedProviderCallSourceLoweringSubset: true,
    rclOwnedBuiltinProviderSourceLoweringSubset: true,
    rclOwnedTokenizedSourceLoweringSubset: true,
    rclOwnedRecursiveFacetParserSubset: true,
    rclOwnedLiteralFacetAstSubset: true,
    rclOwnedAstDrivenBytecodeLoweringSubset: true,
    rclOwnedExpressionAstSubset: true,
    rclOwnedNestedCallLoweringSubset: true,
    rclOwnedPathLoadLoweringSubset: true,
    rclOwnedRuleEmergenceSourceLoweringSubset: true,
    rclOwnedRuleExpressionSourceLoweringSubset: true,
    rclOwnedMultiRuleExpressionSourceLoweringSubset: true,
    rclOwnedGeneralExpressionParserSubset: true,
    rclOwnedRuleLoweringLoopSubset: true,
    rclOwnedFacetWarrantParserSubset: true,
    rclOwnedGeneralRuleDirectiveScalingSubset: true,
    rclOwnedMultisubjectWarrantParserSubset: true,
    rclOwnedEqualityExpressionLoweringSubset: true,
    rclOwnedComparisonOperatorLoweringSubset: true,
    rclOwnedRuleTransactionBytecodeSubset: true,
    rclOwnedTargetNativeExecutionSubset: true,
    rclOwnedRuntimeRootHashingComplete: false,
    rclOwnedExpressionAstComplete: false,
    rclOwnedRuleBytecodeLoweringComplete: false,
    rclCompilerSelfEmitsWithoutStage0: false,
    rclOwnedRuntimeComplete: false,
  },
  nativeBoundary: {
    script: 'scripts/verify-native-windows-boundary.mjs',
    report: 'output/selfhost/native-windows-boundary.json',
    exitCode: nativeBoundaryRun.status,
    ok: nativeWindowsVerified,
    status: nativeBoundaryReport?.status ?? null,
    nativeVmPath: nativeBoundaryReport?.artifacts?.nativeExe?.path ?? null,
    nativeVmSha256: nativeBoundaryReport?.artifacts?.nativeExe?.sha256 ?? null,
    stderr: nativeBoundaryRun.stderr.trim(),
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));

if (!payload.ok) process.exitCode = 1;
