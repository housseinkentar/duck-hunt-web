import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js";

// ---------- UI ----------
const statusEl = document.getElementById("status");
const ammoEl   = document.getElementById("ammo");
const fireBtn  = document.getElementById("fireBtn");
const reloadBtn= document.getElementById("reloadBtn");
const callBtn  = document.getElementById("callBtn");
const camBtn   = document.getElementById("camBtn");
const windArrow= document.getElementById("windArrow");
const windTxt  = document.getElementById("windTxt");

const joyL = document.getElementById("joyL");
const joyR = document.getElementById("joyR");
const knobL = joyL.querySelector(".knob");
const knobR = joyR.querySelector(".knob");

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function len(x,y){ return Math.sqrt(x*x+y*y) || 1; }
function rnd(a,b){ return a + Math.random()*(b-a); }

function setKnob(knob, x, y){
  knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}
function clearKnob(knob){ knob.style.transform = "translate(-50%,-50%)"; }

// ---------- Three.js ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const cameraFPS = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 12000);
const cameraTP  = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 12000);
let useThirdPerson = false;

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2.0, devicePixelRatio || 1));
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(800, 1200, 500);
scene.add(sun);

// World
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(9000, 9000),
  new THREE.MeshStandardMaterial({ color: 0x2f7d32 })
);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

// Mountains
for(let i=0;i<120;i++){
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(rnd(90,220), rnd(260,620), 4),
    new THREE.MeshStandardMaterial({ color: 0x355e3b })
  );
  m.position.set(rnd(-4200,4200), m.geometry.parameters.height*0.45, rnd(-4200,4200));
  scene.add(m);
}

// ---------- Player ----------
const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(10, 28, 4, 10),
  new THREE.MeshStandardMaterial({ color: 0x2b2b2b })
);
body.position.y = 30;
player.add(body);
scene.add(player);
player.position.set(0, 0, 200);

let yaw = 0;
let pitch = 0;
const MAX_PITCH = 0.9;

// Gun (FPS)
const gun = new THREE.Mesh(
  new THREE.BoxGeometry(10, 8, 40),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
);
gun.position.set(20, -18, -45);
cameraFPS.add(gun);

// ---------- Mobile controls (left move, right look) ----------
let moveId=null, lookId=null;
let moveOrigin=null, lookOrigin=null;
let moveVec={x:0,y:0}, lookVec={x:0,y:0};

function onDown(e){
  const x = e.clientX ?? (e.touches?.[0]?.clientX);
  const y = e.clientY ?? (e.touches?.[0]?.clientY);
  const id = e.pointerId ?? (e.touches?.[0]?.identifier);
  if(x == null) return;

  if(x < innerWidth*0.5 && moveId===null){
    moveId=id; moveOrigin={x,y}; moveVec={x:0,y:0};
  } else if(x >= innerWidth*0.5 && lookId===null){
    lookId=id; lookOrigin={x,y}; lookVec={x:0,y:0};
  }
}
function onMove(e){
  const touches = e.touches ? Array.from(e.touches) : [e];
  for(const t of touches){
    const id = t.pointerId ?? t.identifier;
    const x = t.clientX, y = t.clientY;

    if(id===moveId && moveOrigin){
      moveVec.x = x - moveOrigin.x;
      moveVec.y = y - moveOrigin.y;
      const L = len(moveVec.x, moveVec.y);
      const max = 60;
      if(L>max){ moveVec.x = (moveVec.x/L)*max; moveVec.y=(moveVec.y/L)*max; }
      setKnob(knobL, moveVec.x, moveVec.y);
    }

    if(id===lookId && lookOrigin){
      lookVec.x = x - lookOrigin.x;
      lookVec.y = y - lookOrigin.y;
      const L = len(lookVec.x, lookVec.y);
      const max = 60;
      if(L>max){ lookVec.x = (lookVec.x/L)*max; lookVec.y=(lookVec.y/L)*max; }
      setKnob(knobR, lookVec.x, lookVec.y);

      yaw   -= (lookVec.x/60) * 0.035;
      pitch -= (lookVec.y/60) * 0.020;
      pitch = clamp(pitch, -MAX_PITCH, MAX_PITCH);
    }
  }
}
function onUp(e){
  const changed = e.changedTouches ? Array.from(e.changedTouches) : [e];
  for(const t of changed){
    const id = t.pointerId ?? t.identifier;
    if(id===moveId){ moveId=null; moveOrigin=null; moveVec={x:0,y:0}; clearKnob(knobL); }
    if(id===lookId){ lookId=null; lookOrigin=null; lookVec={x:0,y:0}; clearKnob(knobR); }
  }
}

renderer.domElement.addEventListener("touchstart", onDown, {passive:false});
renderer.domElement.addEventListener("touchmove",  (e)=>{ e.preventDefault(); onMove(e); }, {passive:false});
renderer.domElement.addEventListener("touchend",   onUp, {passive:false});
renderer.domElement.addEventListener("pointerdown", onDown);
renderer.domElement.addEventListener("pointermove", onMove);
renderer.domElement.addEventListener("pointerup", onUp);

