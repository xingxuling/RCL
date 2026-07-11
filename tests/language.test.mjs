import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  compileReality,
  tryCompileReality,
  runReality,
  RCLRuntimeError,
  compileRealityToBytecode,
  tryCompileRealityToBytecode,
  decodeBytecode,
  runRealityNative,
  verifyNativeParity,
  bootstrapCompilerSeed,
  bootstrapCompilerStage2,
  bootstrapCompilerStage3,
  bootstrapCompilerStage4,
  bootstrapCompilerStage5,
  lexReality,
  parseReality,
  EmbeddedNativeVm,
} from '../src/index.mjs';

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const hello = `
reality FirstLight {
  facet world.greeting : Text = "unformed"
  subject founder {
    facet awareness : Number = 0
    warrant world.write on world
  }
  emergence hello {
    cause founder
    when world.greeting == "unformed"
    needs world.write on world
    alter world.greeting <- "Hello, reality."
    alter founder.awareness <- founder.awareness + 1
    preserve founder.awareness >= 0
    witness "rcl:first-light"
  }
  foresee hello
  realize hello
}`;

test('compiles a reality program into independent RCL IR', () => {
  const program = compileReality(hello);
  assert.equal(program.format, 'rcl.reality-program.v0.10');
  assert.equal(program.name, 'FirstLight');
  assert.equal(program.rules[0].kind, 'Emergence');
  assert.match(program.programRoot, /^[0-9a-f]{64}$/);
});

test('foresee projects without mutating and realize commits', async () => {
  const result = await runReality(hello);
  assert.equal(result.projections.length, 1);
  assert.equal(result.projections[0].projectedState['world.greeting'], 'Hello, reality.');
  assert.equal(result.history.length, 1);
  assert.equal(result.state['world.greeting'], 'Hello, reality.');
  assert.equal(result.state['founder.awareness'], 1);
});

test('alterations are simultaneous and read the same pre-transition reality', async () => {
  const source = `
  reality Simultaneous {
    facet pair.left : Number = 1
    facet pair.right : Number = 2
    subject mover { warrant pair.swap on pair }
    emergence swap {
      cause mover
      when true
      needs pair.swap on pair
      alter pair.left <- pair.right
      alter pair.right <- pair.left
    }
    realize swap
  }`;
  const result = await runReality(source);
  assert.equal(result.state['pair.left'], 2);
  assert.equal(result.state['pair.right'], 1);
});

test('recursive reckonings perform general computation', async () => {
  const source = `
  reality Mathematics {
    facet result.value : Number = 0
    subject calculator { warrant result.write on result }
    reckon factorial(n : Number) -> Number = choose(n <= 1, 1, n * factorial(n - 1))
    emergence compute {
      cause calculator
      when true
      needs result.write on result
      alter result.value <- factorial(6)
    }
    realize compute
  }`;
  const result = await runReality(source);
  assert.equal(result.state['result.value'], 720);
});

test('resonance changes multiple subject realities in one transaction', async () => {
  const source = `
  reality TwoMinds {
    subject alice {
      facet trust : Number = 0
      warrant relation.influence on bob
    }
    subject bob { facet trust : Number = 0 }
    resonance greeting {
      from alice
      into bob
      when true
      needs relation.influence on bob
      alter alice.trust <- alice.trust + 1
      alter bob.trust <- bob.trust + 2
      preserve bob.trust <= 10
      witness "interaction:greeting"
    }
    realize greeting
  }`;
  const result = await runReality(source);
  assert.equal(result.state['alice.trust'], 1);
  assert.equal(result.state['bob.trust'], 2);
  assert.equal(result.history[0].from, 'alice');
  assert.equal(result.history[0].into, 'bob');
});

test('compiler rejects a rule without a statically granted warrant', () => {
  const source = `
  reality Closed {
    facet world.value : Number = 0
    subject outsider { facet intent : Number = 1 }
    emergence forbidden {
      cause outsider
      when true
      needs world.write on world
      alter world.value <- 1
    }
    realize forbidden
  }`;
  const result = tryCompileReality(source);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => d.code === 'RCL_WARRANT_MISSING'));
});

test('conditional warrants can be open statically but denied by current reality', async () => {
  const source = `
  reality ConditionalAuthority {
    facet system.safe : Truth = false
    facet system.value : Number = 0
    subject operator {
      warrant system.write on system while system.safe
    }
    emergence write {
      cause operator
      when true
      needs system.write on system
      alter system.value <- 1
    }
    realize write
  }`;
  await assert.rejects(() => runReality(source), error => {
    assert.ok(error instanceof RCLRuntimeError);
    assert.equal(error.code, 'RCL_AUTHORITY_DENIED');
    return true;
  });
});

test('preserve clauses block unsafe reality mutations', async () => {
  const source = `
  reality Safety {
    facet reactor.heat : Number = 90
    subject operator { warrant reactor.change on reactor }
    emergence overheat {
      cause operator
      when true
      needs reactor.change on reactor
      alter reactor.heat <- reactor.heat + 20
      preserve reactor.heat <= 100
    }
    realize overheat
  }`;
  await assert.rejects(() => runReality(source), error => {
    assert.ok(error instanceof RCLRuntimeError);
    assert.equal(error.code, 'RCL_REALITY_BOUND_BROKEN');
    return true;
  });
});

test('host adapters connect computer reality while preserving receipts', async () => {
  const source = `
  reality ComputerBridge {
    facet machine.receipt : Text = "none"
    subject builder { warrant computer.invoke on console }
    host console { offers emit -> Text }
    emergence publish {
      cause builder
      when machine.receipt == "none"
      needs computer.invoke on console
      call console.emit("hello") -> machine.receipt
      preserve length(machine.receipt) > 0
      witness "host:console.emit"
    }
    realize publish
  }`;
  const result = await runReality(source, {
    hostAdapters: {
      console: async ({ capability, args }) => `${capability}:${args[0]}`,
    },
  });
  assert.equal(result.state['machine.receipt'], 'emit:hello');
  assert.equal(result.history[0].hostCalls[0].fullCapability, 'console.emit');
});

