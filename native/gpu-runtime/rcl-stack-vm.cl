#pragma OPENCL EXTENSION cl_khr_fp64 : enable
#pragma OPENCL FP_CONTRACT OFF

/* General RBC stack execution on one GPU work item. Host code only decodes
 * the binary instruction/constant pools and transports state/value buffers. */
#define STACK_LIMIT 16384
#define FRAME_LIMIT 2048
#define VALUE_LIMIT 262144
#define INSTRUCTION_BUDGET 2000000
#define WARRANT_LIMIT 256
#define TX_PART_LIMIT 128
#define RECORD_LIMIT 64
#define RECORD_HEADER 8

typedef struct { int op, flags, a, b, c; } Instruction;
typedef struct { int type, first, length, parent, tail; double number; } Value;
typedef struct { int return_pc, base, argc; } Frame;

int alloc_value(__global Value *values, int *used, int type, double number, int *error) {
  if (*used >= VALUE_LIMIT) { *error=1; return 0; }
  int id=(*used)++; values[id]=(Value){type,0,0,0,0,number}; return id;
}
int truth(__global Value *values,int id) {
  Value value=values[id]; return value.type==1||value.type==2 ? value.number!=0&&!isnan(value.number) : (value.type==3||value.type==4)&&value.length>0;
}
int sequence_get(__global Value *values,int id,int index,int *error) {
  if(values[id].type!=4||index<0||index>=values[id].length){*error=2;return 0;}
  while(values[id].length>index+1)id=values[id].parent;
  return values[id].tail;
}
int equal(__global Value *values,__global uchar *text,int left,int right,int *error) {
  int pairs[4096],count=2,iterations=0;pairs[0]=left;pairs[1]=right;
  while(count>0){
    if(++iterations>INSTRUCTION_BUDGET){*error=3;return 0;}
    right=pairs[--count];left=pairs[--count];Value a=values[left],b=values[right];
    if(a.type!=b.type)return 0;if(a.type==0)continue;
    if(a.type==1||a.type==2){if(a.number!=b.number)return 0;continue;}
    if(a.length!=b.length)return 0;
    if(a.type==3){for(int i=0;i<a.length;i++)if(text[a.first+i]!=text[b.first+i])return 0;continue;}
    if(a.type!=4){*error=12;return 0;}
    if(!a.length)continue;if(count>4092){*error=4;return 0;}
    pairs[count++]=a.parent;pairs[count++]=b.parent;pairs[count++]=a.tail;pairs[count++]=b.tail;
  }
  return 1;
}
int string_equal(__global const int *strings,__global uchar *text,int a,int b) {
  if(strings[a*2+1]!=strings[b*2+1])return 0;
  for(int i=0;i<strings[a*2+1];i++)if(text[strings[a*2]+i]!=text[strings[b*2]+i])return 0;return 1;
}
int scope_matches(__global const int *strings,__global uchar *text,int a,int b) {
  int length=strings[a*2+1],other=strings[b*2+1];
  if(length==1&&text[strings[a*2]]=='*')return 1;
  if(length>other)return 0;for(int i=0;i<length;i++)if(text[strings[a*2]+i]!=text[strings[b*2]+i])return 0;
  return length==other||text[strings[b*2]+length]=='.';
}
__kernel void rcl_execute(
  __global const Instruction *code,int instruction_count,__global const double *numbers,
  __global const int *strings,__global uchar *text,int string_count,
  __global Value *values,__global int *state,__global int *result,__global int *records) {
  if(get_global_id(0)!=0)return;
  int stack[STACK_LIMIT],sp=0,used=1,pc=0,error=0,frames_used=0,steps=0,halted=0;
  Frame frames[FRAME_LIMIT];values[0]=(Value){0,0,0,0,0,0};
  int warrants[WARRANT_LIMIT*3],warrant_count=0,active=0,projected_view=0,mode=0,rule=0,actor=0,rule_kind=0;
  int changes[TX_PART_LIMIT*3],change_count=0,needs[TX_PART_LIMIT*2],need_count=0,witnesses[TX_PART_LIMIT],witness_count=0,record_count=0;
  int record_stride=RECORD_HEADER+TX_PART_LIMIT*6+string_count*2;
  for(int i=0;i<string_count;i++)state[i]=0;
  while(pc>=0&&pc<instruction_count&&!error){
    if(++steps>INSTRUCTION_BUDGET){error=3;break;}
    Instruction ins=code[pc++];int left=0,right=0,id=0;
    if(sp>=STACK_LIMIT){error=4;break;}
    int required=(ins.op>=6&&ins.op<=17)||ins.op==44?2:
      ins.op==5||ins.op==18||ins.op==19||ins.op==21||ins.op==25||ins.op==27?1:
      ins.op==22&&(ins.flags&1)?1:ins.op==30?ins.b:ins.op==33?ins.b:0;
    int frame_floor=frames_used?frames[frames_used-1].base+frames[frames_used-1].argc:0;
    if(sp-frame_floor<required){error=5;break;}
    switch(ins.op){
      case 0: break;
      case 1: stack[sp++]=alloc_value(values,&used,1,numbers[ins.a],&error);break;
      case 2: stack[sp++]=alloc_value(values,&used,2,ins.a!=0,&error);break;
      case 3: id=alloc_value(values,&used,3,0,&error);values[id].first=strings[ins.a*2];values[id].length=strings[ins.a*2+1];stack[sp++]=id;break;
      case 4:
        id=state[ins.a];if(active&&projected_view)for(int i=0;i<change_count;i++)if(changes[i*3]==ins.a)id=changes[i*3+2];
        if(!id){error=13;break;}stack[sp++]=id;break;
      case 5: if(sp<1){error=5;break;}if(active){error=14;break;}state[ins.a]=stack[--sp];break;
      case 6:case 7:case 8:case 9:case 44:
        if(sp<2){error=5;break;}right=stack[--sp];left=stack[--sp];
        if(values[left].type!=1||values[right].type!=1){error=6;break;}
        if((ins.op==9||ins.op==44)&&values[right].number==0){error=7;break;}
        {double a=values[left].number,b=values[right].number;
          stack[sp++]=alloc_value(values,&used,1,ins.op==6?a+b:ins.op==7?a-b:ins.op==8?a*b:ins.op==9?a/b:fmod(a,b),&error);}break;
      case 10:case 11:
        if(sp<2){error=5;break;}right=stack[--sp];left=stack[--sp];id=equal(values,text,left,right,&error);
        stack[sp++]=alloc_value(values,&used,2,ins.op==10?id:!id,&error);break;
      case 12:case 13:case 14:case 15:
        if(sp<2){error=5;break;}right=stack[--sp];left=stack[--sp];
        if(values[left].type!=1||values[right].type!=1){error=6;break;}
        {double a=values[left].number,b=values[right].number;
          stack[sp++]=alloc_value(values,&used,2,ins.op==12?a<b:ins.op==13?a<=b:ins.op==14?a>b:a>=b,&error);}break;
      case 16:case 17:
        if(sp<2){error=5;break;}right=stack[--sp];left=stack[--sp];stack[sp++]=alloc_value(values,&used,2,ins.op==16?truth(values,left)&&truth(values,right):truth(values,left)||truth(values,right),&error);break;
      case 18:case 19:
        if(sp<1){error=5;break;}id=stack[--sp];
        if(ins.op==19&&values[id].type!=1){error=6;break;}
        stack[sp++]=alloc_value(values,&used,ins.op==18?2:1,ins.op==18?!truth(values,id):-values[id].number,&error);break;
      case 20:if(ins.a<0||ins.a>=instruction_count){error=8;break;}pc=ins.a;break;
      case 21:if(sp<1){error=5;break;}if(!truth(values,stack[--sp])){if(ins.a<0||ins.a>=instruction_count){error=8;break;}pc=ins.a;}break;
      case 22:
        if(ins.flags&1){if(sp<1){error=5;break;}id=stack[--sp];if(values[id].type!=2){error=15;break;}if(!truth(values,id))break;}
        if(warrant_count>=WARRANT_LIMIT){error=16;break;}
        warrants[warrant_count*3]=ins.a;warrants[warrant_count*3+1]=ins.b;warrants[warrant_count*3+2]=ins.c;warrant_count++;break;
      case 23:
        if(active){error=17;break;}active=1;projected_view=0;mode=ins.a;rule=ins.b;actor=ins.c;rule_kind=ins.flags!=0;
        change_count=need_count=witness_count=0;break;
      case 24:
        if(!active){error=18;break;}id=0;
        for(int i=0;i<warrant_count;i++)if(string_equal(strings,text,warrants[i*3],ins.a)&&string_equal(strings,text,warrants[i*3+1],ins.b)&&scope_matches(strings,text,warrants[i*3+2],ins.c)){id=1;break;}
        if(!id){error=19;break;}if(need_count>=TX_PART_LIMIT){error=20;break;}
        needs[need_count*2]=ins.b;needs[need_count*2+1]=ins.c;need_count++;break;
      case 25:
        if(!active){error=18;break;}if(sp<1){error=5;break;}id=-1;right=stack[--sp];
        for(int i=0;i<change_count;i++)if(changes[i*3]==ins.a){id=i;break;}
        if(id<0){if(change_count>=TX_PART_LIMIT){error=20;break;}id=change_count++;changes[id*3]=ins.a;changes[id*3+1]=state[ins.a];}
        changes[id*3+2]=right;break;
      case 26:if(!active){error=18;break;}projected_view=ins.a!=0;break;
      case 27:if(sp<1){error=5;break;}if(!truth(values,stack[--sp]))error=21;break;
      case 28:if(!active){error=18;break;}if(witness_count>=TX_PART_LIMIT){error=20;break;}witnesses[witness_count++]=ins.a;break;
      case 29:
        if(!active){error=18;break;}if(record_count>=RECORD_LIMIT){error=22;break;}
        {
          int base=record_count++*record_stride;records[base]=mode;records[base+1]=rule;records[base+2]=actor;records[base+3]=rule_kind;
          records[base+4]=change_count;records[base+5]=need_count;records[base+6]=witness_count;records[base+7]=steps;
          for(int i=0;i<change_count*3;i++)records[base+RECORD_HEADER+i]=changes[i];
          for(int i=0;i<need_count*2;i++)records[base+RECORD_HEADER+TX_PART_LIMIT*3+i]=needs[i];
          for(int i=0;i<witness_count;i++)records[base+RECORD_HEADER+TX_PART_LIMIT*5+i]=witnesses[i];
          for(int i=0;i<string_count;i++){records[base+RECORD_HEADER+TX_PART_LIMIT*6+i]=state[i];records[base+RECORD_HEADER+TX_PART_LIMIT*6+string_count+i]=state[i];}
          for(int i=0;i<change_count;i++)records[base+RECORD_HEADER+TX_PART_LIMIT*6+string_count+changes[i*3]]=changes[i*3+2];
          if(mode)for(int i=0;i<change_count;i++)state[changes[i*3]]=changes[i*3+2];
          active=projected_view=0;
        }break;
      case 30:
        if(ins.a==12){id=alloc_value(values,&used,4,0,&error);stack[sp++]=id;}
        else if(ins.a==4){if(sp<1){error=5;break;}id=stack[--sp];if(values[id].type!=3&&values[id].type!=4){error=9;break;}
          int length=values[id].length;if(values[id].type==3){length=0;for(int i=0;i<values[id].length;i++)if((text[values[id].first+i]&0xc0)!=0x80)length++;}
          stack[sp++]=alloc_value(values,&used,1,length,&error);}
        else if(ins.a==13){if(sp<2){error=5;break;}right=stack[--sp];left=stack[--sp];if(values[left].type!=4){error=9;break;}id=alloc_value(values,&used,4,0,&error);values[id].parent=left;values[id].tail=right;values[id].length=values[left].length+1;stack[sp++]=id;}
        else if(ins.a==14){if(sp<2){error=5;break;}right=stack[--sp];left=stack[--sp];
          if(values[right].type!=1||!isfinite(values[right].number)||floor(values[right].number)!=values[right].number||values[right].number<0||values[right].number>=VALUE_LIMIT){error=2;break;}
          stack[sp++]=sequence_get(values,left,(int)values[right].number,&error);}
        else error=10;break;
      case 31:if(active||frames_used){error=23;break;}halted=1;pc=instruction_count;break;
      case 32:if(frames_used<1||ins.a<0||ins.a>=frames[frames_used-1].argc){error=11;break;}stack[sp++]=stack[frames[frames_used-1].base+ins.a];break;
      case 33:
        if(ins.a<0||ins.a>=instruction_count||ins.b<0||sp<ins.b||frames_used>=FRAME_LIMIT){error=11;break;}
        frames[frames_used++]=(Frame){pc,sp-ins.b,ins.b};pc=ins.a;break;
      case 34:
        if(frames_used<1||sp<=frames[frames_used-1].base+frames[frames_used-1].argc){error=11;break;}id=stack[--sp];{Frame frame=frames[--frames_used];sp=frame.base;stack[sp++]=id;pc=frame.return_pc;}break;
      case 47:warrant_count=0;break;
      default:error=12;break;
    }
  }
  if(!error&&(!halted||active||frames_used))error=23;
  result[0]=error;result[1]=used;result[2]=steps;result[3]=frames_used;result[4]=sp;result[5]=record_count;result[6]=warrant_count;
  for(int i=0;i<warrant_count*3;i++)result[7+i]=warrants[i];
}
