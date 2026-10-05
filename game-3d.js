(()=>{
'use strict';
let THREE=null,GLTFLoader=null,scene=null,camera=null,renderer=null,clock=null;
let ball=null,keeper=null,playerA=null,playerB=null;
let animation=null,installed=false,hooked=false,realMode=false;
const mixers=[];

const ASSETS={
  player:'./assets/models/female-player.glb',
  keeper:'./assets/models/goalkeeper.glb'
};

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;

function addStageShell(){
  if(document.getElementById('game3dStage'))return document.getElementById('game3dStage');
  const score=document.querySelector('.score');
  if(!score)return null;
  const wrap=document.createElement('section');
  wrap.id='game3dStage';
  wrap.innerHTML='<div id="game3dLabel">3D MAÇ SAHNESİ</div><div id="game3dCanvas"></div>';
  wrap.style.cssText='position:relative;height:300px;margin:5px 0;border:1px solid #2b3556;border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#10192a,#112c1b);';
  const label=wrap.firstElementChild;
  label.style.cssText='position:absolute;z-index:3;left:8px;top:7px;padding:4px 7px;border-radius:7px;background:rgba(8,14,26,.72);color:#fff;font-size:8px;font-weight:900;letter-spacing:.4px;pointer-events:none';
  score.insertAdjacentElement('afterend',wrap);
  return wrap;
}

function setLabel(text){const el=document.getElementById('game3dLabel');if(el)el.textContent=text}

async function loadThree(){
  if(THREE)return THREE;
  const mod=await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');
  THREE=mod;
  try{
    const loaderMod=await import('https://esm.sh/three@0.169.0/examples/jsm/loaders/GLTFLoader.js');
    GLTFLoader=loaderMod.GLTFLoader;
  }catch(e){console.warn('GLTFLoader yüklenemedi; basit 3D kullanılacak',e)}
  return THREE;
}

function mat(color,rough=.65,metal=.03){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal})}
function mesh(g,m){const x=new THREE.Mesh(g,m);x.castShadow=true;x.receiveShadow=true;return x}

function createPlayer(team){
  const root=new THREE.Group();
  const skin=mat(0xe9b38f,.88,0),hair=mat(0x2e1c13,.9,0);
  const blue=0x173f9b,red=0xc91f2c,yellow=0xffd21f;
  const main=team==='A'?blue:red;
  const torso=mesh(new THREE.CapsuleGeometry(.28,.55,6,12),mat(main,.7,0));torso.position.y=1.35;root.add(torso);
  const stripe=mesh(new THREE.BoxGeometry(.09,.75,.035),mat(yellow,.65,0));stripe.position.set(0,1.35,.29);root.add(stripe);
  const skirt=mesh(new THREE.CylinderGeometry(.27,.38,.30,20,1,true),mat(team==='A'?0x152b59:0x6d1821,.72,0));skirt.position.y=.94;root.add(skirt);
  const head=mesh(new THREE.SphereGeometry(.22,20,16),skin);head.position.y=2.03;root.add(head);
  const hairCap=mesh(new THREE.SphereGeometry(.228,20,12,0,Math.PI*2,0,Math.PI*.58),hair);hairCap.position.set(0,2.10,0);root.add(hairCap);
  const pony=mesh(new THREE.CapsuleGeometry(.055,.28,4,8),hair);pony.position.set(0,1.96,-.24);pony.rotation.x=.45;root.add(pony);
  const armGeo=new THREE.CapsuleGeometry(.07,.48,5,8),legGeo=new THREE.CapsuleGeometry(.09,.62,5,8);
  const la=mesh(armGeo,skin),ra=mesh(armGeo,skin);la.position.set(-.36,1.36,0);ra.position.set(.36,1.36,0);la.rotation.z=-.18;ra.rotation.z=.18;root.add(la,ra);
  const ll=mesh(legGeo,skin),rl=mesh(legGeo,skin);ll.position.set(-.14,.43,0);rl.position.set(.14,.43,0);root.add(ll,rl);
  const sockMat=mat(team==='A'?0x142f68:0x7f1e29,.7,0);
  const lsock=mesh(new THREE.CylinderGeometry(.075,.075,.28,12),sockMat),rsock=lsock.clone();lsock.position.set(-.14,.24,0);rsock.position.set(.14,.24,0);root.add(lsock,rsock);
  const shoeMat=mat(0xffffff,.55,.05);const ls=mesh(new THREE.BoxGeometry(.18,.10,.34),shoeMat),rs=ls.clone();ls.position.set(-.14,.07,.09);rs.position.set(.14,.07,.09);root.add(ls,rs);
  root.userData={team,real:false,torso,ll,rl,la,ra,homeX:-3.25,homeZ:team==='A'?.78:-.78};
  root.position.set(root.userData.homeX,0,root.userData.homeZ);root.rotation.y=Math.PI/2;
  return root;
}