test('type system rejects incompatible reality changes', () => {
  const source = `
  reality Typed {
    facet world.count : Number = 0
    subject founder { warrant world.write on world }
    emergence wrong {
      cause founder
      when true
      needs world.write on world
      alter world.count <- "many"
    }
    realize wrong
  }`;
  const result = tryCompileReality(source);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => d.code === 'RCL_ALTER_TYPE'));
});

test('realized transitions lower into RNCS proposal inputs', async () => {
  const { toRncsProposalInput } = await import('../src/index.mjs');
  const program = compileReality(hello);
  const result = await runReality(program);
  const proposal = toRncsProposalInput(program, result.history[0], {
    realityId: 'reality:first-light',
  });
  assert.equal(proposal.reality_id, 'reality:first-light');
  assert.equal(proposal.subject.subject_id, 'founder');
  assert.equal(proposal.provisional_delta.operations.length, 2);
  assert.equal(proposal.extensions.rcl.after_root, result.history[0].afterRoot);
});

test('foresee never invokes a real computer host without an explicit simulator', async () => {
  const source = `
  reality SafeProjection {
    facet machine.receipt : Text = "none"
    subject builder { warrant computer.invoke on console }
    host console { offers emit -> Text }
    emergence publish {
      cause builder
      when true
      needs computer.invoke on console
      call console.emit("hello") -> machine.receipt
    }
    foresee publish
  }`;
  let invoked = false;
  await assert.rejects(() => runReality(source, {
    hostAdapters: {
      console: async () => { invoked = true; return 'receipt'; },
    },
  }), error => {
    assert.equal(error.code, 'RCL_HOST_SIMULATOR_MISSING');
    return true;
  });
  assert.equal(invoked, false);
});


test('eight-domain foundation compiles and executes as one reality program', async () => {
  const fs = await import('node:fs');
  const url = new URL('../examples/eight-domain-foundation.rcl', import.meta.url);
  const source = fs.readFileSync(url, 'utf8');
  const program = compileReality(source);
  assert.equal(program.foundation.domains.length, 14);
  assert.equal(program.metaDomains.length, 1);
  assert.equal(program.physicals.length, 1);
  assert.equal(program.perceptions.length, 1);
  assert.equal(program.neurals.length, 1);
  assert.equal(program.livings.length, 1);
  assert.equal(program.genetics.length, 1);
  assert.equal(program.quantitatives.length, 1);

  const result = await runReality(program);
  assert.equal(result.foundation.domains.physical, 1);
  assert.equal(result.state['self_model.revision'], 1);
  assert.equal(result.state['sight.altitude'].type, 'Length');
  assert.equal(result.state['creature.energy'], 0.9);
  assert.equal(result.state['brain.response'], 0.5);
  assert.ok(Math.abs(result.state['lineage.motion_bias'] - 0.22) < 1e-12);
  assert.ok(Math.abs(result.state['phenotype.motion_bias'] - 0.22) < 1e-12);
  assert.equal(result.state['telemetry.altitude'].kind, 'Measurement');
  assert.equal(result.state['telemetry.altitude'].confidence, 0.98);
  assert.equal(result.state['telemetry.safe_altitude'], true);
});

test('physical reality enforces dimensions instead of accepting naked-number substitution', () => {
  const source = `
  reality BrokenDimensions {
    physical world {
      body stone { facet position : Length = meters(1) }
      law wrong {
        step dt : Time
        when true
        evolve world.stone.position <- world.stone.position + dt
      }
    }
    advance world.wrong steps 1 dt seconds(1)
  }`;
  const result = tryCompileReality(source);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => d.code === 'RCL_PHYSICAL_EVOLVE_TYPE' || d.code === 'RCL_TYPE_BINARY'));
});

test('quantitative reality carries uncertainty, confidence, scale and evidence', async () => {
  const source = `
  reality MeasurementWorld {
    facet sensor.raw : Temperature = celsius(37)
    quantitative vitals {
      measure temperature : Temperature = sensor.raw
        uncertainty celsius(0.2)
        confidence 0.97
        unit "°C"
        scale interval
        evidence "sensor:body-01"
      derive lower_temperature : Temperature = lower(vitals.temperature)
      preserve confidence(vitals.temperature) >= 0.95
    }
    quantify vitals
  }`;
  const result = await runReality(source);
  const measured = result.state['vitals.temperature'];
  assert.equal(measured.kind, 'Measurement');
  assert.equal(measured.value.value, 37);
  assert.equal(measured.uncertainty.value, 0.2);
  assert.equal(measured.scale, 'interval');
  assert.deepEqual(measured.evidence, ['sensor:body-01']);
  assert.equal(result.state['vitals.lower_temperature'].value, 36.8);
});

test('quantitative preserve rejects low-confidence reality claims', async () => {
  const source = `
  reality WeakEvidence {
    quantitative claim {
      measure score : Number = 10 uncertainty 2 confidence 0.4 scale ratio evidence "weak:model"
      preserve confidence(claim.score) >= 0.8
    }
    quantify claim
  }`;
  await assert.rejects(() => runReality(source), error => {
    assert.equal(error.code, 'RCL_QUANTITATIVE_BOUND_BROKEN');
    return true;
  });
});

test('meta-computational reflection can inspect and revise the running reality model', async () => {
  const source = `
  reality SelfInspection {
    meta self {
      facet passes : Number = 0
      inspect program
      revise self.passes <- self.passes + 1
      preserve self.passes <= 2
    }
    reflect self
    reflect self
  }`;
  const result = await runReality(source);
  assert.equal(result.state['self.passes'], 2);
  assert.equal(result.history[0].domainKind, 'meta-computational');
  assert.equal(result.history[0].foundation.domains.metaComputational, 1);
});


