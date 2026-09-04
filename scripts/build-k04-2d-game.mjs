#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRcl2DGame } from '../src/game-2d-compiler.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = process.argv[2] ?? path.join(root, 'examples', 'k04-2d-game.rcl');
const specPath = process.argv[3] ?? path.join(root, 'examples', 'k04-2d-game.game.json');
const outputPath = process.argv[4] ?? path.join(root, 'output', 'universal-stress-k04');

console.log(JSON.stringify(buildRcl2DGame({ rclPath, specPath, outputPath }), null, 2));
