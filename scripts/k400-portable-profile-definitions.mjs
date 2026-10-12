import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const PROFILE_DIRECTORY = 'examples/universal-stress/portable-profiles';
const readSource = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
export const exactEdit = (text, old, replacement) => {
  assert.equal(text.split(old).length, 2, 'An edit must identify one exact fragment');
  return text.replace(old, replacement);
};
export function applyInputs(source, inputs) {
  for (const [name, value] of Object.entries(inputs)) {
    const pattern = new RegExp(`(facet input\\.${name} : (?:Number|Truth) = )-?(?:[0-9.]+|true|false)`, 'gu');
    assert.equal([...source.matchAll(pattern)].length, 1, name);
    source = source.replace(pattern, (_, prefix) => prefix + String(value));
  }
  return source;
}

function relationalSource() {
  let source = readSource('examples/universal-stress/k326-compiler-database.rcl');
  source = source.slice(source.indexOf('reality '), source.indexOf('  facet evaluation.pass')) + '}\n';
  source = source.replace('CompilerDatabase', 'PortableRelations').replace('k326-compiler-database-v0.1', 'k400-portable-relations-v1').replace('NATIVE_RCLC_TO_RCLVM', 'RCL_OWNED_PORTABLE_RBC');
  source = source.replace('  facet database.customers', `  facet input.region : Number = 10
  facet input.valid_amount : Number = 25
  facet input.approved : Number = 1
  facet input.empty : Truth = false

  facet database.customers`);
  source = source.replace('Sequence = sequence_append(sequence_append(sequence_append(\n    empty_sequence(), make_customer', 'Sequence = choose(input.empty, empty_sequence(), sequence_append(sequence_append(sequence_append(\n    empty_sequence(), make_customer');
  source = source.replace('make_customer(3, 10, 400))', 'make_customer(3, 10, 400)))');
  source = source.replace('Sequence = sequence_append(sequence_append(sequence_append(sequence_append(\n    empty_sequence(), make_order', 'Sequence = choose(input.empty, empty_sequence(), sequence_append(sequence_append(sequence_append(sequence_append(\n    empty_sequence(), make_order');
  source = source.replace('make_order(103, 3, 90, 1))', 'make_order(103, 3, 90, 1)))');
  source = source.replaceAll(', 0, 10)', ', 0, input.region)');
  source = source.replace('make_order(104, 3, 25, 1)', 'make_order(104, 3, input.valid_amount, input.approved)');
  return source;
}
export function relationalOracle({ region, valid_amount, approved, empty }) {
  const customers = empty ? [] : [[1, 10, 500], [2, 20, 300], [3, 10, 400]];
  const orders = empty ? [] : [[100, 1, 70, 1], [101, 2, 40, 1], [102, 1, 30, 0], [103, 3, 90, 1]];
  const insert = row => orders.some(item => item[0] === row[0]) || !customers.some(item => item[0] === row[1]) || row[2] < 0
    ? [orders, 0] : [[...orders, row], 1];
  const selected = rows => rows.filter(order => order[3] === 1 && customers.some(customer => customer[0] === order[1] && customer[1] === region));
  const duplicate = insert([103, 2, 55, 1]), orphan = insert([104, 99, 25, 1]), negative = insert([104, 3, -25, 1]), valid = insert([104, 3, valid_amount, approved]);
  const sum = rows => selected(rows).reduce((value, row) => value + row[2], 0);
  return { 'database.customers': customers, 'database.orders': orders,
    'query.region_10_customer_count': customers.filter(row => row[1] === region).length,
    'query.region_10_initial_sum': sum(orders), 'query.region_10_initial_join_count': selected(orders).length,
    'transaction.duplicate': duplicate, 'transaction.orphan': orphan, 'transaction.negative': negative, 'transaction.valid': valid,
    'database.committed_orders': valid[0], 'query.region_10_committed_sum': sum(valid[0]), 'query.region_10_committed_join_count': selected(valid[0]).length };
}
function simulationSource() {
  let source = readSource('examples/universal-stress/k329-k332-compiler-simulation-scientific.rcl');
  source = source.slice(source.indexOf('reality '), source.indexOf('  facet evaluation.pass')) + '}\n';
  return source.replace('CompilerSimulationScientific', 'PortableSimulationScientific').replace('k329-k332-compiler-simulation-scientific-v0.1', 'k400-portable-simulation-scientific-v1').replace('NATIVE_RCLC_TO_RCLVM', 'RCL_OWNED_PORTABLE_RBC');
}
export function simulationOracle({ initial_position, initial_velocity, acceleration, steps }) {
  let position = initial_position, velocity = initial_velocity;
  const trajectory = [position];
  for (let index = 0; index < steps; index++) { position += velocity; velocity += acceleration; trajectory.push(position); }
  return { 'result.position': position, 'result.velocity': velocity, 'result.trajectory': trajectory,
    'oracle.position': initial_position + steps * initial_velocity + acceleration * steps * (steps - 1) / 2,
    'oracle.velocity': initial_velocity + acceleration * steps,
    'boundary.zero_step_state': [initial_position, initial_velocity, [initial_position]],
    'boundary.one_step_state': [initial_position + initial_velocity, initial_velocity + acceleration, [initial_position, initial_position + initial_velocity]] };
}
export function algorithmOracle({ gcd_a, gcd_b, fibonacci_n, sum_squares_n }) {
  let a = Math.abs(gcd_a), b = Math.abs(gcd_b), first = 0, second = 1, squares = 0;
  while (b) [a, b] = [b, a % b];
  for (let index = 0; index < fibonacci_n; index++) [first, second] = [second, first + second];
  for (let index = 1; index <= sum_squares_n; index++) squares += index * index;
  return { 'result.gcd': a, 'result.fibonacci': first, 'result.sum_squares': squares,
    'result.boundary_gcd_zero': 42, 'result.boundary_fibonacci_zero': 0, 'result.boundary_fibonacci_one': 1, 'result.boundary_sum_zero': 0 };
}
const mapped = (names, values) => Object.fromEntries(names.map((name, index) => [name, values[index]]));
export const PORTABLE_PROFILES = [
  { id: 'relations', donor: 'examples/universal-stress/k326-compiler-database.rcl', source: relationalSource,
    profile: 'bounded in-memory integer relations, selection/join/aggregation, primary and foreign keys, atomic insertion and rejection; no SQL engine/persistence claim',
    families: ['database'], environments: ['windows', 'wasm-vm', 'linux', 'android'],
    baseline: { region: 10, valid_amount: 25, approved: 1, empty: false }, oracle: relationalOracle,
    cases: [[10,0,1,false],[20,25,1,false],[99,25,1,false],[10,25,0,false],[20,0,0,false],[10,-1,1,false],[10,250,1,false],[10,25,1,true],[0,25,0,true],[20,-25,0,false]]
      .map(values => mapped(['region','valid_amount','approved','empty'], values)),
    mutations: [
      { id: 'foreign-key', good: 'not has_customer(customers, 0, order_customer(row))', bad: 'has_customer(customers, 0, order_customer(row))', intent: 'Atomic insert rejects duplicate order keys, missing customer foreign keys or negative amounts; valid inserts append exactly one row.' },
      { id: 'selection', good: 'customer_region(sequence_get(customers, cursor)) == region,\n        1,', bad: 'customer_region(sequence_get(customers, cursor)) != region,\n        1,', intent: 'Count only customers in the requested region, including empty relations and absent regions.' },
      { id: 'aggregation', good: 'order_amount(sequence_get(orders, cursor)),\n        0) + sum_approved', bad: '1,\n        0) + sum_approved', intent: 'Sum amounts of approved orders after joining customers in the requested region; do not replace a sum with a count.' },
    ] },
  { id: 'simulation-scientific', donor: 'examples/universal-stress/k329-k332-compiler-simulation-scientific.rcl', source: simulationSource,
    profile: 'bounded explicit discrete constant-acceleration trajectory and independent closed-form differential numerical checks; no arbitrary physics/HPC claim',
    families: ['simulation', 'scientific'], environments: ['windows', 'wasm-vm', 'linux', 'android'],
    baseline: { initial_position: 0, initial_velocity: 3, acceleration: 2, steps: 10 }, oracle: simulationOracle,
    cases: [[0,0,0,0],[5,-3,2,1],[-7,0,-2,4],[2,4,0,12],[-10,-4,3,9],[100,1,-1,20],[3,7,2,2],[0,0,1,30],[1.5,0.5,-0.5,6],[-32,11,-3,16]]
      .map(values => mapped(['initial_position','initial_velocity','acceleration','steps'], values)),
    mutations: [
      { id: 'advance-position', good: 'state_position(state) + state_velocity(state),\n      state_velocity(state) + acceleration,', bad: 'state_position(state) - state_velocity(state),\n      state_velocity(state) + acceleration,', intent: 'Each explicit step advances position by the old velocity, then adds acceleration to velocity, and appends the new position to the trajectory.' },
      { id: 'closed-position', good: 'acceleration * steps * (steps - 1) / 2', bad: 'acceleration * steps * (steps + 1) / 2', intent: 'The closed-form position must match explicit integration where position is advanced with old velocity before acceleration changes that velocity.' },
      { id: 'closed-velocity', good: '    initial_velocity + acceleration * steps\n', bad: '    initial_velocity + acceleration + steps\n', intent: 'The final velocity after a given number of constant-acceleration discrete steps must match the explicit step integrator, including zero steps.' },
    ] },
  { id: 'algorithm-posix', donor: 'examples/universal-stress/expansion-wave1/algorithm.rcl', source: () => readSource('examples/universal-stress/expansion-wave1/algorithm.rcl'),
    profile: 'bounded recursive GCD/Fibonacci/square summation and command-line outputs on Linux and Android emulator native processes; no mobile UI/hardware claim',
    families: ['algorithm', 'cli'], environments: ['linux', 'android'],
    baseline: { gcd_a: 1071, gcd_b: 462, fibonacci_n: 12, sum_squares_n: 24 }, oracle: algorithmOracle,
    cases: [[0,0,0,0],[-42,0,1,-2],[0,15,2,1],[-18,24,3,2],[270,-192,5,7],[17,19,8,12],[48,180,10,18],[-111,-37,13,23],[12345,54321,16,30],[999,81,18,32]]
      .map(values => mapped(['gcd_a','gcd_b','fibonacci_n','sum_squares_n'], values)),
    mutations: [
      { id: 'gcd', good: 'gcd(b, a % b)', bad: 'gcd(b, b % a)', intent: 'Compute the nonnegative greatest common divisor with Euclidean reduction, including negative values and zero boundaries.' },
      { id: 'fibonacci', good: 'fibonacci(n - 1) + fibonacci(n - 2)', bad: 'fibonacci(n - 1) + fibonacci(n - 3)', intent: 'Compute F(0)=0, F(1)=1 and each subsequent Fibonacci value as the sum of the previous two.' },
      { id: 'sum-squares', good: 'n * n + sum_squares(n - 1)', bad: 'n + n + sum_squares(n - 1)', intent: 'Compute the sum of integer squares from 1 through n, returning zero for nonpositive n.' },
    ] },
];
