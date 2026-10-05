(()=>{
'use strict';
let THREE=null,scene=null,camera=null,renderer=null,clock=null;
let stage=null,ball=null,keeper=null,playerA=null,playerB=null;
let animation=null,installed=false,hooked=false;

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
  wrap.style.cssText='position:relative;height:250px;margin:5px 0;border:1px solid #2b3556;border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#10192a,#112c1b);';
  const label=wrap.firstElementChild;
  label.style.cssText='position:absolute;z-index:3;left:8px;top:7px;padding:4px 7px;border-radius:7px;background:rgba(8,14,26,.66);color:#fff;font-size:8px;font-weight:900;letter-spacing:.4px;pointer-events:none';
  score.insertAdjacentElement('afterend',wrap);
  return wrap;
}

async function loadThree(){
  if(THREE)return THREE;
  const mod=await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');
  THREE=mod;
  return THREE;
}

function mat(color,rough=.65,metal=.03){
  return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
}
function mesh(g,m){const x=new THREE.Mesh(g,m);x.castShadow=true;x.receiveShadow=true;return x}

function createPlayer(team){
  const root=new THREE.Group();
  const skin=mat(0xe9b38f,.88,0),hair=mat(0x2e1c13,.9,0);
  const blue=0x173f9b,red=0xc91f2c,yellow=0xffd21f;
  const main=team==='A'?blue:red;
  const torso=mesh(new THREE.CapsuleGeometry(.28,.55,6,12),mat(main,.7,0));torso.position.y=1.35;root.add(torso);
  const stripe=mesh(new THREE.BoxGeometry(.09,.75,.035),mat(yellow,.65,0));stripe.position.set(0,1.35,.29);root.add(stripe);
  const shorts=mesh(new THREE.BoxGeometry(.53,.25,.34),mat(0xf2f2f2,.8,0));shorts.position.y=.93;root.add(shorts);
  const head=mesh(new THREE.SphereGeometry(.22,20,16),skin);head.position.y=2.03;root.add(head);
  const hairCap=mesh(new THREE.SphereGeometry(.228,20,12,0,Math.PI*2,0,Math.PI*.58),hair);hairCap.position.set(0,2.10,0);hairCap.rotation.x=.04;root.add(hairCap);
  const pony=mesh(new THREE.CapsuleGeometry(.055,.28,4,8),hair);pony.position.set(0,1.96,-.24);pony.rotation.x=.45;root.add(pony);
  const armGeo=new THREE.CapsuleGeometry(.07,.48,5,8),legGeo=new THREE.CapsuleGeometry(.09,.62,5,8);
  const la=mesh(armGeo,skin),ra=mesh(armGeo,skin);la.position.set(-.36,1.36,0);ra.position.set(.36,1.36,0);la.rotation.z=-.18;ra.rotation.z=.18;root.add(la,ra);
  const ll=mesh(legGeo,skin),rl=mesh(legGeo,skin);ll.position.set(-.14,.43,0);rl.position.set(.14,.43,0);root.add(ll,rl);
  const shoeMat=mat(0x111111,.55,.05);
  const ls=mesh(new THREE.BoxGeometry(.18,.10,.34),shoeMat),rs=ls.clone();ls.position.set(-.14,.07,.09);rs.position.set(.14,.07,.09);root.add(ls,rs);
  root.userData={team,torso,ll,rl,la,ra,homeX:team==='A'?-3.25:-3.25,homeZ:team==='A'?.75:-.75};
  root.position.set(root.userData.homeX,0,root.userData.homeZ);
  root.rotation.y=Math.PI/2;
  return root;
}

function createKeeper(){
  const root=new THREE.Group();
  const skin=mat(0xdba47e,.88,0),kit=mat(0x23c7ef,.55,.02),dark=mat(0x14213d,.75,0);
  const body=mesh(new THREE.CapsuleGeometry(.31,.62,6,12),kit);body.position.y=1.33;root.add(body);
  const head=mesh(new THREE.SphereGeometry(.23,20,16),skin);head.position.y=2.06;root.add(head);
  const armGeo=new THREE.CapsuleGeometry(.075,.54,5,8),legGeo=new THREE.CapsuleGeometry(.095,.62,5,8);
  const la=mesh(armGeo,skin),ra=mesh(armGeo,skin);la.position.set(-.4,1.38,0);ra.position.set(.4,1.38,0);la.rotation.z=-.4;ra.rotation.z=.4;root.add(la,ra);
  const ll=mesh(legGeo,dark),rl=mesh(legGeo,dark);ll.position.set(-.15,.45,0);rl.position.set(.15,.45,0);root.add(ll,rl);
  root.userData={la,ra,ll,rl};
  root.position.set(3.75,0,0);
  root.rotation.y=-Math.PI/2;
  return root;
}

function createGoal(){
  const g=new THREE.Group(),white=mat(0xf5f7fb,.45,.05),post=.055;
  const add=(geo,x,y,z)=>{const m=mesh(geo,white);m.position.set(x,y,z);g.add(m)};
  add(new THREE.BoxGeometry(post,2.1,post),4.42,1.05,-1.55);
  add(new THREE.BoxGeometry(post,2.1,post),4.42,1.05,1.55);
  add(new THREE.BoxGeometry(post,post,3.15),4.42,2.08,0);
  const netMat=new THREE.LineBasicMaterial({color:0xbfc8d8,transparent:true,opacity:.42});
  for(let y=.2;y<=2;y+=.3){const pts=[new THREE.Vector3(4.43,y,-1.55),new THREE.Vector3(4.43,y,1.55)];g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),netMat))}
  for(let z=-1.5;z<=1.5;z+=.3){const pts=[new THREE.Vector3(4.43,.15,z),new THREE.Vector3(4.43,2.05,z)];g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),netMat))}
  return g;
}

