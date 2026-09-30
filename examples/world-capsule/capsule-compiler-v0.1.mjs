import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIR = path.resolve(import.meta.dirname);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
function rootOf(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function loadWorldCapsuleRegistry(file=path.join(DIR,'root-capsules.v0.1.json')) {
  const registry = JSON.parse(fs.readFileSync(file,'utf8'));
  return {registry, byId:new Map(registry.capsules.map(c=>[c.id,c]))};
}

export function compileWorldCapsules(ids,{mode='lazy',registry:providedRegistry}={}) {
  const {registry,byId}=providedRegistry ? {registry:providedRegistry,byId:new Map(providedRegistry.capsules.map(c=>[c.id,c]))} : loadWorldCapsuleRegistry();
  const selected=[];
  const seen=new Set();
  function add(id,expand) {
    if (seen.has(id)) return;
    const c=byId.get(id);
    if(!c) throw new Error('WORLD_CAPSULE_NOT_FOUND:'+id);
    seen.add(id);
    if(expand==='full') for(const dep of c.dependencies||[]) add(dep,'full');
    else for(const dep of c.activationPolicy?.eagerDependencies||[]) add(dep,'lazy');
    selected.push(c);
  }
  ids.forEach(id=>add(id,mode));
  const graphBase={
    schema:'taowind.world-capsule-compiled-graph.v0.1',
    version:'0.1.0',
    registryRoot:registry.registryRoot,
    activationMode:mode,
    requested:[...ids],
    selected:selected.map(c=>({
      id:c.id,
      titleZh:c.titleZh,
      meaningRoot:c.meaningRoot,
      dependencies:c.dependencies,
      activationPolicy:c.activationPolicy,
      exports:c.exports,
      slots:c.slots
    }))
  };
  return {...graphBase,graphRoot:rootOf(graphBase)};
}

if (process.argv[1] && path.resolve(process.argv[1])===path.resolve(import.meta.filename)) {
  const ids=process.argv.slice(2);
  if(!ids.length) throw new Error('usage: node capsule-compiler-v0.1.mjs <capsule-id> [...]');
  const out=compileWorldCapsules(ids,{mode:'lazy'});
  const file=path.join(DIR,'compiled-world-graph.v0.1.json');
  fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n','utf8');
  console.log(JSON.stringify({selected:out.selected.map(x=>x.id),graphRoot:out.graphRoot,output:file},null,2));
}
