import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evidenceRoot, campaignCellIdFor } from '../src/universal-program-stress.mjs';
import { ROOT, PROFILE_DIRECTORY, PORTABLE_PROFILES, applyInputs, exactEdit } from './k400-portable-profile-definitions.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = path.join(ROOT, PROFILE_DIRECTORY);
fs.mkdirSync(base, { recursive: true });
const batch = path.join(ROOT, 'output/k400-independent-inputs');
fs.mkdirSync(batch, { recursive: true });
const compilerHash = sha(fs.readFileSync(path.join(ROOT, 'selfhost/compiler.rbc')));
for (const profile of PORTABLE_PROFILES) {
  const file = name => path.join(base, profile.id + '-' + name);
  if (fs.existsSync(file('contract.json'))) {
    const frozen = JSON.parse(fs.readFileSync(file('contract.json'), 'utf8'));
    if (evidenceRoot({ ...frozen, contractRoot: undefined }) !== frozen.contractRoot
      || sha(fs.readFileSync(path.join(ROOT, frozen.sourcePath))) !== frozen.sourceHash
      || sha(fs.readFileSync(path.join(ROOT, frozen.casesPath))) !== frozen.casesHash) throw new Error('RCL_FROZEN_CONTRACT_DRIFT:' + profile.id);
    console.log(JSON.stringify({ id: profile.id, status: 'EXISTING_FREEZE_PRESERVED', contractRoot: frozen.contractRoot })); continue;
  }
  const source = profile.source(), sourcePath = PROFILE_DIRECTORY + '/' + profile.id + '.rcl';
  const tests = profile.cases.map((inputs, index) => ({ index, inputs, sourceHash: sha(applyInputs(source, inputs)), expected: profile.oracle(inputs) }));
  fs.writeFileSync(path.join(ROOT, sourcePath), source);
  fs.writeFileSync(file('sealed-cases.json'), JSON.stringify(tests, null, 2) + '\n');
  const contract = { format: 'rcl.k400-portable-profile-contract.v1', id: profile.id, profile: profile.profile,
    goalMinimumPassCells: 200, frozenBeforeIndependentTrials: true, caseSelection: 'sealed before generation; test file and oracles not provided to generators',
    sourcePath, sourceHash: sha(source), compilerPath: 'selfhost/compiler.rbc', compilerHash,
    donor: { path: profile.donor, sha256: sha(fs.readFileSync(path.join(ROOT, profile.donor))), decision: profile.id === 'algorithm-posix' ? 'REUSE' : 'ADAPT' },
    casesPath: PROFILE_DIRECTORY + '/' + profile.id + '-sealed-cases.json', casesHash: sha(fs.readFileSync(file('sealed-cases.json'))),
    families: profile.families, environments: profile.environments,
    eligibleCells: profile.environments.flatMap(environment => profile.families.map(family => campaignCellIdFor(environment, family))),
    rounds: 20, performanceBudget: { compileP95Ms: 5000, executeP95Ms: 2000 },
    independentGeneration: { requiredFreshContexts: 3, requestedToolPolicy: 'read only named frozen candidate files; no other filesystem, memory, network, tools or writes',
      canonicalSourceProvided: false, oracleEditsProvided: false, holdoutTestsProvided: false, osIsolationClaimed: false },
    authorityProfile: 'local source-bound target execution and exact independent proposals; no new hosted CI', trials: [], contractRoot: null };
  for (const [index, mutation] of profile.mutations.entries()) {
    const mutated = exactEdit(source, mutation.good, mutation.bad);
    const candidatePath = path.join(batch, `${profile.id}-${index}.rcl`);
    fs.writeFileSync(candidatePath, mutated);
    fs.writeFileSync(candidatePath + '.intent.txt', mutation.intent + '\n');
    contract.trials.push({ id: mutation.id, index, intent: mutation.intent, mutatedSourceHash: sha(mutated) });
  }
  contract.contractRoot = evidenceRoot({ ...contract, contractRoot: undefined });
  fs.writeFileSync(file('contract.json'), JSON.stringify(contract, null, 2) + '\n');
  console.log(JSON.stringify({ id: profile.id, contractRoot: contract.contractRoot, eligibleCells: contract.eligibleCells, sealedCases: tests.length }));
}
