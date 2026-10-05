(()=>{
'use strict';
const byId=id=>document.getElementById(id);
let installed=false;

function readNumber(id,fallback,min=0){
  const el=byId(id);
  const raw=el?String(el.value).trim():'';
  if(raw==='')return fallback;
  const n=Number(raw);
  return Number.isFinite(n)?Math.max(min,n):fallback;
}

function installZeroSafeRules(){
  if(typeof window.applyRules!=='function')return;
  window.applyRules=function(r){
    gameRules=r||{};
    const startRaw=gameRules.goalkeeper_initial_power ?? gameRules.start_keeper ?? 100;
    state.startKeeper=Number.isFinite(Number(startRaw))?Number(startRaw):100;
    state.keeperCost=Number.isFinite(Number(gameRules.keeper_cost))?Number(gameRules.keeper_cost):10;
    state.shotDelay=Number.isFinite(Number(gameRules.shot_delay))?Number(gameRules.shot_delay):3000;
    state.shotThreshold=Number.isFinite(Number(gameRules.shot_threshold))?Number(gameRules.shot_threshold):10;
    if(typeof render==='function')render();
  };
}

async function saveAdminSettings(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();}
  const btn=document.querySelector('.applyBtn');
  if(!btn)return;
  const oldText=btn.textContent;
  btn.disabled=true;
  btn.textContent='KAYDEDİLİYOR...';
  try{
    if(typeof db==='undefined'||typeof ids==='undefined'||!ids.game)throw new Error('Maç bağlantısı hazır değil');

    const start=readNumber('setStartKeeper',100,0);
    const resetKeeper=start!==state.startKeeper;
    const cost=readNumber('setKeeperCost',10,0);
    const delay=readNumber('setShotDelay',3000,0);
    const threshold=readNumber('setShotThreshold',10,0);
    const rules={...(typeof gameRules!=='undefined'&&gameRules?gameRules:{}),goalkeeper_initial_power:start,start_keeper:start,keeper_cost:cost,shot_delay:delay,shot_threshold:threshold,last_team:(typeof state!=='undefined'?state.lastTeam:'B')};

    const gameRes=await db.from('games').update({rules}).eq('id',ids.game).select('id,rules');
    if(gameRes.error)throw gameRes.error;
    if(!gameRes.data||!gameRes.data.length)throw new Error('Oyun ayarları güncellenmedi');

    if(resetKeeper){
    const gkRes=await db.from('goalkeepers').update({initial_power:start}).eq('game_id',ids.game).select('id,initial_power');
    if(gkRes.error)throw gkRes.error;

    const stateRes=await db.from('goalkeeper_opponent_state').update({initial_power:start,power:start}).eq('game_id',ids.game).select('id,power,initial_power');
    if(stateRes.error)throw stateRes.error;
    if(!stateRes.data||stateRes.data.length<2)throw new Error('Kaleci güç kayıtları güncellenmedi');
    }

    if(typeof gameRules!=='undefined')gameRules=rules;
    if(typeof state!=='undefined'){
      state.startKeeper=start;
      state.keeperCost=cost;
      state.shotDelay=delay;
      state.shotThreshold=threshold;
      if(resetKeeper){state.keeper.A=start;state.keeper.B=start;}
    }
    if(typeof render==='function')render();
    if(typeof loadRemote==='function')await loadRemote(true);
    if(typeof log==='function')log('Ayarlar kaydedildi');

    btn.textContent='KAYDEDİLDİ';
    setTimeout(()=>{btn.textContent=oldText;btn.disabled=false;},1200);
  }catch(err){
    console.error('Admin ayar kaydetme hatası:',err);
    if(typeof log==='function')log('Ayarlar kaydedilemedi');
    btn.textContent='HATA - TEKRAR DENE';
    btn.disabled=false;
    setTimeout(()=>{btn.textContent=oldText;},1800);
  }
}

function install(){
  if(installed)return;
  const btn=document.querySelector('.applyBtn');
  if(!btn){setTimeout(install,250);return;}
  installed=true;
  installZeroSafeRules();
  btn.onclick=saveAdminSettings;
  const costInput=byId('setKeeperCost');
  if(costInput){
    const note=document.createElement('small');
    note.textContent='0 = kaleci gücü azalmaz. Örnek: 10 = her şutta 10 güç kaybı.';
    note.style.cssText='display:block;color:#aab2c8;font-size:10px;margin-top:4px';
    costInput.parentElement.appendChild(note);
  }
  if(typeof loadRemote==='function')setTimeout(()=>loadRemote(true),50);
}

install();
window.saveAdminSettingsReliable=saveAdminSettings;
})();