// ---------- Wind + scent (COTW feel) ----------
let windAng = rnd(0, Math.PI*2);
let windSpd = rnd(0.4, 1.0); // strength
function windVec(){
  return new THREE.Vector3(Math.sin(windAng), 0, Math.cos(windAng)).normalize();
}
function stepWind(dt){
  windAng += rnd(-0.35, 0.35) * dt;
  windSpd = clamp(windSpd + rnd(-0.25,0.25)*dt, 0.25, 1.2);

  // UI arrow: show wind direction (towards)
  const deg = (windAng * 180/Math.PI);
  windArrow.style.transform = `rotate(${deg}deg)`;
  windTxt.textContent = `Wind ${windSpd.toFixed(1)}`;
}

// ---------- Birds (flock + caller + scare + scent flee) ----------
function makeWarwar(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x28b463 })
  );
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xf4d03f })
  );
  head.position.set(4.2, 1.0, 0);

  const wingMat = new THREE.MeshStandardMaterial({ color: 0x2e86c1 });
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 3.6), wingMat);
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 3.6), wingMat);
  wingL.position.set(0, 0, -4.2);
  wingR.position.set(0, 0,  4.2);

  const beak = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 7.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  beak.rotation.z = Math.PI/2;
  beak.position.set(8.8, 0.4, 0);

  g.add(body, head, wingL, wingR, beak);

  g.userData.wingL = wingL;
  g.userData.wingR = wingR;
  g.userData.v = new THREE.Vector3(rnd(-1,1), 0, rnd(-1,1)).normalize().multiplyScalar(rnd(35,60));
  g.userData.alive = true;
  g.userData.fallV = 0;
  return g;
}

const flock = [];
const FLOCK_N = 16;
let callerPoint = null;
let callerT = 0;

for(let i=0;i<FLOCK_N;i++){
  const b = makeWarwar();
  b.position.set(rnd(-250,250), rnd(180,320), rnd(-250,250));
  scene.add(b);
  flock.push(b);
}

function boidsStep(dt){
  const sepDist = 35;
  const neighDist = 170;

  const w = windVec();

  for(const b of flock){
    if(!b.userData.alive){
      b.userData.fallV += 420*dt;
      b.position.y -= b.userData.fallV*dt;
      b.rotation.x += 1.2*dt;
      if(b.position.y < 6){
        b.userData.alive = true;
        b.userData.fallV = 0;
        b.position.set(rnd(-350,350)+player.position.x, rnd(190,320), rnd(-350,350)+player.position.z);
        b.userData.v.set(rnd(-1,1),0,rnd(-1,1)).normalize().multiplyScalar(rnd(35,60));
        b.rotation.set(0,0,0);
      }
      continue;
    }

    let align = new THREE.Vector3();
    let coh   = new THREE.Vector3();
    let sep   = new THREE.Vector3();
    let count = 0;

    for(const o of flock){
      if(o===b || !o.userData.alive) continue;
      const d = b.position.distanceTo(o.position);
      if(d < neighDist){
        align.add(o.userData.v);
        coh.add(o.position);
        count++;
        if(d < sepDist){
          const away = b.position.clone().sub(o.position);
          away.y = 0;
          if(away.lengthSq()>0.001) sep.add(away.normalize().multiplyScalar(1/d));
        }
      }
    }

    let accel = new THREE.Vector3();

    if(count>0){
      align.multiplyScalar(1/count).setY(0).normalize().multiplyScalar(18);
      coh.multiplyScalar(1/count).sub(b.position).setY(0).normalize().multiplyScalar(10);
      sep.multiplyScalar(26);
      accel.add(align).add(coh).add(sep);
    }

    // roam around player
    const center = player.position.clone().add(new THREE.Vector3(0,0,0));
    const toCenter = center.clone().sub(b.position); toCenter.y=0;
    accel.add(toCenter.normalize().multiplyScalar(6));

    // caller attraction
    if(callerPoint && callerT>0){
      const toCall = callerPoint.clone().sub(b.position); toCall.y=0;
      accel.add(toCall.normalize().multiplyScalar(28));
    }

    // scare if too close
    const toPlayer = b.position.clone().sub(player.position);
    const dP = toPlayer.length();
    if(dP < 120){
      toPlayer.y=0;
      accel.add(toPlayer.normalize().multiplyScalar(55));
    }

    // scent flee: if bird is DOWNWIND of player (wind carries scent to bird) => flee
    // player scent plume direction = windVec (from player towards)
    const fromPlayerToBird = b.position.clone().sub(player.position); fromPlayerToBird.y=0;
    const dist = fromPlayerToBird.length();
    if(dist < 380){
      const dirPB = fromPlayerToBird.clone().normalize();
      // if wind points roughly from player to bird => bird smells you
      const smell = w.dot(dirPB); // 1 means wind directly to bird
      if(smell > 0.55){
        accel.add(dirPB.clone().multiplyScalar(80 * windSpd));
      }
    }

    // wind drift slightly
    accel.add(w.clone().multiplyScalar(4 * windSpd));

    // integrate
    b.userData.v.add(accel.multiplyScalar(dt));
    b.userData.v.y=0;

    const sp = clamp(b.userData.v.length(), 22, 90);
    b.userData.v.setLength(sp);

    b.position.add(b.userData.v.clone().multiplyScalar(dt));
    b.position.y = clamp(b.position.y + Math.sin(performance.now()*0.002 + b.position.x*0.01)*0.25, 150, 360);

    const dir = b.userData.v.clone().normalize();
    b.rotation.y = Math.atan2(dir.x, dir.z);

    const flap = 0.9 + 0.55*Math.sin(performance.now()*0.02 + b.position.z*0.01);
    b.userData.wingL.rotation.x =  flap;
    b.userData.wingR.rotation.x = -flap;
  }

  callerT = Math.max(0, callerT - dt);
  if(callerT<=0) callerPoint = null;
}

