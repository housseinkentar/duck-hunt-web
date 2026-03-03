const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let birds = [];
let bullets = 5;
let score = 0;

function spawnBird(){
  birds.push({
    x:-50,
    y:Math.random()*300+100,
    vx:3+Math.random()*2
  });
}

setInterval(spawnBird,2000);

function drawBird(b){
  ctx.fillStyle="lime";
  ctx.beginPath();
  ctx.arc(b.x,b.y,15,0,Math.PI*2);
  ctx.fill();
}

canvas.onclick=(e)=>{
  if(bullets<=0)return;

  bullets--;

  birds.forEach((b,i)=>{
    let dx=e.clientX-b.x;
    let dy=e.clientY-b.y;

    if(dx*dx+dy*dy<400){
      birds.splice(i,1);
      score++;
    }
  });
};

document.getElementById("reloadBtn").onclick=()=>{
  bullets=5;
};

function loop(){
  ctx.fillStyle="skyblue";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  birds.forEach(b=>{
    b.x+=b.vx;
    drawBird(b);
  });

  document.getElementById("stats").innerText=
  "Score: "+score;

  document.getElementById("ammo").innerText=
  "Bullets: "+bullets;

  requestAnimationFrame(loop);
}

loop();
