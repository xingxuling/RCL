import fs from 'node:fs';
import path from 'node:path';
import {ROOT,casesFrom} from './k400-genomes/shared.mjs';
export const FAMILY_DIRECTORY='examples/universal-stress/new-families';
export const FAMILY_ENVIRONMENTS=['windows','wasm-vm','linux','android','server','embedded-runtime','distributed-runtime','serverless','database','dataflow-runtime','simulation-runtime','automation-runtime'];
function mediaOracle(input){
  const original=input.empty?[]:[input.red,input.green,input.blue,255,128,0,input.red,input.green,input.blue,0,0,0];
  const transformed=original.map(value=>{const bounded=Math.min(255,Math.max(0,value*input.gain+input.offset));return input.invert?255-bounded:bounded;});
  const flipped=[];for(let row=0;row<transformed.length;row+=6)flipped.push(...transformed.slice(row+3,row+6),...transformed.slice(row,row+3));
  const runs=[];for(const value of flipped){if(runs.length&&runs.at(-1)[0]===value)runs.at(-1)[1]++;else runs.push([value,1]);}
  const decoded=runs.flatMap(([value,count])=>Array(count).fill(value));
  return{state:{'image.original':original,'image.transformed':transformed,'image.flipped':flipped,'codec.runs':runs,'codec.decoded':decoded},historyRules:[]};
}
function compilerOracle(input){
  const tokens=input.parenthesized?[[3,0],[0,input.a],[1,0],[0,input.b],[4,0],[2,0],[0,input.c],[5,0],[0,input.d]]:
    [[0,input.a],[1,0],[0,input.b],[2,0],[0,input.c],[5,0],[0,input.d]];
  // Independent shunting-yard lowering and stack execution, rather than the RCL recursive-descent parser.
  const operators=[],bytecode=[],precedence={1:1,5:1,2:2};
  const emit=operator=>bytecode.push([{1:1,5:2,2:3}[operator],0]);
  for(const[kind,value]of tokens){
    if(kind===0)bytecode.push([0,value]);else if(kind===3)operators.push(kind);
    else if(kind===4){while(operators.at(-1)!==3)emit(operators.pop());operators.pop();}
    else{while(operators.length&&operators.at(-1)!==3&&precedence[operators.at(-1)]>=precedence[kind])emit(operators.pop());operators.push(kind);}
  }
  while(operators.length)emit(operators.pop());
  const stack=[];for(const[opcode,value]of bytecode){if(opcode===0)stack.push(value);else{const right=stack.pop(),left=stack.pop();stack.push(opcode===1?left+right:opcode===2?left-right:left*right);}}
  return{state:{'expression.tokens':input.invalid?[...tokens,[4,0]]:tokens,'compiler.bytecode':bytecode,'compiler.valid':!input.invalid,
    'result.execution':input.invalid?[0,0]:[1,stack[0]]},historyRules:[]};
}
function gameOracle(input){
  let x=0,y=0,velocity=0,score=0,alive=1,collected=0,frame=0;const trail=[];
  for(;frame<input.frames&&alive;){
    if(frame===input.jump_frame&&y===0)velocity=-4;
    velocity+=input.gravity;x=Math.max(0,Math.min(input.width,x+input.move*input.speed));y+=velocity;
    if(y>=0){y=0;velocity=0;}
    if(!collected&&x>=input.star){score++;collected=1;}
    if(x===input.enemy&&y===0)alive=0;
    frame++;trail.push([frame,x,y,score,alive]);
  }
  return{state:{'game.snapshot':input.frames<0?[0,0,0,0,1,0,0,[]]:[x,y,velocity,score,alive,collected,frame,trail]},historyRules:input.frames<0?[]:['commit']};
}
const profiles=[
  {id:'media',donor:'examples/forge/media/first-light.json',families:['media'],oracle:mediaOracle,
    baseline:{red:20,green:20,blue:20,gain:2,offset:-5,invert:false,empty:false},
    scope:'RCL-owned bounded 2x2 RGB sample transform/clamp, horizontal row flip and exact run-length encode/decode; procedural samples, no arbitrary image/video/audio codec or provider generation claim',
    cases:casesFrom(['red','green','blue','gain','offset','invert','empty'],[[0,0,0,1,0,false,false],[255,255,255,1,0,true,false],[10,20,30,3,10,false,false],[40,40,40,0,0,false,false],[-20,300,15,1,0,false,false],[12,100,250,2,-100,true,false],[0,128,255,-1,255,false,false],[1,2,3,1,0,false,true],[100,50,25,1,0,true,true],[255,0,128,2,50,false,false]]),
    mutations:[
      {id:'clamp-upper',good:'value > 255',bad:'value < 255',intent:'Clamp each transformed RGB channel to the inclusive range zero through 255 before optional inversion.'},
      {id:'row-flip',good:'cursor % 6 + 3, cursor % 6 - 3',bad:'cursor % 6, cursor % 6 - 3',intent:'Horizontal flipping swaps the two RGB pixels within each row, preserving row order and each pixel channel order.'},
      {id:'run-decode',good:'repeat_sample(value, count - 1, sequence_append(output, value))',bad:'repeat_sample(value, count - 2, sequence_append(output, value))',intent:'Decode every run by appending its sample exactly count times; retain empty inputs and exact run-length round trips.'},
    ]},
  {id:'compiler',donor:'examples/universal-stress/genomes/logical-events.rcl',families:['compiler'],oracle:compilerOracle,
    baseline:{a:2,b:3,c:4,d:5,parenthesized:true,invalid:false},
    scope:'RCL-owned token-sequence expression compiler with parenthesis/precedence validation, postfix stack-code emission and execution for addition/subtraction/multiplication; no lexer/full-RCL compiler or whole-language self-hosting claim',
    cases:casesFrom(['a','b','c','d','parenthesized','invalid'],[[2,3,4,5,false,false],[0,0,0,0,true,false],[-2,3,4,-5,true,false],[100,-30,-2,7,false,false],[1.5,2.5,-0.5,0.25,true,false],[8,2,0,99,false,false],[2,3,4,5,true,true],[2,3,4,5,false,true],[-7,-9,2,-1,true,false],[32,11,-3,6,false,false]]),
    mutations:[
      {id:'precedence',good:'valid(left) == 1 and kind_at(tokens, position(left)) == 2',bad:'valid(left) == 1 and kind_at(tokens, position(left)) == 1',intent:'The term parser consumes multiplication; addition and subtraction belong to the lower-precedence expression parser. Preserve parentheses and complete-input validation.'},
      {id:'opcode-emission',good:'pair(choose(operator == 1, 1, 2), 0)',bad:'pair(choose(operator == 1, 2, 1), 0)',intent:'Emit addition opcode one for a plus token and subtraction opcode two for a minus token; retain postfix operand order.'},
      {id:'operand-order',good:'operator == 2, left - right, left * right',bad:'operator == 2, right - left, left * right',intent:'Stack execution subtracts the right operand from the left operand, preserving addition and multiplication behavior.'},
    ]},
  {id:'game',donor:'examples/k04-2d-game.rcl',families:['game'],oracle:gameOracle,
    baseline:{frames:12,move:1,speed:2,jump_frame:2,gravity:1,star:8,enemy:18,width:20},
    scope:'RCL-owned bounded fixed-step 2D platform kernel: movement/wall clamp, grounded jump, gravity/landing, single collectible, ground enemy collision, terminal stop and governed trajectory commit; no graphics/input device/full game engine or arbitrary game generation claim',
    cases:casesFrom(['frames','move','speed','jump_frame','gravity','star','enemy','width'],[[0,1,2,2,1,8,18,20],[10,-1,3,-1,1,8,-1,20],[20,1,4,0,1,8,100,20],[12,1,2,-1,1,6,8,20],[16,0,0,0,1,0,-1,20],[12,1,2,2,2,8,-1,20],[8,1,1,0,0,4,12,20],[-1,1,2,2,1,8,18,20],[20,1,2,5,1,40,-1,10],[4,1,1.5,1,0.5,3,-1,20]]),
    mutations:[
      {id:'movement',good:'input.move * input.speed',bad:'input.move + input.speed',intent:'Advance horizontal position by direction multiplied by speed and clamp to the world bounds; preserve zero and negative directions.'},
      {id:'landing',good:'proposed_y >= 0',bad:'proposed_y <= 0',intent:'With downward-positive coordinates, landing occurs when proposed y reaches or crosses ground zero; then reset vertical position and velocity. Preserve airborne motion.'},
      {id:'pickup-once',good:'collected(state) == 0 and next_x >= input.star',bad:'collected(state) >= 0 and next_x >= input.star',intent:'Collect the star at most once after reaching its threshold, retaining a score between zero and one and terminal enemy-stop behavior.'},
    ]},
];
export const NEW_FAMILIES=profiles.map(profile=>({...profile,file:'scripts/k400-new-family-definitions.mjs',environments:FAMILY_ENVIRONMENTS,
  sourcePath:FAMILY_DIRECTORY+'/'+profile.id+'.rcl',source:()=>fs.readFileSync(path.join(ROOT,FAMILY_DIRECTORY,profile.id+'.rcl'),'utf8')}));
