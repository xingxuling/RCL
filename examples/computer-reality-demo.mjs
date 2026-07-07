import fs from 'node:fs';
import { runReality } from '../src/index.mjs';

const source = fs.readFileSync(new URL('./computer-reality.rcl', import.meta.url), 'utf8');
const result = await runReality(source, {
  hostAdapters: {
    console: async ({ capability, args }) => {
      if (capability !== 'emit') throw new Error(`Unsupported capability: ${capability}`);
      return `receipt:${args[0]}`;
    },
  },
});
console.log(JSON.stringify(result, null, 2));
