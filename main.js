import * as THREE from
'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';

// =================
// Scene
// =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// =================
// Camera
// =================
const camera =
new THREE.PerspectiveCamera(
75,
window.innerWidth/window.innerHeight,
0.1,
5000
);

camera.position.set(0,20,50);

// =================
// Renderer
// =================
const renderer =
new THREE.WebGLRenderer({antialias:true});

renderer.setSize(
window.innerWidth,
window.innerHeight
);

document.body.appendChild(renderer.domElement);

// =================
// Light
// =================
const sun =
new THREE.DirectionalLight(0xffffff,1);

sun.position.set(100,200,100);
scene.add(sun);

scene.add(
new THREE.AmbientLight(0xffffff,0.6)
);

// =================
// Ground
// =================
const groundGeo =
new THREE.PlaneGeometry(3000,3000);

const groundMat =
new THREE.MeshLambertMaterial({
color:0x2f6b2f
});

const ground =
new THREE.Mesh(groundGeo,groundMat);

ground.rotation.x=-Math.PI/2;
scene.add(ground);

// =================
// Mountains
// =================
for(let i=0;i<40;i++){

 const geo =
 new THREE.ConeGeometry(
 100+Math.random()*200,
 300+Math.random()*400,
 4
 );

 const mat =
 new THREE.MeshLambertMaterial({
 color:0x335533
 });

 const m = new THREE.Mesh(geo,mat);

 m.position.set(
 Math.random()*2500-1250,
 150,
 Math.random()*2500-1250
 );

 scene.add(m);
}

// =================
// MOBILE CONTROL
// =================
let touchX=0;
let touchY=0;

window.addEventListener("touchmove",(e)=>{

 const t=e.touches[0];

 touchX=
 (t.clientX/window.innerWidth)-0.5;

 touchY=
 (t.clientY/window.innerHeight)-0.5;

 camera.rotation.y =
 -touchX*2;

});

// =================
// Movement
// =================
function move(){

 const speed = 2;

 const forward =
 new THREE.Vector3();

 camera.getWorldDirection(forward);

 forward.y=0;
 forward.normalize();

 camera.position.add(
 forward.multiplyScalar(
 -touchY*speed
 )
 );

}

// =================
// Animate
// =================
function animate(){

 requestAnimationFrame(animate);

 move();

 renderer.render(scene,camera);
}

animate();

// =================
// Resize
// =================
window.addEventListener(
"resize",
()=>{
 camera.aspect=
 window.innerWidth/
 window.innerHeight;

 camera.updateProjectionMatrix();

 renderer.setSize(
 window.innerWidth,
 window.innerHeight
 );
}
);