test('knowledge reality forms justified claims and drives bounded execution', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../examples/small-data-agent.rcl', import.meta.url), 'utf8');
  const program = compileReality(source);
  assert.equal(program.foundation.domains.length, 14);
  assert.equal(program.knowledges.length, 1);
  const result = await runReality(program);
  assert.equal(result.state['mind.cold'].kind, 'Knowledge');
  assert.equal(result.state['mind.cold'].value, true);
  assert.equal(result.state['mind.should_heat'].value, true);
  assert.ok(result.state['mind.should_heat'].confidence >= 0.9);
  assert.equal(result.state['room.heater'], true);
  assert.equal(result.innerReality.knowledge['mind.should_heat'].value, true);
  assert.ok(result.executionReality.realized.some(item => item.rule === 'heat_room'));
});

test('knowledge revision retains contradiction history and chooses stronger evidence', async () => {
  const source = `
  reality RevisionMind {
    knowledge mind {
      claim route : Text = "left" confidence 0.60 evidence "map:old" source "old-map"
      revise mind.route <- "right" confidence 0.90 evidence "sensor:new" source "fresh-sensor"
      preserve certainty(mind.route) >= 0.8
    }
    learn mind
  }`;
  const result = await runReality(source);
  const route = result.state['mind.route'];
  assert.equal(route.value, 'right');
  assert.equal(route.status, 'revised');
  assert.equal(route.alternatives.length, 1);
  assert.equal(route.alternatives[0].value, 'left');
});

test('knowledge preserve rejects unsupported claims', async () => {
  const source = `
  reality WeakKnowledge {
    knowledge mind {
      claim safe : Truth = true confidence 0.30 evidence "guess"
      preserve supported(mind.safe, 0.80)
    }
    learn mind
  }`;
  await assert.rejects(() => runReality(source), error => {
    assert.equal(error.code, 'RCL_KNOWLEDGE_BOUND_BROKEN');
    return true;
  });
});

test('knowledge decay models forgetting without deleting provenance', async () => {
  const source = `
  reality Forgetting {
    knowledge mind {
      claim signal : Truth = true confidence 0.90 evidence "observation:1"
      forget mind.signal by 0.35
    }
    learn mind
  }`;
  const result = await runReality(source);
  assert.ok(Math.abs(result.state['mind.signal'].confidence - 0.55) < 1e-12);
  assert.equal(result.state['mind.signal'].status, 'decayed');
  assert.deepEqual(result.state['mind.signal'].evidence, ['observation:1']);
});

test('inner reality and execution reality are composite planes rather than extra domains', async () => {
  const source = `
  reality CompositePlanes {
    facet world.value : Number = 1
    subject agent { warrant world.write on world }
    perception view { observer agent source world channel value : Number = world.value }
    neural brain { facet activation : Number = 0 }
    living self { facet energy : Number = 1 maintain self.energy >= 0 }
    knowledge mind {
      claim positive : Truth = view.value > 0 confidence 1 evidence "direct"
    }
    emergence act {
      cause agent
      when knowledge_value(mind.positive)
      needs world.write on world
      alter world.value <- world.value + 1
    }
    observe view
    learn mind
    realize act
  }`;
  const result = await runReality(source);
  assert.equal(result.foundation.compositePlanes.length, 5);
  assert.equal(result.innerReality.format, 'rcl.inner-reality.v0.2');
  assert.equal(result.executionReality.format, 'rcl.execution-reality.v0.2');
  assert.equal(result.naturalLanguageReality.format, 'rcl.natural-language-reality.v0.1');
  assert.equal(result.understandingReality.format, 'rcl.understanding-reality.v0.1');
  assert.equal(result.creativeReality.format, 'rcl.creative-reality.v0.1');
  assert.equal(result.innerReality.knowledge['mind.positive'].value, true);
  assert.equal(result.executionReality.realized.at(-1).rule, 'act');
});


test('natural-language reality turns an utterance into an explicit bounded intent', async () => {
  const source = `
  reality LanguagePlane {
    language command {
      utterance request = "请打开温室灯" speaker "operator" locale "zh-CN" evidence "input:1"
      intent activate when contains(utterance_text(command.request), "打开") and contains(utterance_text(command.request), "灯")
        action "activate" target "greenhouse.light" confidence 0.97 evidence "grammar:open-light" from command.request
      preserve intent_confidence(command.activate) >= 0.90
    }
    interpret command
  }`;
  const result = await runReality(source);
  assert.equal(result.state['command.request'].text, '请打开温室灯');
  assert.equal(result.state['command.activate'].active, true);
  assert.equal(result.state['command.activate'].action, 'activate');
  assert.equal(result.state['command.activate'].target, 'greenhouse.light');
  assert.deepEqual(result.state['command.activate'].evidence, ['grammar:open-light', 'input:1']);
  assert.equal(result.naturalLanguageReality.activeIntents[0].path, 'command.activate');
});

test('understanding reality forms an explainable model and caps confidence by its weakest dependency', async () => {
  const source = `
  reality UnderstandingPlane {
    facet world.safe : Truth = true
    language command {
      utterance request = "open" evidence "input"
      intent activate when contains(utterance_text(command.request), "open")
        action "activate" target "light" confidence 0.80 evidence "grammar" from command.request
    }
    knowledge mind {
      claim safe : Truth = world.safe confidence 0.95 evidence "policy"
    }
    understanding situation {
      hypothesis allowed : Truth = intent_matches(command.activate, "activate", "light") and knowledge_value(mind.safe)
        confidence 0.99 explanation "Intent and safety knowledge agree." evidence "model" from command.activate, mind.safe coverage 1 coherence 0.90
      preserve understood(situation.allowed, 0.75)
    }
    interpret command
    learn mind
    understand situation
  }`;
  const result = await runReality(source);
  const model = result.state['situation.allowed'];
  assert.equal(model.value, true);
  assert.equal(model.confidence, 0.80);
  assert.equal(model.explanation, 'Intent and safety knowledge agree.');
  assert.deepEqual(model.evidence, ['model', 'grammar', 'input', 'policy']);
  assert.equal(result.understandingReality.models['situation.allowed'].coherence, 0.90);
});

