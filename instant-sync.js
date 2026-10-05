(()=>{
'use strict';
let channel=null,ready=false,lastWakeAt=0,started=false;
const now=()=>Date.now();

function canUse(){
  return typeof db!=='undefined'&&typeof ids!=='undefined'&&ids.game&&typeof state!=='undefined'&&typeof render==='function';
}

async function syncQueuesFromDb(broadcast=true){
  if(!canUse())return;
  try{
    const {data,error}=await db.from('pending_shots').select('attacking_team_id').eq('game_id',ids.game).eq('status','pending');
    if(error)throw error;
    state.A.queue=data.filter(x=>x.attacking_team_id===ids.team.A).length;
    state.B.queue=data.filter(x=>x.attacking_team_id===ids.team.B).length;
    render();
    if(broadcast)send('queues',{a:state.A.queue,b:state.B.queue});
  }catch(e){console.warn('Anlık sıra eşitleme hatası',e)}
}

function send(event,payload){
  if(!ready||!channel)return;
  try{channel.send({type:'broadcast',event,payload:{...payload,ts:now()}})}catch(e){}
}

function sendState(goalTeam=null){
  if(!canUse())return;
  send('state',{
    scoreA:Number(state.A.score)||0,
    scoreB:Number(state.B.score)||0,
    queueA:Number(state.A.queue)||0,
    queueB:Number(state.B.queue)||0,
    keeperA:Number(state.keeper.A)||0,
    keeperB:Number(state.keeper.B)||0,
    eventText:(document.getElementById('event')?.textContent||'').trim(),
    goalTeam
  });
}

function applyQueues(p){
  if(!p||!canUse())return;
  state.A.queue=Math.max(0,Number(p.a)||0);
  state.B.queue=Math.max(0,Number(p.b)||0);
  render();
  if(typeof adminAuthed!=='undefined'&&adminAuthed&&typeof processQueue==='function'&&(state.A.queue>0||state.B.queue>0))processQueue();
}

function applyState(p){
  if(!p||!canUse())return;
  state.A.score=Number(p.scoreA)||0;
  state.B.score=Number(p.scoreB)||0;
  state.A.queue=Math.max(0,Number(p.queueA)||0);
  state.B.queue=Math.max(0,Number(p.queueB)||0);
  state.keeper.A=Number.isFinite(Number(p.keeperA))?Number(p.keeperA):state.keeper.A;
  state.keeper.B=Number.isFinite(Number(p.keeperB))?Number(p.keeperB):state.keeper.B;
  render();
  if(p.eventText&&typeof log==='function')log(p.eventText);
  if(p.goalTeam&&typeof celebrateGoal==='function')celebrateGoal(p.goalTeam);
  if(typeof adminAuthed!=='undefined'&&adminAuthed&&typeof processQueue==='function'&&(state.A.queue>0||state.B.queue>0))processQueue();
}

function installBroadcast(){
  if(!canUse()){setTimeout(installBroadcast,120);return;}
  if(channel)return;
  channel=db.channel('instant-ui-'+ids.game,{config:{broadcast:{self:false}}})
    .on('broadcast',{event:'queues'},({payload})=>applyQueues(payload))
    .on('broadcast',{event:'state'},({payload})=>applyState(payload))
    .on('broadcast',{event:'wake'},async()=>{
      if(now()-lastWakeAt<150)return;
      lastWakeAt=now();
      await syncQueuesFromDb(false);
      if(typeof adminAuthed!=='undefined'&&adminAuthed&&typeof processQueue==='function')processQueue();
    })
    .subscribe(status=>{
      ready=status==='SUBSCRIBED';
      if(ready)syncQueuesFromDb(false);
    });
}

function patchFunctions(){
  if(started)return;
  if(typeof addShots!=='function'||typeof resolveShot!=='function'||typeof addKeeper!=='function'){setTimeout(patchFunctions,120);return;}
  started=true;

  const oldAddShots=addShots;
  addShots=async function(t,n){
    const r=await oldAddShots.apply(this,arguments);
    await syncQueuesFromDb(true);
    send('wake',{});
    if(typeof adminAuthed!=='undefined'&&adminAuthed&&typeof processQueue==='function')processQueue();
    return r;
  };

  const oldResolveShot=resolveShot;
  resolveShot=async function(t,shot){
    const r=await oldResolveShot.apply(this,arguments);
    await syncQueuesFromDb(false);
    const txt=(document.getElementById('event')?.textContent||'').trim();
    sendState(/^GOL!/i.test(txt)?t:null);
    return r;
  };

  const oldAddKeeper=addKeeper;
  addKeeper=async function(t,n){
    const r=await oldAddKeeper.apply(this,arguments);
    send('state',{
      scoreA:Number(state.A.score)||0,scoreB:Number(state.B.score)||0,
      queueA:Number(state.A.queue)||0,queueB:Number(state.B.queue)||0,
      keeperA:Number(state.keeper.A)||0,keeperB:Number(state.keeper.B)||0,
      eventText:(document.getElementById('event')?.textContent||'').trim(),goalTeam:null
    });
    return r;
  };

  if(typeof resetMatch==='function'){
    const oldReset=resetMatch;
    resetMatch=async function(){const r=await oldReset.apply(this,arguments);sendState(null);return r;};
  }

  const ev=document.getElementById('event');
  if(ev){
    let prev=ev.textContent;
    new MutationObserver(()=>{
      const cur=ev.textContent;
      if(cur===prev)return;
      prev=cur;
      if(/Ayarlar kaydedildi/i.test(cur))setTimeout(()=>sendState(null),150);
    }).observe(ev,{childList:true,characterData:true,subtree:true});
  }
}

function boot(){installBroadcast();patchFunctions();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
