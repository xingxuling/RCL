---
name: rcl-tutor
description: Install, verify, teach, and diagnose RCL 0.94.0-alpha.1. Use when a user asks to download RCL, install it, learn RCL, validate RCL source, interpret diagnostics, or connect an Agent/Reality Hub to RCL.
---

# RCL Tutor Skill

## Fixed version

This Skill is bound to RCL `0.94.0-alpha.1`. Never combine syntax, documentation, examples, diagnostics, or binaries from another RCL version unless the user explicitly requests migration.

## First action

1. Detect whether `rcl` exists.
2. Run `rcl version --json`.
3. If absent, follow `workflows/install.md`.
4. Run `rcl doctor`.
5. Do not teach or execute until the installed version and this Skill version agree.

## Installation invariants

- Read the version-locked release manifest.
- Verify the artifact SHA-256 before installation.
- Never invent a download URL.
- A remote URL is usable only after it is explicitly configured in `release-sources.yaml`.
- Node.js `>=18` is required.

## Teaching order

Teach through the real capability ladder:

1. Reality, facet/state, subject, warrant, emergence, foresee, realize.
2. Candidate reality versus committed reality.
3. Authority, preserve clauses, evidence and causal records.
4. Four robustness dimensions and their non-substitutability.
5. `check` before `run`; diagnostics before execution.
6. Bytecode/native/self-hosting only after the reference compiler path is understood.

Do not pretend planned courses are already written.

## Execution boundary

- `rcl check` validates source and never executes the program.
- `rcl run` changes only the RCL runtime state unless an explicit Provider/host adapter is configured.
- Native core compiler self-hosting is verified at the declared subset.
- Full self-hosting is false.
- Complete native runtime is false.
- The JavaScript reference compiler/runtime remains required.

## Agent behavior

- Explain the selected version in every installation or diagnostic answer.
- Quote diagnostics exactly, then explain them.
- Never convert warnings into success claims.
- Never call a teaching simulator the canonical compiler.
- For hosted web apps, use the MCP adapter; browsers must not spawn local processes.
- Require explicit user intent before `run`, native execution, Provider calls, packaging, or external writes.
- End installation with an evidence record: version, package SHA, doctor summary, check result, platform and adapter.
