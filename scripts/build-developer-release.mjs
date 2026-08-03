#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outDir = path.resolve(
  process.argv[2] ?? path.join(root, 'dist', `rcl-developer-release-${sourcePackage.version}`),
);
const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-developer-release-'));

function copyFilter(source) {
  const relative = path.relative(root, source).replaceAll('\\', '/');
  if (!relative) return true;
  return !['.git', 'node_modules', 'dist', 'output', '.DS_Store'].some(
    (blocked) => relative === blocked || relative.startsWith(`${blocked}/`),
  );
}

try {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(root, stageRoot, { recursive: true, filter: copyFilter });

  const stagedPackagePath = path.join(stageRoot, 'package.json');
  const stagedPackage = JSON.parse(fs.readFileSync(stagedPackagePath, 'utf8'));
  stagedPackage.bin = {
    ...stagedPackage.bin,
    rcl: './src/reality-hub-cli.mjs',
  };
  stagedPackage.engines = { node: '>=18' };
  stagedPackage.files = [
    'src/**',
    'examples/**',
    'selfhost/**',
    'native/**',
    'bootstrap/**',
    'api/**',
    'docs/**',
    'benchmarks/**',
    'VERSION-CONTRACT.json',
    'foundation-conformance.json',
  ];
  stagedPackage.scripts = {
    mcp: 'node src/rcl-mcp-server.mjs',
    demo: 'node src/reality-hub-cli.mjs run examples/hello-reality.rcl',
    'verify:install':
      'node src/reality-hub-cli.mjs doctor && node src/reality-hub-cli.mjs check examples/hello-reality.rcl',
  };
  fs.writeFileSync(stagedPackagePath, `${JSON.stringify(stagedPackage, null, 2)}\n`);

  const contractResult = spawnSync(
    process.execPath,
    ['--test', '--test-concurrency=1', 'tests/cli-public-contract.test.mjs'],
    { cwd: stageRoot, encoding: 'utf8' },
  );
  if (contractResult.status !== 0) {
    console.error(contractResult.stdout);
    console.error(contractResult.stderr);
    process.exit(contractResult.status ?? 1);
  }

  const packed = spawnSync('npm', ['pack', '--json', '--pack-destination', outDir], {
    cwd: stageRoot,
    encoding: 'utf8',
  });
  if (packed.status !== 0) {
    console.error(packed.stdout);
    console.error(packed.stderr);
    process.exit(packed.status ?? 1);
  }

  const packInfo = JSON.parse(packed.stdout)[0];
  const archivePath = path.join(outDir, packInfo.filename);
  const archiveBytes = fs.readFileSync(archivePath);
  const sha256 = crypto.createHash('sha256').update(archiveBytes).digest('hex');

  const manifest = {
    format: 'taowind.rcl.developer-release.v1',
    package: stagedPackage.name,
    version: stagedPackage.version,
    channel: 'alpha',
    runtimeRequirement: stagedPackage.engines.node,
    artifact: {
      fileName: packInfo.filename,
      bytes: archiveBytes.length,
      unpackedBytes: packInfo.unpackedSize ?? null,
      sha256,
      mediaType: 'application/gzip',
    },
    install: {
      npm: `npm install -g ./${packInfo.filename}`,
      posix: './install.sh',
      powershell: '.\\install.ps1',
    },
    verify: [
      'rcl --version',
      'rcl doctor',
      'rcl check ./hello-reality.rcl',
      'rcl run ./hello-reality.rcl',
    ],
    compilerBoundary: {
      canonicalSource: true,
      nativeCoreCompilerSelfHosting: true,
      fullSelfHosting: false,
      completeRuntime: false,
      jsReferenceRuntimeStillRequired: true,
    },
  };

  fs.writeFileSync(
    path.join(outDir, 'release-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), `${sha256}  ${packInfo.filename}\n`);
  fs.copyFileSync(
    path.join(root, 'VERSION-CONTRACT.json'),
    path.join(outDir, 'VERSION-CONTRACT.json'),
  );
  fs.copyFileSync(
    path.join(root, 'examples', 'hello-reality.rcl'),
    path.join(outDir, 'hello-reality.rcl'),
  );

  fs.writeFileSync(
    path.join(outDir, 'install.sh'),
    `#!/usr/bin/env sh\nset -eu\nSCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nnpm install -g "$SCRIPT_DIR/${packInfo.filename}"\nrcl --version\nrcl doctor\nrcl check "$SCRIPT_DIR/hello-reality.rcl"\n`,
    { mode: 0o755 },
  );

  fs.writeFileSync(
    path.join(outDir, 'install.ps1'),
    `$ErrorActionPreference = "Stop"\n$Package = Join-Path $PSScriptRoot "${packInfo.filename}"\nnpm install -g $Package\nrcl --version\nrcl doctor\nrcl check (Join-Path $PSScriptRoot "hello-reality.rcl")\n`,
  );

  const notes = [
    `# RCL Developer Release ${stagedPackage.version}`,
    '',
    'This package is staged from the canonical repository and replaces only the public rcl bin entry with the Reality Hub contract wrapper. All advanced commands delegate to the existing CLI.',
    '',
    'Release metadata, Tutor Skill sources, integration contracts, tests and CI files are deliberately excluded from the runtime npm archive so the artifact hash is not self-referential.',
    '',
    'The published package.json exposes only scripts whose referenced files are included in the runtime archive: mcp, demo and verify:install.',
    '',
    '## Honest boundary',
    '',
    'Native core compiler self-hosting is verified only at the declared subset. Full self-hosting and a complete native runtime are not claimed.',
    '',
    `Artifact: ${packInfo.filename}`,
    '',
    `SHA-256: ${sha256}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'RELEASE_NOTES.md'), notes);

  console.log(JSON.stringify({ ok: true, outputDir: outDir, manifest }, null, 2));
} finally {
  fs.rmSync(stageRoot, { recursive: true, force: true });
}
