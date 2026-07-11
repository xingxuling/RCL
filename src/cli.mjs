#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compileReality, runReality, materializeRclAbsorptionKernel, packageRclSource, listRclPackageTargets, verifyRclPackage, detectAndroidBuildEnvironment, buildAndroidDebugPackage, installRclApp, verifyRclApp, runRclApp, uninstallRclApp, listRclApps, tryCompileReality, runTypeLinkedCompilerDemo, runTypeConstructorDemo, runTypedPackageDemo, compileTypedPackage, verifyTypedPackageLock, runTypedBytecodeLayoutDemo, compileTypedBytecodeFromFiles, runTypedAccessPatternDemo, compileTypedAccessPatternFromFiles, runTypedHeapLayoutDemo, compileTypedHeapLayoutFromFiles, runTypedReferenceAbiDemo, compileTypedReferenceAbiFromFiles, runTypedGcSnapshotDemo, compileTypedGcSnapshotFromFiles, runDebugMapDemo, writeTraceRunReports, replayTrace, runDebugSessionDemo, writeDebugSessionReports, stepDebugSessionFromFiles, runProfilerDemo, writeProfilerDebugUiReports, writeReplayInputBundle, runDebugUiDemo, buildDebugUiProtocolFromFiles, runLspDemo, writeLspIndexReports, writeLspQueryReport, runDapDemo, writeDapBridgeReports, writeIdeBridgeReports, runPackageEcosystemDemo, initPackageEcosystem, buildPackageLock, verifyPackageLock, populateContentAddressedCache, buildTargetMatrix, buildReleaseBundle, verifyReleaseBundle, runRealityCompilerDemo, writeRealityCompilerReports, buildRealityCompilerSpec, renderRealityCompilerRcl, runInternalClosureDemo, writeInternalClosureReports, buildInternalClosureSpec, renderInternalClosureRcl, readInternalClosureInput, runCosmogenicDemo, writeCosmogenicReports, buildCosmogenicSpec, renderCosmogenicRcl, readCosmogenicInput, runNestedUniverseMemoryDemo, writeNestedUniverseMemoryReports, buildNestedUniverseMemorySpec, renderNestedUniverseMemoryRcl, readNestedUniverseMemoryInput, runIntersticeObserverDemo, writeIntersticeObserverReports, buildIntersticeObserverSpec, renderIntersticeObserverRcl, readIntersticeObserverInput, runEmpiricalGroundingDemo, writeEmpiricalGroundingReports, buildEmpiricalGroundingSpec, renderEmpiricalGroundingRcl, readEmpiricalGroundingInput, runUnknownKnowledgeDemo, writeUnknownKnowledgeReports, buildUnknownKnowledgeSpec, renderUnknownKnowledgeRcl, readUnknownKnowledgeInput, runDirectedWisherDemo, writeDirectedWisherReports, buildDirectedWisherSpec, renderDirectedWisherRcl, readDirectedWisherInput, runPredictiveTraceDemo, writePredictiveTraceReports, buildPredictiveTraceSpec, renderPredictiveTraceRcl, readPredictiveTraceInput, runTemporalFingerprintDemo, writeTemporalFingerprintReports, buildTemporalFingerprintSpec, renderTemporalFingerprintRcl, readTemporalFingerprintInput, runCandidatePressureForgeDemo, writeCandidatePressureForgeReports, buildCandidatePressureForgeSpec, renderCandidatePressureForgeRcl, readCandidatePressureForgeInput, runEcologicalInjectionPhase0Demo, writeEcologicalInjectionPhase0Reports, buildEcologicalInjectionPhase0Spec, renderEcologicalInjectionPhase0Rcl, readEcologicalInjectionPhase0Input, runEsotericMechanismDemo, writeEsotericMechanismReports, buildEsotericMechanismSpec, renderEsotericMechanismRcl, readEsotericMechanismInput, runAkashicRecordDemo, writeAkashicRecordReports, buildAkashicRecordSpec, renderAkashicRecordRcl, readAkashicRecordInput, runExperimentDesignDemo, writeExperimentDesignReports, buildExperimentDesignSpec, renderExperimentDesignRcl, readExperimentDesignInput, runBlueSkyWorldviewBlindtestSandboxDemo, writeBlueSkyWorldviewBlindtestReports, buildBlueSkyWorldviewBlindtestSpec, renderBlueSkyWorldviewBlindtestRcl, readBlueSkyWorldviewBlindtestInput } from './index.mjs';
import { runRealUniverseCoordinateBlindtestDemo, writeRealUniverseCoordinateBlindtestReports, buildRealUniverseCoordinateBlindtestSpec, renderRealUniverseCoordinateBlindtestRcl, readRealUniverseCoordinateBlindtestInput } from './real-universe-coordinate-blindtest.mjs';
import { runCosmogenicParameterInversionDemo, writeCosmogenicParameterInversionReports, buildCosmogenicParameterInversionSpec, renderCosmogenicParameterInversionRcl, readCosmogenicParameterInversionInput } from './cosmogenic-parameter-inversion.mjs';
import { runBlueSkyCosmogenicProjectionDemo, writeBlueSkyCosmogenicProjectionReports, buildBlueSkyCosmogenicProjectionSpec, renderBlueSkyCosmogenicProjectionRcl, readBlueSkyCosmogenicProjectionInput } from './blue-sky-cosmogenic-projection-trial.mjs';
import { runSuperconductorCandidateInversionDemo, writeSuperconductorCandidateInversionReports, buildSuperconductorCandidateInversionSpec, renderSuperconductorCandidateInversionRcl, readSuperconductorCandidateInversionInput } from './superconductor-candidate-inversion-compiler.mjs';
import { runSandboxComputerFileTransmissionDemo, writeSandboxComputerFileTransmissionReports, buildSandboxComputerTransmissionSpec, renderSandboxComputerTransmissionRcl, readSandboxTransmissionInput } from './sandbox-computer-file-transmission-protocol.mjs';
import { runAutonomousSandboxFileEmissionDemo, writeAutonomousSandboxFileEmissionReports, buildAutonomousSandboxFileEmissionSpec, renderAutonomousSandboxFileEmissionRcl, readAutonomousSandboxFileEmissionInput } from './autonomous-sandbox-file-emission-protocol.mjs';
import { decodeBytecode } from './bytecode.mjs';
import { runNativeBytecode } from './native-vm.mjs';
import {
  DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH,
  compileSourceFileSelfHosted,
  compileSourceSelfHosted,
} from './selfhost-compiler.mjs';
import { bootstrapCompilerSeed, bootstrapCompilerStage2, bootstrapCompilerStage3, bootstrapCompilerStage4, bootstrapCompilerStage5, bootstrapCompilerStage6, bootstrapCompilerStage7, bootstrapCompilerStage8, bootstrapCompilerStage9, bootstrapCompilerComplete } from './bootstrap.mjs';
import { runProviderV2Demo } from './provider-runtime-v2.mjs';
import { runResourceIsolationDemo, runResourceLifecycleDemo } from './resource-isolation-kernel.mjs';
import { runResourceWalDemo } from './resource-wal-runtime.mjs';
import { runTypeModuleDemo, writeTypeModuleReport } from './type-module-kernel.mjs';
import { runSelfAkashicRecordDemo, writeSelfAkashicRecordReports, buildSelfAkashicRecordSpec, renderSelfAkashicRecordRcl, readSelfAkashicRecordInput } from './self-akashic-record-compiler.mjs';
import { runFutureRclAkashicDemo, writeFutureRclAkashicReports, buildFutureRclAkashicSpec, renderFutureRclAkashicRcl, readFutureRclAkashicInput } from './future-rcl-akashic-compiler.mjs';
import { runMechanismToPrototypeDemo, writeMechanismToPrototypeReports, buildMechanismToPrototypeSpec, renderMechanismToPrototypeRcl, readMechanismToPrototypeInput } from './mechanism-to-prototype-generator.mjs';
import { runEmpiricalLabNotebookDemo, writeEmpiricalLabNotebookReports, buildEmpiricalLabNotebookSpec, renderEmpiricalLabNotebookRcl, readEmpiricalLabNotebookInput } from './empirical-lab-notebook-runtime.mjs';
import { runCivilizationTechnologyTreeDemo, writeCivilizationTechnologyTreeReports, buildCivilizationTechnologyTreeSpec, renderCivilizationTechnologyTreeRcl, readCivilizationTechnologyTreeInput } from './civilization-technology-tree-compiler.mjs';
import { runRncsExecutionBridgeV2Demo, writeRncsExecutionBridgeV2Reports, buildRncsExecutionBridgeV2Spec, renderRncsExecutionBridgeV2Rcl, readRncsExecutionBridgeV2Input } from './rncs-execution-bridge-v2.mjs';
import { runHumanCapabilityFeedbackOsDemo, writeHumanCapabilityFeedbackOsReports, buildHumanCapabilityFeedbackOsSpec, renderHumanCapabilityFeedbackOsRcl, readHumanCapabilityFeedbackOsInput } from './human-capability-feedback-os.mjs';
import { runRealityProductEntryRuntimeDemo, writeRealityProductEntryRuntimeReports, buildRealityProductEntryRuntimeSpec, renderRealityProductEntryRuntimeRcl, readRealityProductEntryRuntimeInput } from './reality-product-entry-runtime.mjs';
import { runRecursiveFutureReleasePlannerDemo, writeRecursiveFutureReleasePlannerReports, buildRecursiveFutureReleasePlannerSpec, renderRecursiveFutureReleasePlannerRcl, readRecursiveFutureReleasePlannerInput } from './recursive-future-release-planner.mjs';
import { runEvidenceProductShellRuntimeDemo, writeEvidenceProductShellRuntimeReports, buildEvidenceProductShellRuntimeSpec, renderEvidenceProductShellRuntimeRcl, readEvidenceProductShellRuntimeInput } from './evidence-product-shell-runtime.mjs';
import { runAetherForgePocketProductBridgeDemo, writeAetherForgePocketProductBridgeReports, buildAetherForgePocketProductBridgeSpec, renderAetherForgePocketProductBridgeRcl, readAetherForgePocketProductBridgeInput } from './aether-forge-pocket-product-bridge.mjs';
import { runExperimentAutomationAdapterDemo, writeExperimentAutomationAdapterReports, buildExperimentAutomationAdapterSpec, renderExperimentAutomationAdapterRcl, readExperimentAutomationAdapterInput } from './experiment-automation-adapter.mjs';
import { runPrototypeSimulationRuntimeDemo, writePrototypeSimulationRuntimeReports, buildPrototypeSimulationRuntimeSpec, renderPrototypeSimulationRuntimeRcl, readPrototypeSimulationRuntimeInput } from './prototype-simulation-runtime.mjs';
import { runRealWorldDataIngestionLayerDemo, writeRealWorldDataIngestionLayerReports, buildRealWorldDataIngestionLayerSpec, renderRealWorldDataIngestionLayerRcl, readRealWorldDataIngestionLayerInput } from './real-world-data-ingestion-layer.mjs';
import { runMultiAgentVerificationCouncilDemo, writeMultiAgentVerificationCouncilReports, buildMultiAgentVerificationCouncilSpec, renderMultiAgentVerificationCouncilRcl, readMultiAgentVerificationCouncilInput } from './multi-agent-verification-council.mjs';
import { runLivingArtifactRuntimeDemo, writeLivingArtifactRuntimeReports, buildLivingArtifactRuntimeSpec, renderLivingArtifactRuntimeRcl, readLivingArtifactRuntimeInput } from './living-artifact-runtime.mjs';
import { runRecursiveGovernanceKernelDemo, writeRecursiveGovernanceKernelReports, buildRecursiveGovernanceKernelSpec, renderRecursiveGovernanceKernelRcl, readRecursiveGovernanceKernelInput } from './recursive-governance-kernel.mjs';
import { runUniversalSemanticTranslatorDemo, writeUniversalSemanticTranslatorReports, buildUniversalSemanticTranslatorSpec, renderUniversalSemanticTranslatorRcl, readUniversalSemanticTranslatorInput } from './universal-semantic-translator.mjs';
import { runUniverseKnowledgeRuntimeDemo, writeUniverseKnowledgeRuntimeReports, buildUniverseKnowledgeRuntimeSpec, renderUniverseKnowledgeRuntimeRcl, readUniverseKnowledgeRuntimeInput } from './universe-knowledge-runtime.mjs';
import { runSuperAgentRuntimeDemo, writeSuperAgentRuntimeReports, buildSuperAgentRuntimeSpec, renderSuperAgentRuntimeRcl, readSuperAgentRuntimeInput } from './super-agent-runtime.mjs';
import { runLlmLikeRuntimeDemo, writeLlmLikeRuntimeReports, buildLlmLikeRuntimeSpec, renderLlmLikeRuntimeRcl, readLlmLikeRuntimeInput } from './llm-like-runtime.mjs';
import { runCompositeProviderRouterDemo, writeCompositeProviderRouterReports, normalizeCompositeProviderRouterSpec, renderCompositeProviderRouterRcl, readCompositeProviderRouterInput } from './composite-provider-router.mjs';
import { runUnknownFrameworkGapClosureDemo, writeUnknownFrameworkGapClosureReports, buildUnknownFrameworkGapClosureSpec, renderUnknownFrameworkGapClosureRcl, readUnknownFrameworkGapClosureInput } from './unknown-framework-gap-closure-runtime.mjs';
import { runSelfUpgradeTeamSandboxDemo, writeSelfUpgradeTeamSandboxReports, buildSelfUpgradeTeamSandboxSpec, renderSelfUpgradeTeamSandboxRcl, readSelfUpgradeTeamSandboxInput } from './self-upgrade-team-sandbox.mjs';
import { runSourceMapPatchQueueDemo, writeSourceMapPatchQueueReports, buildSourceMapPatchQueueSpec, renderSourceMapPatchQueueRcl, readSourceMapPatchQueueInput } from './source-map-patch-queue.mjs';
import { runAgentCivilizationSandboxDemo, writeAgentCivilizationSandboxReports, buildAgentCivilizationSandboxSpec, renderAgentCivilizationSandboxRcl, readAgentCivilizationSandboxInput } from './agent-civilization-sandbox.mjs';
import { runFounderTwinAgentCityAcceleratorDemo, writeFounderTwinAgentCityAcceleratorReports, buildFounderTwinAgentCityAcceleratorSpec, renderFounderTwinAgentCityAcceleratorRcl, readFounderTwinAgentCityAcceleratorInput } from './founder-twin-agent-city-accelerator.mjs';
import { runIalCivilizationProductOsDemo, writeIalCivilizationProductOsReports, buildIalCivilizationProductOsSpec, renderIalCivilizationProductOsRcl, readIalCivilizationProductOsInput } from './ial-civilization-product-os.mjs';
import { runMemoryToProductFoundryDemo, writeMemoryToProductFoundryReports, buildMemoryToProductFoundrySpec, renderMemoryToProductFoundryRcl, readMemoryToProductFoundryInput } from './memory-to-product-foundry.mjs';
import { runAgentCivilizationFederationDemo, writeAgentCivilizationFederationReports, buildAgentCivilizationFederationSpec, renderAgentCivilizationFederationRcl, readAgentCivilizationFederationInput } from './agent-civilization-federation.mjs';
import { runSoulUniverseDialogueSandboxDemo, writeSoulUniverseDialogueReports, buildSoulUniverseDialogueSpec, renderSoulUniverseDialogueRcl, readSoulUniverseDialogueInput } from './soul-universe-dialogue-sandbox.mjs';

