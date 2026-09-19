import { foundationCapabilityTruthSurface } from '../src/foundation-capability-truth-surface.mjs';

export default function handler(_request, response) {
  let surface;
  try {
    surface = foundationCapabilityTruthSurface();
  } catch (error) {
    response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    response.end(`${JSON.stringify({
      ok: false,
      status: 'RCL_FOUNDATION_CAPABILITY_TRUTH_SURFACE_UNAVAILABLE',
      error: error?.message ?? String(error),
    })}\n`);
    return;
  }

  response.writeHead(surface.ok ? 200 : 503, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
  });
  response.end(`${JSON.stringify(surface)}\n`);
}
