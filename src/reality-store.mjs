import { realityRoot } from './canonical.mjs';
import { RCLError } from './errors.mjs';

export const RCL_REALITY_STORE_VERSION = '0.13.0-alpha.1';

export class RCLRealityStoreError extends RCLError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'RCLRealityStoreError';
  }
}

function envelopeRoot(envelope) {
  return realityRoot({ ...envelope, root: undefined });
}

function freezeEnvelope(envelope) {
  return Object.freeze(envelope);
}

function assertRef(root, store, label = 'object') {
  if (!store.objects.has(root)) throw new RCLRealityStoreError('RCL_STORE_REF_MISSING', `${label} '${root}' is not present in the store`, { root, label });
}

export class ContentAddressedRealityStore {
  constructor() {
    this.format = 'rcl.content-addressed-reality-store.v0.13';
    this.version = RCL_REALITY_STORE_VERSION;
    this.objects = new Map();
    this.branches = new Map();
  }

  putObject(value, { type = 'object', metadata = {} } = {}) {
    const envelope = { format: 'rcl.reality-object.v0.13', kind: 'object', type, value, metadata };
    const root = envelopeRoot(envelope);
    const stored = freezeEnvelope({ ...envelope, root });
    if (!this.objects.has(root)) this.objects.set(root, stored);
    return root;
  }

  putEvidence(value, metadata = {}) {
    return this.putObject(value, { type: 'evidence', metadata });
  }

  putEvent({ type, subject = null, payload = {}, evidence = [], metadata = {} }) {
    const event = { format: 'rcl.reality-event.v0.13', kind: 'event', type, subject, payload, evidence: [...evidence].sort(), metadata };
    const root = envelopeRoot(event);
    const stored = freezeEnvelope({ ...event, root });
    if (!this.objects.has(root)) this.objects.set(root, stored);
    return root;
  }

  putTree(entries) {
    const normalized = entries.map(entry => ({
      path: entry.path,
      root: entry.root,
      type: entry.type ?? this.get(entry.root)?.type ?? 'object',
    })).sort((a, b) => a.path.localeCompare(b.path));
    for (const entry of normalized) assertRef(entry.root, this, `tree entry ${entry.path}`);
    const tree = { format: 'rcl.reality-tree.v0.13', kind: 'tree', entries: normalized };
    const root = envelopeRoot(tree);
    const stored = freezeEnvelope({ ...tree, root });
    if (!this.objects.has(root)) this.objects.set(root, stored);
    return root;
  }

  putCommit({ tree, parents = [], message = '', author = 'rcl', events = [], evidence = [], metadata = {} }) {
    assertRef(tree, this, 'tree');
    for (const parent of parents) assertRef(parent, this, 'parent commit');
    for (const event of events) assertRef(event, this, 'event');
    for (const item of evidence) assertRef(item, this, 'evidence');
    const commit = {
      format: 'rcl.reality-commit.v0.13', kind: 'commit', tree,
      parents: [...parents].sort(), events: [...events].sort(), evidence: [...evidence].sort(),
      message, author, metadata,
    };
    const root = envelopeRoot(commit);
    const stored = freezeEnvelope({ ...commit, root });
    if (!this.objects.has(root)) this.objects.set(root, stored);
    return root;
  }

  snapshotState(state, { message = 'snapshot', parent = null, events = [], evidence = [], author = 'rcl' } = {}) {
    const stateRoot = this.putObject(state, { type: 'state' });
    const tree = this.putTree([{ path: 'state.json', root: stateRoot, type: 'state' }]);
    return this.putCommit({ tree, parents: parent ? [parent] : [], message, author, events, evidence });
  }

  get(root) { return this.objects.get(root) ?? null; }

  has(root) { return this.objects.has(root); }

  createBranch(name, commitRoot) {
    assertRef(commitRoot, this, 'branch commit');
    if (this.branches.has(name)) throw new RCLRealityStoreError('RCL_BRANCH_EXISTS', `Branch '${name}' already exists`, { name });
    this.branches.set(name, commitRoot);
    return { name, commit: commitRoot };
  }

  updateBranch(name, commitRoot, { expected = null } = {}) {
    assertRef(commitRoot, this, 'branch commit');
    const current = this.branches.get(name) ?? null;
    if (expected !== null && current !== expected) {
      throw new RCLRealityStoreError('RCL_BRANCH_EXPECTATION_FAILED', `Branch '${name}' did not point to expected commit`, { name, expected, current });
    }
    this.branches.set(name, commitRoot);
    return { name, previous: current, commit: commitRoot };
  }

  getBranch(name) { return this.branches.get(name) ?? null; }

  summary() {
    const summary = {
      format: this.format,
      version: this.version,
      objectCount: this.objects.size,
      branchCount: this.branches.size,
      branches: Object.fromEntries([...this.branches.entries()].sort(([a], [b]) => a.localeCompare(b))),
    };
    return Object.freeze({ ...summary, root: realityRoot(summary) });
  }
}

export function createContentAddressedRealityStore() {
  return new ContentAddressedRealityStore();
}
