export const SFX_ASSETS = Object.freeze({
  slash1: Object.freeze({ url:'https://cdn.jsdelivr.net/gh/magnusrodseth/attack-on-titan@15f80d905322da96879e3ab1b7a6e72c27768fd2/public/sounds/slash-1.ogg', license:'CC0-1.0', source:'StarNinjas — 20 Sword Sound Effects (OpenGameArt)' }),
  slash2: Object.freeze({ url:'https://cdn.jsdelivr.net/gh/magnusrodseth/attack-on-titan@15f80d905322da96879e3ab1b7a6e72c27768fd2/public/sounds/slash-2.ogg', license:'CC0-1.0', source:'StarNinjas — 20 Sword Sound Effects (OpenGameArt)' }),
  slash3: Object.freeze({ url:'https://cdn.jsdelivr.net/gh/magnusrodseth/attack-on-titan@15f80d905322da96879e3ab1b7a6e72c27768fd2/public/sounds/slash-3.ogg', license:'CC0-1.0', source:'StarNinjas — 20 Sword Sound Effects (OpenGameArt)' }),
  metal1: Object.freeze({ url:'https://cdn.jsdelivr.net/gh/Sonofg0tham/tailgate@99de980908146410f5bb3b0efcd6711e22b253b9/public/assets/audio/metal-impact-1.ogg', license:'CC0-1.0', source:'Kenney RPG Audio — metalPot1.ogg' }),
  metal2: Object.freeze({ url:'https://cdn.jsdelivr.net/gh/Sonofg0tham/tailgate@99de980908146410f5bb3b0efcd6711e22b253b9/public/assets/audio/metal-impact-2.ogg', license:'CC0-1.0', source:'Kenney RPG Audio — metalPot2.ogg' }),
  metal3: Object.freeze({ url:'https://cdn.jsdelivr.net/gh/Sonofg0tham/tailgate@99de980908146410f5bb3b0efcd6711e22b253b9/public/assets/audio/metal-impact-3.ogg', license:'CC0-1.0', source:'Kenney RPG Audio — metalPot3.ogg' }),
  footstep: Object.freeze({ url:'https://cdn.jsdelivr.net/gh/Sonofg0tham/tailgate@99de980908146410f5bb3b0efcd6711e22b253b9/public/assets/audio/footstep-concrete-1.ogg', license:'CC0-1.0', source:'Kenney Impact/RPG Audio — concrete footstep mirror' }),
});

const ATTACK_SAMPLE = Object.freeze({
  light1:['slash1',1.08,.48], light2:['slash2',1.02,.5], light3:['slash3',.95,.58], heavy:['slash3',.80,.66], skill_u:['slash1',1.18,.62], skill_i:['slash2',.92,.68], skill_o:['slash3',.70,.78],
  kendo_light1:['slash1',1.00,.46], kendo_light2:['slash1',.94,.50], kendo_light3:['slash2',.86,.58], kendo_heavy:['slash3',.76,.67], kendo_skill_u:['slash1',1.04,.58], kendo_skill_i:['slash2',.84,.65], kendo_skill_o:['slash3',.64,.80],
  ai_thrust:['slash1',1.12,.43], ai_heavy:['slash3',.82,.58],
});

const STYLE_AUDIO = Object.freeze({
  epee:['slash1',1.22,.42,2500], destreza:['slash2,',1,.5,2100], liech:['slash3',.78,.62,1350], fiore:['slash3',.72,.65,1180], miaodao:['slash3',.62,.72,900],
});

function fallbackAttackSample(attackId){
  const style=Object.keys(STYLE_AUDIO).find(prefix=>attackId.startsWith(`${prefix}_`));
  if(!style)return null;
  const [sample0,rate0,volume0,frequency]=STYLE_AUDIO[style];
  const sample=sample0==='slash2,'?'slash2':sample0;
  const heavy=attackId.includes('heavy')||attackId.endsWith('_o');
  return [sample, heavy?rate0*.88:rate0, heavy?volume0*1.12:volume0, frequency];
}