function setupScene(){
  const holder=document.getElementById('game3dCanvas'); if(!holder)return;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x0e1828);
  camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(0,4.4,8.6);camera.lookAt(.5,1.0,0);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  holder.appendChild(renderer.domElement);renderer.domElement.style.cssText='display:block;width:100%;height:100%';
  holder.style.cssText='width:100%;height:100%';
  scene.add(new THREE.HemisphereLight(0xcfe4ff,0x24451f,1.7));
  const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(-3,8,4);sun.castShadow=true;scene.add(sun);
  const pitch=mesh(new THREE.PlaneGeometry(12,6),mat(0x1f6c34,.95,0));pitch.rotation.x=-Math.PI/2;pitch.receiveShadow=true;scene.add(pitch);
  const lineMat=new THREE.LineBasicMaterial({color:0xf0f3f5,transparent:true,opacity:.55});
  const pts=[new THREE.Vector3(-5.7,.012,-2.8),new THREE.Vector3(5.7,.012,-2.8),new THREE.Vector3(5.7,.012,2.8),new THREE.Vector3(-5.7,.012,2.8),new THREE.Vector3(-5.7,.012,-2.8)];scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat));
  scene.add(createGoal());keeper=createKeeper();scene.add(keeper);playerA=createPlayer('A');playerB=createPlayer('B');scene.add(playerA,playerB);
  ball=mesh(new THREE.SphereGeometry(.14,18,14),mat(0xf7f7f7,.5,.02));ball.position.set(-1.0,.14,0);scene.add(ball);
  const spot=mesh(new THREE.CircleGeometry(.04,16),mat(0xffffff,.8,0));spot.rotation.x=-Math.PI/2;spot.position.set(-1,.013,0);scene.add(spot);
  clock=new THREE.Clock();
  resize();window.addEventListener('resize',resize);animate();
}

function resize(){
  if(!renderer||!camera)return;const box=document.getElementById('game3dCanvas')?.getBoundingClientRect();if(!box||!box.width)return;
  renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();
}

function resetPose(){
  if(!playerA||!playerB||!keeper||!ball)return;
  for(const p of [playerA,playerB]){p.position.set(p.userData.homeX,0,p.userData.homeZ);p.rotation.set(0,Math.PI/2,0);p.userData.ll.rotation.set(0,0,0);p.userData.rl.rotation.set(0,0,0);p.userData.la.rotation.set(0,0,-.18);p.userData.ra.rotation.set(0,0,.18)}
  keeper.position.set(3.75,0,0);keeper.rotation.set(0,-Math.PI/2,0);
  keeper.userData.la.rotation.set(0,0,-.4);keeper.userData.ra.rotation.set(0,0,.4);
  ball.position.set(-1,.14,0);
}