test('creative reality generates alternatives, scores them and selects without executing reality', async () => {
  const source = `
  reality CreativePlane {
    facet device.active : Truth = false
    creation solutions {
      candidate direct : Text = "activate" when true target "device" novelty 0.3 utility 0.95 feasibility 0.99 risk 0.02 evidence "direct"
      candidate defer : Text = "defer" when true target "operator" novelty 0.2 utility 0.2 feasibility 1 risk 0.01 evidence "fallback"
      select chosen from direct, defer
      preserve creation_score(solutions.chosen) >= 0.80
    }
    create solutions
  }`;
  const result = await runReality(source);
  assert.equal(result.state['solutions.chosen'].value, 'activate');
  assert.equal(result.state['solutions.chosen'].status, 'selected');
  assert.equal(result.state['device.active'], false);
  assert.equal(result.executionReality.realized.at(-1).domainKind, 'creative-plane');
});

test('natural language, understanding and creation remain candidates until authority realizes the selected action', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../examples/cognitive-creation-agent.rcl', import.meta.url), 'utf8'));
  const result = await runReality(source);
  assert.equal(result.state['greenhouse.light'], true);
  assert.equal(result.state['caretaker.actions'], 1);
  assert.equal(result.projections.at(-1).status, 'projected');
  assert.equal(result.history.at(-1).rule, 'enact_selected_solution');
  assert.equal(result.creativeReality.selected['solutions.chosen'].target, 'greenhouse.light');
});

test('creative preserve rejects weak candidate sets instead of laundering them into a decision', async () => {
  const source = `
  reality WeakCreation {
    creation ideas {
      candidate weak : Text = "guess" when true novelty 0.1 utility 0.1 feasibility 0.1 risk 0.9
      select chosen from weak
      preserve creation_score(ideas.chosen) >= 0.80
    }
    create ideas
  }`;
  await assert.rejects(() => runReality(source), error => {
    assert.ok(error instanceof RCLRuntimeError);
    assert.equal(error.code, 'RCL_CREATION_BOUND_BROKEN');
    return true;
  });
});

test('compiler rejects understanding dependencies that are not evidence-bearing reality objects', () => {
  const source = `
  reality InvalidUnderstanding {
    facet world.number : Number = 1
    understanding model {
      hypothesis claim : Truth = true from world.number
    }
    understand model
  }`;
  const result = tryCompileReality(source);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_UNDERSTANDING_DEPENDENCY_TYPE'));
});


test('meta-spacetime reality synchronizes clocks, coordinates and transition stamps', async () => {
  const source = `
  reality SpacetimePlane {
    facet world.value : Number = 0
    spacetime chronos {
      frame world dimensions 3 topology "euclidean"
      clock simulation : Time = seconds(0) tick seconds(1) rate 2
      coordinate beacon = point("world", meters(1), meters(2), meters(3), seconds(0)) target "world.beacon" clock simulation
      relation sensing before acting
      preserve chronos.simulation >= seconds(0)
    }
    synchronize chronos steps 3
  }`;
  const result = await runReality(source);
  assert.equal(result.state['chronos.simulation'].value, 6);
  assert.equal(result.state['chronos.beacon'].t.value, 6);
  assert.equal(result.state['chronos.beacon'].frame, 'world');
  assert.equal(result.spacetimeReality.programs[0].frames[0].dimensions, 3);
  assert.equal(result.history.filter(item => item.domainKind === 'meta-spacetime').length, 3);
  assert.ok(result.history.every(item => item.spacetime));
});

test('meta-spacetime reality rejects causal cycles', async () => {
  const source = `
  reality BrokenCausality {
    spacetime chronos {
      frame world dimensions 3 topology "euclidean"
      clock simulation : Time = seconds(0) tick seconds(1) rate 1
      relation a before b
      relation b before a
    }
    synchronize chronos steps 1
  }`;
  await assert.rejects(() => runReality(source), error => {
    assert.equal(error.code, 'RCL_SPACETIME_CAUSAL_CYCLE');
    return true;
  });
});

test('meta-acceleration reality memoizes exact recursive computation', async () => {
  const source = `
  reality AcceleratedComputation {
    facet world.result : Number = 0
    subject architect { warrant world.write on world }
    reckon fib(n : Number) -> Number = choose(n <= 1, n, fib(n - 1) + fib(n - 2))
    acceleration fast {
      target fib
      strategy memoize
      factor 8
      budget seconds(1)
      fidelity 1
      evidence "optimization:memoization"
    }
    emergence calculate {
      cause architect
      when true
      needs world.write on world
      alter world.result <- fib(24)
      preserve world.result == 46368
    }
    accelerate fast
    realize calculate
  }`;
  const result = await runReality(source);
  const metrics = result.accelerationReality.metrics.fib;
  assert.equal(result.state['world.result'], 46368);
  assert.ok(metrics.cacheHits > 0);
  assert.ok(metrics.evaluations <= 25);
  assert.ok(metrics.requests > metrics.evaluations);
});

test('meta-compression reality discards and losslessly restores a state namespace', async () => {
  const source = `
  reality CompressedMemory {
    facet memory.payload : Text = "META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-META-REALITY-"
    compression memory_capsule {
      target memory
      mode lossless
      codec deflate
      reversible true
      discard true
      fidelity 1
      max_ratio 0.8
      evidence "snapshot:memory"
    }
    compress memory_capsule
    restore memory_capsule
  }`;
  const result = await runReality(source);
  const capsule = result.compressionReality.capsules[0];
  assert.equal(result.state['memory.payload'].length, 5200);
  assert.equal(capsule.reversible, true);
  assert.equal(capsule.fidelity, 1);
  assert.ok(capsule.ratio < 0.1);
  assert.equal(result.history.at(-1).domainKind, 'meta-compression-restore');
  assert.equal(result.history.at(-1).originalRoot, result.history.at(-1).restoredRoot);
});

