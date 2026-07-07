
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runMemoryToProductFoundryDemo,
  runMemoryToProductFoundry,
  buildMemoryToProductFoundrySpec,
  renderMemoryToProductFoundryRcl,
  renderMemoryFoundryWorkMethodMarkdown,
  writeMemoryToProductFoundryReports,
} from '../src/memory-to-product-foundry.mjs';

test('v0.85 establishes Memory-to-Product Foundry', () => {
  const bundle = runMemoryToProductFoundryDemo();
  assert.equal(bundle.ok, true);
  assert.equal(bundle.result.version, '0.85.0-alpha.1');
  assert.equal(bundle.result.memoryToProductFoundryEstablished, true);
  assert.ok(bundle.result.inputMemoryCount >= 7);
  assert.equal(bundle.result.foundryAgentCount, 10);
  assert.equal(bundle.result.canClaimExternalCommunicationProof, false);
  assert.equal(bundle.result.canClaimMysticalVerification, false);
});

test('v0.85 gates, grounds and scores memory fragments', () => {
  const bundle = runMemoryToProductFoundryDemo();
  assert.equal(bundle.ledger.established, true);
  assert.equal(bundle.ledger.fragmentCount, bundle.result.inputMemoryCount);
  assert.ok(bundle.result.qinglianGatePassedCount >= 1);
  assert.ok(bundle.result.donggeGroundingPassedCount >= 1);
  assert.ok(bundle.ledger.fragments.every(f => typeof f.risk === 'number' && typeof f.utility === 'number'));
});

test('v0.85 creates product cards and quarantine', () => {
  const bundle = runMemoryToProductFoundryDemo();
  assert.equal(bundle.productCards.length, bundle.result.productCardCount);
  assert.ok(bundle.result.productizableMemoryCount >= 1);
  assert.ok(bundle.productCards.some(card => card.rclTask.includes('MEMORY_PRODUCT_CARD')));
  assert.equal(bundle.quarantine.established, true);
  assert.equal(bundle.result.quarantineWritten, true);
});

test('v0.85 produces roadmap, falsifiers and evidence ledger', () => {
  const bundle = runMemoryToProductFoundryDemo();
  assert.equal(bundle.roadmap.established, true);
  assert.equal(bundle.falsifierPack.established, true);
  assert.ok(bundle.falsifierPack.globalFalsifierCount >= 5);
  assert.equal(bundle.result.evidenceLedgerWritten, true);
  assert.match(bundle.canonicalRoot, /^[a-f0-9]{64}$/);
});

test('v0.85 supports custom memory input without losing safety boundaries', () => {
  const bundle = runMemoryToProductFoundry({
    memoryFragments: [
      { id: 'custom_memory', title: 'Custom Memory', content: 'A safe custom product memory', anchors: ['custom'], affect: 'stable_structure', productHint: 'Custom Product' },
    ],
  });
  assert.equal(bundle.result.inputMemoryCount, 1);
  assert.equal(bundle.result.noRealWorldActionByDefault, true);
  assert.equal(bundle.result.humanFinalAuthorityKept, true);
  assert.equal(bundle.result.canClaimExternalCommunicationProof, false);
});

test('v0.85 writes reports, work method and RCL program', () => {
  const outDir = path.join(os.tmpdir(), `rcl-v085-memory-foundry-${Date.now()}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  const report = writeMemoryToProductFoundryReports(outDir, buildMemoryToProductFoundrySpec());
  assert.equal(report.ok, true);
  for (const file of [
    'memory-to-product-foundry-result.json',
    'memory-to-product-foundry-bundle.json',
    'foundry-technical-architecture.md',
    'memory-input-ledger.md',
    'productizable-memory-cards.md',
    'product-candidate-roadmap.md',
    'harmful-memory-quarantine.md',
    'ial-rcl-task-blocks.md',
    'evidence-and-falsifier-pack.md',
    'founder-verdict.md',
    'evidence-ledger.md',
    'memory-foundry-work-method.md',
    'memory-to-product-foundry.rcl',
    'canonical-root.txt',
  ]) assert.ok(fs.existsSync(path.join(outDir, file)), file);
  const rcl = renderMemoryToProductFoundryRcl();
  assert.match(rcl, /MemoryToProductFoundryV085/);
  assert.match(rcl, /MEMORY/);
  const method = renderMemoryFoundryWorkMethodMarkdown();
  assert.match(method, /Memory-to-Product Foundry/);
  assert.match(method, /柳清莲/);
});