function animate(){
  requestAnimationFrame(animate);if(!renderer||!scene||!camera)return;const t=performance.now();
  if(animation)runAnimation(t);
  const idle=t*.0022;
  if(playerA&&!animation)playerA.position.y=Math.sin(idle)*.012;
  if(playerB&&!animation)playerB.position.y=Math.sin(idle+1.3)*.012;
  renderer.render(scene,camera);
}

function beginShot(team){
  if(!playerA)return;resetPose();
  const p=team==='A'?playerA:playerB;const other=team==='A'?playerB:playerA;
  other.visible=true;p.visible=true;
  animation={phase:'run',team,start:performance.now(),player:p,result:null};
}

function finishShot(team,result){
  if(!animation||animation.team!==team)beginShot(team);
  animation.result=result;animation.phase='kick';animation.start=performance.now();
}

function runAnimation(t){
  const a=animation,p=a.player; if(!p)return;
  let u=clamp((t-a.start)/520,0,1);
  if(a.phase==='run'){
    p.position.x=lerp(p.userData.homeX,-1.35,u);p.position.z=lerp(p.userData.homeZ,0,u);
    p.userData.ll.rotation.x=Math.sin(u*Math.PI*6)*.5;p.userData.rl.rotation.x=-p.userData.ll.rotation.x;
    if(u>=1){a.phase='wait';a.start=t;}
  }else if(a.phase==='wait'){
    if(a.result){a.phase='kick';a.start=t}
  }else if(a.phase==='kick'){
    u=clamp((t-a.start)/320,0,1);p.userData.rl.rotation.x=-1.0*Math.sin(u*Math.PI);p.userData.la.rotation.z=-.18-.45*Math.sin(u*Math.PI);
    if(u>=.45&&a.phase==='kick'){a.phase='ball';a.start=t;}
  }else if(a.phase==='ball'){
    u=clamp((t-a.start)/620,0,1);
    const targetZ=a.result==='goal'?(a.team==='A'?.72:-.72):(a.team==='A'?-.35:.35);
    ball.position.x=lerp(-1,4.15,u);ball.position.z=lerp(0,targetZ,u);ball.position.y=.14+Math.sin(u*Math.PI)*(a.result==='goal'?1.05:.62);
    if(a.result==='save'){
      const dive=targetZ>0?1:-1;keeper.position.z=lerp(0,targetZ*.8,u);keeper.rotation.x=lerp(0,.85*dive,u);
    }else keeper.position.z=lerp(0,-targetZ*.3,u);
    if(u>=1){a.phase='result';a.start=t;}
  }else if(a.phase==='result'){
    u=clamp((t-a.start)/850,0,1);
    if(a.result==='goal'){p.rotation.y=Math.PI/2+Math.sin(u*Math.PI)*.45;p.position.y=Math.sin(u*Math.PI)*.18}
    if(u>=1){resetPose();animation=null;}
  }
}

function hookGame(){
  if(hooked)return;
  if(typeof window.resolveShot!=='function'){setTimeout(hookGame,150);return;}
  hooked=true;
  const old=window.resolveShot;
  window.resolveShot=async function(team,shot){
    try{beginShot(team)}catch(e){}
    await sleep(360);
    const r=await old.apply(this,arguments);
    let result='save';
    const txt=(document.getElementById('event')?.textContent||'').trim();
    if(/^GOL!/i.test(txt))result='goal';
    try{finishShot(team,result)}catch(e){}
    return r;
  };
}

async function boot(){
  if(installed)return;const shell=addStageShell();if(!shell){setTimeout(boot,120);return;}
  installed=true;
  try{await loadThree();setupScene();hookGame();}
  catch(e){console.error('3D sahne yüklenemedi',e);const l=document.getElementById('game3dLabel');if(l)l.textContent='3D SAHNE YÜKLENEMEDİ';}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.AIFootball3D={beginShot,finishShot,reset:resetPose};
})();
