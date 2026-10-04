(()=>{
'use strict';
if(typeof applyAdminSettings!=='function')return;
applyAdminSettings=async function(){
  if(!adminAuthed)return;
  state.startKeeper=Math.max(1,+$('setStartKeeper').value||100);
  state.keeperCost=Math.max(1,+$('setKeeperCost').value||10);
  state.shotDelay=Math.max(500,+$('setShotDelay').value||3000);
  state.shotThreshold=Math.max(1,+$('setShotThreshold').value||10);
  gameRules={...gameRules,goalkeeper_initial_power:state.startKeeper,keeper_cost:state.keeperCost,shot_delay:state.shotDelay,shot_threshold:state.shotThreshold,last_team:state.lastTeam};
  const results=await Promise.all([
    db.from('games').update({rules:gameRules}).eq('id',ids.game),
    db.from('goalkeepers').update({initial_power:state.startKeeper}).eq('game_id',ids.game),
    db.from('goalkeeper_opponent_state').update({initial_power:state.startKeeper,power:state.startKeeper}).eq('game_id',ids.game)
  ]);
  const failed=results.find(r=>r&&r.error);
  if(failed){console.error(failed.error);log('Ayarlar kaydedilemedi');return;}
  state.keeper.A=state.startKeeper;
  state.keeper.B=state.startKeeper;
  render();
  closeAdmin();
  log('Ayarlar kaydedildi');
};
})();