const [command, file, output, third, fourth, fifth] = process.argv.slice(2);
const commands = new Set(['compile', 'run', 'absorb', 'bytecode', 'disasm', 'native-run', 'native', 'bootstrap', 'bootstrap2', 'bootstrap3', 'bootstrap4', 'bootstrap5', 'bootstrap6', 'bootstrap7', 'bootstrap8', 'bootstrap9', 'selfhost', 'package', 'package-verify', 'android-env', 'package-build-android', 'rclapp-install', 'rclapp-verify', 'rclapp-run', 'rclapp-uninstall', 'rclapp-list', 'provider-v2-demo', 'resource-isolation-demo', 'resource-lifecycle-demo', 'resource-wal-demo', 'type-module-demo', 'type-module-check', 'type-linked-demo', 'type-constructor-demo', 'type-package-demo', 'type-package-build', 'type-package-verify', 'compile-typed', 'typed-bytecode-demo', 'typed-bytecode-build', 'typed-access-demo', 'typed-access-build', 'typed-heap-demo', 'typed-heap-build', 'typed-reference-demo', 'typed-reference-build', 'typed-gc-demo', 'typed-gc-build', 'debug-map-demo', 'trace-run', 'replay-trace', 'debug-session-demo', 'debug-session-run', 'debug-step', 'profiler-demo', 'profile-run', 'replay-bundle', 'debug-ui-demo', 'debug-ui-protocol', 'lsp-demo', 'lsp-index', 'lsp-query', 'dap-demo', 'dap-bridge', 'ide-bridge', 'package-ecosystem-demo', 'package-ecosystem-init', 'package-lock', 'package-lock-verify', 'package-cache', 'package-target-matrix', 'package-release', 'package-release-verify', 'reality-compiler-demo', 'reality-compiler-sandbox', 'reality-compiler-spec', 'internal-closure-demo', 'internal-closure-run', 'internal-closure-spec', 'cosmogenic-demo', 'cosmogenic-run', 'cosmogenic-spec', 'nested-universe-demo', 'nested-universe-run', 'nested-universe-spec', 'interstice-observer-demo', 'interstice-observer-run', 'interstice-observer-spec', 'empirical-grounding-demo', 'empirical-grounding-run', 'empirical-grounding-spec', 'unknown-knowledge-demo', 'unknown-knowledge-run', 'unknown-knowledge-spec', 'directed-wisher-demo', 'directed-wisher-run', 'directed-wisher-spec', 'predictive-trace-demo', 'predictive-trace-run', 'predictive-trace-spec', 'temporal-fingerprint-demo', 'temporal-fingerprint-run', 'temporal-fingerprint-spec', 'candidate-pressure-forge-demo', 'candidate-pressure-forge-run', 'candidate-pressure-forge-spec', 'ecological-phase0-demo', 'ecological-phase0-run', 'ecological-phase0-spec', 'esoteric-mechanism-demo', 'esoteric-mechanism-run', 'esoteric-mechanism-spec', 'akashic-record-demo', 'akashic-record-run', 'akashic-record-spec', 'self-akashic-record-demo', 'self-akashic-record-run', 'self-akashic-record-spec', 'future-rcl-akashic-demo', 'future-rcl-akashic-run', 'future-rcl-akashic-spec', 'experiment-design-demo', 'experiment-design-run', 'experiment-design-spec', 'mechanism-prototype-demo', 'mechanism-prototype-run', 'mechanism-prototype-spec', 'empirical-lab-notebook-demo', 'empirical-lab-notebook-run', 'empirical-lab-notebook-spec', 'civilization-tech-tree-demo', 'civilization-tech-tree-run', 'civilization-tech-tree-spec', 'rncs-execution-bridge-v2-demo', 'rncs-execution-bridge-v2-run', 'rncs-execution-bridge-v2-spec', 'human-capability-feedback-demo', 'human-capability-feedback-run', 'human-capability-feedback-spec', 'reality-product-entry-demo', 'reality-product-entry-run', 'reality-product-entry-spec', 'recursive-future-release-demo', 'recursive-future-release-run', 'recursive-future-release-spec', 'evidence-product-shell-demo', 'evidence-product-shell-run', 'evidence-product-shell-spec', 'aether-forge-pocket-bridge-demo', 'aether-forge-pocket-bridge-run', 'aether-forge-pocket-bridge-spec', 'experiment-automation-demo', 'experiment-automation-run', 'experiment-automation-spec', 'prototype-simulation-demo', 'prototype-simulation-run', 'prototype-simulation-spec', 'real-world-data-ingestion-demo', 'real-world-data-ingestion-run', 'real-world-data-ingestion-spec', 'real-world-data-ingestion-demo', 'real-world-data-ingestion-run', 'real-world-data-ingestion-spec', 'multi-agent-verification-council-demo', 'multi-agent-verification-council-run', 'multi-agent-verification-council-spec', 'living-artifact-demo', 'living-artifact-run', 'living-artifact-spec', 'recursive-governance-demo', 'recursive-governance-run', 'recursive-governance-spec', 'universal-semantic-translator-demo', 'universal-semantic-translator-run', 'universal-semantic-translator-spec', 'universe-knowledge-runtime-demo', 'universe-knowledge-runtime-run', 'universe-knowledge-runtime-spec', 'super-agent-runtime-demo', 'super-agent-runtime-run', 'super-agent-runtime-spec', 'llm-like-runtime-demo', 'llm-like-runtime-run', 'llm-like-runtime-spec', 'composite-provider-router-demo', 'composite-provider-router-run', 'composite-provider-router-spec', 'unknown-framework-gap-closure-demo', 'unknown-framework-gap-closure-run', 'unknown-framework-gap-closure-spec', 'self-upgrade-team-demo', 'self-upgrade-team-run', 'self-upgrade-team-spec', 'source-map-patch-queue-demo', 'source-map-patch-queue-run', 'source-map-patch-queue-spec', 'agent-civilization-demo', 'agent-civilization-run', 'agent-civilization-spec', 'founder-twin-agent-city-demo', 'founder-twin-agent-city-run', 'founder-twin-agent-city-spec', 'ial-civilization-product-os-demo', 'ial-civilization-product-os-run', 'ial-civilization-product-os-spec', 'memory-to-product-foundry-demo', 'memory-to-product-foundry-run', 'memory-to-product-foundry-spec', 'agent-civilization-federation-demo', 'agent-civilization-federation-run', 'agent-civilization-federation-spec', 'soul-universe-dialogue-demo', 'soul-universe-dialogue-run', 'soul-universe-dialogue-spec', 'blue-sky-worldview-blindtest-demo', 'blue-sky-worldview-blindtest-run', 'blue-sky-worldview-blindtest-spec', 'blue-sky-world-anchor-demo', 'blue-sky-world-anchor-run', 'blue-sky-world-anchor-spec', 'inner-universe-worldview-demo', 'inner-universe-worldview-run', 'inner-universe-worldview-spec', 'blue-sky-world-demo', 'blue-sky-world-run', 'blue-sky-world-spec', 'inner-universe-blind-planet-demo', 'inner-universe-blind-planet-run', 'inner-universe-blind-planet-spec', 'cosmogenic-parameter-inversion-demo', 'cosmogenic-parameter-inversion-run', 'cosmogenic-parameter-inversion-spec', 'real-universe-coordinate-blindtest-demo', 'real-universe-coordinate-blindtest-run', 'real-universe-coordinate-blindtest-spec', 'real-universe-coordinate-demo', 'real-universe-coordinate-run', 'real-universe-coordinate-spec', 'blue-sky-cosmogenic-projection-demo', 'blue-sky-cosmogenic-projection-run', 'blue-sky-cosmogenic-projection-spec', 'superconductor-candidate-inversion-demo', 'superconductor-candidate-inversion-run', 'superconductor-candidate-inversion-spec', 'sandbox-file-transmission-demo', 'sandbox-file-transmission-run', 'sandbox-file-transmission-spec', 'autonomous-file-emission-demo', 'autonomous-file-emission-run', 'autonomous-file-emission-spec']);
if (!command || !commands.has(command) || (!file && !['bootstrap', 'bootstrap2', 'bootstrap3', 'bootstrap4', 'bootstrap5', 'bootstrap6', 'bootstrap7', 'bootstrap8', 'bootstrap9', 'selfhost', 'android-env', 'rclapp-list', 'provider-v2-demo', 'resource-isolation-demo', 'resource-lifecycle-demo', 'resource-wal-demo', 'type-module-demo', 'type-linked-demo', 'type-constructor-demo', 'type-package-demo', 'typed-bytecode-demo', 'typed-access-demo', 'typed-heap-demo', 'typed-reference-demo', 'typed-gc-demo', 'debug-map-demo', 'debug-session-demo', 'profiler-demo', 'debug-ui-demo', 'lsp-demo', 'dap-demo', 'package-ecosystem-demo', 'package-ecosystem-init', 'reality-compiler-demo', 'reality-compiler-sandbox', 'reality-compiler-spec', 'internal-closure-demo', 'internal-closure-run', 'internal-closure-spec', 'cosmogenic-demo', 'cosmogenic-run', 'cosmogenic-spec', 'nested-universe-demo', 'nested-universe-run', 'nested-universe-spec', 'interstice-observer-demo', 'interstice-observer-run', 'interstice-observer-spec', 'empirical-grounding-demo', 'empirical-grounding-run', 'empirical-grounding-spec', 'unknown-knowledge-demo', 'unknown-knowledge-run', 'unknown-knowledge-spec', 'directed-wisher-demo', 'directed-wisher-run', 'directed-wisher-spec', 'predictive-trace-demo', 'predictive-trace-run', 'predictive-trace-spec', 'temporal-fingerprint-demo', 'temporal-fingerprint-run', 'temporal-fingerprint-spec', 'candidate-pressure-forge-demo', 'candidate-pressure-forge-run', 'candidate-pressure-forge-spec', 'ecological-phase0-demo', 'ecological-phase0-run', 'ecological-phase0-spec', 'esoteric-mechanism-demo', 'esoteric-mechanism-run', 'esoteric-mechanism-spec', 'akashic-record-demo', 'akashic-record-run', 'akashic-record-spec', 'self-akashic-record-demo', 'self-akashic-record-run', 'self-akashic-record-spec', 'future-rcl-akashic-demo', 'future-rcl-akashic-run', 'future-rcl-akashic-spec', 'experiment-design-demo', 'experiment-design-run', 'experiment-design-spec', 'mechanism-prototype-demo', 'mechanism-prototype-run', 'mechanism-prototype-spec', 'empirical-lab-notebook-demo', 'empirical-lab-notebook-run', 'empirical-lab-notebook-spec', 'civilization-tech-tree-demo', 'civilization-tech-tree-run', 'civilization-tech-tree-spec', 'rncs-execution-bridge-v2-demo', 'rncs-execution-bridge-v2-run', 'rncs-execution-bridge-v2-spec', 'human-capability-feedback-demo', 'human-capability-feedback-run', 'human-capability-feedback-spec', 'reality-product-entry-demo', 'reality-product-entry-run', 'reality-product-entry-spec', 'recursive-future-release-demo', 'recursive-future-release-run', 'recursive-future-release-spec', 'evidence-product-shell-demo', 'evidence-product-shell-run', 'evidence-product-shell-spec', 'aether-forge-pocket-bridge-demo', 'aether-forge-pocket-bridge-run', 'aether-forge-pocket-bridge-spec', 'experiment-automation-demo', 'experiment-automation-run', 'experiment-automation-spec', 'prototype-simulation-demo', 'prototype-simulation-run', 'prototype-simulation-spec', 'real-world-data-ingestion-demo', 'real-world-data-ingestion-run', 'real-world-data-ingestion-spec', 'real-world-data-ingestion-demo', 'real-world-data-ingestion-run', 'real-world-data-ingestion-spec', 'multi-agent-verification-council-demo', 'multi-agent-verification-council-run', 'multi-agent-verification-council-spec', 'living-artifact-demo', 'living-artifact-run', 'living-artifact-spec', 'recursive-governance-demo', 'recursive-governance-run', 'recursive-governance-spec', 'universal-semantic-translator-demo', 'universal-semantic-translator-run', 'universal-semantic-translator-spec', 'universe-knowledge-runtime-demo', 'universe-knowledge-runtime-run', 'universe-knowledge-runtime-spec', 'super-agent-runtime-demo', 'super-agent-runtime-run', 'super-agent-runtime-spec', 'llm-like-runtime-demo', 'llm-like-runtime-run', 'llm-like-runtime-spec', 'composite-provider-router-demo', 'composite-provider-router-run', 'composite-provider-router-spec', 'unknown-framework-gap-closure-demo', 'unknown-framework-gap-closure-run', 'unknown-framework-gap-closure-spec', 'self-upgrade-team-demo', 'self-upgrade-team-run', 'self-upgrade-team-spec', 'source-map-patch-queue-demo', 'source-map-patch-queue-run', 'source-map-patch-queue-spec', 'agent-civilization-demo', 'agent-civilization-run', 'agent-civilization-spec', 'founder-twin-agent-city-demo', 'founder-twin-agent-city-run', 'founder-twin-agent-city-spec', 'ial-civilization-product-os-demo', 'ial-civilization-product-os-run', 'ial-civilization-product-os-spec', 'memory-to-product-foundry-demo', 'memory-to-product-foundry-run', 'memory-to-product-foundry-spec', 'agent-civilization-federation-demo', 'agent-civilization-federation-run', 'agent-civilization-federation-spec', 'soul-universe-dialogue-demo', 'soul-universe-dialogue-run', 'soul-universe-dialogue-spec', 'blue-sky-worldview-blindtest-demo', 'blue-sky-worldview-blindtest-run', 'blue-sky-worldview-blindtest-spec', 'blue-sky-world-anchor-demo', 'blue-sky-world-anchor-run', 'blue-sky-world-anchor-spec', 'inner-universe-worldview-demo', 'inner-universe-worldview-run', 'inner-universe-worldview-spec', 'blue-sky-world-demo', 'blue-sky-world-run', 'blue-sky-world-spec', 'inner-universe-blind-planet-demo', 'inner-universe-blind-planet-run', 'inner-universe-blind-planet-spec', 'cosmogenic-parameter-inversion-demo', 'cosmogenic-parameter-inversion-run', 'cosmogenic-parameter-inversion-spec', 'real-universe-coordinate-blindtest-demo', 'real-universe-coordinate-blindtest-run', 'real-universe-coordinate-blindtest-spec', 'real-universe-coordinate-demo', 'real-universe-coordinate-run', 'real-universe-coordinate-spec', 'blue-sky-cosmogenic-projection-demo', 'blue-sky-cosmogenic-projection-run', 'blue-sky-cosmogenic-projection-spec', 'superconductor-candidate-inversion-demo', 'superconductor-candidate-inversion-run', 'superconductor-candidate-inversion-spec', 'sandbox-file-transmission-demo', 'sandbox-file-transmission-run', 'sandbox-file-transmission-spec', 'autonomous-file-emission-demo', 'autonomous-file-emission-run', 'autonomous-file-emission-spec'].includes(command))) {
  console.error(`Usage: rcl <compile|run|absorb|bytecode|disasm|native-run|native> <file> [output.rbc]
       rcl package <file.rcl> [target|all] [output-dir]
       rcl package-verify <package-dir>
       rcl android-env [package-dir]
       rcl package-build-android <android-package-dir>
       rcl rclapp-install <package-dir> [store-dir]
       rcl rclapp-verify <app-id|package-dir> [store-dir]
       rcl rclapp-run <app-id> [store-dir]
       rcl rclapp-uninstall <app-id> [store-dir]
       rcl rclapp-list [store-dir]
       rcl provider-v2-demo
       rcl resource-isolation-demo
       rcl resource-lifecycle-demo
       rcl resource-wal-demo [wal-output-dir]
       rcl type-module-demo
       rcl type-module-check <dir|file> [report.json]
       rcl type-linked-demo
       rcl type-constructor-demo
       rcl type-package-demo
       rcl type-package-build <package-dir> [lockfile]
       rcl type-package-verify <package-dir> [lockfile]
       rcl compile-typed <file.rcl> <types-dir|file> [report.json]
       rcl typed-bytecode-demo
       rcl typed-bytecode-build <file.rcl> <types-dir|file> [output-dir]
       rcl typed-access-demo
       rcl typed-access-build <file.rcl> <types-dir|file> [output-dir]
       rcl typed-heap-demo
       rcl typed-heap-build <file.rcl> <types-dir|file> [output-dir]
       rcl typed-reference-demo
       rcl typed-reference-build <file.rcl> <types-dir|file> [output-dir]
       rcl typed-gc-demo
       rcl typed-gc-build <file.rcl> <types-dir|file> [output-dir]
       rcl debug-map-demo
       rcl trace-run <file.rcl> <types-dir|file> [output-dir] [watchpoints.json]
       rcl replay-trace <trace.json> [output-dir]
       rcl debug-session-demo
       rcl debug-session-run <file.rcl> <types-dir|file> [output-dir] [debug-config.json]
       rcl debug-step <debug-session.json> [next|continue|reset|seq:<n>|frame:<n>] [output-dir]
       rcl profiler-demo
       rcl profile-run <file.rcl> <types-dir|file> [output-dir] [debug-config.json]
       rcl replay-bundle <trace.json> [output-dir]
       rcl debug-ui-demo
       rcl debug-ui-protocol <debug-session.json> [output-dir]
       rcl lsp-demo
       rcl lsp-index <file.rcl> <types-dir|file> [output-dir]
       rcl lsp-query <lsp-index.json> [hover|definition|symbols|diagnostics|semanticTokens|completion][:facet|prefix] [output-dir]
       rcl dap-demo
       rcl dap-bridge <debug-session.json> [output-dir] [debug-ui-protocol.json]
       rcl ide-bridge <file.rcl> <types-dir|file> [output-dir] [debug-config.json]
       rcl package-ecosystem-demo
       rcl package-ecosystem-init [file.rcl] [output-dir]
       rcl package-lock <package-dir>
       rcl package-lock-verify <package-dir> [rcl.lock.json]
       rcl package-cache <package-dir> [cache-dir]
       rcl package-target-matrix <package-dir> [output-dir]
       rcl package-release <package-dir> [output-dir]
       rcl package-release-verify <release-dir>
       rcl reality-compiler-demo
       rcl reality-compiler-sandbox [output-dir]
       rcl reality-compiler-spec [output-dir]
       rcl internal-closure-demo
       rcl internal-closure-run [input.json] [output-dir]
       rcl internal-closure-spec [output-dir]
       rcl cosmogenic-demo
       rcl cosmogenic-run [input.json] [output-dir]
       rcl cosmogenic-spec [output-dir]
       rcl nested-universe-demo
       rcl nested-universe-run [input.json] [output-dir]
       rcl nested-universe-spec [output-dir]
       rcl interstice-observer-demo
       rcl interstice-observer-run [input.json] [output-dir]
       rcl interstice-observer-spec [output-dir]
       rcl empirical-grounding-demo
       rcl empirical-grounding-run [input.json] [output-dir]
       rcl empirical-grounding-spec [output-dir]
       rcl unknown-knowledge-demo
       rcl unknown-knowledge-run [input.json] [output-dir]
       rcl unknown-knowledge-spec [output-dir]
       rcl directed-wisher-demo
       rcl directed-wisher-run [input.json] [output-dir]
       rcl directed-wisher-spec [output-dir]
       rcl predictive-trace-demo
       rcl predictive-trace-run [input.json] [output-dir]
       rcl predictive-trace-spec [output-dir]
       rcl temporal-fingerprint-demo
       rcl temporal-fingerprint-run [input.json] [output-dir]
       rcl temporal-fingerprint-spec [output-dir]
       rcl candidate-pressure-forge-demo
       rcl candidate-pressure-forge-run [input.json] [output-dir]
       rcl candidate-pressure-forge-spec [output-dir]
       rcl ecological-phase0-demo
       rcl ecological-phase0-run [input.json] [output-dir]
       rcl ecological-phase0-spec [output-dir]
       rcl esoteric-mechanism-demo
       rcl esoteric-mechanism-run [input.json] [output-dir]
       rcl esoteric-mechanism-spec [output-dir]
       rcl akashic-record-demo
       rcl akashic-record-run [input.json] [output-dir]
       rcl akashic-record-spec [output-dir]
       rcl self-akashic-record-demo
       rcl self-akashic-record-run [input.json] [output-dir]
       rcl self-akashic-record-spec [output-dir]
       rcl future-rcl-akashic-demo
       rcl future-rcl-akashic-run [input.json] [output-dir]
       rcl future-rcl-akashic-spec [output-dir]
       rcl experiment-design-demo
       rcl experiment-design-run [input.json] [output-dir]
       rcl experiment-design-spec [output-dir]
       rcl mechanism-prototype-demo
       rcl mechanism-prototype-run [input.json] [output-dir]
       rcl mechanism-prototype-spec [output-dir]
       rcl empirical-lab-notebook-demo
       rcl empirical-lab-notebook-run [input.json] [output-dir]
       rcl empirical-lab-notebook-spec [output-dir]
       rcl civilization-tech-tree-demo
       rcl civilization-tech-tree-run [input.json] [output-dir]
       rcl civilization-tech-tree-spec [output-dir]
       rcl rncs-execution-bridge-v2-demo
       rcl rncs-execution-bridge-v2-run [input.json] [output-dir]
       rcl rncs-execution-bridge-v2-spec [output-dir]
       rcl human-capability-feedback-demo
       rcl human-capability-feedback-run [input.json] [output-dir]
       rcl human-capability-feedback-spec [output-dir]
       rcl reality-product-entry-demo
       rcl reality-product-entry-run [input.json] [output-dir]
       rcl reality-product-entry-spec [output-dir]
       rcl composite-provider-router-demo
       rcl composite-provider-router-run [input.json] [output-dir]
       rcl composite-provider-router-spec [output-dir]
       rcl unknown-framework-gap-closure-demo
       rcl unknown-framework-gap-closure-run [input.json] [output-dir]
       rcl unknown-framework-gap-closure-spec [output-dir]
       rcl self-upgrade-team-demo
       rcl self-upgrade-team-run [input.json] [output-dir]
       rcl self-upgrade-team-spec [output-dir]
       rcl source-map-patch-queue-demo
       rcl source-map-patch-queue-run [input.json] [output-dir]
       rcl source-map-patch-queue-spec [output-dir]
       rcl agent-civilization-demo
       rcl agent-civilization-run [input.json] [output-dir]
       rcl agent-civilization-spec [output-dir]
       rcl founder-twin-agent-city-demo
       rcl founder-twin-agent-city-run [input.json] [output-dir]
       rcl founder-twin-agent-city-spec [output-dir]
       rcl ial-civilization-product-os-demo
       rcl ial-civilization-product-os-run [input.json] [output-dir]
       rcl ial-civilization-product-os-spec [output-dir]
       rcl memory-to-product-foundry-demo
       rcl memory-to-product-foundry-run [input.json] [output-dir]
       rcl memory-to-product-foundry-spec [output-dir]
       rcl agent-civilization-federation-demo
       rcl agent-civilization-federation-run [input.json] [output-dir]
       rcl agent-civilization-federation-spec [output-dir]
       rcl soul-universe-dialogue-demo
       rcl soul-universe-dialogue-run [input.json] [output-dir]
       rcl soul-universe-dialogue-spec [output-dir]
       rcl blue-sky-world-anchor-demo
       rcl blue-sky-world-anchor-run [input.json] [output-dir]
       rcl blue-sky-world-anchor-spec [output-dir]
       rcl inner-universe-worldview-demo
       rcl inner-universe-worldview-run [input.json] [output-dir]
       rcl inner-universe-worldview-spec [output-dir]
       rcl blue-sky-worldview-blindtest-demo
       rcl blue-sky-worldview-blindtest-run [input.json] [output-dir]
       rcl blue-sky-worldview-blindtest-spec [output-dir]
       rcl blue-sky-world-demo
       rcl blue-sky-world-run [input.json] [output-dir]
       rcl blue-sky-world-spec [output-dir]
       rcl inner-universe-blind-planet-demo
       rcl inner-universe-blind-planet-run [input.json] [output-dir]
       rcl inner-universe-blind-planet-spec [output-dir]
       rcl real-universe-coordinate-blindtest-demo
       rcl real-universe-coordinate-blindtest-run [input.json] [output-dir]
       rcl real-universe-coordinate-blindtest-spec [output-dir]
       rcl real-universe-coordinate-demo
       rcl real-universe-coordinate-run [input.json] [output-dir]
       rcl real-universe-coordinate-spec [output-dir]
       rcl cosmogenic-parameter-inversion-demo
       rcl cosmogenic-parameter-inversion-run [input.json] [output-dir]
       rcl cosmogenic-parameter-inversion-spec [output-dir]
       rcl blue-sky-cosmogenic-projection-demo
       rcl blue-sky-cosmogenic-projection-run [corpus.txt|input.json] [output-dir]
       rcl blue-sky-cosmogenic-projection-spec [output-dir]
       rcl bootstrap|bootstrap2|bootstrap3|bootstrap4|bootstrap5
       rcl bootstrap7|bootstrap8|bootstrap9 [file.rcl]
       rcl selfhost [core.rcl] [app.rcl] [output.rbc]`);
  process.exit(2);
}