test('compiler refuses unsupported lossy compression disguised as a foundation feature', () => {
  const source = `
  reality UnsupportedCompression {
    facet memory.value : Text = "data"
    compression semantic {
      target memory
      mode semantic
      codec deflate
      reversible false
      fidelity 0.8
    }
  }`;
  const result = tryCompileReality(source);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_COMPRESSION_MODE'));
});

test('foundation closure executes energy, element, science, body and spirit realities', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../examples/foundation-closure.rcl', import.meta.url), 'utf8'));
  const result = await runReality(source);
  assert.equal(result.state['grid.source'].value, 60);
  assert.equal(result.state['grid.load'].value, 36);
  assert.equal(result.state['matter.water'].category, 'compound');
  assert.equal(Object.keys(result.state['matter.water'].components).length, 2);
  assert.equal(result.state['lab.accepted'].value, true);
  assert.equal(result.state['lab.delivered'].reproducibility, 1);
  assert.equal(result.state['vessel.state'].maintained, true);
  assert.equal(result.state['mind.state'].integrated, true);
  assert.equal(result.foundation.domains.energy, 1);
  assert.equal(result.foundation.domains.elemental, 1);
  assert.equal(result.foundation.domains.science, 1);
  assert.equal(result.foundation.domains.embodied, 1);
  assert.equal(result.foundation.domains.spirit, 1);
});

test('energy reality enforces finite reservoirs and rejects overdraft', async () => {
  const source = `
  reality EnergyOverdraft {
    energy grid {
      reservoir source : Energy = joules(10)
      reservoir load : Energy = joules(0)
      flow impossible from source to load amount joules(20) efficiency 1
    }
    energize grid
  }`;
  await assert.rejects(() => runReality(source), error => {
    assert.equal(error.code, 'RCL_ENERGY_INSUFFICIENT');
    return true;
  });
});

test('element reality rejects compounds built from undeclared constituents', () => {
  const source = `
  reality UnknownElement {
    element matter {
      species oxygen { symbol "O" atomic 8 mass 15.999 charge 0 phase "gas" }
      compound mystery { component hydrogen 2 component oxygen 1 bond "unknown" }
    }
  }`;
  const result = tryCompileReality(source);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_ELEMENT_COMPONENT_UNKNOWN'));
});

test('science reality records method, repetitions and falsifiable conclusion', async () => {
  const source = `
  reality ScienceMethod {
    facet world.value : Number = 4
    science lab {
      hypothesis stable : Truth = world.value == 4 confidence 0.9 evidence "observation"
      experiment repeated tests stable repeats 4 tolerance 0 method "replay" evidence "run-log"
      conclude accepted from stable confidence 0.88 evidence "review"
      preserve reproducible(lab.repeated)
    }
    investigate lab
  }`;
  const result = await runReality(source);
  assert.equal(result.state['lab.stable'].status, 'supported');
  assert.equal(result.state['lab.stable'].replications, 4);
  assert.equal(result.state['lab.repeated'].method, 'replay');
  assert.equal(result.state['lab.accepted'].value, true);
});

test('body reality refuses a body that cannot maintain its declared boundary', async () => {
  const source = `
  reality BrokenBody {
    embodiment vessel {
      facet vitality : Number = 0.2
      organ core { facet integrity : Number = 1 }
      maintain vessel.vitality >= 0.8
    }
    embody vessel
  }`;
  await assert.rejects(() => runReality(source), error => {
    assert.equal(error.code, 'RCL_BODY_HOMEOSTASIS');
    return true;
  });
});

test('spirit reality integrates identity, values, purposes and affect without claiming consciousness', async () => {
  const source = `
  reality SpiritIntegration {
    spirit self {
      facet identity : Text = "unit-1"
      value autonomy : Number = 1 weight 1
      purpose continue : Truth = true priority 1
      affect calm : Number = 0.5 intensity 0.5
      preserve self.value.autonomy >= 0.5
    }
    integrate self
  }`;
  const result = await runReality(source);
  assert.equal(result.state['self.state'].identity, 'unit-1');
  assert.equal(result.state['self.state'].purposes.continue.value, true);
  assert.equal(result.state['self.state'].integrated, true);
  assert.ok(result.state['self.state'].coherence > 0);
});

test('v0.6 foundation declares fourteen reality domains and preserves prior planes', async () => {
  const source = `reality DomainCount { facet world.ok : Truth = true }`;
  const result = await runReality(source);
  assert.equal(result.foundation.domains.metaComputational, 0);
  assert.equal(result.foundation.compositePlanes.length, 5);
  assert.equal(result.foundation.metaRealityPlanes.length, 3);
  assert.equal(result.foundation.domains.energy, 0);
});


test('compiles deterministic RBC bytecode with an inspectable instruction stream', () => {
  const first = compileRealityToBytecode(hello);
  const second = compileRealityToBytecode(hello);
  assert.deepEqual(first, second);
  const decoded = decodeBytecode(first);
  assert.equal(decoded.format, 'rcl.bytecode.v1');
  assert.equal(decoded.version.major, 1);
  assert.equal(decoded.program, 'FirstLight');
  assert.ok(decoded.instructions.some(instruction => instruction.name === 'CHECK_WARRANT'));
  assert.ok(decoded.instructions.some(instruction => instruction.name === 'COMMIT_TX'));
});

