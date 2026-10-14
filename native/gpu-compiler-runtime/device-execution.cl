int pool_match(__global const int* positions,__global uchar* text,int a,int b){if(positions[a*2+1]!=positions[b*2+1])return 0;for(int i=0;i<positions[a*2+1];i++)if(text[positions[a*2]+i]!=text[positions[b*2]+i])return 0;return 1;}
int pool_scope(__global const int* positions,__global uchar* text,int a,int b){int n=positions[a*2+1],other=positions[b*2+1];if(n==1&&text[positions[a*2]]=='*')return 1;if(n>other)return 0;for(int i=0;i<n;i++)if(text[positions[a*2]+i]!=text[positions[b*2]+i])return 0;return n==other||text[positions[b*2]+n]=='.';}
int continuation_returns(__global const Instruction* code,int count,int pc){for(int hops=0;hops<count;hops++){if(pc<0||pc>=count)return 0;if(code[pc].op==34)return 1;if(code[pc].op==0){pc++;continue;}if(code[pc].op!=20)return 0;pc=code[pc].a;}return 0;}
int stack_get(__global Machine* m,__local int* hot,int i){return i<4096?hot[i]:m->stack[i];}
void stack_set(__global Machine* m,__local int* hot,int i,int v){if(i<4096)hot[i]=v;else m->stack[i]=v;}
__kernel void rcl_execute(__global const Instruction* code,int instruction_count,__global const double* numbers,int number_count,__global const int* positions,int string_count,__global uchar* text,int initial_text_bytes,int source_offset,int source_length,__global Value* values,__global int* state,__global int* string_values,__global int* number_values,__global Machine* m,__global int* meta,__global int* indices,__global int* scratch,__global int* records,int quantum){
  if(get_global_id(0)!=0)return;__local int hot_meta[128];for(int i=0;i<128;i++)hot_meta[i]=meta[i];Heap h={values,text,indices,hot_meta,scratch};
  if(!m->initialized){m->initialized=1;hot_meta[0]=1;hot_meta[4]=(initial_text_bytes+15)&~15;hot_meta[5]=16;values[0]=(Value){0,IMMORTAL_REFS,0,0,0,0,-1,0,0};m->true_value=value_new(&h,2,1);m->false_value=value_new(&h,2,0);m->empty_value=value_new(&h,4,0);values[m->true_value].refs=values[m->false_value].refs=values[m->empty_value].refs=IMMORTAL_REFS;values[m->empty_value].aux=0;
    for(int i=0;i<256;i++){m->byte_value[i]=value_new(&h,1,(double)i);values[m->byte_value[i]].refs=IMMORTAL_REFS;}
    for(int i=0;i<number_count;i++){number_values[i]=value_new(&h,1,numbers[i]);values[number_values[i]].refs=IMMORTAL_REFS;}
    for(int i=0;i<string_count;i++){int id=value_new(&h,3,0);values[id].first=positions[i*2];values[id].length=positions[i*2+1];values[id].refs=IMMORTAL_REFS;string_values[i]=id;state[i]=0;}
    if(source_length>=0){m->source_value=value_new(&h,3,0);values[m->source_value].first=source_offset;values[m->source_value].length=source_length;values[m->source_value].refs=IMMORTAL_REFS;}
  }
  __local int hot_stack[4096];for(int i=0;i<min(m->sp,4096);i++)hot_stack[i]=m->stack[i];
  int pc=m->pc;int sp=m->sp;int fp=m->fp;int steps=m->steps;int halted=m->halted;
  int end=min(INSTRUCTION_BUDGET,steps+quantum),stride=8+TX_CAPACITY*6+string_count*2;
  while(!m->error&&!halted&&steps<end){if(pc<0||pc>=instruction_count){m->error=23;break;}Instruction ins=code[pc++];steps++;int left=0,right=0,out=0,id=0;int required=(ins.op>=6&&ins.op<=17)||ins.op==44?2:ins.op==5||ins.op==18||ins.op==19||ins.op==21||ins.op==25||ins.op==27?1:ins.op==22&&(ins.flags&1)?1:ins.op==30?ins.b:ins.op==33?ins.b:ins.op==35&&(ins.flags&1)?3:0;int floor=fp?m->frames[fp-1].base+m->frames[fp-1].argc:0;if(sp-floor<required){m->error=5;break;}if(sp>=STACK_CAPACITY){m->error=4;break;}
    switch(ins.op){
      case 0:break;
      case 1:stack_set(m,hot_stack,sp++,keep(&h,number_values[ins.a]));break;
      case 2:stack_set(m,hot_stack,sp++,boolean(&h,ins.a!=0,m));break;
      case 3:stack_set(m,hot_stack,sp++,keep(&h,string_values[ins.a]));break;
      case 4:id=state[ins.a];if(m->active&&m->projected)for(int i=0;i<m->changes;i++)if(m->change[i*3]==ins.a)id=m->change[i*3+2];if(!id){m->error=13;break;}stack_set(m,hot_stack,sp++,keep(&h,id));break;
      case 5:if(m->active){m->error=14;break;}id=stack_get(m,hot_stack,--sp);drop(&h,state[ins.a]);state[ins.a]=id;break;
      case 6:case 7:case 8:case 9:case 44:{right=stack_get(m,hot_stack,--sp);left=stack_get(m,hot_stack,--sp);Value a=values[left],b=values[right];if(ins.op==6&&(a.type==3||b.type==3))out=text_join(&h,left,right,m);else if(a.type!=1||b.type!=1)m->error=6;else if((ins.op==9||ins.op==44)&&b.number==0)m->error=7;else out=numeric(&h,ins.op==6?a.number+b.number:ins.op==7?a.number-b.number:ins.op==8?a.number*b.number:ins.op==9?a.number/b.number:fmod(a.number,b.number),m);drop(&h,left);drop(&h,right);stack_set(m,hot_stack,sp++,out);}break;
      case 10:case 11:right=stack_get(m,hot_stack,--sp);left=stack_get(m,hot_stack,--sp);id=equal_value(&h,left,right,m);out=boolean(&h,ins.op==10?id:!id,m);drop(&h,left);drop(&h,right);stack_set(m,hot_stack,sp++,out);break;
      case 12:case 13:case 14:case 15:{right=stack_get(m,hot_stack,--sp);left=stack_get(m,hot_stack,--sp);Value a=values[left],b=values[right];if(a.type!=1||b.type!=1)m->error=6;else out=boolean(&h,ins.op==12?a.number<b.number:ins.op==13?a.number<=b.number:ins.op==14?a.number>b.number:a.number>=b.number,m);drop(&h,left);drop(&h,right);stack_set(m,hot_stack,sp++,out);}break;
      case 16:case 17:right=stack_get(m,hot_stack,--sp);left=stack_get(m,hot_stack,--sp);out=boolean(&h,ins.op==16?truth(&h,left)&&truth(&h,right):truth(&h,left)||truth(&h,right),m);drop(&h,left);drop(&h,right);stack_set(m,hot_stack,sp++,out);break;
      case 18:case 19:id=stack_get(m,hot_stack,--sp);if(ins.op==19&&values[id].type!=1)m->error=6;else out=ins.op==18?boolean(&h,!truth(&h,id),m):numeric(&h,-values[id].number,m);drop(&h,id);stack_set(m,hot_stack,sp++,out);break;
      case 20:pc=ins.a;break;
      case 21:id=stack_get(m,hot_stack,--sp);if(!truth(&h,id))pc=ins.a;drop(&h,id);break;
      case 22:if(ins.flags&1){id=stack_get(m,hot_stack,--sp);int permitted=values[id].type==2&&truth(&h,id);if(values[id].type!=2)m->error=15;drop(&h,id);if(!permitted)break;}if(m->warrants>=WARRANT_CAPACITY){m->error=16;break;}m->warrant[m->warrants*3]=ins.a;m->warrant[m->warrants*3+1]=ins.b;m->warrant[m->warrants*3+2]=ins.c;m->warrants++;break;
      case 23:if(m->active){m->error=17;break;}m->active=1;m->projected=0;m->mode=ins.a;m->rule=ins.b;m->actor=ins.c;m->rule_kind=ins.flags!=0;m->changes=m->needs=m->witnesses=0;break;
      case 24:if(!m->active){m->error=18;break;}id=0;for(int i=0;i<m->warrants;i++)if(pool_match(positions,text,m->warrant[i*3],ins.a)&&pool_match(positions,text,m->warrant[i*3+1],ins.b)&&pool_scope(positions,text,m->warrant[i*3+2],ins.c)){id=1;break;}if(!id){m->error=19;break;}if(m->needs>=TX_CAPACITY){m->error=20;break;}m->need[m->needs*2]=ins.b;m->need[m->needs*2+1]=ins.c;m->needs++;break;
      case 25:if(!m->active){m->error=18;break;}right=stack_get(m,hot_stack,--sp);id=-1;for(int i=0;i<m->changes;i++)if(m->change[i*3]==ins.a){id=i;break;}if(id<0){if(m->changes>=TX_CAPACITY){m->error=20;drop(&h,right);break;}id=m->changes++;m->change[id*3]=ins.a;m->change[id*3+1]=keep(&h,state[ins.a]);m->change[id*3+2]=0;}drop(&h,m->change[id*3+2]);m->change[id*3+2]=right;break;
      case 26:if(!m->active){m->error=18;break;}m->projected=ins.a!=0;break;
      case 27:id=stack_get(m,hot_stack,--sp);if(!truth(&h,id))m->error=21;drop(&h,id);break;
      case 28:if(!m->active){m->error=18;break;}if(m->witnesses>=TX_CAPACITY){m->error=20;break;}m->witness[m->witnesses++]=ins.a;break;
      case 29:{if(!m->active){m->error=18;break;}if(m->records>=RECORD_CAPACITY){m->error=22;break;}int base=m->records++*stride;records[base]=m->mode;records[base+1]=m->rule;records[base+2]=m->actor;records[base+3]=m->rule_kind;records[base+4]=m->changes;records[base+5]=m->needs;records[base+6]=m->witnesses;records[base+7]=steps;for(int i=0;i<m->changes;i++){records[base+8+i*3]=m->change[i*3];records[base+8+i*3+1]=keep(&h,m->change[i*3+1]);records[base+8+i*3+2]=keep(&h,m->change[i*3+2]);}for(int i=0;i<m->needs*2;i++)records[base+8+TX_CAPACITY*3+i]=m->need[i];for(int i=0;i<m->witnesses;i++)records[base+8+TX_CAPACITY*5+i]=m->witness[i];for(int i=0;i<string_count;i++){records[base+8+TX_CAPACITY*6+i]=keep(&h,state[i]);int after=state[i];for(int j=0;j<m->changes;j++)if(m->change[j*3]==i)after=m->change[j*3+2];records[base+8+TX_CAPACITY*6+string_count+i]=keep(&h,after);}if(m->mode)for(int i=0;i<m->changes;i++){int key=m->change[i*3];drop(&h,state[key]);state[key]=keep(&h,m->change[i*3+2]);}for(int i=0;i<m->changes;i++){drop(&h,m->change[i*3+1]);drop(&h,m->change[i*3+2]);}m->active=m->projected=0;}break;
      case 30:{int args[8];if(ins.b>8){m->error=10;break;}for(int i=ins.b-1;i>=0;i--)args[i]=stack_get(m,hot_stack,--sp);out=device_builtin(&h,m,ins.a,ins.b,args);for(int i=0;i<ins.b;i++)drop(&h,args[i]);stack_set(m,hot_stack,sp++,out);}break;
      case 31:if(m->active||fp){m->error=23;break;}halted=1;break;
      case 32:if(fp<1||ins.a<0||ins.a>=m->frames[fp-1].argc){m->error=11;break;}stack_set(m,hot_stack,sp++,keep(&h,stack_get(m,hot_stack,m->frames[fp-1].base+ins.a)));break;
      case 33:if(fp&&continuation_returns(code,instruction_count,pc)){Frame frame=m->frames[fp-1];int start=sp-ins.b;if(start<frame.base){m->error=11;break;}for(int i=frame.base;i<start;i++)drop(&h,stack_get(m,hot_stack,i));for(int i=0;i<ins.b;i++)stack_set(m,hot_stack,frame.base+i,stack_get(m,hot_stack,start+i));sp=frame.base+ins.b;m->frames[fp-1].argc=ins.b;pc=ins.a;break;}if(fp>=FRAME_CAPACITY){m->error=11;break;}m->frames[fp++]=(Frame){pc,sp-ins.b,ins.b};pc=ins.a;break;
      case 34:if(fp<1||sp<=m->frames[fp-1].base+m->frames[fp-1].argc){m->error=11;break;}out=stack_get(m,hot_stack,--sp);{Frame frame=m->frames[--fp];for(int i=frame.base;i<sp;i++)drop(&h,stack_get(m,hot_stack,i));sp=frame.base;stack_set(m,hot_stack,sp++,out);pc=frame.return_pc;}break;
      case 35:{int provider=0,capability=0,request=0;if(ins.flags&1){request=stack_get(m,hot_stack,--sp);capability=stack_get(m,hot_stack,--sp);provider=stack_get(m,hot_stack,--sp);}else{provider=keep(&h,string_values[ins.a]);capability=keep(&h,string_values[ins.b]);request=keep(&h,string_values[ins.c]);}if(!m->source_value||!text_constant_matches(&h,provider,"compiler_input",14)||!text_constant_matches(&h,capability,"source",6)||values[request].type!=3)m->error=27;else{stack_set(m,hot_stack,sp++,keep(&h,m->source_value));hot_meta[6]++;}drop(&h,provider);drop(&h,capability);drop(&h,request);}break;
      case 47:m->warrants=0;break;
      default:m->error=12;break;
    }
  }
  if(!m->error&&!halted&&steps>=INSTRUCTION_BUDGET)m->error=3;
  for(int i=0;i<min(sp,4096);i++)m->stack[i]=hot_stack[i];
  for(int i=0;i<128;i++)meta[i]=hot_meta[i];
  m->pc=pc;m->sp=sp;m->fp=fp;m->steps=steps;m->halted=halted;
}
__kernel void rcl_flatten(__global Value* values,__global uchar* text,__global int* indices,__global int* meta,__global int* scratch,__global Machine* m,int id){if(get_global_id(0))return;__local int hot_meta[128];for(int i=0;i<128;i++)hot_meta[i]=meta[i];Heap h={values,text,indices,hot_meta,scratch};seq_flat(&h,id,m);for(int i=0;i<128;i++)meta[i]=hot_meta[i];}
