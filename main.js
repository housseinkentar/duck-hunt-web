import * as THREE from
'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';

const canvas = document.getElementById("game");

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// Camera
const camera =
new THREE.PerspectiveCamera(
75,
window.innerWidth/window.innerHeight,
0.1,
5000
);

camera.position.set(0,20,50);

// Renderer
const renderer =
new THREE.WebGLRenderer({canvas});
renderer.setSize(window.innerWidth,window.innerHeight);

// Light (Sun)
const sun = new THREE.DirectionalLight(0xffffff,1.5);
sun.position.set(100,200,100);
scene.add(sun);

scene.add(new THREE.AmbientLight(0xffffff,0.4));

// Ground (Lebanon terrain start)
const groundGeo =
new THREE.PlaneGeometry(2000,2000,100,100);

const groundMat =
new THREE.MeshStandardMaterial({
color:0x3f7d3f
});

const ground =
new THREE.Mesh(groundGeo,groundMat);

ground.rotation.x = -Math.PI/2;
scene.add(ground);

// Simple mountains
for(let i=0;i<30;i++){
  const geo =
  new THREE.ConeGeometry(
    40+Math.random()*60,
    120+Math.random()*200,
    6
  );

  const mat =
  new THREE.MeshStandardMaterial({
    color:0x556b2f
  });

  const m =
  new THREE.Mesh(geo,mat);

  m.position.set(
    Math.random()*1500-750,
    60,
    Math.random()*1500-750
  );

  scene.add(m);
}

// movement
const keys={};

window.addEventListener("keydown",
e=>keys[e.key]=true);

window.addEventListener("keyup",
e=>keys[e.key]=false);

function move(){
  const speed=1.5;

  if(keys["w"]) camera.position.z-=speed;
  if(keys["s"]) camera.position.z+=speed;
  if(keys["a"]) camera.position.x-=speed;
  if(keys["d"]) camera.position.x+=speed;
}

function animate(){
  requestAnimationFrame(animate);
  move();
  renderer.render(scene,camera);
}

animate();
