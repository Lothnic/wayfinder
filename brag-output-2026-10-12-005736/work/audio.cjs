// Original 22-second D-major bed, with deterministic percussion and in-key UI cues.
const fs=require('fs'),path=require('path');
const SR=48000,DUR=22,N=SR*DUR,L=new Float64Array(N),R=new Float64Array(N);
const hz=n=>440*2**((n-69)/12);let seed=81473;
function noise(){seed=(1664525*seed+1013904223)>>>0;return seed/2147483648-1;}
function tone(midi,start,dur,gain,kind='key',pan=0){
 const f=hz(midi),count=Math.min(N-Math.floor(start*SR),Math.ceil(dur*SR)),base=Math.floor(start*SR);
 for(let j=0;j<count;j++){
  const t=j/SR,p=t/dur;
  const attack=Math.min(1,t/(kind==='pad'?.35:.012));
  const release=Math.min(1,(dur-t)/(kind==='pad'?.5:.08));
  const env=attack*release*(kind==='pad'?1:Math.exp(-t*4.6));
  const wave=Math.sin(2*Math.PI*f*t)+.16*Math.sin(4*Math.PI*f*t)+.035*Math.sin(6*Math.PI*f*t);
  const v=wave*env*gain;
  L[base+j]+=v*(1-pan*.3);R[base+j]+=v*(1+pan*.3);
 }
}
const chords=[[50,57,61,66],[43,54,57,62],[47,54,57,62],[45,52,57,61],[50,57,61,66],[50,57,61,66]];
for(let k=0;k<6;k++){
 const start=k*4,dur=Math.min(4.2,DUR-start);
 for(let i=1;i<4;i++)tone(chords[k][i],start,dur,.026,'pad',(i-2)*.6);
}
const melody=[74,69,66,69,73,69,66,62];
for(let beat=0;beat<44;beat++){
 const t=beat*.5,k=Math.min(5,Math.floor(t/4));
 if(beat%2===0)tone(chords[k][0]-12,t,.42,.055,'bass');
 if(beat>=6&&beat%2===1)tone(melody[(beat>>1)%8],t+.04,.65,.027,'key',beat%4===1?-.5:.5);
 if(beat%4===0&&t>1){
  for(let j=0;j<SR*.15;j++){const u=j/SR,env=(1-Math.exp(-u*400))*Math.exp(-u*36);const phase=2*Math.PI*(46*u+58*.025*(1-Math.exp(-u/.025)));const v=Math.sin(phase)*env*.11;L[Math.floor(t*SR)+j]+=v;R[Math.floor(t*SR)+j]+=v;}
 }
 if(beat>=6&&beat%4===2){
  let smooth=0;for(let j=0;j<SR*.09;j++){const u=j/SR;smooth=smooth*.75+noise()*.25;const v=smooth*Math.exp(-u*55)*.03;L[Math.floor(t*SR)+j]+=v;R[Math.floor(t*SR)+j]+=v;}
 }
}
// UI cues share D major and sit below the instrumental.
for(const [t,n]of[[3,69],[8,74],[9.2,66],[10.75,69],[12.2,74],[14,69],[16.3,78],[18,74]])tone(n,t,.28,.018,'key',.1);
tone(62,18,1.5,.05,'key',-.1);tone(69,18.16,1.4,.035,'key',.1);tone(74,18.32,1.3,.03,'key',.2);
// Shared short room reflections, softer than the direct sound.
for(const [delay,gain]of[[.065,.1],[.13,.06],[.195,.035]]){
 const shift=Math.floor(delay*SR);for(let i=N-1;i>=shift;i--){L[i]+=R[i-shift]*gain;R[i]+=L[i-shift]*gain;}
}
const buf=Buffer.alloc(44+N*4);buf.write('RIFF');buf.writeUInt32LE(36+N*4,4);buf.write('WAVE',8);buf.write('fmt ',12);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(N*4,40);
let peak=0;for(let i=0;i<N;i++){const t=i/SR,fade=Math.min(1,t/.08,(DUR-t)/1.1);const l=Math.tanh(L[i])*fade,r=Math.tanh(R[i])*fade;peak=Math.max(peak,Math.abs(l),Math.abs(r));buf.writeInt16LE(Math.round(l*32767),44+i*4);buf.writeInt16LE(Math.round(r*32767),46+i*4);}
fs.writeFileSync(path.join(__dirname,'music-raw.wav'),buf);console.log('Original stereo soundtrack:',DUR+'s,',SR+'Hz, peak',Math.round(20*Math.log10(peak))+'dBFS');
