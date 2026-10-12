import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const DIRECTORY = 'examples/universal-stress/genomes';
export const ENVIRONMENTS = ['windows', 'wasm-vm', 'linux', 'android'];
export function donorSource(file, name, id) {
  let source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  source = source.slice(source.indexOf('reality '));
  if (source.includes('  facet evaluation.pass')) source = source.slice(0, source.indexOf('  facet evaluation.pass')) + '}\n';
  source = source.replace(/^reality \w+/u, 'reality ' + name).replace(/facet contract\.id : Text = "[^"]*"/u, 'facet contract.id : Text = "' + id + '"');
  return source.replaceAll('NATIVE_RCLC_TO_RCLVM', 'RCL_OWNED_PORTABLE_RBC');
}
export function edit(text, old, replacement) {
  assert.equal(text.split(old).length, 2, 'Exactly one edit required: ' + old);
  return text.replace(old, replacement);
}
export function inputFacets(source, values) {
  const declarations = Object.entries(values).map(([name, value]) => `  facet input.${name} : ${typeof value === 'boolean' ? 'Truth' : 'Number'} = ${value}`).join('\n');
  return source.replace(/(reality \w+ \{\n)/u, '$1' + declarations + '\n\n');
}
export function variant(source, inputs) {
  for (const [name, value] of Object.entries(inputs)) {
    const expression = new RegExp(`(facet input\\.${name} : (?:Number|Truth) = )-?(?:[0-9.]+|true|false)`, 'gu');
    assert.equal([...source.matchAll(expression)].length, 1, name);
    source = source.replace(expression, (_, prefix) => prefix + value);
  }
  return source;
}
export const casesFrom = (names, rows) => rows.map(row => Object.fromEntries(names.map((name, index) => [name, row[index]])));
export function definition(value, file) { return { ...value, file, environments: ENVIRONMENTS }; }