function createKeeper(){
  const root=new THREE.Group();
  const skin=mat(0xdba47e,.88,0),kit=mat(0x159b57,.55,.02),dark=mat(0x0d5c37,.75,0);
  const body=mesh(new THREE.CapsuleGeometry(.31,.62,6,12),kit);body.position.y=1.33;root.add(body);
  const head=mesh(new THREE.SphereGeometry(.23,20,16),skin);head.position.y=2.06;root.add(head);
  const armGeo=new THREE.CapsuleGeometry(.075,.54,5,8),legGeo=new THREE.CapsuleGeometry(.095,.62,5,8);
  const la=mesh(armGeo,skin),ra=mesh(armGeo,skin);la.position.set(-.4,1.38,0);ra.position.set(.4,1.38,0);la.rotation.z=-.4;ra.rotation.z=.4;root.add(la,ra);
  const ll=mesh(legGeo,dark),rl=mesh(legGeo,dark);ll.position.set(-.15,.45,0);rl.position.set(.15,.45,0);root.add(ll,rl);
  root.userData={real:false,la,ra,ll,rl,homeX:3.75,homeZ:0};root.position.set(3.75,0,0);root.rotation.y=-Math.PI/2;
  return root;
}

function createGoal(){
  const g=new THREE.Group(),white=mat(0xf5f7fb,.45,.05),post=.055;
  const add=(geo,x,y,z)=>{const m=mesh(geo,white);m.position.set(x,y,z);g.add(m)};
  add(new THREE.BoxGeometry(post,2.25,post),4.42,1.125,-1.55);add(new THREE.BoxGeometry(post,2.25,post),4.42,1.125,1.55);add(new THREE.BoxGeometry(post,post,3.15),4.42,2.23,0);
  const netMat=new THREE.LineBasicMaterial({color:0xcdd5df,transparent:true,opacity:.55});
  for(let y=.2;y<=2.2;y+=.25){g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(4.43,y,-1.55),new THREE.Vector3(4.43,y,1.55)]),netMat))}
  for(let z=-1.5;z<=1.5;z+=.25){g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(4.43,.15,z),new THREE.Vector3(4.43,2.2,z)]),netMat))}
  return g;
}

