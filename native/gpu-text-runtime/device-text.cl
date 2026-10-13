/* Generic length-tagged UTF-8 values. Every transformation below runs on GPU.
 * Allocation appends into a bounded arena; retained values are never mutated. */
int text_alloc(__global Value* values,int* used,__global uchar* arena,int* bytes,int capacity,int length,int* error) {
  if(length<0||*bytes<0||length>capacity-*bytes){*error=24;return 0;}
  int id=alloc_value(values,used,3,0,error);if(*error)return 0;
  values[id].first=*bytes;values[id].length=length;*bytes+=length;return id;
}
int text_private(__global Value* values,int* used,__global uchar* arena,int* bytes,int capacity,const char* source,int length,int* error) {
  int id=text_alloc(values,used,arena,bytes,capacity,length,error);if(*error)return 0;
  for(int i=0;i<length;i++)arena[values[id].first+i]=(uchar)source[i];return id;
}
int text_constant(__global Value* values,int* used,__global uchar* arena,int* bytes,int capacity,__constant const char* source,int length,int* error) {
  int id=text_alloc(values,used,arena,bytes,capacity,length,error);if(*error)return 0;
  for(int i=0;i<length;i++)arena[values[id].first+i]=(uchar)source[i];return id;
}
int number_text(double number,char* output) {
  if(number==0){output[0]='0';return 1;}
  if(isnan(number)){output[0]='N';output[1]='a';output[2]='N';return 3;}
  if(isinf(number)){int at=0;if(signbit(number))output[at++]='-';__constant const char* s="Infinity";for(int i=0;i<8;i++)output[at++]=s[i];return at;}
  // Native canonical_number_text falls back to seventeen significant digits
  // when strtod's subnormal conversion sets ERANGE. Preserve that behavior.
  char raw[32],digits[24];int length=fabs(number)<0x1p-1022?d2exp_buffered_n(number,16,raw):d2s_buffered_n(number,raw),cursor=0,negative=raw[0]=='-';
  if(negative)cursor++;int count=0;
  while(cursor<length&&raw[cursor]!='E'&&raw[cursor]!='e'){if(raw[cursor]!='.')digits[count++]=raw[cursor];cursor++;}
  while(count>1&&digits[count-1]=='0')count--;
  cursor++;int exponent_sign=1,exponent=0;
  if(cursor<length&&raw[cursor]=='-'){exponent_sign=-1;cursor++;}else if(cursor<length&&raw[cursor]=='+')cursor++;
  while(cursor<length){exponent=exponent*10+(raw[cursor++]-'0');}int k=exponent*exponent_sign+1,at=0;
  if(negative)output[at++]='-';
  if(k>0&&k<=21){
    for(int i=0;i<k;i++)output[at++]=i<count?digits[i]:'0';
    if(count>k){output[at++]='.';for(int i=k;i<count;i++)output[at++]=digits[i];}
  }else if(k<=0&&k>-6){
    output[at++]='0';output[at++]='.';for(int i=0;i<-k;i++)output[at++]='0';for(int i=0;i<count;i++)output[at++]=digits[i];
  }else{
    output[at++]=digits[0];if(count>1){output[at++]='.';for(int i=1;i<count;i++)output[at++]=digits[i];}
    int exp=k-1;output[at++]='e';output[at++]=exp<0?'-':'+';if(exp<0)exp=-exp;
    char reverse[4];int n=0;do{reverse[n++]=(char)('0'+exp%10);exp/=10;}while(exp);while(n)output[at++]=reverse[--n];
  }return at;
}
int scalar_text(__global Value* values,int* used,__global uchar* arena,int* bytes,int capacity,int input,int* error) {
  Value value=values[input];
  if(value.type==3)return input;
  if(value.type==1){char buffer[160];int length=number_text(value.number,buffer);return text_private(values,used,arena,bytes,capacity,buffer,length,error);}
  if(value.type==2)return value.number!=0?text_constant(values,used,arena,bytes,capacity,"true",4,error):text_constant(values,used,arena,bytes,capacity,"false",5,error);
  if(value.type==0)return text_constant(values,used,arena,bytes,capacity,"null",4,error);
  *error=9;return 0;
}
int text_join(__global Value* values,int* used,__global uchar* arena,int* bytes,int capacity,int left,int right,int* error) {
  left=scalar_text(values,used,arena,bytes,capacity,left,error);right=scalar_text(values,used,arena,bytes,capacity,right,error);if(*error)return 0;
  Value a=values[left],b=values[right];if(a.length>capacity-b.length){*error=24;return 0;}
  int id=text_alloc(values,used,arena,bytes,capacity,a.length+b.length,error);if(*error)return 0;
  int start=values[id].first;for(int i=0;i<a.length;i++)arena[start+i]=arena[a.first+i];for(int i=0;i<b.length;i++)arena[start+a.length+i]=arena[b.first+i];return id;
}
int utf8_count(__global uchar* arena,Value value){int count=0;for(int i=0;i<value.length;i++)if((arena[value.first+i]&0xc0)!=0x80)count++;return count;}
int utf8_offset(__global uchar* arena,Value value,int scalar){int index=0,at=0;while(at<value.length&&index<scalar){at++;while(at<value.length&&(arena[value.first+at]&0xc0)==0x80)at++;index++;}return at;}
int text_slice(__global Value* values,int* used,__global uchar* arena,int* bytes,int capacity,int input,double start,double count,int* error){
  Value value=values[input];if(value.type!=3||!isfinite(start)||!isfinite(count)||floor(start)!=start||floor(count)!=count){*error=9;return 0;}
  if(start<0||count<0){*error=25;return 0;}int total=utf8_count(arena,value),offset=(int)fmin(start,(double)total),take=(int)fmin(count,(double)(total-offset));
  int first=utf8_offset(arena,value,offset),end=utf8_offset(arena,value,offset+take),id=alloc_value(values,used,3,0,error);if(*error)return 0;
  values[id].first=value.first+first;values[id].length=end-first;return id;
}
int text_find(__global uchar* arena,Value source,Value marker){
  if(marker.length>source.length)return -1;
  for(int i=0;i<=source.length-marker.length;i++){int equal=1;for(int j=0;j<marker.length;j++)if(arena[source.first+i+j]!=arena[marker.first+j]){equal=0;break;}if(equal)return i;}return -1;
}
int ascii_space(int value){return value==32||(value>=9&&value<=13);}
int text_builtin(int builtin,int argc,int* args,__global Value* values,int* used,__global uchar* arena,int* bytes,int capacity,int* error){
  int input=argc?args[0]:0;Value a=values[input];
  if(builtin==7)return scalar_text(values,used,arena,bytes,capacity,input,error);
  if(a.type!=3){*error=9;return 0;}
  if(builtin>=1&&builtin<=3){
    Value b=values[args[1]];if(b.type!=3){*error=9;return 0;}int at=text_find(arena,a,b),matched=at>=0;
    if(builtin==2)matched=at==0;
    if(builtin==3){matched=a.length>=b.length;for(int i=0;matched&&i<b.length;i++)if(arena[a.first+a.length-b.length+i]!=arena[b.first+i])matched=0;}
    return alloc_value(values,used,2,matched,error);
  }
  if(builtin==5||builtin==6){
    int id=text_alloc(values,used,arena,bytes,capacity,a.length,error);if(*error)return 0;
    for(int i=0;i<a.length;i++){int c=arena[a.first+i];arena[values[id].first+i]=(uchar)(builtin==5&&c>='A'&&c<='Z'?c+32:builtin==6&&c>='a'&&c<='z'?c-32:c);}return id;
  }
  if(builtin==8){
    int start=0,end=a.length;while(start<end&&ascii_space(arena[a.first+start]))start++;while(end>start&&ascii_space(arena[a.first+end-1]))end--;
    int id=alloc_value(values,used,3,0,error);if(*error)return 0;values[id].first=a.first+start;values[id].length=end-start;return id;
  }
  if(builtin==9||builtin==10){
    Value b=values[args[1]];if(b.type!=3){*error=9;return 0;}int at=text_find(arena,a,b),first=builtin==9?0:at<0?a.length:at+b.length,length=builtin==9?(at<0?a.length:at):a.length-first;
    int id=alloc_value(values,used,3,0,error);if(*error)return 0;values[id].first=a.first+first;values[id].length=length;return id;
  }
  if(builtin==15){
    Value b=values[args[1]];if(b.type!=1||!isfinite(b.number)||floor(b.number)!=b.number){*error=9;return 0;}
    int total=utf8_count(arena,a);if(b.number<0||b.number>=total)return text_constant(values,used,arena,bytes,capacity,"",0,error);
    return text_slice(values,used,arena,bytes,capacity,input,b.number,1,error);
  }
  if(builtin==16){Value b=values[args[1]],c=values[args[2]];if(b.type!=1||c.type!=1){*error=9;return 0;}return text_slice(values,used,arena,bytes,capacity,input,b.number,c.number,error);}
  if(builtin>=17&&builtin<=20){
    int character=a.length?arena[a.first]:0,matched=0;
    if(builtin==17)matched=a.length==1&&ascii_space(character);
    if(builtin==18)matched=a.length==1&&character>='0'&&character<='9';
    if(builtin==19||builtin==20)matched=a.length==1&&((character>='a'&&character<='z')||(character>='A'&&character<='Z')||character=='_'||(builtin==20&&character>='0'&&character<='9'));
    return alloc_value(values,used,2,matched,error);
  }
  *error=10;return 0;
}
