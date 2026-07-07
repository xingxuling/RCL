import { runReality } from '../index.mjs';
import { identifier } from './common.mjs';

function literal(value) {
  return JSON.stringify(String(value));
}

export function buildAuthoritySource({
  realityName,
  subject = 'architect',
  host = 'forge',
  capability = 'generate',
  warrant = 'forge.generate',
  target = 'forge',
  request,
  witness = 'rcl:reality-forge',
  purpose = 'produce_verified_artifacts',
}) {
  const realityId = identifier(realityName, 'RealityForgeRun');
  const subjectId = identifier(subject, 'architect');
  const hostId = identifier(host, 'forge');
  const requestJson = typeof request === 'string' ? request : JSON.stringify(request);
  return `reality ${realityId} {
  facet forge.request : Text = ${literal(requestJson)}
  facet forge.receipt : Text = "pending"

  subject ${subjectId} {
    warrant ${warrant} on ${target}
  }

  spirit mission {
    facet identity : Text = ${literal(realityName)}
    value traceability : Number = 1 weight 1
    purpose ${identifier(purpose, 'produce')} : Truth = true priority 1
    affect confidence : Number = 0.8 intensity 0.5
    preserve mission.value.traceability >= 1
    evidence "rcl:reality-forge-purpose"
  }

  host ${hostId} {
    offers ${identifier(capability, 'generate')} -> Text
  }

  emergence build {
    cause ${subjectId}
    when forge.receipt == "pending"
    needs ${warrant} on ${target}
    call ${hostId}.${identifier(capability, 'generate')}(forge.request) -> forge.receipt
    preserve length(forge.receipt) > 0
    witness ${literal(witness)}
  }

  integrate mission
  realize build
}`;
}

export async function runAuthorizedProvider(options) {
  const source = buildAuthoritySource(options);
  const hostId = identifier(options.host ?? 'forge', 'forge');
  const capabilityId = identifier(options.capability ?? 'generate', 'generate');
  const result = await runReality(source, {
    hostAdapters: {
      [hostId]: async request => {
        if (request.capability !== capabilityId) {
          throw new Error(`Unexpected capability ${request.capability}; expected ${capabilityId}`);
        }
        const requestJson = request.args[0];
        const parsed = JSON.parse(requestJson);
        const providerResult = await options.provider(parsed, request);
        return typeof providerResult === 'string' ? providerResult : JSON.stringify(providerResult);
      },
    },
  });
  return { source, result };
}
