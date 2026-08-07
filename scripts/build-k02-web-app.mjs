#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRclWebApplication } from '../src/web-application-compiler.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output=process.argv[2]??path.join(root,'output','universal-stress-k02','index.html');
const result=buildRclWebApplication({
  rclPath:path.join(root,'examples','universal-stress','k02-complete-web-app.rcl'),
  specPath:path.join(root,'examples','universal-stress','k02-complete-web-app.web.json'),
  outputPath:output,
});
console.log(JSON.stringify({status:'BUILT',outputPath:result.outputPath,manifestPath:result.manifestPath,serverPath:result.serverPath,htmlBytes:result.htmlBytes,htmlSha256:result.htmlSha256,manifestRoot:result.manifest.manifestRoot},null,2));