function setupScene(){
  const holder=document.getElementById('game3dCanvas');if(!holder)return;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x0a1424);
  camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(-.1,3.55,8.9);camera.lookAt(.75,1.0,0);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  if('outputColorSpace' in renderer)renderer.outputColorSpace=THREE.SRGBColorSpace;
  holder.appendChild(renderer.domElement);renderer.domElement.style.cssText='display:block;width:100%;height:100%';holder.style.cssText='width:100%;height:100%';
  scene.add(new THREE.HemisphereLight(0xdcecff,0x18331d,2.0));
  const sun=new THREE.DirectionalLight(0xffffff,2.8);sun.position.set(-3,8,4);sun.castShadow=true;scene.add(sun);
  const fill=new THREE.DirectionalLight(0x86a7ff,1.1);fill.position.set(4,4,5);scene.add(fill);
  const pitch=mesh(new THREE.PlaneGeometry(12,6),mat(0x1f7438,.94,0));pitch.rotation.x=-Math.PI/2;pitch.receiveShadow=true;scene.add(pitch);
  const lineMat=new THREE.LineBasicMaterial({color:0xf5f7fa,transparent:true,opacity:.7});
  const pts=[new THREE.Vector3(-5.7,.012,-2.8),new THREE.Vector3(5.7,.012,-2.8),new THREE.Vector3(5.7,.012,2.8),new THREE.Vector3(-5.7,.012,2.8),new THREE.Vector3(-5.7,.012,-2.8)];scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat));
  scene.add(createGoal());keeper=createKeeper();playerA=createPlayer('A');playerB=createPlayer('B');scene.add(keeper,playerA,playerB);
  ball=mesh(new THREE.SphereGeometry(.14,24,18),mat(0xf7f7f7,.45,.02));ball.position.set(-1.0,.14,0);scene.add(ball);
  const spot=mesh(new THREE.CircleGeometry(.04,16),mat(0xffffff,.8,0));spot.rotation.x=-Math.PI/2;spot.position.set(-1,.013,0);scene.add(spot);
  clock=new THREE.Clock();resize();window.addEventListener('resize',resize);animate();
  tryLoadRealModels();
}

function normalizeModel(root,targetHeight=2.15){
  root.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(root);const size=new THREE.Vector3();box.getSize(size);
  if(size.y>0){const s=targetHeight/size.y;root.scale.multiplyScalar(s)}
  root.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(root);root.position.y-=box.min.y;
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){if(Array.isArray(o.material))o.material=o.material.map(m=>m.clone());else o.material=o.material.clone()}}});
}

function tintTeamModel(root,team){
  const main=team==='A'?0x173f9b:0xc91f2c;const yellow=0xffd21f;const skirt=team==='A'?0x152b59:0x6d1821;
  root.traverse(o=>{
    if(!o.isMesh||!o.material)return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const m of mats){
      const n=((o.name||'')+' '+(m.name||'')).toLowerCase();
      if(/skin|face|head|hair|eye|teeth|mouth/.test(n))continue;
      if(/skirt|short|bottom|pants/.test(n)){if(m.color)m.color.setHex(skirt);continue}
      if(/shirt|jersey|top|cloth|uniform|body|torso/.test(n)){if(m.color)m.color.setHex(main);continue}
      if(/stripe|trim|line|accent/.test(n)){if(m.color)m.color.setHex(yellow)}
    }
  });
}

function clipsFor(gltf){
  const clips=gltf.animations||[];
  const pick=(...re)=>clips.find(c=>re.some(r=>r.test(c.name.toLowerCase())))||null;
  return{
    idle:pick(/idle/,/stand/,/breath/),run:pick(/run/,/jog/,/sprint/),kick:pick(/kick/,/shoot/,/soccer/),celebrate:pick(/celebr/,/victory/,/cheer/),
    saveLeft:pick(/save.*left/,/dive.*left/,/left.*dive/),saveRight:pick(/save.*right/,/dive.*right/,/right.*dive/),miss:pick(/miss/,/defeat/,/fall/)
  };
}

function prepareActor(gltf,type,team){
  const root=gltf.scene;normalizeModel(root,type==='keeper'?2.12:2.18);if(type==='player')tintTeamModel(root,team);
  const mixer=new THREE.AnimationMixer(root);mixers.push(mixer);const clips=clipsFor(gltf),actions={};
  for(const [k,c] of Object.entries(clips))if(c)actions[k]=mixer.clipAction(c);
  root.userData={...root.userData,real:true,type,team,actions,mixer,homeX:type==='keeper'?3.75:-3.25,homeZ:type==='keeper'?0:(team==='A'?.78:-.78),baseRotationY:type==='keeper'?-Math.PI/2:Math.PI/2};
  root.position.set(root.userData.homeX,0,root.userData.homeZ);root.rotation.y=root.userData.baseRotationY;
  playAction(root,'idle');return root;
}

