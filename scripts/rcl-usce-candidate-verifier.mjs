#!/usr/bin/env node
import fs from 'node:fs';
import { verifyCandidateEnvelope } from '../src/candidate-verifier.mjs';

const CAPABILITY = 'candidate.verify.v1';

export function handle(request = {}) {
  if (request.action === 'handshake') {
    return {
      schema_id: 'rcl.usce-candidate-verifier-handshake.v0.1',
      status: 'REACHABLE_CANDIDATE',
      organ_id: 'rcl',
      surface_id: 'candidate-verification',
      capabilities: [CAPABILITY],
      canonical_domains: ['semantic.governed_envelope'],
      canonical_promotion_performed: false,
      rcl_evidence_commit_performed: false,
      world_fact_promoted: false,
      rncs_reality_commit_performed: false
    };
  }
  if (request.action !== 'invoke') throw new Error('RCL_CANDIDATE_VERIFY_ACTION_UNSUPPORTED');
  if (request.capability_id !== CAPABILITY) throw new Error('RCL_CANDIDATE_VERIFY_CAPABILITY_UNSUPPORTED');
  if (!request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload)) {
    throw new Error('RCL_CANDIDATE_VERIFY_PAYLOAD_INVALID');
  }
  return verifyCandidateEnvelope(request.payload);
}

const isMain = process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname;
if (isMain) {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    const request = JSON.parse(raw);
    process.stdout.write(`${JSON.stringify(handle(request))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: 'ERROR', code: error.code ?? 'RCL_CANDIDATE_VERIFY_ERROR', message: error.message })}\n`);
    process.exitCode = 1;
  }
}
