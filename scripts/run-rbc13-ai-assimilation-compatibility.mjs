#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderRbc13CapabilityAssimilationCompatibilitySurfaceMarkdown,
  runRbc13CapabilityAssimilationCompatibilitySurface,
} from '../src/rbc13-capability-assimilation-compatibility-surface.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'output', 'rbc13-ai-assimilation-compatibility'));
const report = await runRbc13CapabilityAssimilationCompatibilitySurface();
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'compatibility_surface_results.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(ROOT, 'docs', 'RCL_CAPABILITY_ASSIMILATION_COMPATIBILITY_SURFACE_v0.1.md'), renderRbc13CapabilityAssimilationCompatibilitySurfaceMarkdown(report));
fs.writeFileSync(path.join(ROOT, 'docs', 'RCL_JSON_SCHEMA_INDEPENDENT_DONOR_ORACLE_v0.1.md'), `# RCL JSON Schema Independent Donor Oracle v0.1\n\n- Status: **${report.oracle.processBoundary && report.oracle.sharedCandidateImports === false ? 'VERIFIED' : 'BLOCKED'}**\n- Evidence root: \`${report.root}\`\n- Implementation: **${report.oracle.implementation}**\n- Exact dependency: **${report.oracle.dependency}**\n- Process boundary: ${report.oracle.processBoundary}\n- Shared candidate imports: **${report.oracle.sharedCandidateImports}**\n- Semantic projection: ${report.oracle.semanticProjection.join(', ')}\n\n## Supported fixed subset\n\n${report.donor.subset.supported.map(item => `- \`${item}\``).join('\n')}\n\n## Corpus and controls\n\n- Corpus root: \`${report.corpus.root}\`\n- Cases: ${report.corpus.caseCount} (${report.corpus.classificationCounts.positive} positive / ${report.corpus.classificationCounts.negative} negative / ${report.corpus.classificationCounts.boundary} boundary)\n- Mutation controls: ${report.corpus.mutationControls.map(item => item.id).join(', ')}\n\n## Security and authority boundary\n\nThe oracle imports Ajv and Node built-ins only. It does not import RCL candidate validators, candidate helpers, candidate outputs, or prior research outputs. It runs as a separate process, fails closed on malformed input or schema compilation failure, and emits semantic errors with keyword, instancePath, schemaPath, and params. The oracle is an evidence source, not an execution-authority grant.\n\nReproduction: \`${report.reproductionCommand}\`\n`);
process.stdout.write(`${JSON.stringify({ output: path.join(outputDir, 'compatibility_surface_results.json'), status: report.status, root: report.root, bestAcl: report.summary.bestAcl, aclByModel: report.summary.aclByModel, formalA10: report.formalA10.status }, null, 2)}\n`);
if (report.status === 'BLOCKED') process.exitCode = 2;

