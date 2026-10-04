(()=>{
'use strict';
let ctx=null,master=null,teamTimer=null,currentTeam=null,enabled=false,lastGoalAt=0;
const $=id=>document.getElementById(id);

function ensureButton(){
  let b=$('soundEnable');
  if(b)return b;
  b=document.createElement('button');
  b.id='soundEnable';
  b.textContent='SESİ AÇ';
  Object.assign(b.style,{position:'fixed',right:'10px',bottom:'10px',zIndex:'500',border:'1px solid #6f84c5',background:'#1f315c',color:'#fff',borderRadius:'10px',padding:'10px 12px',fontWeight:'900',fontSize:'11px',boxShadow:'0 6px 22px rgba(0,0,0,.35)'});
  b.onclick=toggleSound;
  document.body.appendChild(b);
  return b;
}

async function enableSound(){
  try{
    if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();
    if(ctx.state==='suspended')await ctx.resume();
    if(!master){master=ctx.createGain();master.gain.value=.72;master.connect(ctx.destination)}
    master.gain.value=.72;
    enabled=true;
    const b=ensureButton();
    b.textContent='SESİ KAPAT';
    b.style.background='#8e2f44';
  }catch(e){console.error('Ses açılamadı',e)}
}

function disableSound(){
  enabled=false;
  stopTeamMusic();
  try{if(master)master.gain.value=0}catch(e){}
  try{if('speechSynthesis' in window)speechSynthesis.cancel()}catch(e){}
  const b=ensureButton();
  b.textContent='SESİ AÇ';
  b.style.background='#1f315c';
}

async function toggleSound(){
  if(enabled)disableSound();
  else await enableSound();
}

function tone(freq,at,dur=.16,vol=.045,type='sine'){
  if(!enabled||!ctx)return;
  const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime+at;
  o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(vol,now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+dur);
  o.connect(g);g.connect(master);o.start(now);o.stop(now+dur+.03)
}
function kick(at){
  if(!enabled||!ctx)return;
  const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime+at;
  o.type='sine';o.frequency.setValueAtTime(95,now);o.frequency.exponentialRampToValueAtTime(48,now+.12);
  g.gain.setValueAtTime(.055,now);g.gain.exponentialRampToValueAtTime(.0001,now+.14);
  o.connect(g);g.connect(master);o.start(now);o.stop(now+.15)
}
function playMotif(team){
  if(!enabled||!ctx)return;
  const notes=team==='A'?[220,277.18,329.63,440,329.63,277.18]:[196,246.94,293.66,392,293.66,246.94];
  notes.forEach((n,i)=>tone(n,i*.26,.17,.04,team==='A'?'triangle':'sine'));
  [0,.52,1.04].forEach(kick)
}
function startTeamMusic(team){
  if(!enabled||!team||currentTeam===team)return;
  currentTeam=team;
  if(teamTimer)clearInterval(teamTimer);
  playMotif(team);
  teamTimer=setInterval(()=>playMotif(team),1900)
}
function stopTeamMusic(){currentTeam=null;if(teamTimer){clearInterval(teamTimer);teamTimer=null}}
function speakGoal(){
  if(!enabled)return;
  const now=Date.now();if(now-lastGoalAt<1200)return;lastGoalAt=now;
  try{
    if('speechSynthesis'in window){
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance('Gooooooooooooool!');
      u.lang='tr-TR';u.rate=.62;u.pitch=.9;u.volume=1;
      const voices=speechSynthesis.getVoices();const tr=voices.find(v=>/^tr/i.test(v.lang));if(tr)u.voice=tr;
      speechSynthesis.speak(u)
    }
  }catch(e){}
  [523,659,784,1047].forEach((f,i)=>tone(f,i*.1,.32,.065,'sawtooth'))
}
function bind(){
  const ev=$('event'),qa=$('queueA'),qb=$('queueB');
  if(ev){
    let last='';
    new MutationObserver(()=>{const t=(ev.textContent||'').trim();if(!t||t===last)return;last=t;if(/^GOL!/i.test(t))speakGoal();if(/Maç sıfırlandı/i.test(t))stopTeamMusic()}).observe(ev,{childList:true,characterData:true,subtree:true})
  }
  if(qa&&qb){
    let a=Number(qa.textContent)||0,b=Number(qb.textContent)||0;
    new MutationObserver(()=>{const n=Number(qa.textContent)||0;if(n<a)startTeamMusic('A');a=n}).observe(qa,{childList:true,characterData:true,subtree:true});
    new MutationObserver(()=>{const n=Number(qb.textContent)||0;if(n<b)startTeamMusic('B');b=n}).observe(qb,{childList:true,characterData:true,subtree:true})
  }
}
function boot(){ensureButton();bind()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.AIFootballAudio={enableSound,disableSound,toggleSound,startTeamMusic,stopTeamMusic,speakGoal};
})();