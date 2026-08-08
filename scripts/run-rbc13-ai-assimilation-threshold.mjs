#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderRbc13AiAssimilationThresholdMarkdown,
  runRbc13AiAssimilationThreshold,
} from '../src/rbc13-ai-assimilation-threshold.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contractPath = path.join(ROOT, 'examples', 'rbc13-ai-donor-json-schema-contract.json');
const previousPath = path.join(ROOT, 'output', 'rbc13-ai-generate-json-schema', 'report.json');
const outputDir = path.resolve(process.argv[2] ?? path.join(ROOT, 'output', 'rbc13-ai-assimilation-threshold'));
const baseline = fs.existsSync(previousPath)
  ? (() => {
    const prior = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
    return {
      status: prior.status,
      model: prior.model,
      root: prior.root ?? null,
      promptRoot: prior.promptRoot ?? null,
      responseRoot: prior.responseRoot ?? null,
      successfulTrials: prior.successfulTrials ?? 0,
      requiredTrials: prior.requiredTrials ?? 1,
    };
  })()
  : null;
const report = await runRbc13AiAssimilationThreshold({ contractPath, baseline });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'ai_assimilation_threshold_results.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(ROOT, 'docs', 'RCL_AI_ASSIMILATION_INTELLIGENCE_THRESHOLD_v0.1.md'), renderRbc13AiAssimilationThresholdMarkdown(report));
process.stdout.write(`${JSON.stringify({
  output: path.join(outputDir, 'ai_assimilation_threshold_results.json'),
  status: report.status,
  root: report.root,
  minimumObservedLevel: report.summary.minimumObservedLevel,
  maximumObservedLevel: report.summary.maximumObservedLevel,
  humanInterventions: report.summary.humanInterventions,
  attempts: report.attempts.map(item => ({ tier: item.tier, model: item.model, status: item.status, level: item.level })),
}, null, 2)}\n`);
if (report.status === 'BLOCKED') process.exitCode = 2;
