import {GENOMES} from './k400-genomes/index.mjs';
import {runGenome,verifyGenome} from './k400-genome-engine.mjs';
const args=process.argv.slice(2),verify=args[0]==='--verify';
for(const id of (verify?args.slice(1):args).length?(verify?args.slice(1):args):GENOMES.map(item=>item.id)){
  const definition=GENOMES.find(item=>item.id===id);if(!definition)throw new Error('UNKNOWN_GENOME:'+id);
  if(verify){const result=verifyGenome(definition);console.log(JSON.stringify({admitted:result.admitted,id,eligibleCells:result.eligibleCells,reportRoot:result.reportRoot}));if(!result.admitted)process.exitCode=1;}
  else runGenome(definition);
}