// ---------- Shooting ----------
const MAG = 5;
let ammo = MAG;
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2(0,0);

function updateHUD(){
  ammoEl.textContent = `Ammo: ${ammo}/${MAG}`;
  statusEl.textContent =
    `COTW Web Lite | Birds: ${flock.filter(b=>b.userData.alive).length}/${FLOCK_N} | Call: ${callerT>0 ? callerT.toFixed(0)+"s" : "off"} | Cam: ${useThirdPerson?"TP":"FPS"}`;
}
updateHUD();

function shoot(){
  if(ammo<=0) return;
  ammo--;

  gun.rotation.x = -0.25;
  setTimeout(()=> gun.rotation.x = 0, 80);

  const cam = useThirdPerson ? cameraTP : cameraFPS;
  ray.setFromCamera(ndc, cam);

  const meshes = flock.map(b=>b.children[0]); // body mesh
  const hit = ray.intersectObjects(meshes, false);
  if(hit.length){
    const bird = hit[0].object.parent;
    bird.userData.alive = false;
    bird.userData.fallV = 0;
  }

  updateHUD();
}
function reload(){ ammo = MAG; updateHUD(); }
function callBirds(){
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const p = player.position.clone().add(forward.multiplyScalar(220));
  p.y = 240;
  callerPoint = p;
  callerT = 10.0;
  updateHUD();
}
fireBtn.addEventListener("click", shoot);
reloadBtn.addEventListener("click", reload);
callBtn.addEventListener("click", callBirds);
camBtn.addEventListener("click", ()=>{ useThirdPerson = !useThirdPerson; updateHUD(); });

// ---------- Movement + cameras ----------
function stepPlayer(dt){
  const mx = moveVec.x / 60;
  const my = moveVec.y / 60;

  // heavy realistic speed
  const baseSpeed = 145;
  const inputLen = Math.min(1, Math.sqrt(mx*mx + my*my));
  const speed = baseSpeed * inputLen; // خفيف = يمشي أهدى (Stealth-like)

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const right   = new THREE.Vector3(forward.z, 0, -forward.x);

  const v = new THREE.Vector3();
  v.add(forward.multiplyScalar(-my));
  v.add(right.multiplyScalar(mx));

  if(v.lengthSq()>0.0001) v.normalize().multiplyScalar(speed);
  player.position.add(v.multiplyScalar(dt));

  // bounds
  player.position.x = clamp(player.position.x, -4300, 4300);
  player.position.z = clamp(player.position.z, -4300, 4300);

  cameraFPS.position.set(player.position.x, 70, player.position.z);
  cameraFPS.rotation.set(pitch, yaw, 0);

  const tpDist = 180, tpHeight = 95;
  const behind = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize().multiplyScalar(-tpDist);
  cameraTP.position.set(player.position.x + behind.x, player.position.y + tpHeight, player.position.z + behind.z);
  cameraTP.lookAt(player.position.x, player.position.y + 70, player.position.z);

  player.rotation.y = yaw;
}

// ---------- Loop ----------
let last = performance.now();
function loop(now){
  const dt = Math.min(0.033, (now-last)/1000);
  last = now;

  stepWind(dt);
  stepPlayer(dt);
  boidsStep(dt);

  const cam = useThirdPerson ? cameraTP : cameraFPS;
  renderer.render(scene, cam);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener("resize", ()=>{
  renderer.setSize(innerWidth, innerHeight);
  cameraFPS.aspect = innerWidth/innerHeight; cameraFPS.updateProjectionMatrix();
  cameraTP.aspect  = innerWidth/innerHeight; cameraTP.updateProjectionMatrix();
});

statusEl.textContent = "COTW Web Lite Ready";