class SfxRuntime {
  constructor(){ this.ctx=null; this.master=null; this.buffers=new Map(); this.loading=new Map(); this.unlocked=false; this.enabled=true; }
  unlock(){ if(!this.enabled||typeof window==='undefined')return; if(!this.ctx){ const AudioCtor=window.AudioContext||window.webkitAudioContext; if(!AudioCtor)return; this.ctx=new AudioCtor(); this.master=this.ctx.createGain(); this.master.gain.value=.72; this.master.connect(this.ctx.destination); for(const name of Object.keys(SFX_ASSETS))this.load(name); } this.unlocked=true; if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{}); }
  async load(name){ if(!this.ctx||this.buffers.has(name))return this.buffers.get(name); if(this.loading.has(name))return this.loading.get(name); const asset=SFX_ASSETS[name]; if(!asset)return null; const promise=fetch(asset.url,{mode:'cors',cache:'force-cache'}).then(response=>{ if(!response.ok)throw new Error(`SFX ${name} HTTP ${response.status}`); return response.arrayBuffer(); }).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.buffers.set(name,buffer);this.loading.delete(name);return buffer;}).catch(()=>{this.loading.delete(name);return null;}); this.loading.set(name,promise); return promise; }
  play(name,{volume=.5,rate=1,detune=0}={}){ if(!this.enabled)return false; this.unlock(); const buffer=this.buffers.get(name); if(!this.ctx||!this.master||!buffer){this.load(name);return false;} const source=this.ctx.createBufferSource(); source.buffer=buffer; source.playbackRate.value=rate; source.detune.value=detune; const gain=this.ctx.createGain(); gain.gain.value=volume; source.connect(gain).connect(this.master); source.start(); return true; }
  noiseBurst({duration=.16,volume=.22,frequency=1500,type='bandpass'}={}){ this.unlock(); const ctx=this.ctx;if(!ctx||!this.master)return; const count=Math.max(64,Math.floor(ctx.sampleRate*duration)); const buffer=ctx.createBuffer(1,count,ctx.sampleRate); const data=buffer.getChannelData(0); for(let i=0;i<count;i+=1)data[i]=(Math.random()*2-1)*(1-i/count); const source=ctx.createBufferSource();source.buffer=buffer; const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=.7; const gain=ctx.createGain();gain.gain.setValueAtTime(volume,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration); source.connect(filter).connect(gain).connect(this.master);source.start(); }
  thud(volume=.3){ this.unlock(); const ctx=this.ctx;if(!ctx||!this.master)return; const osc=ctx.createOscillator();osc.type='sine';osc.frequency.setValueAtTime(96,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(42,ctx.currentTime+.13);const gain=ctx.createGain();gain.gain.setValueAtTime(volume,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.16);osc.connect(gain).connect(this.master);osc.start();osc.stop(ctx.currentTime+.18); }
  attack(attackId,role='player'){
    const spec=ATTACK_SAMPLE[attackId]??fallbackAttackSample(attackId); if(!spec)return; const [sample,rate,volume,frequency=2200]=spec;
    const played=this.play(sample,{volume:role==='enemy'?volume*.82:volume,rate}); if(!played)this.noiseBurst({duration:.12,volume:.16,frequency,type:'bandpass'});
    const skill=attackId.includes('skill_'); if(skill){const ultimate=attackId.endsWith('_o');this.noiseBurst({duration:ultimate?.32:.20,volume:ultimate?.34:.22,frequency:ultimate?frequency*.72:frequency,type:'bandpass'});}
  }
  dash(role='player'){this.noiseBurst({duration:.18,volume:role==='enemy'?.13:.2,frequency:1750,type:'bandpass'});}
  guard(){const index=1+Math.floor(Math.random()*3);const played=this.play(`metal${index}`,{volume:.72,rate:1.05+Math.random()*.08});if(!played)this.noiseBurst({duration:.08,volume:.34,frequency:3300,type:'highpass'});}
  hit(weight=1){this.thud(.22+Math.min(.34,weight*.16));const played=this.play('metal1',{volume:.16+weight*.08,rate:.82});if(!played)this.noiseBurst({duration:.07,volume:.2,frequency:900,type:'lowpass'});}
  footstep(role='player'){const played=this.play('footstep',{volume:role==='enemy'?.12:.16,rate:.92+Math.random()*.12});if(!played)this.noiseBurst({duration:.035,volume:.05,frequency:420,type:'lowpass'});}
  victory(){this.unlock();const ctx=this.ctx;if(!ctx||!this.master)return;for(const [freq,delay] of [[523,0],[659,.08],[784,.18]]){const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=freq;const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,ctx.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.15,ctx.currentTime+delay+.02);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+delay+.38);osc.connect(gain).connect(this.master);osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+.42);}}
}

export const sfx=new SfxRuntime();
if(typeof window!=='undefined'){const unlock=()=>sfx.unlock();window.addEventListener('pointerdown',unlock,{capture:true,once:true});window.addEventListener('keydown',unlock,{capture:true,once:true});}
