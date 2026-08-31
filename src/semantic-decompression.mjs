import { realityRoot } from './canonical.mjs';

export const RCL_SEMANTIC_DECOMPRESSION_VERSION = '0.1.0-candidate.1';
export const RCL_SEMANTIC_DECOMPRESSION_FORMAT = 'rcl.semantic-profile-transition.v0.1';

const SHA256_RE = /^[0-9a-f]{64}$/u;
const LEVEL = Object.freeze({ C0: 0, C1: 1, C2: 2, C3: 3 });

function root(value, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new TypeError(code);
  return value;
}
function strings(values, code) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0)) throw new TypeError(code);
  if (new Set(values).size !== values.length) throw new TypeError(`${code}_DUPLICATE`);
  return [...values].sort();
}
function setEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
function subset(left, right) { return [...left].every((value) => right.has(value)); }

function normalizeProfile(profile, inventory, label) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new TypeError(`RCL_SEMANTIC_${label}_PROFILE_REQUIRED`);
  if (!(profile.level in LEVEL)) throw new TypeError(`RCL_SEMANTIC_${label}_LEVEL_INVALID`);
  const revealed = strings(profile.revealed ?? [], `RCL_SEMANTIC_${label}_REVEALED_INVALID`);
  const withheld = strings(profile.withheld ?? [], `RCL_SEMANTIC_${label}_WITHHELD_INVALID`);
  const unknown = strings(profile.unknown ?? [], `RCL_SEMANTIC_${label}_UNKNOWN_INVALID`);
  const partitions = [new Set(revealed), new Set(withheld), new Set(unknown)];
  if ([...partitions[0]].some((x) => partitions[1].has(x) || partitions[2].has(x))
      || [...partitions[1]].some((x) => partitions[2].has(x))) {
    throw new Error(`RCL_SEMANTIC_${label}_PARTITION_OVERLAP`);
  }
  const union = new Set([...revealed, ...withheld, ...unknown]);
  if (!setEqual(union, inventory)) throw new Error(`RCL_SEMANTIC_${label}_PARTITION_NOT_INVENTORY`);
  const core = { level: profile.level, revealed, withheld, unknown };
  return Object.freeze({ ...core, profileRoot: realityRoot(core) });
}

export function createSemanticProfileTransition(input = {}) {
  const genomeRoot = root(input.genomeRoot, 'RCL_SEMANTIC_GENOME_ROOT_INVALID');
  const inventoryList = strings(input.inventory, 'RCL_SEMANTIC_INVENTORY_INVALID');
  if (inventoryList.length === 0) throw new Error('RCL_SEMANTIC_INVENTORY_EMPTY');
  const inventory = new Set(inventoryList);
  const from = normalizeProfile(input.from, inventory, 'FROM');
  const to = normalizeProfile(input.to, inventory, 'TO');

  if (LEVEL[to.level] > LEVEL[from.level]) throw new Error('RCL_SEMANTIC_DECOMPRESSION_DIRECTION_INVALID');
  const fromRevealed = new Set(from.revealed);
  const toRevealed = new Set(to.revealed);
  const fromWithheld = new Set(from.withheld);
  const toWithheld = new Set(to.withheld);
  const fromUnknown = new Set(from.unknown);
  const toUnknown = new Set(to.unknown);
  if (!subset(fromRevealed, toRevealed)) throw new Error('RCL_SEMANTIC_REVEALED_NOT_MONOTONIC');
  if (!subset(toWithheld, fromWithheld)) throw new Error('RCL_SEMANTIC_WITHHELD_NOT_MONOTONIC');
  if (!setEqual(fromUnknown, toUnknown)) throw new Error('RCL_SEMANTIC_UNKNOWN_CANNOT_CHANGE_DURING_DECOMPRESSION');

  const newlyRevealed = to.revealed.filter((value) => !fromRevealed.has(value));
  if (newlyRevealed.some((value) => !fromWithheld.has(value))) {
    throw new Error('RCL_SEMANTIC_DECOMPRESSION_INTRODUCED_INFORMATION');
  }
  const knownInventory = inventoryList.length - to.unknown.length;
  const capabilityRecoveryRatio = knownInventory === 0 ? 1 : to.revealed.length / knownInventory;
  const core = {
    format: RCL_SEMANTIC_DECOMPRESSION_FORMAT,
    version: RCL_SEMANTIC_DECOMPRESSION_VERSION,
    genomeRoot,
    inventory: inventoryList,
    from,
    to,
    newlyRevealed,
    capabilityRecoveryRatio,
    informationIntroduced: false,
    genomeIdentityChanged: false,
    canonicalPromotionPerformed: false,
    rollback: {
      required: true,
      fromProfileRoot: from.profileRoot,
      toProfileRoot: to.profileRoot,
      genomeRoot,
    },
  };
  return Object.freeze({ ...core, transitionRoot: realityRoot(core) });
}