test('native C VM preserves state, transaction, authority and reality-root parity', async () => {
  const parity = await verifyNativeParity(hello);
  assert.equal(parity.ok, true);
  assert.deepEqual(parity.native.state, parity.reference.state);
  assert.equal(parity.native.projections[0].afterRoot, parity.reference.projections[0].afterRoot);
  assert.equal(parity.native.history[0].afterRoot, parity.reference.history[0].afterRoot);
  assert.equal(parity.native.history[0].authority.needs[0].capability, 'world.write');
});

test('native VM preserves simultaneous alteration semantics', () => {
  const source = `
  reality NativeSimultaneous {
    facet pair.left : Number = 1
    facet pair.right : Number = 2
    subject mover { warrant pair.swap on pair }
    emergence swap {
      cause mover
      when true
      needs pair.swap on pair
      alter pair.left <- pair.right
      alter pair.right <- pair.left
    }
    realize swap
  }`;
  const result = runRealityNative(source);
  assert.equal(result.state['pair.left'], 2);
  assert.equal(result.state['pair.right'], 1);
});

test('native VM rejects preserve-bound violations instead of committing unsafe state', () => {
  const source = `
  reality NativeSafety {
    facet reactor.heat : Number = 90
    subject operator { warrant reactor.change on reactor }
    emergence overheat {
      cause operator
      when true
      needs reactor.change on reactor
      alter reactor.heat <- reactor.heat + 20
      preserve reactor.heat <= 100
    }
    realize overheat
  }`;
  assert.throws(() => runRealityNative(source), error => {
    assert.equal(error.code, 'RCL_REALITY_BOUND_BROKEN');
    return true;
  });
});

test('native subset refuses provider domains rather than pretending full-domain execution', () => {
  const source = `
  reality NativeBoundary {
    energy grid { reservoir source : Energy = joules(10) }
    energize grid
  }`;
  const result = tryCompileRealityToBytecode(source);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_NATIVE_DOMAIN_PROVIDER_REQUIRED'));
});

test('Stage-1 RCL compiler seed lowers a literal assignment and produces runnable target bytecode', () => {
  const result = bootstrapCompilerSeed();
  assert.equal(result.compilerRun.state['compiler.path'], 'world.value');
  assert.equal(result.compilerRun.state['compiler.opcode'], 1);
  assert.equal(result.compilerRun.state['compiler.constant'], 7);
  assert.equal(result.targetRun.state['world.value'], 7);
  assert.match(result.boundary, /Stage-0 JavaScript/);
});


test('native VM v0.2 executes recursive reckonings with local parameters and call frames', () => {
  const source = `
  reality NativeRecursion {
    reckon triangular(n : Number) -> Number = choose(n <= 0, 0, n + triangular(n - 1))
    facet world.total : Number = triangular(20)
  }`;
  const result = runRealityNative(source);
  assert.equal(result.state['world.total'], 210);
  const decoded = decodeBytecode(compileRealityToBytecode(source));
  assert.ok(decoded.instructions.some(instruction => instruction.name === 'LOAD_LOCAL'));
  assert.ok(decoded.instructions.some(instruction => instruction.name === 'CALL'));
  assert.ok(decoded.instructions.some(instruction => instruction.name === 'RETURN'));
});

test('native Sequence, Span and Token values survive state storage and canonical JSON output', () => {
  const source = `
  reality NativeCompilerValues {
    facet compiler.tokens : Sequence = sequence_append(
      empty_sequence(),
      make_token("IDENT", "facet", make_span(0, 1, 1, 5)))
    facet compiler.kind : Text = token_kind(sequence_get(compiler.tokens, 0))
    facet compiler.offset : Number = span_offset(token_span(sequence_get(compiler.tokens, 0)))
  }`;
  const result = runRealityNative(source);
  assert.equal(result.state['compiler.kind'], 'IDENT');
  assert.equal(result.state['compiler.offset'], 0);
  assert.equal(result.state['compiler.tokens'][0].kind, 'Token');
  assert.deepEqual(result.state['compiler.tokens'][0].span, { kind: 'Span', offset: 0, line: 1, column: 1, length: 5 });
});

test('Stage-2 RCL tokenizer and parser produce typed tokens, spans and AST before Stage-0 serialization', () => {
  const result = bootstrapCompilerStage2();
  assert.equal(result.stage, 'self-hosting-core-v0.2');
  assert.equal(result.tokens.at(-1).tokenType, 'EOF');
  assert.equal(result.ast.length, 3);
  assert.deepEqual(result.targetRun.state, {
    'world.flag': true,
    'world.name': 'Aster',
    'world.value': 7,
  });
  assert.match(result.boundary, /only serializes the AST/);
});

test('Stage-2 self-hosted core matches the Stage-0 lexer and parser for its declared facet subset', () => {
  const target = 'facet world.value : Number = 7\nfacet world.flag : Truth = true\nfacet world.name : Text = "Aster"';
  const result = bootstrapCompilerStage2({ source: target });
  const stage0Tokens = lexReality(target).map(token => ({ tokenType: token.type, text: token.value, line: token.line, column: token.column }));
  const stage2Tokens = result.tokens.map(token => ({ tokenType: token.tokenType, text: token.text, line: token.span.line, column: token.span.column }));
  assert.deepEqual(stage2Tokens, stage0Tokens);
  const stage0Ast = parseReality(`reality Core { ${target} }`).body.map(node => ({ path: node.path, valueType: node.valueType, value: node.value }));
  const stage2Ast = result.ast.map(node => ({ path: node.path, valueType: node.valueType, value: node.value }));
  assert.deepEqual(stage2Ast, stage0Ast);
});

test('Stage-2 parser rejects malformed core source instead of emitting misleading AST', () => {
  assert.throws(() => bootstrapCompilerStage2({ source: 'facet world.value Number = 7' }), error => {
    assert.equal(error.code, 'RCL_PARSE_EXPECTATION');
    return true;
  });
});