try {
  if (command === 'reality-compiler-demo') {
    console.log(JSON.stringify(runRealityCompilerDemo(), null, 2));
  } else if (command === 'reality-compiler-sandbox') {
    console.log(JSON.stringify(writeRealityCompilerReports(file || output || 'output/v0.43/reality-compiler'), null, 2));
  } else if (command === 'reality-compiler-spec') {
    const spec = buildRealityCompilerSpec();
    const payload = { ok: true, spec, rcl: renderRealityCompilerRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'reality-compiler-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'reality-compiler-kernel.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'internal-closure-demo') {
    console.log(JSON.stringify(runInternalClosureDemo(), null, 2));
  } else if (command === 'internal-closure-run') {
    let input = {};
    let outDir = output || 'output/v0.44/internal-closure';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readInternalClosureInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeInternalClosureReports(outDir, input), null, 2));
  } else if (command === 'internal-closure-spec') {
    const spec = buildInternalClosureSpec();
    const payload = { ok: true, spec, rcl: renderInternalClosureRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'internal-closure-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'internal-closure-controller.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'cosmogenic-demo') {
    console.log(JSON.stringify(runCosmogenicDemo(), null, 2));
  } else if (command === 'cosmogenic-run') {
    let input = {};
    let outDir = output || 'output/v0.45/cosmogenic-reality';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readCosmogenicInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeCosmogenicReports(outDir, input), null, 2));
  } else if (command === 'cosmogenic-spec') {
    const spec = buildCosmogenicSpec();
    const payload = { ok: true, spec, rcl: renderCosmogenicRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'cosmogenic-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'cosmogenic-reality-compiler.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'nested-universe-demo') {
    console.log(JSON.stringify(runNestedUniverseMemoryDemo(), null, 2));
  } else if (command === 'nested-universe-run') {
    let input = {};
    let outDir = output || 'output/v0.46/nested-universe-memory';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readNestedUniverseMemoryInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeNestedUniverseMemoryReports(outDir, input), null, 2));
  } else if (command === 'nested-universe-spec') {
    const spec = buildNestedUniverseMemorySpec();
    const payload = { ok: true, spec, rcl: renderNestedUniverseMemoryRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'nested-universe-memory-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'nested-universe-memory-compiler.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'interstice-observer-demo') {
    console.log(JSON.stringify(runIntersticeObserverDemo(), null, 2));
  } else if (command === 'interstice-observer-run') {
    let input = {};
    let outDir = output || 'output/v0.47/interstice-observer';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readIntersticeObserverInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeIntersticeObserverReports(outDir, input), null, 2));
  } else if (command === 'interstice-observer-spec') {
    const spec = buildIntersticeObserverSpec();
    const payload = { ok: true, spec, rcl: renderIntersticeObserverRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'interstice-observer-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'interstice-observer-compiler.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'empirical-grounding-demo') {
    console.log(JSON.stringify(runEmpiricalGroundingDemo(), null, 2));
  } else if (command === 'empirical-grounding-run') {
    let input = {};
    let outDir = output || 'output/v0.48/empirical-grounding';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readEmpiricalGroundingInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeEmpiricalGroundingReports(outDir, input), null, 2));
  } else if (command === 'empirical-grounding-spec') {
    const spec = buildEmpiricalGroundingSpec();
    const payload = { ok: true, spec, rcl: renderEmpiricalGroundingRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'empirical-grounding-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'empirical-grounding-layer.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'unknown-knowledge-demo') {
    console.log(JSON.stringify(runUnknownKnowledgeDemo(), null, 2));
  } else if (command === 'unknown-knowledge-run') {
    let input = {};
    let outDir = output || 'output/v0.49/unknown-knowledge';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readUnknownKnowledgeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeUnknownKnowledgeReports(outDir, input), null, 2));
  } else if (command === 'unknown-knowledge-spec') {
    const spec = buildUnknownKnowledgeSpec();
    const payload = { ok: true, spec, rcl: renderUnknownKnowledgeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'unknown-knowledge-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'unknown-knowledge-compiler.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'directed-wisher-demo') {
    console.log(JSON.stringify(runDirectedWisherDemo(), null, 2));
  } else if (command === 'directed-wisher-run') {
    let input = {};
    let outDir = output || 'output/v0.50/directed-wisher';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readDirectedWisherInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeDirectedWisherReports(outDir, input), null, 2));
  } else if (command === 'directed-wisher-spec') {
    const spec = buildDirectedWisherSpec();
    const payload = { ok: true, spec, rcl: renderDirectedWisherRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'directed-wisher-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'directed-wisher.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'predictive-trace-demo') {
    console.log(JSON.stringify(runPredictiveTraceDemo(), null, 2));
  } else if (command === 'predictive-trace-run') {
    let input = {};
    let outDir = output || 'output/v0.51/predictive-trace';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readPredictiveTraceInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writePredictiveTraceReports(outDir, input), null, 2));
  } else if (command === 'predictive-trace-spec') {
    const spec = buildPredictiveTraceSpec();
    const payload = { ok: true, spec, rcl: renderPredictiveTraceRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'predictive-trace-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'predictive-trace.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'temporal-fingerprint-demo') {
    console.log(JSON.stringify(runTemporalFingerprintDemo(), null, 2));
  } else if (command === 'temporal-fingerprint-run') {
    let input = {};
    let outDir = output || 'output/v0.52/temporal-fingerprint';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readTemporalFingerprintInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeTemporalFingerprintReports(outDir, input), null, 2));
  } else if (command === 'temporal-fingerprint-spec') {
    const spec = buildTemporalFingerprintSpec();
    const payload = { ok: true, spec, rcl: renderTemporalFingerprintRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'temporal-fingerprint-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'temporal-fingerprint.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'candidate-pressure-forge-demo') {
    console.log(JSON.stringify(runCandidatePressureForgeDemo(), null, 2));
  } else if (command === 'candidate-pressure-forge-run') {
    let input = {};
    let outDir = output || 'output/v0.53/candidate-pressure-forge';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readCandidatePressureForgeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeCandidatePressureForgeReports(outDir, input), null, 2));
  } else if (command === 'candidate-pressure-forge-spec') {
    const spec = buildCandidatePressureForgeSpec();
    const payload = { ok: true, spec, rcl: renderCandidatePressureForgeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'candidate-pressure-forge-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'candidate-pressure-forge.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'ecological-phase0-demo') {
    console.log(JSON.stringify(runEcologicalInjectionPhase0Demo(), null, 2));
  } else if (command === 'ecological-phase0-run') {
    let input = {};
    let outDir = output || 'output/v0.54/ecological-injection-phase0';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readEcologicalInjectionPhase0Input(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeEcologicalInjectionPhase0Reports(outDir, input), null, 2));
  } else if (command === 'ecological-phase0-spec') {
    const spec = buildEcologicalInjectionPhase0Spec();
    const payload = { ok: true, spec, rcl: renderEcologicalInjectionPhase0Rcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'ecological-phase0-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'ecological-phase0.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'type-module-demo') {
    console.log(JSON.stringify(runTypeModuleDemo(), null, 2));
  } else if (command === 'type-linked-demo') {
    console.log(JSON.stringify(runTypeLinkedCompilerDemo(), null, 2));
  } else if (command === 'type-constructor-demo') {
    console.log(JSON.stringify(runTypeConstructorDemo(), null, 2));
  } else if (command === 'type-package-demo') {
    console.log(JSON.stringify(runTypedPackageDemo(), null, 2));
  } else if (command === 'typed-bytecode-demo') {
    console.log(JSON.stringify(runTypedBytecodeLayoutDemo(), null, 2));
  } else if (command === 'typed-access-demo') {
    console.log(JSON.stringify(runTypedAccessPatternDemo(), null, 2));
  } else if (command === 'typed-heap-demo') {
    console.log(JSON.stringify(runTypedHeapLayoutDemo(), null, 2));
  } else if (command === 'typed-reference-demo') {
    console.log(JSON.stringify(runTypedReferenceAbiDemo(), null, 2));
  } else if (command === 'typed-gc-demo') {
    console.log(JSON.stringify(runTypedGcSnapshotDemo(), null, 2));
  } else if (command === 'debug-map-demo') {
    console.log(JSON.stringify(runDebugMapDemo(), null, 2));
  } else if (command === 'trace-run') {
    console.log(JSON.stringify(writeTraceRunReports(file, output, third, { watchpointsPath: fourth }), null, 2));
  } else if (command === 'replay-trace') {
    console.log(JSON.stringify(replayTrace(file, { outputDir: output }), null, 2));
  } else if (command === 'debug-session-demo') {
    console.log(JSON.stringify(runDebugSessionDemo(), null, 2));
  } else if (command === 'debug-session-run') {
    console.log(JSON.stringify(writeDebugSessionReports(file, output, third, { debugConfigPath: fourth }), null, 2));
  } else if (command === 'debug-step') {
    console.log(JSON.stringify(stepDebugSessionFromFiles(file, output ?? 'next', third), null, 2));
  } else if (command === 'profiler-demo') {
    console.log(JSON.stringify(runProfilerDemo(), null, 2));
  } else if (command === 'profile-run') {
    console.log(JSON.stringify(writeProfilerDebugUiReports(file, output, third, { debugConfigPath: fourth }), null, 2));
  } else if (command === 'replay-bundle') {
    console.log(JSON.stringify(writeReplayInputBundle(file, output), null, 2));
  } else if (command === 'debug-ui-demo') {
    console.log(JSON.stringify(runDebugUiDemo(), null, 2));
  } else if (command === 'debug-ui-protocol') {
    console.log(JSON.stringify(buildDebugUiProtocolFromFiles(file, output), null, 2));
  } else if (command === 'lsp-demo') {
    console.log(JSON.stringify(runLspDemo(), null, 2));
  } else if (command === 'lsp-index') {
    console.log(JSON.stringify(writeLspIndexReports(file, output, third), null, 2));
  } else if (command === 'lsp-query') {
    console.log(JSON.stringify(writeLspQueryReport(file, output ?? 'hover', third), null, 2));
  } else if (command === 'dap-demo') {
    console.log(JSON.stringify(runDapDemo(), null, 2));
  } else if (command === 'dap-bridge') {
    console.log(JSON.stringify(writeDapBridgeReports(file, output, { debugUiProtocolPath: third }), null, 2));
  } else if (command === 'ide-bridge') {
    console.log(JSON.stringify(writeIdeBridgeReports(file, output, third, { debugConfigPath: fourth }), null, 2));
  } else if (command === 'package-ecosystem-demo') {
    console.log(JSON.stringify(await runPackageEcosystemDemo(), null, 2));
  } else if (command === 'package-ecosystem-init') {
    console.log(JSON.stringify(initPackageEcosystem(file, output), null, 2));
  } else if (command === 'package-lock') {
    console.log(JSON.stringify(buildPackageLock(file), null, 2));
  } else if (command === 'package-lock-verify') {
    console.log(JSON.stringify(verifyPackageLock(file, output), null, 2));
  } else if (command === 'package-cache') {
    console.log(JSON.stringify(populateContentAddressedCache(file, output), null, 2));
  } else if (command === 'package-target-matrix') {
    console.log(JSON.stringify(await buildTargetMatrix(file, output), null, 2));
  } else if (command === 'package-release') {
    console.log(JSON.stringify(await buildReleaseBundle(file, output), null, 2));
  } else if (command === 'package-release-verify') {
    console.log(JSON.stringify(verifyReleaseBundle(file), null, 2));
  } else if (command === 'type-package-build') {
    console.log(JSON.stringify(compileTypedPackage(file, { lockPath: output }), null, 2));
  } else if (command === 'typed-bytecode-build') {
    console.log(JSON.stringify(compileTypedBytecodeFromFiles(file, output, { outputDir: third }), null, 2));
  } else if (command === 'typed-access-build') {
    console.log(JSON.stringify(compileTypedAccessPatternFromFiles(file, output, { outputDir: third }), null, 2));
  } else if (command === 'typed-heap-build') {
    console.log(JSON.stringify(compileTypedHeapLayoutFromFiles(file, output, { outputDir: third }), null, 2));
  } else if (command === 'typed-reference-build') {
    console.log(JSON.stringify(compileTypedReferenceAbiFromFiles(file, output, { outputDir: third }), null, 2));
  } else if (command === 'typed-gc-build') {
    console.log(JSON.stringify(compileTypedGcSnapshotFromFiles(file, output, { outputDir: third }), null, 2));
  } else if (command === 'type-package-verify') {
    console.log(JSON.stringify(verifyTypedPackageLock(file, { lockPath: output }), null, 2));
  } else if (command === 'compile-typed') {
    const source = fs.readFileSync(file, 'utf8');
    const result = tryCompileReality(source, { typeModuleDir: output });
    const payload = result.ok ? {
      ok: true,
      programRoot: result.program.programRoot,
      typeModuleRoot: result.typeModuleReport?.irRoot ?? null,
      semanticMap: result.program.semanticMap,
      sourceMap: result.program.sourceMap,
      typeBindings: result.program.typeBindings,
      diagnostics: [],
    } : { ok: false, diagnostics: result.diagnostics };
    if (third) fs.writeFileSync(third, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'type-module-check') {
    console.log(JSON.stringify(writeTypeModuleReport(file, output), null, 2));
  } else if (command === 'resource-isolation-demo') {
    console.log(JSON.stringify(await runResourceIsolationDemo(), null, 2));
  } else if (command === 'resource-lifecycle-demo') {
    console.log(JSON.stringify(await runResourceLifecycleDemo(), null, 2));
  } else if (command === 'resource-wal-demo') {
    console.log(JSON.stringify(await runResourceWalDemo({ baseDir: file }), null, 2));
  } else if (command === 'provider-v2-demo') {
    console.log(JSON.stringify(await runProviderV2Demo(), null, 2));
  } else if (command === 'rclapp-list') {
    console.log(JSON.stringify(listRclApps({ storeDir: file }), null, 2));
  } else if (command === 'rclapp-install') {
    console.log(JSON.stringify(installRclApp(file, { storeDir: output }), null, 2));
  } else if (command === 'rclapp-verify') {
    console.log(JSON.stringify(verifyRclApp(file, { storeDir: output }), null, 2));
  } else if (command === 'rclapp-run') {
    console.log(JSON.stringify(runRclApp(file, { storeDir: output }), null, 2));
  } else if (command === 'rclapp-uninstall') {
    console.log(JSON.stringify(uninstallRclApp(file, { storeDir: output }), null, 2));
  } else if (command === 'android-env') {
    console.log(JSON.stringify(detectAndroidBuildEnvironment(file || process.cwd()), null, 2));
  } else if (command === 'package-build-android') {
    console.log(JSON.stringify(buildAndroidDebugPackage(file, { executeBuild: true }), null, 2));
  } else if (command === 'package-verify') {
    console.log(JSON.stringify(verifyRclPackage(file), null, 2));
  } else if (command === 'package') {
    const target = output || 'all';
    if (target !== 'all' && !listRclPackageTargets().includes(target)) throw new Error(`Unknown package target '${target}'`);
    const result = await packageRclSource(file, { target, outputDir: third });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'disasm') {
    console.log(JSON.stringify(decodeBytecode(fs.readFileSync(file)), null, 2));
  } else if (command === 'native-run') {
    console.log(JSON.stringify(runNativeBytecode(file), null, 2));

  } else if (command === 'selfhost') {
    const result = bootstrapCompilerComplete({
      corePath: file || undefined,
      appPath: output || undefined,
      outputPath: third || undefined,
    });
    console.log(JSON.stringify({
      stage: result.stage,
      scope: result.scope,
      program: result.program,
      sourceRoot: result.sourceRoot,
      compilerArtifactPath: result.compilerArtifactPath,
      compilerArtifactBytes: result.compilerArtifactBytes,
      outputPath: result.outputPath,
      targetBytes: result.targetBytes,
      deterministicCompilerArtifact: result.deterministicCompilerArtifact,
      deterministicTarget: result.deterministicTarget,
      referenceParity: result.referenceParity,
      targetState: result.targetState,
      root: result.root,
      boundary: result.boundary,
    }, null, 2));
  } else if (command === 'bootstrap7') {
    const result = bootstrapCompilerStage7({ targetPath: file || undefined });
    console.log(JSON.stringify({
      stage: result.stage,
      scope: result.scope,
      program: result.program,
      tokenCount: result.tokenCount,
      declarationCount: result.declarationCount,
      semanticCount: result.semanticCount,
      loweredIrCount: result.loweredIrCount,
      counts: result.counts,
      semanticNodes: result.semanticNodes,
      loweredIr: result.loweredIr,
      deterministicSemantic: result.deterministicSemantic,
      deterministicLowering: result.deterministicLowering,
      acceptedSemanticConstructs: result.acceptedSemanticConstructs,
      acceptedLoweringConstructs: result.acceptedLoweringConstructs,
      root: result.root,
      boundary: result.boundary,
    }, null, 2));
  } else if (command === 'bootstrap9') {
    const result = bootstrapCompilerStage9({ stage9Path: file || undefined });
    console.log(JSON.stringify({
      stage: result.stage,
      scope: result.scope,
      artifactBytes: result.artifactBytes,
      artifactNSha256: result.artifactNSha256,
      artifactN1Sha256: result.artifactN1Sha256,
      byteIdenticalArtifactFixedPoint: result.byteIdenticalArtifactFixedPoint,
      semanticFixedPoint: result.semanticFixedPoint,
      signatureN: result.signatureN,
      signatureN1: result.signatureN1,
      root: result.root,
      boundary: result.boundary,
    }, null, 2));
  } else if (command === 'bootstrap8') {
    const result = bootstrapCompilerStage8({ targetPath: file || undefined });
    console.log(JSON.stringify({
      stage: result.stage,
      scope: result.scope,
      program: result.program,
      tokenCount: result.tokenCount,
      declarationCount: result.declarationCount,
      absorptionCount: result.absorptionCount,
      absorptionLoweredIrCount: result.absorptionLoweredIrCount,
      counts: result.counts,
      absorptionNodes: result.absorptionNodes,
      absorptionLoweredIr: result.absorptionLoweredIr,
      deterministicAbsorption: result.deterministicAbsorption,
      deterministicAbsorptionLowering: result.deterministicAbsorptionLowering,
      acceptedAbsorptionConstructs: result.acceptedAbsorptionConstructs,
      acceptedAbsorptionLoweringConstructs: result.acceptedAbsorptionLoweringConstructs,
      root: result.root,
      boundary: result.boundary,
    }, null, 2));
  } else if (command === 'bootstrap6') {
    const result = bootstrapCompilerStage6({ targetPath: file || undefined });
    console.log(JSON.stringify({
      stage: result.stage,
      scope: result.scope,
      program: result.program,
      tokenCount: result.tokenCount,
      declarationCount: result.declarationCount,
      counts: result.counts,
      declarations: result.declarations,
      deterministicParse: result.deterministicParse,
      acceptedConstructs: result.acceptedConstructs,
      root: result.root,
      boundary: result.boundary,
    }, null, 2));
  } else if (command === 'esoteric-mechanism-demo') {
    console.log(JSON.stringify(runEsotericMechanismDemo(), null, 2));
  } else if (command === 'esoteric-mechanism-run') {
    let input = {};
    let outDir = output || 'output/v0.55/esoteric-mechanism';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readEsotericMechanismInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeEsotericMechanismReports(outDir, input), null, 2));
  } else if (command === 'esoteric-mechanism-spec') {
    const spec = buildEsotericMechanismSpec();
    const payload = { ok: true, spec, rcl: renderEsotericMechanismRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'esoteric-mechanism-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'esoteric-mechanism.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'akashic-record-demo') {
    console.log(JSON.stringify(runAkashicRecordDemo(), null, 2));
  } else if (command === 'akashic-record-run') {
    let input = {};
    let outDir = output || 'output/v0.56/akashic-record';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readAkashicRecordInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeAkashicRecordReports(outDir, input), null, 2));
  } else if (command === 'akashic-record-spec') {
    const spec = buildAkashicRecordSpec();
    const payload = { ok: true, spec, rcl: renderAkashicRecordRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'akashic-record-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'akashic-record.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'self-akashic-record-demo') {
    console.log(JSON.stringify(runSelfAkashicRecordDemo(), null, 2));
  } else if (command === 'self-akashic-record-run') {
    let input = {};
    let outDir = output || 'output/v0.57/self-akashic-record';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readSelfAkashicRecordInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeSelfAkashicRecordReports(outDir, input), null, 2));
  } else if (command === 'self-akashic-record-spec') {
    const spec = buildSelfAkashicRecordSpec();
    const payload = { ok: true, spec, rcl: renderSelfAkashicRecordRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'self-akashic-record-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'self-akashic-record.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'future-rcl-akashic-demo') {
    console.log(JSON.stringify(runFutureRclAkashicDemo(), null, 2));
  } else if (command === 'future-rcl-akashic-run') {
    let input = {};
    let outDir = output || 'output/v0.58/future-rcl-akashic';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readFutureRclAkashicInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeFutureRclAkashicReports(outDir, input), null, 2));
  } else if (command === 'future-rcl-akashic-spec') {
    const spec = buildFutureRclAkashicSpec();
    const payload = { ok: true, spec, rcl: renderFutureRclAkashicRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'future-rcl-akashic-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'future-rcl-akashic.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'experiment-design-demo') {
    console.log(JSON.stringify(runExperimentDesignDemo(), null, 2));
  } else if (command === 'experiment-design-run') {
    let input = {};
    let outDir = output || 'output/v0.59/experiment-design-synthesizer';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readExperimentDesignInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeExperimentDesignReports(outDir, input), null, 2));
  } else if (command === 'experiment-design-spec') {
    const spec = buildExperimentDesignSpec();
    const payload = { ok: true, spec, rcl: renderExperimentDesignRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'experiment-design-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'experiment-design.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'mechanism-prototype-demo') {
    console.log(JSON.stringify(runMechanismToPrototypeDemo(), null, 2));
  } else if (command === 'mechanism-prototype-run') {
    let input = {};
    let outDir = output || 'output/v0.60/mechanism-to-prototype';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readMechanismToPrototypeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeMechanismToPrototypeReports(outDir, input), null, 2));
  } else if (command === 'mechanism-prototype-spec') {
    const spec = buildMechanismToPrototypeSpec();
    const payload = { ok: true, spec, rcl: renderMechanismToPrototypeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'mechanism-prototype-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'mechanism-prototype.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'empirical-lab-notebook-demo') {
    console.log(JSON.stringify(runEmpiricalLabNotebookDemo(), null, 2));
  } else if (command === 'empirical-lab-notebook-run') {
    let input = {};
    let outDir = output || 'output/v0.61/empirical-lab-notebook';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readEmpiricalLabNotebookInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeEmpiricalLabNotebookReports(outDir, input), null, 2));
  } else if (command === 'empirical-lab-notebook-spec') {
    const spec = buildEmpiricalLabNotebookSpec();
    const payload = { ok: true, spec, rcl: renderEmpiricalLabNotebookRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'empirical-lab-notebook-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'empirical-lab-notebook.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'civilization-tech-tree-demo') {
    console.log(JSON.stringify(runCivilizationTechnologyTreeDemo(), null, 2));
  } else if (command === 'civilization-tech-tree-run') {
    let input = {};
    let outDir = output || 'output/v0.62/civilization-tech-tree';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readCivilizationTechnologyTreeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeCivilizationTechnologyTreeReports(outDir, input), null, 2));
  } else if (command === 'civilization-tech-tree-spec') {
    const spec = buildCivilizationTechnologyTreeSpec();
    const payload = { ok: true, spec, rcl: renderCivilizationTechnologyTreeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'civilization-technology-tree-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'civilization-technology-tree.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'rncs-execution-bridge-v2-demo') {
    console.log(JSON.stringify(runRncsExecutionBridgeV2Demo(), null, 2));
  } else if (command === 'rncs-execution-bridge-v2-run') {
    let input = {};
    let outDir = output || 'output/v0.63/rncs-execution-bridge-v2';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readRncsExecutionBridgeV2Input(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeRncsExecutionBridgeV2Reports(outDir, input), null, 2));
  } else if (command === 'rncs-execution-bridge-v2-spec') {
    const spec = buildRncsExecutionBridgeV2Spec();
    const payload = { ok: true, spec, rcl: renderRncsExecutionBridgeV2Rcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'rncs-execution-bridge-v2-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'rncs-execution-bridge-v2.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'human-capability-feedback-demo') {
    console.log(JSON.stringify(runHumanCapabilityFeedbackOsDemo(), null, 2));
  } else if (command === 'human-capability-feedback-run') {
    let input = {};
    let outDir = output || 'output/v0.64/human-capability-feedback';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readHumanCapabilityFeedbackOsInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeHumanCapabilityFeedbackOsReports(outDir, input), null, 2));
  } else if (command === 'human-capability-feedback-spec') {
    const spec = buildHumanCapabilityFeedbackOsSpec();
    const payload = { ok: true, spec, rcl: renderHumanCapabilityFeedbackOsRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'human-capability-feedback-os-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'human-capability-feedback-os.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'reality-product-entry-demo') {
    console.log(JSON.stringify(runRealityProductEntryRuntimeDemo(), null, 2));
  } else if (command === 'reality-product-entry-run') {
    let input = {};
    let outDir = output || 'output/v0.65/reality-product-entry-runtime';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readRealityProductEntryRuntimeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeRealityProductEntryRuntimeReports(outDir, input), null, 2));
  } else if (command === 'reality-product-entry-spec') {
    const spec = buildRealityProductEntryRuntimeSpec();
    const payload = { ok: true, spec, rcl: renderRealityProductEntryRuntimeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'reality-product-entry-runtime-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'reality-product-entry-runtime.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'recursive-future-release-demo') {
    console.log(JSON.stringify(runRecursiveFutureReleasePlannerDemo(), null, 2));
  } else if (command === 'recursive-future-release-run') {
    let input = {};
    let outDir = output || 'output/v0.66/recursive-future-release-planner';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readRecursiveFutureReleasePlannerInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeRecursiveFutureReleasePlannerReports(outDir, input), null, 2));
  } else if (command === 'recursive-future-release-spec') {
    const spec = buildRecursiveFutureReleasePlannerSpec();
    const payload = { ok: true, spec, rcl: renderRecursiveFutureReleasePlannerRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'recursive-future-release-planner-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'recursive-future-release-planner.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'evidence-product-shell-demo') {
    console.log(JSON.stringify(runEvidenceProductShellRuntimeDemo(), null, 2));
  } else if (command === 'evidence-product-shell-run') {
    let input = {};
    let outDir = output || 'output/v0.67/evidence-product-shell-runtime';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readEvidenceProductShellRuntimeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeEvidenceProductShellRuntimeReports(outDir, input), null, 2));
  } else if (command === 'evidence-product-shell-spec') {
    const spec = buildEvidenceProductShellRuntimeSpec();
    const payload = { ok: true, spec, rcl: renderEvidenceProductShellRuntimeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'evidence-product-shell-runtime-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'evidence-product-shell-runtime.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'prototype-simulation-demo') {
    console.log(JSON.stringify(runPrototypeSimulationRuntimeDemo(), null, 2));
  } else if (command === 'prototype-simulation-run') {
    let input = {};
    let outDir = output || 'output/v0.70/prototype-simulation-runtime';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readPrototypeSimulationRuntimeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writePrototypeSimulationRuntimeReports(outDir, input), null, 2));
  } else if (command === 'prototype-simulation-spec') {
    const spec = buildPrototypeSimulationRuntimeSpec();
    const payload = { ok: true, spec, rcl: renderPrototypeSimulationRuntimeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'prototype-simulation-runtime-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'prototype-simulation-runtime.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'real-world-data-ingestion-demo') {
    console.log(JSON.stringify(runRealWorldDataIngestionLayerDemo(), null, 2));
  } else if (command === 'real-world-data-ingestion-run') {
    let input = {};
    let outDir = output || 'output/v0.71/real-world-data-ingestion-layer';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readRealWorldDataIngestionLayerInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeRealWorldDataIngestionLayerReports(outDir, input), null, 2));
  } else if (command === 'real-world-data-ingestion-spec') {
    const spec = buildRealWorldDataIngestionLayerSpec();
    const payload = { ok: true, spec, rcl: renderRealWorldDataIngestionLayerRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'real-world-data-ingestion-layer-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'real-world-data-ingestion-layer.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'multi-agent-verification-council-demo') {
    console.log(JSON.stringify(runMultiAgentVerificationCouncilDemo(), null, 2));
  } else if (command === 'multi-agent-verification-council-run') {
    let input = {};
    let outDir = output || 'output/v0.72/multi-agent-verification-council';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readMultiAgentVerificationCouncilInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeMultiAgentVerificationCouncilReports(outDir, input), null, 2));
  } else if (command === 'multi-agent-verification-council-spec') {
    const spec = buildMultiAgentVerificationCouncilSpec();
    const payload = { ok: true, spec, rcl: renderMultiAgentVerificationCouncilRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'multi-agent-verification-council-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'multi-agent-verification-council.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'llm-like-runtime-demo') {
    console.log(JSON.stringify(runLlmLikeRuntimeDemo(), null, 2));
  } else if (command === 'llm-like-runtime-run') {
    let input = {};
    let outDir = output || 'output/v0.78/llm-like-runtime';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readLlmLikeRuntimeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeLlmLikeRuntimeReports(outDir, input), null, 2));
  } else if (command === 'llm-like-runtime-spec') {
    const spec = buildLlmLikeRuntimeSpec();
    const payload = { ok: true, spec, rcl: renderLlmLikeRuntimeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'llm-like-runtime-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'llm-like-runtime.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'composite-provider-router-demo') {
    console.log(JSON.stringify(runCompositeProviderRouterDemo(), null, 2));
  } else if (command === 'composite-provider-router-run') {
    let input = {};
    let outDir = output || 'output/v0.78.1/composite-provider-router';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readCompositeProviderRouterInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeCompositeProviderRouterReports(outDir, input), null, 2));
  } else if (command === 'composite-provider-router-spec') {
    const spec = normalizeCompositeProviderRouterSpec();
    const payload = { ok: true, spec, rcl: renderCompositeProviderRouterRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'composite-provider-router-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'composite-provider-router.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'unknown-framework-gap-closure-demo') {
    console.log(JSON.stringify(runUnknownFrameworkGapClosureDemo(), null, 2));
  } else if (command === 'unknown-framework-gap-closure-run') {
    let input = {};
    let outDir = output || 'output/v0.79/unknown-framework-gap-closure';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readUnknownFrameworkGapClosureInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeUnknownFrameworkGapClosureReports(outDir, input), null, 2));
  } else if (command === 'unknown-framework-gap-closure-spec') {
    const spec = buildUnknownFrameworkGapClosureSpec();
    const payload = { ok: true, spec, rcl: renderUnknownFrameworkGapClosureRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'unknown-framework-gap-closure-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'unknown-framework-gap-closure.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'self-upgrade-team-demo') {
    console.log(JSON.stringify(runSelfUpgradeTeamSandboxDemo(), null, 2));
  } else if (command === 'self-upgrade-team-run') {
    let input = {};
    let outDir = output || 'output/v0.80/self-upgrade-team-sandbox';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readSelfUpgradeTeamSandboxInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeSelfUpgradeTeamSandboxReports(outDir, input), null, 2));
  } else if (command === 'self-upgrade-team-spec') {
    const spec = buildSelfUpgradeTeamSandboxSpec();
    const payload = { ok: true, spec, rcl: renderSelfUpgradeTeamSandboxRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'self-upgrade-team-sandbox-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'self-upgrade-team-sandbox.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'source-map-patch-queue-demo') {
    console.log(JSON.stringify(runSourceMapPatchQueueDemo(), null, 2));
  } else if (command === 'source-map-patch-queue-run') {
    let input = {};
    let outDir = output || 'output/v0.81/source-map-patch-queue';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readSourceMapPatchQueueInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeSourceMapPatchQueueReports(outDir, input), null, 2));
  } else if (command === 'source-map-patch-queue-spec') {
    const spec = buildSourceMapPatchQueueSpec();
    const payload = { ok: true, spec, rcl: renderSourceMapPatchQueueRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'source-map-patch-queue-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'source-map-patch-queue.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'agent-civilization-demo') {
    console.log(JSON.stringify(runAgentCivilizationSandboxDemo(), null, 2));
  } else if (command === 'agent-civilization-run') {
    let input = {};
    let outDir = output || 'output/v0.82/agent-civilization-sandbox';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readAgentCivilizationSandboxInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeAgentCivilizationSandboxReports(outDir, input), null, 2));
  } else if (command === 'agent-civilization-spec') {
    const spec = buildAgentCivilizationSandboxSpec();
    const payload = { ok: true, spec, rcl: renderAgentCivilizationSandboxRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'agent-civilization-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'agent-civilization-sandbox.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'founder-twin-agent-city-demo') {
    console.log(JSON.stringify(runFounderTwinAgentCityAcceleratorDemo(), null, 2));
  } else if (command === 'founder-twin-agent-city-run') {
    let input = {};
    let outDir = output || 'output/v0.83/founder-twin-agent-city';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readFounderTwinAgentCityAcceleratorInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeFounderTwinAgentCityAcceleratorReports(outDir, input), null, 2));
  } else if (command === 'founder-twin-agent-city-spec') {
    const spec = buildFounderTwinAgentCityAcceleratorSpec();
    const payload = { ok: true, spec, rcl: renderFounderTwinAgentCityAcceleratorRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'founder-twin-agent-city-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'founder-twin-agent-city.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'ial-civilization-product-os-demo') {
    console.log(JSON.stringify(runIalCivilizationProductOsDemo(), null, 2));
  } else if (command === 'ial-civilization-product-os-run') {
    let input = {};
    let outDir = output || 'output/v0.84/ial-civilization-product-os';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readIalCivilizationProductOsInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeIalCivilizationProductOsReports(outDir, input), null, 2));
  } else if (command === 'ial-civilization-product-os-spec') {
    const spec = buildIalCivilizationProductOsSpec();
    const payload = { ok: true, spec, rcl: renderIalCivilizationProductOsRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'ial-civilization-product-os-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'ial-civilization-product-os.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'memory-to-product-foundry-demo') {
    console.log(JSON.stringify(runMemoryToProductFoundryDemo(), null, 2));
  } else if (command === 'memory-to-product-foundry-run') {
    let input = {};
    let outDir = output || 'output/v0.85/memory-to-product-foundry';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readMemoryToProductFoundryInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeMemoryToProductFoundryReports(outDir, input), null, 2));
  } else if (command === 'memory-to-product-foundry-spec') {
    const spec = buildMemoryToProductFoundrySpec();
    const payload = { ok: true, spec, rcl: renderMemoryToProductFoundryRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'memory-to-product-foundry-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'memory-to-product-foundry.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));

  } else if (command === 'agent-civilization-federation-demo') {
    console.log(JSON.stringify(runAgentCivilizationFederationDemo(), null, 2));
  } else if (command === 'agent-civilization-federation-run') {
    let input = {};
    let outDir = output || 'output/v0.86/agent-civilization-federation';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readAgentCivilizationFederationInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeAgentCivilizationFederationReports(outDir, input), null, 2));
  } else if (command === 'agent-civilization-federation-spec') {
    const spec = buildAgentCivilizationFederationSpec();
    const payload = { ok: true, spec, rcl: renderAgentCivilizationFederationRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'agent-civilization-federation-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'agent-civilization-federation.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'blue-sky-worldview-blindtest-demo') {
    console.log(JSON.stringify(runBlueSkyWorldviewBlindtestSandboxDemo(), null, 2));
  } else if (command === 'blue-sky-worldview-blindtest-run') {
    let input = {};
    let outDir = output || 'output/v0.88/blue-sky-worldview-blindtest';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readBlueSkyWorldviewBlindtestInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeBlueSkyWorldviewBlindtestReports(outDir, input), null, 2));
  } else if (command === 'blue-sky-worldview-blindtest-spec') {
    const spec = buildBlueSkyWorldviewBlindtestSpec();
    const payload = { ok: true, spec, rcl: renderBlueSkyWorldviewBlindtestRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'blue-sky-world-demo') {
    console.log(JSON.stringify(runBlueSkyInnerUniverseWorldSandboxDemo(), null, 2));
  } else if (command === 'blue-sky-world-run') {
    let input = {};
    let outDir = output || 'output/v0.88/blue-sky-inner-universe-world-sandbox';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readBlueSkyInnerUniverseWorldInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeBlueSkyInnerUniverseWorldReports(outDir, input), null, 2));
  } else if (command === 'blue-sky-world-spec') {
    const spec = buildBlueSkyInnerUniverseWorldSpec();
    const payload = { ok: true, spec, rcl: renderBlueSkyInnerUniverseWorldRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blue-sky-inner-universe-world-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'blue-sky-inner-universe-world-sandbox.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'soul-universe-dialogue-demo') {
    console.log(JSON.stringify(runSoulUniverseDialogueSandboxDemo(), null, 2));
  } else if (command === 'soul-universe-dialogue-run') {
    let input = {};
    let outDir = output || 'output/v0.87/soul-universe-dialogue-sandbox';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readSoulUniverseDialogueInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeSoulUniverseDialogueReports(outDir, input), null, 2));
  } else if (command === 'soul-universe-dialogue-spec') {
    const spec = buildSoulUniverseDialogueSpec();
    const payload = { ok: true, spec, rcl: renderSoulUniverseDialogueRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'soul-universe-dialogue-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'soul-universe-dialogue-sandbox.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'inner-universe-blind-planet-demo') {
    console.log(JSON.stringify(runBlueSkyWorldviewBlindtestSandboxDemo(), null, 2));
  } else if (command === 'inner-universe-blind-planet-run') {
    let input = {};
    let outDir = output || 'output/v0.88/blue-sky-worldview-blindtest';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readBlueSkyWorldviewBlindtestInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeBlueSkyWorldviewBlindtestReports(outDir, input), null, 2));
  } else if (command === 'inner-universe-blind-planet-spec') {
    const spec = buildBlueSkyWorldviewBlindtestSpec();
    const payload = { ok: true, spec, rcl: renderBlueSkyWorldviewBlindtestRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'inner-universe-worldview-demo') {
    console.log(JSON.stringify(runBlueSkyWorldviewBlindtestSandboxDemo(), null, 2));
  } else if (command === 'inner-universe-worldview-run') {
    let input = {};
    let outDir = output || 'output/v0.88/blue-sky-worldview-blindtest';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readBlueSkyWorldviewBlindtestInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeBlueSkyWorldviewBlindtestReports(outDir, input), null, 2));
  } else if (command === 'inner-universe-worldview-spec') {
    const spec = buildBlueSkyWorldviewBlindtestSpec();
    const payload = { ok: true, spec, rcl: renderBlueSkyWorldviewBlindtestRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'blue-sky-world-anchor-demo') {
    console.log(JSON.stringify(runBlueSkyWorldviewBlindtestSandboxDemo(), null, 2));
  } else if (command === 'blue-sky-world-anchor-run') {
    let input = {};
    let outDir = output || 'output/v0.88/blue-sky-worldview-blindtest';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readBlueSkyWorldviewBlindtestInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeBlueSkyWorldviewBlindtestReports(outDir, input), null, 2));
  } else if (command === 'blue-sky-world-anchor-spec') {
    const spec = buildBlueSkyWorldviewBlindtestSpec();
    const payload = { ok: true, spec, rcl: renderBlueSkyWorldviewBlindtestRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'blue-sky-worldview-blindtest.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'super-agent-runtime-demo') {
    console.log(JSON.stringify(runSuperAgentRuntimeDemo(), null, 2));
  } else if (command === 'super-agent-runtime-run') {
    let input = {};
    let outDir = output || 'output/v0.77/super-agent-runtime';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readSuperAgentRuntimeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeSuperAgentRuntimeReports(outDir, input), null, 2));
  } else if (command === 'super-agent-runtime-spec') {
    const spec = buildSuperAgentRuntimeSpec();
    const payload = { ok: true, spec, rcl: renderSuperAgentRuntimeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'super-agent-runtime-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'super-agent-runtime.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'universe-knowledge-runtime-demo') {
    console.log(JSON.stringify(runUniverseKnowledgeRuntimeDemo(), null, 2));
  } else if (command === 'universe-knowledge-runtime-run') {
    let input = {};
    let outDir = output || 'output/v0.76/universe-knowledge-runtime';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readUniverseKnowledgeRuntimeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeUniverseKnowledgeRuntimeReports(outDir, input), null, 2));
  } else if (command === 'universe-knowledge-runtime-spec') {
    const spec = buildUniverseKnowledgeRuntimeSpec();
    const payload = { ok: true, spec, rcl: renderUniverseKnowledgeRuntimeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'universe-knowledge-runtime-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'universe-knowledge-runtime.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'universal-semantic-translator-demo') {
    console.log(JSON.stringify(runUniversalSemanticTranslatorDemo(), null, 2));
  } else if (command === 'universal-semantic-translator-run') {
    let input = {};
    let outDir = output || 'output/v0.75/universal-semantic-translator';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readUniversalSemanticTranslatorInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeUniversalSemanticTranslatorReports(outDir, input), null, 2));
  } else if (command === 'universal-semantic-translator-spec') {
    const spec = buildUniversalSemanticTranslatorSpec();
    const payload = { ok: true, spec, rcl: renderUniversalSemanticTranslatorRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'universal-semantic-translator-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'universal-semantic-translator.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'recursive-governance-demo') {
    console.log(JSON.stringify(runRecursiveGovernanceKernelDemo(), null, 2));
  } else if (command === 'recursive-governance-run') {
    let input = {};
    let outDir = output || 'output/v0.74/recursive-governance-kernel';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readRecursiveGovernanceKernelInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeRecursiveGovernanceKernelReports(outDir, input), null, 2));
  } else if (command === 'recursive-governance-spec') {
    const spec = buildRecursiveGovernanceKernelSpec();
    const payload = { ok: true, spec, rcl: renderRecursiveGovernanceKernelRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'recursive-governance-kernel-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'recursive-governance-kernel.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'living-artifact-demo') {
    console.log(JSON.stringify(runLivingArtifactRuntimeDemo(), null, 2));
  } else if (command === 'living-artifact-run') {
    let input = {};
    let outDir = output || 'output/v0.73/living-artifact-runtime';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readLivingArtifactRuntimeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeLivingArtifactRuntimeReports(outDir, input), null, 2));
  } else if (command === 'living-artifact-spec') {
    const spec = buildLivingArtifactRuntimeSpec();
    const payload = { ok: true, spec, rcl: renderLivingArtifactRuntimeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'living-artifact-runtime-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'living-artifact-runtime.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'experiment-automation-demo') {
    console.log(JSON.stringify(runExperimentAutomationAdapterDemo(), null, 2));
  } else if (command === 'experiment-automation-run') {
    let input = {};
    let outDir = output || 'output/v0.69/experiment-automation-adapter';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readExperimentAutomationAdapterInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeExperimentAutomationAdapterReports(outDir, input), null, 2));
  } else if (command === 'experiment-automation-spec') {
    const spec = buildExperimentAutomationAdapterSpec();
    const payload = { ok: true, spec, rcl: renderExperimentAutomationAdapterRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'experiment-automation-adapter-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'experiment-automation-adapter.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'aether-forge-pocket-bridge-demo') {
    console.log(JSON.stringify(runAetherForgePocketProductBridgeDemo(), null, 2));
  } else if (command === 'aether-forge-pocket-bridge-run') {
    let input = {};
    let outDir = output || 'output/v0.68/aether-forge-pocket-product-bridge';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readAetherForgePocketProductBridgeInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeAetherForgePocketProductBridgeReports(outDir, input), null, 2));
  } else if (command === 'aether-forge-pocket-bridge-spec') {
    const spec = buildAetherForgePocketProductBridgeSpec();
    const payload = { ok: true, spec, rcl: renderAetherForgePocketProductBridgeRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'aether-forge-pocket-product-bridge-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'aether-forge-pocket-product-bridge.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));

  } else if (command === 'cosmogenic-parameter-inversion-demo') {
    console.log(JSON.stringify(runCosmogenicParameterInversionDemo(), null, 2));
  } else if (command === 'cosmogenic-parameter-inversion-run') {
    let input = {};
    let outDir = output || 'output/v0.90/cosmogenic-parameter-inversion';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readCosmogenicParameterInversionInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeCosmogenicParameterInversionReports(outDir, input), null, 2));
  } else if (command === 'cosmogenic-parameter-inversion-spec') {
    const spec = buildCosmogenicParameterInversionSpec();
    const payload = { ok: true, spec, rcl: renderCosmogenicParameterInversionRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'cosmogenic-parameter-inversion-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'cosmogenic-parameter-inversion.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'blue-sky-cosmogenic-projection-demo') {
    console.log(JSON.stringify(runBlueSkyCosmogenicProjectionDemo(), null, 2));
  } else if (command === 'blue-sky-cosmogenic-projection-run') {
    let input = {};
    let outDir = output || 'output/v0.91/blue-sky-cosmogenic-projection';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readBlueSkyCosmogenicProjectionInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeBlueSkyCosmogenicProjectionReports(outDir, input), null, 2));
  } else if (command === 'blue-sky-cosmogenic-projection-spec') {
    const spec = buildBlueSkyCosmogenicProjectionSpec({ corpusText: Array(16).fill('命序界 十二长生 绝 胎 养 承 帝旺 超序 蓝天机 风云策 万变 DU-HENG DH–Ω 判断 迟疑 灰区 天策府 并行结构 不可建模项 前提撤销 最优解 以太文明 帝级以太语言 慢下来 责任 判断权').join(' ') });
    const payload = { ok: true, spec, rcl: renderBlueSkyCosmogenicProjectionRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blue-sky-cosmogenic-projection-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
      fs.writeFileSync(path.join(dir, 'blue-sky-cosmogenic-projection.rcl'), `${payload.rcl}\n`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'superconductor-candidate-inversion-demo') {
    console.log(JSON.stringify(runSuperconductorCandidateInversionDemo(), null, 2));
  } else if (command === 'superconductor-candidate-inversion-run') {
    let input = {};
    let outDir = output || 'output/v0.92/superconductor-candidate-inversion';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readSuperconductorCandidateInversionInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeSuperconductorCandidateInversionReports(outDir, input), null, 2));
  } else if (command === 'superconductor-candidate-inversion-spec') {
    const spec = buildSuperconductorCandidateInversionSpec();
    const payload = { ok: true, spec, rcl: renderSuperconductorCandidateInversionRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'superconductor-candidate-inversion-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'superconductor-candidate-inversion.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'sandbox-file-transmission-demo') {
    console.log(JSON.stringify(runSandboxComputerFileTransmissionDemo(), null, 2));
  } else if (command === 'sandbox-file-transmission-run') {
    let input = {};
    let outDir = output || 'output/v0.93/sandbox-computer-file-transmission';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readSandboxTransmissionInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeSandboxComputerFileTransmissionReports(outDir, input), null, 2));
  } else if (command === 'sandbox-file-transmission-spec') {
    const spec = buildSandboxComputerTransmissionSpec();
    const payload = { ok: true, spec, rcl: renderSandboxComputerTransmissionRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'sandbox-computer-file-transmission-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'sandbox-computer-file-transmission.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'autonomous-file-emission-demo') {
    console.log(JSON.stringify(runAutonomousSandboxFileEmissionDemo(), null, 2));
  } else if (command === 'autonomous-file-emission-run') {
    let input = {};
    let outDir = output || 'output/v0.94/autonomous-sandbox-file-emission';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readAutonomousSandboxFileEmissionInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeAutonomousSandboxFileEmissionReports(outDir, input), null, 2));
  } else if (command === 'autonomous-file-emission-spec') {
    const spec = buildAutonomousSandboxFileEmissionSpec();
    const payload = { ok: true, spec, rcl: renderAutonomousSandboxFileEmissionRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'autonomous-sandbox-file-emission-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'autonomous-sandbox-file-emission.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'real-universe-coordinate-blindtest-demo' || command === 'real-universe-coordinate-demo') {
    console.log(JSON.stringify(runRealUniverseCoordinateBlindtestDemo(), null, 2));
  } else if (command === 'real-universe-coordinate-blindtest-run' || command === 'real-universe-coordinate-run') {
    let input = {};
    let outDir = output || 'output/v0.89/real-universe-coordinate-blindtest';
    if (file) {
      const candidate = path.resolve(file);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        input = readRealUniverseCoordinateBlindtestInput(candidate);
      } else {
        outDir = file;
      }
    }
    console.log(JSON.stringify(writeRealUniverseCoordinateBlindtestReports(outDir, input), null, 2));
  } else if (command === 'real-universe-coordinate-blindtest-spec' || command === 'real-universe-coordinate-spec') {
    const spec = buildRealUniverseCoordinateBlindtestSpec();
    const payload = { ok: true, spec, rcl: renderRealUniverseCoordinateBlindtestRcl(spec) };
    if (file || output) {
      const dir = path.resolve(file || output);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'real-universe-coordinate-blindtest-spec.json'), `${JSON.stringify(spec, null, 2)}
`);
      fs.writeFileSync(path.join(dir, 'real-universe-coordinate-blindtest.rcl'), `${payload.rcl}
`);
    }
    console.log(JSON.stringify(payload, null, 2));
  } else if (command === 'bootstrap5') {
    const result = bootstrapCompilerStage5();
    console.log(JSON.stringify({
      stage: result.stage,
      modules: result.modules,
      symbolCount: result.symbols.length,
      semanticCount: result.semantic.length,
      irCount: result.ir.length,
      targetBytes: result.targetBytecode.length,
      deterministic: result.deterministic,
      referenceParity: result.referenceParity,
      targetState: result.targetRun.state,
      boundary: result.boundary,
    }, null, 2));
  } else if (command === 'bootstrap4') {
    const result = bootstrapCompilerStage4();
    console.log(JSON.stringify({
      stage: result.stage,
      modules: result.modules,
      imports: result.imports,
      coreAstCount: result.coreAst.length,
      appAstCount: result.appAst.length,
      symbolCount: result.symbols.length,
      semanticCount: result.semantic.length,
      irCount: result.ir.length,
      targetState: result.targetRun.state,
      boundary: result.boundary,
    }, null, 2));
  } else if (command === 'bootstrap3') {
    const result = bootstrapCompilerStage3();
    console.log(JSON.stringify({
      stage: result.stage,
      tokenCount: result.tokens.length,
      astCount: result.ast.length,
      symbolCount: result.symbols.length,
      semanticCount: result.semantic.length,
      irCount: result.ir.length,
      targetState: result.targetRun.state,
      boundary: result.boundary,
    }, null, 2));
  } else if (command === 'bootstrap2') {
    const result = bootstrapCompilerStage2();
    console.log(JSON.stringify({
      stage: result.stage, tokenCount: result.tokens.length, ast: result.ast,
      targetState: result.targetRun.state, boundary: result.boundary,
    }, null, 2));
  } else if (command === 'bootstrap') {
    const result = bootstrapCompilerSeed();
    console.log(JSON.stringify({
      stage: result.stage,
      compilerState: result.compilerRun.state,
      targetState: result.targetRun.state,
      boundary: result.boundary,
    }, null, 2));
  } else {
    const source = fs.readFileSync(file, 'utf8');
    if (command === 'compile') console.log(JSON.stringify(compileReality(source), null, 2));
    else if (command === 'run') console.log(JSON.stringify(await runReality(source), null, 2));
    else if (command === 'absorb') console.log(JSON.stringify(materializeRclAbsorptionKernel(source), null, 2));
    else if (command === 'native') console.log(JSON.stringify(runNativeBytecode(compileSourceSelfHosted(source)), null, 2));
    else if (command === 'bytecode') {
      const target = output ?? path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.rbc`);
      const result = compileSourceFileSelfHosted(file, target);
      console.log(JSON.stringify({
        status: 'ok',
        compiler: 'rcl-selfhost-native',
        compilerArtifact: DEFAULT_GENERAL_SELFHOST_COMPILER_ARTIFACT_PATH,
        output: target,
        bytes: result.bytecode.length,
      }, null, 2));
    }
  }
} catch (error) {
  console.error(error.stack ?? String(error));
  process.exit(1);
}