function playAction(actor,name){
  if(!actor?.userData?.real)return;
  const actions=actor.userData.actions||{};const next=actions[name]||actions.idle;if(!next)return;
  for(const a of Object.values(actions)){if(a!==next)a.fadeOut(.12)}
  next.reset();next.enabled=true;next.setEffectiveWeight(1);next.fadeIn(.12);
  if(name==='idle'||name==='run'){next.setLoop(THREE.LoopRepeat,Infinity);next.clampWhenFinished=false}else{next.setLoop(THREE.LoopOnce,1);next.clampWhenFinished=true}
  next.play();
}

async function tryLoadRealModels(){
  if(!GLTFLoader){setLabel('3D MAÇ SAHNESİ • MODEL BEKLENİYOR');return}
  const loader=new GLTFLoader();
  try{
    setLabel('GERÇEKÇİ 3D MODELLER YÜKLENİYOR…');
    const [ga,gb,gk]=await Promise.all([loader.loadAsync(ASSETS.player),loader.loadAsync(ASSETS.player),loader.loadAsync(ASSETS.keeper)]);
    const a=prepareActor(ga,'player','A'),b=prepareActor(gb,'player','B'),k=prepareActor(gk,'keeper',null);
    scene.remove(playerA,playerB,keeper);playerA=a;playerB=b;keeper=k;scene.add(playerA,playerB,keeper);realMode=true;resetPose();setLabel('GERÇEKÇİ 3D MAÇ SAHNESİ');
  }catch(e){
    console.warn('Gerçekçi model dosyaları bulunamadı, basit 3D devam ediyor',e);setLabel('3D MAÇ SAHNESİ • GERÇEK MODEL BEKLENİYOR');
  }
}

function resize(){if(!renderer||!camera)return;const box=document.getElementById('game3dCanvas')?.getBoundingClientRect();if(!box||!box.width)return;renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix()}

function resetPose(){
  if(!playerA||!playerB||!keeper||!ball)return;
  for(const p of [playerA,playerB]){
    p.position.set(p.userData.homeX,0,p.userData.homeZ);p.rotation.set(0,p.userData.baseRotationY??Math.PI/2,0);
    if(p.userData.real)playAction(p,'idle');else{p.userData.ll.rotation.set(0,0,0);p.userData.rl.rotation.set(0,0,0);p.userData.la.rotation.set(0,0,-.18);p.userData.ra.rotation.set(0,0,.18)}
  }
  keeper.position.set(keeper.userData.homeX??3.75,0,keeper.userData.homeZ??0);keeper.rotation.set(0,keeper.userData.baseRotationY??-Math.PI/2,0);
  if(keeper.userData.real)playAction(keeper,'idle');else{keeper.userData.la.rotation.set(0,0,-.4);keeper.userData.ra.rotation.set(0,0,.4)}
  ball.position.set(-1,.14,0);
}

function animate(){
  requestAnimationFrame(animate);if(!renderer||!scene||!camera)return;const dt=Math.min(clock?.getDelta?.()||.016,.05),t=performance.now();
  for(const m of mixers)m.update(dt);if(animation)runAnimation(t);
  const idle=t*.0022;if(playerA&&!animation&&!playerA.userData.real)playerA.position.y=Math.sin(idle)*.012;if(playerB&&!animation&&!playerB.userData.real)playerB.position.y=Math.sin(idle+1.3)*.012;
  renderer.render(scene,camera);
}