test('Stage-3 RCL semantic core resolves symbols, checks types and lowers typed IR', () => {
  const result = bootstrapCompilerStage3();
  assert.equal(result.stage, 'self-hosting-semantic-core-v0.3');
  assert.equal(result.symbols.length, 3);
  assert.equal(result.semantic.length, 3);
  assert.equal(result.ir.length, 3);
  assert.deepEqual(result.symbols.map(item => [item.path, item.valueType, item.slot]), [
    ['world.value', 'Number', 0],
    ['world.flag', 'Truth', 1],
    ['world.name', 'Text', 2],
  ]);
  assert.ok(result.ir.every(item => item.kind === 'IRStore' && item.op === 'STORE_FACET'));
  assert.deepEqual(result.targetRun.state, {
    'world.flag': true,
    'world.name': 'Aster',
    'world.value': 7,
  });
  assert.match(result.boundary, /type checking/);
});

test('Stage-3 semantic core rejects duplicate declarations during RCL name resolution', () => {
  assert.throws(() => bootstrapCompilerStage3({
    source: 'facet world.value : Number = 7\nfacet world.value : Number = 8',
  }), error => {
    assert.equal(error.code, 'RCL_SEMANTIC_DUPLICATE');
    return true;
  });
});

test('Stage-3 semantic core rejects declared and literal type mismatch', () => {
  assert.throws(() => bootstrapCompilerStage3({
    source: 'facet world.value : Truth = 7',
  }), error => {
    assert.equal(error.code, 'RCL_SEMANTIC_TYPE_MISMATCH');
    return true;
  });
});

test('Stage-3 typed IR preserves source slots and spans deterministically', () => {
  const first = bootstrapCompilerStage3();
  const second = bootstrapCompilerStage3();
  assert.deepEqual(first.symbols, second.symbols);
  assert.deepEqual(first.semantic, second.semantic);
  assert.deepEqual(first.ir, second.ir);
  assert.deepEqual(first.targetBytecode, second.targetBytecode);
  assert.equal(first.ir[0].slot, 0);
  assert.equal(first.ir[1].slot, 1);
  assert.equal(first.ir[2].slot, 2);
  assert.equal(first.ir[0].span.kind, 'Span');
});

test('native VM v0.3 stores Symbol, SemanticNode and IrNode values in canonical state', () => {
  const result = bootstrapCompilerStage3();
  assert.equal(result.compilerRun.state['compiler.symbols'][0].kind, 'Symbol');
  assert.equal(result.compilerRun.state['compiler.semantic'][0].kind, 'SemanticFacet');
  assert.equal(result.compilerRun.state['compiler.ir'][0].kind, 'IRStore');
  assert.match(result.compilerRun.vm, /0\.6\.0-alpha\.1/);
});


test('Stage-4 RCL module core validates imports, qualifies symbols and lowers combined cross-file IR', () => {
  const result = bootstrapCompilerStage4();
  assert.equal(result.stage, 'self-hosting-module-core-v0.4');
  assert.deepEqual(result.modules, ['core', 'app']);
  assert.deepEqual(result.imports, ['core']);
  assert.deepEqual(result.symbols.map(item => [item.path, item.valueType, item.slot]), [
    ['core::world.value', 'Number', 0],
    ['core::world.name', 'Text', 1],
    ['app::app.ready', 'Truth', 2],
  ]);
  assert.deepEqual(result.targetRun.state, {
    'app::app.ready': true,
    'core::world.name': 'Aster',
    'core::world.value': 7,
  });
  assert.match(result.boundary, /cross-file name resolution/);
});

test('Stage-4 rejects imports whose module is absent from the module graph', () => {
  assert.throws(() => bootstrapCompilerStage4({
    appSource: 'module app\nimport missing\nfacet app.ready : Truth = true',
  }), error => {
    assert.equal(error.code, 'RCL_MODULE_MISSING');
    return true;
  });
});

test('Stage-4 rejects cross-file requirements without an explicit import', () => {
  assert.throws(() => bootstrapCompilerStage4({
    appSource: 'module app\nrequire core world.value : Number\nfacet app.ready : Truth = true',
  }), error => {
    assert.equal(error.code, 'RCL_MODULE_NOT_IMPORTED');
    return true;
  });
});

test('Stage-4 rejects unresolved imported symbols and imported type mismatch', () => {
  assert.throws(() => bootstrapCompilerStage4({
    appSource: 'module app\nimport core\nrequire core world.missing : Number\nfacet app.ready : Truth = true',
  }), error => {
    assert.equal(error.code, 'RCL_MODULE_SYMBOL_MISSING');
    return true;
  });
  assert.throws(() => bootstrapCompilerStage4({
    appSource: 'module app\nimport core\nrequire core world.value : Text\nfacet app.ready : Truth = true',
  }), error => {
    assert.equal(error.code, 'RCL_MODULE_TYPE_MISMATCH');
    return true;
  });
});

test('Stage-4 module graph, qualified IR and target RBC are deterministic', () => {
  const first = bootstrapCompilerStage4();
  const second = bootstrapCompilerStage4();
  assert.deepEqual(first.modules, second.modules);
  assert.deepEqual(first.symbols, second.symbols);
  assert.deepEqual(first.ir, second.ir);
  assert.deepEqual(first.targetBytecode, second.targetBytecode);
  assert.match(first.compilerRun.vm, /0\.6\.0-alpha\.1/);
});


