#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRclAndroidApplication } from '../src/android-application-compiler.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rclPath = process.argv[2] ?? path.join(root, 'examples', 'universal-stress', 'k03-native-android-app.rcl');
const specPath = process.argv[3] ?? path.join(root, 'examples', 'universal-stress', 'k03-native-android-app.android.json');
const outputPath = process.argv[4] ?? path.join(root, 'output', 'universal-stress-k03');

const result = buildRclAndroidApplication({ rclPath, specPath, outputPath });
console.log(JSON.stringify(result, null, 2));
