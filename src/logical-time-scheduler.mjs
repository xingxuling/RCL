import { realityRoot } from './canonical.mjs';

export const RCL_LOGICAL_TIME_SCHEDULER_VERSION = '0.95.0-alpha.1';
export const RCL_LOGICAL_TIME_SCHEDULER_FORMAT = 'rcl.logical-time-scheduler.v0.95';
export const RCL_LOGICAL_TIME_SNAPSHOT_FORMAT = 'rcl.logical-time-snapshot.v0.95';

export class LogicalTimeSchedulerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LogicalTimeSchedulerError';
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function requireId(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_ID_INVALID', `${label} must be a non-empty string`, { label, value });
  }
  return value;
}

function requireInstant(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_INSTANT_INVALID', `${label} must be a non-negative safe integer`, { label, value });
  }
  return value;
}

function requireTimeScale(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_SCALE_INVALID', 'timeScale must be a positive finite number', { value });
  }
  return value;
}

function requireOptionalText(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_TEXT_INVALID', `${label} must be a string or null`, { label, value });
  }
  return value;
}

function requireCanonicalData(value, label, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return clone(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_DATA_INVALID', `${label} contains a non-finite number`, { label, value });
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_DATA_INVALID', `${label} must not contain cycles`, { label });
    }
    seen.add(value);
    return value.map((item, index) => requireCanonicalData(item, `${label}[${index}]`, seen));
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_DATA_INVALID', `${label} must contain plain data only`, { label });
    }
    if (seen.has(value)) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_DATA_INVALID', `${label} must not contain cycles`, { label });
    }
    seen.add(value);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (item === undefined) {
        throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_DATA_INVALID', `${label}.${key} must not be undefined`, { label, key });
      }
      return [key, requireCanonicalData(item, `${label}.${key}`, seen)];
    }));
  }
  throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_DATA_INVALID', `${label} must contain JSON-like canonical data`, { label, type: typeof value });
}

function compareText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function sortedUniqueStrings(values, label) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_STRING_LIST_INVALID', `${label} must be an array of strings`, { label, values });
  }
  return [...new Set(values)].sort(compareText);
}

function compareSchedule(left, right) {
  return left.at - right.at || left.priority - right.priority || compareText(left.id, right.id);
}

function snapshotRoot(snapshot) {
  return realityRoot({ ...snapshot, root: undefined });
}

function normalizeSchedule(input, currentTime) {
  if (!input || typeof input !== 'object') {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_SCHEDULE_INVALID', 'schedule must be an object', { input });
  }
  const at = requireInstant(input.at, 'schedule.at');
  if (at < currentTime) {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_SCHEDULE_IN_PAST', 'cannot schedule before current logical time', { at, currentTime });
  }
  const priority = input.priority ?? 0;
  if (!Number.isSafeInteger(priority)) {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_PRIORITY_INVALID', 'schedule.priority must be a safe integer', { priority });
  }
  const kind = typeof input.kind === 'string' && input.kind.length > 0 ? input.kind : 'event';
  return {
    id: requireId(input.id, 'schedule.id'),
    at,
    priority,
    kind,
    payload: requireCanonicalData(input.payload ?? null, 'schedule.payload'),
    causalParents: sortedUniqueStrings(input.causalParents ?? [], 'schedule.causalParents'),
    source: requireOptionalText(input.source, 'schedule.source'),
  };
}

function normalizeExternalTimeProposal(input, currentTime) {
  if (!input || typeof input !== 'object') {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_PROPOSAL_INVALID', 'external time proposal must be an object', { input });
  }
  const proposedLogicalTime = requireInstant(input.proposedLogicalTime, 'proposal.proposedLogicalTime');
  if (proposedLogicalTime < currentTime) {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_PROPOSAL_STALE', 'external proposal cannot move logical time backward', {
      proposedLogicalTime,
      currentTime,
    });
  }
  if (!Number.isFinite(input.observedAtMs)) {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_EXTERNAL_OBSERVATION_INVALID', 'proposal.observedAtMs must be finite', { observedAtMs: input.observedAtMs });
  }
  return {
    id: requireId(input.id, 'proposal.id'),
    source: requireId(input.source, 'proposal.source'),
    observedAtMs: input.observedAtMs,
    proposedLogicalTime,
    metadata: requireCanonicalData(input.metadata ?? {}, 'proposal.metadata'),
    authoritative: false,
    status: 'proposed',
    observedAtLogicalTime: currentTime,
  };
}

function proposalWithRoot(proposal) {
  return { ...proposal, root: realityRoot({ ...proposal, root: undefined }) };
}

