import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runMultiAgentVerificationCouncilDemo,
  runMultiAgentVerificationCouncil,
  buildMultiAgentVerificationCouncilSpec,
  renderMultiAgentVerificationCouncilRcl,
} from '../src/multi-agent-verification-council.mjs';

test('multi-agent verification council demo establishes v0.72 runtime', () => {
  const bundle = runMultiAgentVerificationCouncilDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.multiAgentVerificationCouncilEstablished, true);
  assert.equal(bundle.result.verificationSessionCount, 8);
  assert.equal(bundle.result.councilMemberCount, 64);
  assert.equal(bundle.result.dissentLedgerCount, 8);
  assert.equal(bundle.result.consensusDecisionCount, 8);
  assert.equal(bundle.result.blindAuditCount, 8);
  assert.equal(bundle.result.redTeamReviewCount, 8);
  assert.equal(bundle.result.humanAuthorityGateCount, 8);
  assert.equal(bundle.result.evidenceWritebackCount, 8);
  assert.equal(bundle.result.livingArtifactHandoffCount, 8);
  assert.equal(bundle.result.averageVerificationScore, 1);
  assert.equal(bundle.result.livingArtifactHandoffReady, true);
});

test('verification sessions include independent roles, dissent and consensus', () => {
  const bundle = runMultiAgentVerificationCouncil({});
  assert.equal(bundle.sessions.length, 8);
  for (const session of bundle.sessions) {
    assert.equal(session.councilMembers.length, 8);
    assert.ok(session.councilMembers.some(m => m.roleId === 'red_team_falsifier'));
    assert.ok(session.councilMembers.some(m => m.roleId === 'blind_holdout_auditor'));
    assert.ok(session.councilMembers.some(m => m.roleId === 'human_authority_delegate'));
    assert.ok(session.dissentLedger.objections.length >= 1);
    assert.equal(session.consensusDecision.decision, 'verified-for-living-artifact-handoff');
    assert.equal(session.consensusDecision.blindAuditGate, true);
    assert.equal(session.consensusDecision.redTeamGate, true);
    assert.equal(session.consensusDecision.humanAuthorityGate, true);
    assert.equal(session.livingArtifactHandoffReady, true);
    assert.equal(session.verificationScore, 1);
  }
});

test('multi-agent verification council spec renders RCL declaration', () => {
  const spec = buildMultiAgentVerificationCouncilSpec({});
  const rcl = renderMultiAgentVerificationCouncilRcl(spec);
  assert.match(rcl, /MultiAgentVerificationCouncilV072/);
  assert.match(rcl, /requireRedTeamFalsifier/);
  assert.match(rcl, /v0\.73 Living Artifact Runtime/);
});
