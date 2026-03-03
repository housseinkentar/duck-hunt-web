import * as THREE from
'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';

// ===== Scene =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// ===== Camera =====
const camera =
new THREE.PerspectiveCamera(
75,
window.innerWidth/window.innerHeight,
0.1,
5000
);

camera.position.set(0,120,200);
camera.lookAt(0,0,0);

// ===== Renderer =====
const renderer =
new THREE.WebGLRenderer({antialias:true});

renderer.setSize(
window.innerWidth,
window.innerHeight
);

document.body.appendChild(renderer.domElement);

// ===== Light =====
const sun =
new THREE.DirectionalLight(0xffffff,1);

sun.position.set(200,300,200);
scene.add(sun);

scene.add(
new THREE.AmbientLight(0xffffff,0.5)
);

// ===== Ground =====
const ground =
new THREE.Mesh(
new THREE.PlaneGeometry(3000,3000),
new THREE.MeshStandardMaterial({
color:0x2f7d32
})
);

ground.rotation.x = -Math.PI/2;
scene.add(ground);

// ===== Mountains =====
for(let i=0;i<25;i++){

const m =
new THREE.Mesh(
new THREE.ConeGeometry(
80+Math.random()*120,
200+Math.random()*200,
4
),
new THREE.MeshStandardMaterial({
color:0x355e3b
})
);

m.position.set(
Math.random()*2500-1250,
100,
Math.random()*2500-1250
);

scene.add(m);
}

// ===== Controls =====
const keys={};

window.addEventListener(
"keydown",
e=>keys[e.key.toLowerCase()]=true
);

window.addEventListener(
"keyup",
e=>keys[e.key.toLowerCase()]=false
);

let yaw=0;

window.addEventListener("mousemove",(e)=>{
yaw -= e.movementX*0.002;
camera.rotation.y=yaw;
});

// ===== Movement =====
function move(){

const speed=3;

const forward=new THREE.Vector3();
camera.getWorldDirection(forward);
forward.y=0;
forward.normalize();

const right=
new THREE.Vector3()
.crossVectors(forward,new THREE.Vector3(0,1,0));

if(keys["w"])
camera.position.add(
forward.clone().multiplyScalar(speed)
);

if(keys["s"])
camera.position.add(
forward.clone().multiplyScalar(-speed)
);

if(keys["a"])
camera.position.add(
right.clone().multiplyScalar(speed)
);

if(keys["d"])
camera.position.add(
right.clone().multiplyScalar(-speed)
);
}

// ===== Animate =====
function animate(){

requestAnimationFrame(animate);

move();

renderer.render(scene,camera);
}

animate();
