(()=>{
'use strict';
let ctx=null,master=null,crowdGain=null,crowdSource=null,crowdFilter=null,teamTimer=null,currentTeam=null,enabled=false;
const STORE='aiFootballSoundEnabledV1';
const $=id=>document.getElementById(id);
function ensureButton(){
  let b=$('soundEnable');
  if(b)return b;
  b=document.createElement('button');
  b.id='soundEnable';
  b.textContent='SESİ AÇ';
  b.setAttribute('aria-label','Stadyum sesini aç');
  Object.assign(b.style,{position:'fixed',right:'10px',bottom:'10px',zIndex:'500',border:'1px solid #6f84c5',background:'#1f315c',color:'#fff',borderRadius:'10px',padding:'10px 12px',fontWeight:'900',fontSize:'11px',boxShadow:'0 6px 22px rgba(0,0,0,.35)'});
  b.addEventListener('click',enableSound);
  document.body.appendChild(b);
  return b;
}
function makeNoiseBuffer(seconds=4){
  const rate=ctx.sampleRate,len=Math.floor(rate*seconds),buf=ctx.createBuffer(1,len,rate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(0.55+Math.random()*0.45);
  return buf;
}
function startCrowd(){
  if(!ctx||crowdSource)return;
  crowdSource=ctx.createBufferSource();
  crowdSource.buffer=makeNoiseBuffer(5);crowdSource.loop=true;
  crowdFilter=ctx.createBiquadFilter();crowdFilter.type='bandpass';crowdFilter.frequency.value=900;crowdFilter.Q.value=.45;
  crowdGain=ctx.createGain();crowdGain.gain.value=.035;
  const wobble=ctx.createOscillator(),wobbleGain=ctx.createGain();wobble.frequency.value=.16;wobbleGain.gain.value=.012;
  wobble.connect(wobbleGain);wobbleGain.connect(crowdGain.gain);wobble.start();
  crowdSource.connect(crowdFilter);crowdFilter.connect(crowdGain);crowdGain.connect(master);crowdSource.start();
}
function cheer(strength=1,duration=3.6){
  if(!ctx||!enabled)return;
  const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  src.buffer=makeNoiseBuffer(Math.max(2,duration));f.type='bandpass';f.frequency.value=1250;f.Q.value=.35;
  const now=ctx.currentTime;g.gain.setValueAtTime(.001,now);g.gain.exponentialRampToValueAtTime(.14*strength,now+.12);g.gain.exponentialRampToValueAtTime(.055*strength,now+1.2);g.gain.exponentialRampToValueAtTime(.001,now+duration);
  src.connect(f);f.connect(g);g.connect(master);src.start(now);src.stop(now+duration+.1);
}
function tone(freq,at,dur=.15,vol=.055,type='sine'){
  if(!ctx||!enabled)return;
  const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;const now=ctx.currentTime+at;
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(vol,now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+dur);
  o.connect(g);g.connect(master);o.start(now);o.stop(now+dur+.03);
}
function kick(at,vol=.07){
  if(!ctx||!enabled)return;
  const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime+at;o.type='sine';o.frequency.setValueAtTime(110,now);o.frequency.exponentialRampToValueAtTime(52,now+.12);g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(.0001,now+.16);o.connect(g);g.connect(master);o.start(now);o.stop(now+.17);
}
function playMotif(team){
  if(!enabled||!ctx)return;
  const notes=team==='A'?[220,277.18,329.63,440,329.63,277.18]:[196,233.08,293.66,392,293.66,233.08];
  const rhythm=team==='A'?[0,.28,.56,.84,1.12,1.4]:[0,.24,.52,.76,1.08,1.36];
  notes.forEach((n,i)=>tone(n,rhythm[i],.18,.042,team==='A'?'square':'triangle'));
  [0,.48,.96,1.44].forEach((t,i)=>kick(t,i===0?.08:.055));
}
function startTeamMusic(team){
  if(!enabled||!team||currentTeam===team)return;
  currentTeam=team;
  if(teamTimer){clearInterval(teamTimer);teamTimer=null;}
  playMotif(team);
  teamTimer=setInterval(()=>playMotif(team),2100);
}
function stopTeamMusic(){currentTeam=null;if(teamTimer){clearInterval(teamTimer);teamTimer=null;}}
function speakGoal(){
  if(!enabled)return;
  try{
    if('speechSynthesis' in window){
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance('Gooooooooooooool!');u.lang='tr-TR';u.rate=.72;u.pitch=1.12;u.volume=1;
      const voices=speechSynthesis.getVoices();const tr=voices.find(v=>/^tr/i.test(v.lang));if(tr)u.voice=tr;
      speechSynthesis.speak(u);
    }
  }catch(e){}
  cheer(1.35,4.2);
  [523,659,784,1047].forEach((f,i)=>tone(f,i*.09,.32,.07,'sawtooth'));
}
async function enableSound(){
  try{
    if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();
    if(ctx.state==='suspended')await ctx.resume();
    if(!master){master=ctx.createGain();master.gain.value=.85;master.connect(ctx.destination);}
    enabled=true;localStorage.setItem(STORE,'1');startCrowd();
    const b=$('soundEnable');if(b){b.textContent='SES AÇIK';setTimeout(()=>b.remove(),700)}
  }catch(e){console.error('Ses açılamadı',e)}
}
function detectTeamFromText(t){if(/Sarı-Lacivert/i.test(t))return'A';if(/Sarı-Kırmızı/i.test(t))return'B';return null;}
function bindStatusObserver(){
  const el=$('event');if(!el)return;
  let last='';
  const act=()=>{const t=(el.textContent||'').trim();if(!t||t===last)return;last=t;const team=detectTeamFromText(t);if(/şut çekiyor/i.test(t)&&team)startTeamMusic(team);if(/^GOL!/i.test(t)){speakGoal();}if(/Maç sıfırlandı/i.test(t))stopTeamMusic();};
  new MutationObserver(act).observe(el,{childList:true,characterData:true,subtree:true});act();
}
function patchGameEvents(){
  const old=window.handleEventRow;
  if(typeof old==='function'){
    window.handleEventRow=function(row,animate=true){
      try{if(row&&row.event_type==='shot'){const team=typeof window.teamFromId==='function'?window.teamFromId(row.attacking_team_id):null;if(team){const name=team==='A'?'Sarı-Lacivert':'Sarı-Kırmızı';if(typeof window.log==='function')window.log(name+' şut çekiyor!');startTeamMusic(team);}return;}}catch(e){}
      return old.apply(this,arguments);
    };
  }
  const oldResolve=window.resolveShot;
  if(typeof oldResolve==='function'){
    window.resolveShot=async function(t,shot){
      try{if(typeof window.insertGameEvent==='function'&&window.ids&&window.ids.game&&window.ids.team&&window.ids.team[t])await window.insertGameEvent({game_id:window.ids.game,event_type:'shot',attacking_team_id:window.ids.team[t],player_id:shot&&shot.player_id||null,value:1,details:{source:'test_queue'}});}catch(e){console.warn('shot event',e)}
      startTeamMusic(t);
      return oldResolve.apply(this,arguments);
    };
  }
  const oldCelebrate=window.celebrateGoal;
  if(typeof oldCelebrate==='function'){
    window.celebrateGoal=function(team){speakGoal();return oldCelebrate.apply(this,arguments);};
  }
}
function boot(){ensureButton();bindStatusObserver();patchGameEvents();
  document.addEventListener('pointerdown',()=>{if(!enabled)enableSound();},{once:true,capture:true});
  try{if(localStorage.getItem(STORE)==='1')ensureButton().textContent='SESİ AÇ';}catch(e){}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.AIFootballAudio={enableSound,startTeamMusic,stopTeamMusic,speakGoal,cheer};
})();