export class LogicalTimeScheduler {
  constructor(options = {}) {
    this.format = RCL_LOGICAL_TIME_SCHEDULER_FORMAT;
    this.version = RCL_LOGICAL_TIME_SCHEDULER_VERSION;
    this.replicaId = requireId(options.replicaId ?? 'local', 'replicaId');
    this.currentTime = requireInstant(options.startTime ?? 0, 'startTime');
    this.timeScale = requireTimeScale(options.timeScale ?? 1);
    this.queue = [];
    this.eventLog = [];
    this.externalProposals = [];
    this.knownScheduleIds = new Set();
    this.knownProposalIds = new Set();
    this.eventSequence = 0;
    this.revision = 0;
  }

  scheduleAt(input) {
    const schedule = normalizeSchedule(input, this.currentTime);
    if (this.knownScheduleIds.has(schedule.id)) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_SCHEDULE_DUPLICATE', `schedule '${schedule.id}' already exists`, { id: schedule.id });
    }
    this.knownScheduleIds.add(schedule.id);
    this.queue.push(schedule);
    this.queue.sort(compareSchedule);
    this.revision += 1;
    return clone(schedule);
  }

  scheduleAfter(input) {
    if (!input || typeof input !== 'object') {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_SCHEDULE_INVALID', 'relative schedule must be an object', { input });
    }
    const after = requireInstant(input.after, 'schedule.after');
    return this.scheduleAt({ ...input, at: this.currentTime + after });
  }

  cancel(id, { reason = null, subject = null } = {}) {
    const scheduleId = requireId(id, 'schedule id');
    const index = this.queue.findIndex((entry) => entry.id === scheduleId);
    if (index < 0) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_SCHEDULE_MISSING', `schedule '${scheduleId}' is not pending`, { id: scheduleId });
    }
    const [schedule] = this.queue.splice(index, 1);
    const receipt = this.#appendEvent('schedule-cancelled', {
      scheduleId,
      schedule,
      reason: requireOptionalText(reason, 'cancel.reason'),
      subject: requireOptionalText(subject, 'cancel.subject'),
    });
    this.revision += 1;
    return clone(receipt);
  }

  advanceTo(targetTime, { maxEvents = 100_000, reason = 'explicit-logical-advance' } = {}) {
    const target = requireInstant(targetTime, 'targetTime');
    if (target < this.currentTime) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_NON_MONOTONIC', 'logical time cannot move backward', {
        currentTime: this.currentTime,
        targetTime: target,
      });
    }
    if (!Number.isSafeInteger(maxEvents) || maxEvents < 0) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_MAX_EVENTS_INVALID', 'maxEvents must be a non-negative safe integer', { maxEvents });
    }
    const normalizedReason = requireOptionalText(reason, 'advance.reason');
    const dueCount = this.queue.filter((schedule) => schedule.at <= target).length;
    if (dueCount > maxEvents) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_MAX_EVENTS_EXCEEDED', 'advance would exceed its declared event budget', {
        dueCount,
        maxEvents,
      });
    }

    const previousTime = this.currentTime;
    const beforeEvents = this.eventLog.length;
    while (this.queue.length > 0 && this.queue[0].at <= target) {
      const schedule = this.queue.shift();
      this.currentTime = schedule.at;
      this.#appendEvent('scheduled-event-fired', {
        scheduleId: schedule.id,
        kind: schedule.kind,
        payload: schedule.payload,
        priority: schedule.priority,
        causalParents: schedule.causalParents,
        source: schedule.source,
      });
    }
    this.currentTime = target;
    this.#appendEvent('time-advanced', {
      fromLogicalTime: previousTime,
      toLogicalTime: target,
      reason: normalizedReason,
    });
    this.revision += 1;
    return {
      fromLogicalTime: previousTime,
      toLogicalTime: target,
      currentTime: this.currentTime,
      events: clone(this.eventLog.slice(beforeEvents)),
      root: this.snapshot().root,
    };
  }

  advanceBy(delta, options = {}) {
    return this.advanceTo(this.currentTime + requireInstant(delta, 'delta'), options);
  }

  setTimeScale(timeScale) {
    this.timeScale = requireTimeScale(timeScale);
    this.revision += 1;
    return this.timeScale;
  }

  projectWallDuration(logicalDuration) {
    const duration = requireInstant(logicalDuration, 'logicalDuration');
    return duration / this.timeScale;
  }

  proposeExternalTime(input) {
    const proposal = normalizeExternalTimeProposal(input, this.currentTime);
    if (this.knownProposalIds.has(proposal.id)) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_PROPOSAL_DUPLICATE', `proposal '${proposal.id}' already exists`, { id: proposal.id });
    }
    const rooted = proposalWithRoot(proposal);
    this.knownProposalIds.add(rooted.id);
    this.externalProposals.push(rooted);
    this.externalProposals.sort((left, right) => compareText(left.id, right.id));
    this.#appendEvent('external-time-observed', {
      proposalId: rooted.id,
      source: rooted.source,
      observedAtMs: rooted.observedAtMs,
      proposedLogicalTime: rooted.proposedLogicalTime,
      proposalRoot: rooted.root,
    });
    this.revision += 1;
    return clone(rooted);
  }

  commitExternalTime(proposalId, authority = {}) {
    const id = requireId(proposalId, 'proposal id');
    const index = this.externalProposals.findIndex((proposal) => proposal.id === id);
    if (index < 0) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_PROPOSAL_MISSING', `proposal '${id}' does not exist`, { id });
    }
    const proposal = this.externalProposals[index];
    if (proposal.status !== 'proposed') {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_PROPOSAL_NOT_PENDING', `proposal '${id}' is not pending`, { id, status: proposal.status });
    }
    if (!authority || typeof authority !== 'object' || !Array.isArray(authority.capabilities ?? [])) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_AUTHORITY_INVALID', 'authority must provide capabilities as an array', {
        authority,
      });
    }
    const subject = requireOptionalText(authority.subject, 'authority.subject');
    const capabilities = new Set(authority.capabilities ?? []);
    if (![...capabilities].every((capability) => typeof capability === 'string')) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_AUTHORITY_INVALID', 'authority capabilities must be strings', {
        capabilities: [...capabilities],
      });
    }
    if (!capabilities.has('temporal.commit')) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_AUTHORITY_DENIED', 'external time commit requires temporal.commit', {
        subject: authority.subject ?? null,
        capabilities: [...capabilities].sort(),
      });
    }
    if (proposal.proposedLogicalTime < this.currentTime) {
      throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_PROPOSAL_STALE', 'external proposal became stale before commit', {
        proposalId: id,
        proposedLogicalTime: proposal.proposedLogicalTime,
        currentTime: this.currentTime,
      });
    }

    this.advanceTo(proposal.proposedLogicalTime, { reason: `external-time-proposal:${id}` });
    const committed = proposalWithRoot({
      ...proposal,
      status: 'committed',
      committedBy: subject,
      committedAtLogicalTime: this.currentTime,
      root: undefined,
    });
    this.externalProposals[index] = committed;
    const receipt = this.#appendEvent('external-time-committed', {
      proposalId: id,
      proposalRoot: committed.root,
      subject,
      source: committed.source,
      committedLogicalTime: this.currentTime,
    });
    this.revision += 1;
    return clone(receipt);
  }

  snapshot() {
    const withoutRoot = {
      format: RCL_LOGICAL_TIME_SNAPSHOT_FORMAT,
      version: this.version,
      replicaId: this.replicaId,
      currentTime: this.currentTime,
      timeScale: this.timeScale,
      revision: this.revision,
      eventSequence: this.eventSequence,
      knownScheduleIds: [...this.knownScheduleIds].sort(compareText),
      knownProposalIds: [...this.knownProposalIds].sort(compareText),
      queue: clone([...this.queue].sort(compareSchedule)),
      eventLog: clone(this.eventLog),
      externalProposals: clone([...this.externalProposals].sort((left, right) => compareText(left.id, right.id))),
    };
    return { ...withoutRoot, root: snapshotRoot(withoutRoot) };
  }

  #appendEvent(type, payload = {}) {
    const event = {
      id: `logical:${this.replicaId}:${this.eventSequence + 1}`,
      sequence: this.eventSequence + 1,
      logicalTime: this.currentTime,
      type,
      ...clone(payload),
    };
    const rooted = { ...event, root: realityRoot({ ...event, root: undefined }) };
    this.eventSequence += 1;
    this.eventLog.push(rooted);
    return rooted;
  }
}