test('native VM v0.5 exposes deterministic byte and UTF-8 primitives for self-hosted RBC encoding', () => {
  const source = `
  reality BytePrimitives {
    facet bytes.u8 : Sequence = bytes_u8(255)
    facet bytes.u16 : Sequence = bytes_u16le(258)
    facet bytes.u32 : Sequence = bytes_u32le(16909060)
    facet bytes.i32 : Sequence = bytes_i32le(-2)
    facet bytes.f64 : Sequence = bytes_f64le(1)
    facet bytes.utf8 : Sequence = utf8_bytes("道")
    facet bytes.joined : Sequence = sequence_concat(bytes.u8, bytes.u16)
  }`;
  const result = runRealityNative(source);
  assert.deepEqual(result.state['bytes.u8'], [255]);
  assert.deepEqual(result.state['bytes.u16'], [2, 1]);
  assert.deepEqual(result.state['bytes.u32'], [4, 3, 2, 1]);
  assert.deepEqual(result.state['bytes.i32'], [254, 255, 255, 255]);
  assert.deepEqual(result.state['bytes.f64'], [0, 0, 0, 0, 0, 0, 240, 63]);
  assert.deepEqual(result.state['bytes.utf8'], [233, 129, 147]);
  assert.deepEqual(result.state['bytes.joined'], [255, 2, 1]);
  assert.match(result.vm, /0\.6\.0-alpha\.1/);
});

test('sha256_text computes the same SHA-256 digest in JS and native runtimes', async () => {
  const source = `
  reality HashPrimitive {
    facet hash.input : Text = "abc"
    facet hash.digest : Text = sha256_text(hash.input)
  }`;
  const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const jsRun = await runReality(source);
  const nativeRun = runRealityNative(source);
  const decoded = decodeBytecode(compileRealityToBytecode(source));

  assert.equal(jsRun.state['hash.digest'], expected);
  assert.equal(nativeRun.state['hash.digest'], expected);
  assert.equal(decoded.instructions.some(instruction => instruction.builtin === 'SHA256_TEXT'), true);
});

test('native byte primitives reject values outside their declared binary range', () => {
  assert.throws(() => runRealityNative('reality InvalidByte { facet bytes.bad : Sequence = bytes_u8(256) }'), error => {
    assert.equal(error.code, 'RCL_BYTE_ENCODING_RANGE');
    return true;
  });
});

test('Stage-5 RCL encoder emits exact RBC 1.1 bytes and runs the encoded target', () => {
  const result = bootstrapCompilerStage5();
  assert.equal(result.stage, 'self-hosting-rbc-encoder-v0.5');
  assert.equal(result.referenceParity, true);
  assert.equal(result.deterministic, true);
  assert.deepEqual(result.targetBytecode, result.referenceBytecode);
  assert.deepEqual(result.targetRun.state, {
    'app::app.ready': true,
    'core::world.name': 'Aster',
    'core::world.value': 7,
  });
  assert.equal(result.targetBytecode.toString('ascii', 0, 4), 'RCLB');
  assert.match(result.boundary, /only extracts bytes/);
});

test('Stage-5 RCL string and number pools deduplicate values exactly like the Stage-0 reference', () => {
  const result = bootstrapCompilerStage5({
    coreSource: 'module core\nfacet world.name : Text = "Aster"\nfacet world.value : Number = 7',
    appSource: 'module app\nimport core\nrequire core world.name : Text\nfacet app.name : Text = "Aster"\nfacet app.value : Number = 7',
  });
  assert.equal(result.referenceParity, true);
  assert.equal(result.rbcStrings.filter(item => item === 'Aster').length, 1);
  assert.equal(result.rbcNumbers.filter(item => item === 7).length, 1);
});

test('Stage-5 repeated native compiler runs produce byte-identical target RBC', () => {
  const first = bootstrapCompilerStage5();
  const second = bootstrapCompilerStage5();
  assert.deepEqual(first.targetBytecode, second.targetBytecode);
  assert.deepEqual(first.ir, second.ir);
  assert.equal(first.compilerRun.state['compiler.rbc_size'], first.targetBytecode.length);
});


test('embedded native VM keeps one process alive and replays preloaded RBC without process startup', async () => {
  const bytecode = compileRealityToBytecode('reality EmbeddedTest { facet world.ready : Truth = true facet world.value : Number = 7 }');
  const vm = new EmbeddedNativeVm(bytecode);
  await vm.ready;
  const pid = vm.process.pid;
  const first = await vm.run({ resetState: true });
  const second = await vm.run();
  assert.equal(vm.process.pid, pid);
  assert.equal(first.result.state['world.value'], 7);
  assert.equal(second.result.state['world.ready'], true);
  assert.ok(second.daemonElapsedMs < 10);
  await vm.close();
});

test('native Provider ABI v1 invokes a registered provider from RCL bytecode', () => {
  const source = fs.readFileSync(path.join(PACKAGE_ROOT, 'examples', 'provider-abi.rcl'), 'utf8');
  const bytecode = compileRealityToBytecode(source);
  const decoded = decodeBytecode(bytecode);
  assert.ok(decoded.instructions.some(instruction => instruction.name === 'CALL_PROVIDER'));
  const buildPath = path.join(PACKAGE_ROOT, 'build', 'provider-abi-test.rbc');
  fs.writeFileSync(buildPath, bytecode);
  const providerDemo = process.platform === 'win32' ? 'provider_demo.exe' : 'provider_demo';
  const run = spawnSync(path.join(PACKAGE_ROOT, 'native', providerDemo), [buildPath], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(run.stdout);
  assert.match(payload.state['provider.reply'], /hello-provider/);
});

test('reference runtime accepts the same provider_call contract through explicit providers', async () => {
  const source = 'reality ProviderReference { facet provider.reply : Text = provider_call("echo", "echo.text", "request") }';
  const result = await runReality(source, { providers: { echo: (capability, request) => `${capability}:${request}` } });
  assert.equal(result.state['provider.reply'], 'echo.text:request');
});

test('native build exports embeddable static/shared libraries and public header', () => {
  const files = process.platform === 'win32'
    ? ['librclvm.a', 'rclvm.dll', 'rclvm.lib', 'rclvm.h', 'rclvmd.exe', 'rclc.exe']
    : ['librclvm.a', 'librclvm.so', 'rclvm.h', 'rclvmd', 'rclc'];
  for (const file of files) {
    assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, 'native', file)), true, file);
  }
});
