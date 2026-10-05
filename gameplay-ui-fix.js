(()=>{
'use strict';
let installed=false;
const $=id=>document.getElementById(id);
const sleepLocal=ms=>new Promise(r=>setTimeout(r,ms));

function setAdminSteps(){
  const start=$('setStartKeeper');
  const cost=$('setKeeperCost');
  if(start){start.type='number';start.min='0';start.step='10';}
  if(cost){cost.type='number';cost.min='0';cost.step='10';}
}

function jerseyHtml(team){
  return `<span class="jersey adminMiniJersey ${team==='A'?'jA':'jB'}" style="display:inline-block;vertical-align:middle;margin-right:6px"></span>`;
}

function patchLog(){
  if(typeof log!=='function')return false;
  const oldLog=log;
  log=function(message){
    const text=String(message??'');
    const ev=$('event');
    if(ev){
      let team=null,rest=text;
      if(/^Sarı-Lacivert\s+/i.test(text)){team='A';rest=text.replace(/^Sarı-Lacivert\s+/i,'');}
      else if(/^Sarı-Kırmızı\s+/i.test(text)){team='B';rest=text.replace(/^Sarı-Kırmızı\s+/i,'');}
      if(team){
        ev.innerHTML=jerseyHtml(team)+`<span>${rest}</span>`;
        return;
      }
    }
    return oldLog.call(this,message);
  };
  return true;
}

function patchQueue(){
  if(typeof nextPending!=='function'||typeof resolveShot!=='function'||typeof processQueue!=='function')return false;
  processQueue=async function(){
    if(!adminAuthed||state.busy||!ids.game)return;
    state.busy=true;
    try{
      while(adminAuthed){
        const {a,b}=await nextPending();
        let t=null,shot=null;
        if(a&&b){
          t=state.lastTeam==='A'?'B':'A';
          shot=t==='A'?a:b;
        }else if(a){
          t='A';shot=a;
        }else if(b){
          t='B';shot=b;
        }else{
          break;
        }
        const {data:claimed,error:claimError}=await db.from('pending_shots')
          .update({status:'processing'})
          .eq('id',shot.id)
          .eq('status','pending')
          .select('id');
        if(claimError)throw claimError;
        if(!claimed||!claimed.length){
          await sleepLocal(60);
          continue;
        }
        await resolveShot(t,shot);
        state.lastTeam=t;
        await sleepLocal(Math.max(0,Number(state.shotDelay)||0));
      }
    }catch(e){
      console.error('Şut kuyruğu işlenirken hata oluştu',e);
      if(typeof log==='function')log('Şut kuyruğu işlenirken hata oluştu');
    }finally{
      state.busy=false;
      if(typeof loadRemote==='function')await loadRemote(true);
    }
  };
  return true;
}

function install(){
  if(installed)return;
  if(typeof state==='undefined'||typeof ids==='undefined'||!$('event')){setTimeout(install,100);return;}
  if(!patchLog()||!patchQueue()){setTimeout(install,100);return;}
  installed=true;
  setAdminSteps();
  const overlay=$('adminOverlay');
  if(overlay)new MutationObserver(setAdminSteps).observe(overlay,{attributes:true,attributeFilter:['class']});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
