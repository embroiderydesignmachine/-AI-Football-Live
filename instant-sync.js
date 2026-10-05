(()=>{
'use strict';
let channel=null,ready=false,started=false,lastWakeAt=0;
let originalRender=null,originalProcessQueue=null,originalLoadRemote=null;
let processTimer=null,syncing=false,processingHoldUntil=0;
let isWorkerLeader=false,leaderId=null;
const queueTruth={a:null,b:null};
const now=()=>Date.now();
const clientId=(globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():('c-'+Math.random().toString(36).slice(2)+'-'+Date.now().toString(36));
const startedAt=Date.now();

function canUse(){
  return typeof db!=='undefined'&&typeof ids!=='undefined'&&ids.game&&typeof state!=='undefined'&&typeof render==='function';
}

function paintQueueTruth(){
  if(queueTruth.a===null||queueTruth.b===null||typeof state==='undefined')return;
  state.A.queue=queueTruth.a;
  state.B.queue=queueTruth.b;
  const pairs=[['queueA',queueTruth.a],['queueB',queueTruth.b],['adminQueueA',queueTruth.a],['adminQueueB',queueTruth.b]];
  for(const [id,value] of pairs){const el=document.getElementById(id);if(el)el.textContent=String(value)}
}

function patchRender(){
  if(originalRender||typeof render!=='function')return;
  originalRender=render;
  render=function(){
    if(queueTruth.a!==null){state.A.queue=queueTruth.a;state.B.queue=queueTruth.b;}
    const r=originalRender.apply(this,arguments);
    paintQueueTruth();
    return r;
  };
}

function setQueues(a,b,broadcast=false,holdMs=0){
  queueTruth.a=Math.max(0,Number(a)||0);
  queueTruth.b=Math.max(0,Number(b)||0);
  if(holdMs>0)processingHoldUntil=Math.max(processingHoldUntil,now()+holdMs);
  if(typeof state!=='undefined'){state.A.queue=queueTruth.a;state.B.queue=queueTruth.b;}
  if(typeof render==='function')render();else paintQueueTruth();
  if(broadcast)send('queues',{a:queueTruth.a,b:queueTruth.b,holdMs});
}

async function syncQueuesFromDb(broadcast=false,holdMs=0){
  if(!canUse()||syncing)return;
  syncing=true;
  try{
    const {data,error}=await db.from('pending_shots').select('attacking_team_id').eq('game_id',ids.game).eq('status','pending');
    if(error)throw error;
    const a=data.filter(x=>x.attacking_team_id===ids.team.A).length;
    const b=data.filter(x=>x.attacking_team_id===ids.team.B).length;
    setQueues(a,b,broadcast,holdMs);
  }catch(e){console.warn('Bekleyen şut eşitleme hatası',e)}
  finally{syncing=false;}
}

function send(event,payload){
  if(!ready||!channel)return;
  try{channel.send({type:'broadcast',event,payload:{...payload}})}catch(e){}
}

function sendState(goalTeam=null){
  if(!canUse())return;
  send('state',{
    scoreA:Number(state.A.score)||0,
    scoreB:Number(state.B.score)||0,
    keeperA:Number.isFinite(Number(state.keeper.A))?Number(state.keeper.A):0,
    keeperB:Number.isFinite(Number(state.keeper.B))?Number(state.keeper.B):0,
    eventText:(document.getElementById('event')?.textContent||'').trim(),
    goalTeam
  });
}

function applyQueues(p){
  if(!p||!canUse())return;
  setQueues(p.a,p.b,false,Math.max(0,Number(p.holdMs)||0));
  if(isWorkerLeader&&(queueTruth.a>0||queueTruth.b>0))processQueue();
}

function applyState(p){
  if(!p||!canUse())return;
  state.A.score=Number(p.scoreA)||0;
  state.B.score=Number(p.scoreB)||0;
  state.keeper.A=Number.isFinite(Number(p.keeperA))?Number(p.keeperA):state.keeper.A;
  state.keeper.B=Number.isFinite(Number(p.keeperB))?Number(p.keeperB):state.keeper.B;
  if(typeof render==='function')render();
  if(p.eventText&&typeof log==='function')log(p.eventText);
  if(p.goalTeam&&typeof celebrateGoal==='function')celebrateGoal(p.goalTeam);
}

function scheduleProcessQueue(minDelay=650){
  if(!originalProcessQueue||!isWorkerLeader)return;
  if(processTimer)clearTimeout(processTimer);
  const wait=Math.max(minDelay,processingHoldUntil-now(),0);
  processTimer=setTimeout(()=>{
    processTimer=null;
    if(isWorkerLeader)originalProcessQueue();
  },wait);
}

function presenceMembers(){
  if(!channel)return[];
  const raw=channel.presenceState?channel.presenceState():{};
  const out=[];
  for(const [key,items] of Object.entries(raw||{})){
    for(const item of (Array.isArray(items)?items:[])){
      out.push({
        clientId:String(item.clientId||key),
        admin:!!item.admin,
        startedAt:Number(item.startedAt)||0
      });
    }
  }
  return out;
}

function electLeader(){
  const admins=presenceMembers().filter(x=>x.admin);
  admins.sort((a,b)=>(a.startedAt-b.startedAt)||a.clientId.localeCompare(b.clientId));
  const next=admins.length?admins[0].clientId:null;
  const wasLeader=isWorkerLeader;
  leaderId=next;
  isWorkerLeader=!!(typeof adminAuthed!=='undefined'&&adminAuthed&&leaderId===clientId);
  if(!wasLeader&&isWorkerLeader&&(queueTruth.a>0||queueTruth.b>0))processQueue();
}

async function trackPresence(){
  if(!ready||!channel)return;
  try{
    await channel.track({
      clientId,
      admin:!!(typeof adminAuthed!=='undefined'&&adminAuthed),
      startedAt
    });
    electLeader();
  }catch(e){console.warn('İşleyici seçimi güncellenemedi',e)}
}

function installBroadcast(){
  if(!canUse()){setTimeout(installBroadcast,120);return;}
  if(channel)return;
  channel=db.channel('instant-ui-'+ids.game,{config:{broadcast:{self:false},presence:{key:clientId}}})
    .on('broadcast',{event:'queues'},({payload})=>applyQueues(payload))
    .on('broadcast',{event:'state'},({payload})=>applyState(payload))
    .on('broadcast',{event:'wake'},async({payload})=>{
      if(now()-lastWakeAt<120)return;
      lastWakeAt=now();
      const holdMs=Math.max(0,Number(payload&&payload.holdMs)||0);
      if(holdMs)processingHoldUntil=Math.max(processingHoldUntil,now()+holdMs);
      await syncQueuesFromDb(false,holdMs);
      if(isWorkerLeader&&(queueTruth.a>0||queueTruth.b>0))processQueue();
    })
    .on('presence',{event:'sync'},electLeader)
    .on('presence',{event:'join'},electLeader)
    .on('presence',{event:'leave'},electLeader)
    .subscribe(async status=>{
      ready=status==='SUBSCRIBED';
      if(ready){
        await trackPresence();
        await syncQueuesFromDb(false);
        electLeader();
      }else{
        isWorkerLeader=false;
      }
    });
}

function patchFunctions(){
  if(started)return;
  if(typeof addShots!=='function'||typeof resolveShot!=='function'||typeof addKeeper!=='function'||typeof processQueue!=='function'||typeof render!=='function'){
    setTimeout(patchFunctions,120);return;
  }
  started=true;
  patchRender();

  originalProcessQueue=processQueue;
  processQueue=function(){scheduleProcessQueue(650)};

  if(typeof loadRemote==='function'){
    originalLoadRemote=loadRemote;
    loadRemote=async function(){
      const r=await originalLoadRemote.apply(this,arguments);
      await syncQueuesFromDb(false);
      return r;
    };
  }

  const oldAddShots=addShots;
  addShots=async function(t,n){
    processingHoldUntil=Math.max(processingHoldUntil,now()+850);
    const r=await oldAddShots.apply(this,arguments);
    await syncQueuesFromDb(true,700);
    send('wake',{holdMs:700});
    if(isWorkerLeader)processQueue();
    return r;
  };

  const oldResolveShot=resolveShot;
  resolveShot=async function(t,shot){
    const r=await oldResolveShot.apply(this,arguments);
    await syncQueuesFromDb(true,0);
    const txt=(document.getElementById('event')?.textContent||'').trim();
    sendState(/^GOL!/i.test(txt)?t:null);
    return r;
  };

  const oldAddKeeper=addKeeper;
  addKeeper=async function(t,n){
    const r=await oldAddKeeper.apply(this,arguments);
    sendState(null);
    return r;
  };

  if(typeof resetMatch==='function'){
    const oldReset=resetMatch;
    resetMatch=async function(){
      const r=await oldReset.apply(this,arguments);
      await syncQueuesFromDb(true,0);
      sendState(null);
      return r;
    };
  }

  const ev=document.getElementById('event');
  if(ev){
    let prev=ev.textContent;
    new MutationObserver(()=>{
      const cur=ev.textContent;
      if(cur===prev)return;
      prev=cur;
      if(/Ayarlar kaydedildi/i.test(cur))setTimeout(()=>sendState(null),100);
    }).observe(ev,{childList:true,characterData:true,subtree:true});
  }

  if(typeof db!=='undefined'&&db.auth&&db.auth.onAuthStateChange){
    db.auth.onAuthStateChange(()=>setTimeout(trackPresence,0));
  }
  window.addEventListener('beforeunload',()=>{try{if(channel)channel.untrack()}catch(e){}});
  syncQueuesFromDb(false);
}

function boot(){installBroadcast();patchFunctions();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