export function validateLogicalTimeSnapshot(snapshot) {
  const failures = [];
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, failures: ['snapshot_missing'] };
  }
  if (snapshot.format !== RCL_LOGICAL_TIME_SNAPSHOT_FORMAT) failures.push('snapshot_format_invalid');
  try {
    requireId(snapshot.replicaId, 'snapshot.replicaId');
    requireInstant(snapshot.currentTime, 'snapshot.currentTime');
    requireTimeScale(snapshot.timeScale);
    requireInstant(snapshot.eventSequence, 'snapshot.eventSequence');
    requireInstant(snapshot.revision, 'snapshot.revision');
    const rawScheduleIds = snapshot.knownScheduleIds ?? [];
    const rawProposalIds = snapshot.knownProposalIds ?? [];
    const knownScheduleIds = sortedUniqueStrings(rawScheduleIds, 'snapshot.knownScheduleIds');
    const knownProposalIds = sortedUniqueStrings(rawProposalIds, 'snapshot.knownProposalIds');
    if (rawScheduleIds.length !== knownScheduleIds.length) failures.push('snapshot_duplicate_schedule_ids');
    if (rawProposalIds.length !== knownProposalIds.length) failures.push('snapshot_duplicate_proposal_ids');
    const queue = Array.isArray(snapshot.queue) ? snapshot.queue.map((item) => normalizeSchedule(item, snapshot.currentTime)) : null;
    if (!queue) failures.push('snapshot_queue_invalid');
    if (queue && queue.some((schedule, index) => index > 0 && compareSchedule(queue[index - 1], schedule) > 0)) failures.push('snapshot_queue_not_sorted');
    if (queue && queue.some((schedule) => !knownScheduleIds.includes(schedule.id))) failures.push('snapshot_queue_unknown_schedule');
    if (queue && new Set(queue.map((schedule) => schedule.id)).size !== queue.length) failures.push('snapshot_queue_duplicate_schedule');
    if (!Array.isArray(snapshot.eventLog)) {
      failures.push('snapshot_event_log_invalid');
    } else {
      if (snapshot.eventSequence !== snapshot.eventLog.length) failures.push('snapshot_event_sequence_mismatch');
      let previousEventTime = -1;
      for (const [index, event] of snapshot.eventLog.entries()) {
        if (!event || typeof event !== 'object') {
          failures.push(`snapshot_event_invalid:${index}`);
          continue;
        }
        if (typeof event.id !== 'string' || event.id.trim().length === 0) failures.push(`snapshot_event_id_invalid:${index}`);
        if (event.id !== `logical:${snapshot.replicaId}:${index + 1}`) failures.push(`snapshot_event_id_mismatch:${index}`);
        if (event.sequence !== index + 1) failures.push(`snapshot_event_sequence_invalid:${index}`);
        if (!Number.isSafeInteger(event.logicalTime) || event.logicalTime < 0) failures.push(`snapshot_event_time_invalid:${index}`);
        if (event.logicalTime < previousEventTime) failures.push(`snapshot_event_time_non_monotonic:${index}`);
        previousEventTime = event.logicalTime;
        if (event.root !== realityRoot({ ...event, root: undefined })) failures.push(`event_root_mismatch:${event.id ?? index}`);
      }
    }
    if (!Array.isArray(snapshot.externalProposals)) failures.push('snapshot_external_proposals_invalid');
    if (Array.isArray(snapshot.externalProposals)) {
      const proposalIds = new Set();
      for (const proposal of snapshot.externalProposals) {
        if (!proposal || typeof proposal !== 'object') {
          failures.push('snapshot_proposal_invalid');
          continue;
        }
        requireId(proposal.id, 'snapshot.proposal.id');
        if (proposalIds.has(proposal.id)) failures.push(`snapshot_duplicate_proposal:${proposal.id}`);
        proposalIds.add(proposal.id);
        if (!knownProposalIds.includes(proposal.id)) failures.push(`snapshot_unknown_proposal:${proposal.id}`);
        if (!['proposed', 'committed'].includes(proposal.status)) failures.push(`snapshot_proposal_status_invalid:${proposal.id}`);
        if (proposal.root !== realityRoot({ ...proposal, root: undefined })) failures.push(`proposal_root_mismatch:${proposal.id}`);
      }
      if (proposalIds.size !== knownProposalIds.length || knownProposalIds.some((id) => !proposalIds.has(id))) failures.push('snapshot_proposal_registry_mismatch');
    }
  } catch (error) {
    failures.push(error.code ?? 'snapshot_shape_invalid');
  }
  let expectedRoot = null;
  try {
    expectedRoot = snapshotRoot(snapshot);
    if (snapshot.root !== expectedRoot) failures.push('snapshot_root_mismatch');
  } catch (error) {
    failures.push(error.code ?? 'snapshot_unrootable');
  }
  return { ok: failures.length === 0, failures, expectedRoot };
}

export function restoreLogicalTimeScheduler(snapshot) {
  const validation = validateLogicalTimeSnapshot(snapshot);
  if (!validation.ok) {
    throw new LogicalTimeSchedulerError('RCL_LOGICAL_TIME_SNAPSHOT_ROOT_MISMATCH', 'logical time snapshot failed validation', validation);
  }
  const scheduler = new LogicalTimeScheduler({
    replicaId: snapshot.replicaId,
    startTime: snapshot.currentTime,
    timeScale: snapshot.timeScale,
  });
  scheduler.revision = snapshot.revision;
  scheduler.eventSequence = snapshot.eventSequence;
  scheduler.knownScheduleIds = new Set(snapshot.knownScheduleIds);
  scheduler.knownProposalIds = new Set(snapshot.knownProposalIds);
  scheduler.queue = clone(snapshot.queue).sort(compareSchedule);
  scheduler.eventLog = clone(snapshot.eventLog);
  scheduler.externalProposals = clone(snapshot.externalProposals).sort((left, right) => compareText(left.id, right.id));
  return scheduler;
}

export function createLogicalTimeScheduler(options = {}) {
  return new LogicalTimeScheduler(options);
}
