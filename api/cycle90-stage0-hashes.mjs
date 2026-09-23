import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const modules = [
  ['lexer', 'src/lexer.mjs'],
  ['parser', 'src/parser.mjs'],
  ['compiler', 'src/compiler.mjs'],
  ['runtime', 'src/runtime.mjs'],
  ['bytecode', 'src/bytecode.mjs'],
  ['bootstrap', 'src/bootstrap.mjs'],
  ['native_vm', 'src/native-vm.mjs'],
  ['v094_file_emission', 'src/autonomous-sandbox-file-emission-protocol.mjs'],
];

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export default function handler(req, res) {
  const root = process.cwd();
  const result = modules.map(([id, relativePath]) => {
    const file = path.join(root, relativePath);
    if (!fs.existsSync(file)) return { id, path: relativePath, present: false, sha256: null };
    const text = fs.readFileSync(file, 'utf8');
    return { id, path: relativePath, present: true, bytes: Buffer.byteLength(text), sha256: sha256(text) };
  });
  res.status(200).json({ ok: result.every(item => item.present), root, modules: result });
}
