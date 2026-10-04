(()=>{
'use strict';
const byId=id=>document.getElementById(id);
let installed=false;

async function saveAdminSettings(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();}
  const btn=document.querySelector('.applyBtn');
  if(!btn)return;
  const oldText=btn.textContent;
  btn.disabled=true;
  btn.textContent='KAYDEDİLİYOR...';
  try{
    if(typeof db==='undefined'||typeof ids==='undefined'||!ids.game)throw new Error('Maç bağlantısı hazır değil');

    const start=Math.max(1,Number(byId('setStartKeeper')?.value)||100);
    const cost=Math.max(1,Number(byId('setKeeperCost')?.value)||10);
    const delay=Math.max(500,Number(byId('setShotDelay')?.value)||3000);
    const threshold=Math.max(1,Number(byId('setShotThreshold')?.value)||10);
    const rules={...(typeof gameRules!=='undefined'&&gameRules?gameRules:{}),goalkeeper_initial_power:start,start_keeper:start,keeper_cost:cost,shot_delay:delay,shot_threshold:threshold,last_team:(typeof state!=='undefined'?state.lastTeam:'B')};

    const gameRes=await db.from('games').update({rules}).eq('id',ids.game).select('id,rules');
    if(gameRes.error)throw gameRes.error;
    if(!gameRes.data||!gameRes.data.length)throw new Error('Oyun ayarları güncellenmedi');

    const gkRes=await db.from('goalkeepers').update({initial_power:start}).eq('game_id',ids.game).select('id,initial_power');
    if(gkRes.error)throw gkRes.error;

    const stateRes=await db.from('goalkeeper_opponent_state').update({initial_power:start,power:start}).eq('game_id',ids.game).select('id,power,initial_power');
    if(stateRes.error)throw stateRes.error;
    if(!stateRes.data||stateRes.data.length<2)throw new Error('Kaleci güç kayıtları güncellenmedi');

    if(typeof gameRules!=='undefined')gameRules=rules;
    if(typeof state!=='undefined'){
      state.startKeeper=start;
      state.keeperCost=cost;
      state.shotDelay=delay;
      state.shotThreshold=threshold;
      state.keeper.A=start;
      state.keeper.B=start;
    }
    if(typeof render==='function')render();
    if(typeof loadRemote==='function')await loadRemote(true);
    if(typeof log==='function')log('Ayarlar kaydedildi • Kaleci gücü '+start);

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
  btn.onclick=saveAdminSettings;
}

install();
window.saveAdminSettingsReliable=saveAdminSettings;
})();