function beginShot(team){
  if(!playerA)return;resetPose();const p=team==='A'?playerA:playerB;const other=team==='A'?playerB:playerA;other.visible=true;p.visible=true;if(p.userData.real)playAction(p,'run');animation={phase:'run',team,start:performance.now(),player:p,result:null};
}

function finishShot(team,result){if(!animation||animation.team!==team)beginShot(team);animation.result=result;animation.phase='kick';animation.start=performance.now();if(animation.player?.userData?.real)playAction(animation.player,'kick')}

function runAnimation(t){
  const a=animation,p=a.player;if(!p)return;let u=clamp((t-a.start)/520,0,1);
  if(a.phase==='run'){
    p.position.x=lerp(p.userData.homeX,-1.35,u);p.position.z=lerp(p.userData.homeZ,0,u);
    if(!p.userData.real){p.userData.ll.rotation.x=Math.sin(u*Math.PI*6)*.5;p.userData.rl.rotation.x=-p.userData.ll.rotation.x}
    if(u>=1){a.phase='wait';a.start=t;if(p.userData.real)playAction(p,'idle')}
  }else if(a.phase==='wait'){
    if(a.result){a.phase='kick';a.start=t;if(p.userData.real)playAction(p,'kick')}
  }else if(a.phase==='kick'){
    u=clamp((t-a.start)/360,0,1);
    if(!p.userData.real){p.userData.rl.rotation.x=-1.0*Math.sin(u*Math.PI);p.userData.la.rotation.z=-.18-.45*Math.sin(u*Math.PI)}
    if(u>=.50){a.phase='ball';a.start=t}
  }else if(a.phase==='ball'){
    u=clamp((t-a.start)/650,0,1);const targetZ=a.result==='goal'?(a.team==='A'?.78:-.78):(a.team==='A'?-.55:.55);
    ball.position.x=lerp(-1,4.15,u);ball.position.z=lerp(0,targetZ,u);ball.position.y=.14+Math.sin(u*Math.PI)*(a.result==='goal'?1.05:.62);ball.rotation.x+=.25;ball.rotation.z+=.18;
    if(a.result==='save'){
      const diveRight=targetZ>0;keeper.position.z=lerp(0,targetZ*.82,u);
      if(keeper.userData.real&&u<.08)playAction(keeper,diveRight?'saveRight':'saveLeft');else if(!keeper.userData.real)keeper.rotation.x=lerp(0,.85*(diveRight?1:-1),u);
    }else keeper.position.z=lerp(0,-targetZ*.25,u);
    if(u>=1){a.phase='result';a.start=t;if(a.result==='goal'&&p.userData.real)playAction(p,'celebrate');if(a.result==='goal'&&keeper.userData.real)playAction(keeper,'miss')}
  }else if(a.phase==='result'){
    u=clamp((t-a.start)/1100,0,1);if(a.result==='goal'&&!p.userData.real){p.rotation.y=Math.PI/2+Math.sin(u*Math.PI)*.45;p.position.y=Math.sin(u*Math.PI)*.18}if(u>=1){resetPose();animation=null}
  }
}

function hookGame(){
  if(hooked)return;if(typeof window.resolveShot!=='function'){setTimeout(hookGame,150);return}hooked=true;const old=window.resolveShot;
  window.resolveShot=async function(team,shot){try{beginShot(team)}catch(e){}await sleep(360);const r=await old.apply(this,arguments);let result='save';const txt=(document.getElementById('event')?.textContent||'').trim();if(/^GOL!/i.test(txt))result='goal';try{finishShot(team,result)}catch(e){}return r};
}

async function boot(){
  if(installed)return;const shell=addStageShell();if(!shell){setTimeout(boot,120);return}installed=true;
  try{await loadThree();setupScene();hookGame()}catch(e){console.error('3D sahne yüklenemedi',e);setLabel('3D SAHNE YÜKLENEMEDİ')}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.AIFootball3D={beginShot,finishShot,reset:resetPose,reloadModels:tryLoadRealModels};
})();
