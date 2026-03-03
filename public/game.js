const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const statsEl = document.getElementById("stats");
const ammoEl = document.getElementById("ammo");
const reloadBtn = document.getElementById("reloadBtn");
const pauseBtn = document.getElementById("pauseBtn");
const callBtn = document.getElementById("callBtn");

// ===== helpers =====
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function norm(x, y) { const L = Math.sqrt(x*x + y*y) || 1; return [x / L, y / L]; }

// ===== canvas resize =====
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();
document.body.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

// ===== GAME STATE =====
let score = 0;
let misses = 0;
let level = 1;

const MAG = 5;
let bullets = MAG;

let paused = false;
let gameOver = false;

// aiming
let aimX = W * 0.5;
let aimY = H * 0.55;
function setAim(x, y){ aimX = clamp(x, 0, W); aimY = clamp(y, 0, H); }

// ===== MAPS (3) =====
let currentMap = 0;
const MAPS = ["sunset_marsh", "mountain_valley", "river_delta"];
function nextMap(){ currentMap = (currentMap + 1) % MAPS.length; }

// ===== SIMPLE ENV =====
const ENV = { t: 0, wind: 0, windTarget: 0, light: 1, fog: 0 };

function updateEnv(dt){
  ENV.t += dt;
  if (Math.floor(ENV.t) % 4 === 0) ENV.windTarget = rnd(-80, 80);
  ENV.wind += (ENV.windTarget - ENV.wind) * (dt * 0.6);

  const cycle = (ENV.t / 90) % 1;
  const s = Math.sin(cycle * Math.PI); // 0..1..0
  ENV.light = clamp(0.35 + 0.65 * s, 0.35, 1);
  ENV.fog = clamp(0.10 + (1 - ENV.light) * 0.35, 0, 0.55);
}

// ===== BACKGROUNDS =====
function drawSunsetMarsh(t){
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ff914d");
  g.addColorStop(0.55, "#ff5e62");
  g.addColorStop(1, "#2b1b55");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ffe1a3";
  ctx.beginPath();
  ctx.arc(W*0.78, H*0.28, 82, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const rg = ctx.createLinearGradient(0, H*0.62, W, H*0.86);
  rg.addColorStop(0, "rgba(255,120,90,0.38)");
  rg.addColorStop(1, "rgba(120,60,160,0.60)");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(0, H*0.76);
  ctx.bezierCurveTo(W*0.25, H*0.66, W*0.55, H*0.90, W, H*0.78);
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#1f6f3f";
  ctx.fillRect(0, H*0.82, W, H*0.18);
}

function drawMountainValley(t){
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#8ec5fc");
  g.addColorStop(1, "#e0f7fa");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#2b3a4a";
  for (let i=-1;i<7;i++){
    const baseX = i*(W/5);
    ctx.beginPath();
    ctx.moveTo(baseX, H*0.68);
    ctx.lineTo(baseX + (W/10), H*0.34 + Math.sin(i + t*0.0004)*12);
    ctx.lineTo(baseX + (W/5), H*0.68);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(35,140,220,0.70)";
  ctx.beginPath();
  ctx.moveTo(0, H*0.78);
  ctx.quadraticCurveTo(W*0.52, H*0.60, W, H*0.82);
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#1f6f3f";
  ctx.fillRect(0, H*0.84, W, H*0.16);
}

function drawRiverDelta(t){
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#4facfe");
  g.addColorStop(1, "#00f2fe");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  ctx.fillStyle = "rgba(2,136,209,0.88)";
  ctx.fillRect(0, H*0.62, W, H);

  ctx.globalAlpha = 0.30;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (let y = H*0.62; y < H; y += 14){
    ctx.beginPath();
    for (let x=0; x<=W; x+=40){
      const yy = y + Math.sin(x*0.02 + t*0.003)*3;
      if (x===0) ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#f4d35e";
  ctx.fillRect(0, H*0.86, W, H*0.14);
}

function drawBackground(t){
  if (MAPS[currentMap]==="sunset_marsh") drawSunsetMarsh(t);
  else if (MAPS[currentMap]==="mountain_valley") drawMountainValley(t);
  else drawRiverDelta(t);

  // night overlay
  ctx.globalAlpha = (1 - ENV.light) * 0.55;
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0,0,W,H);
  ctx.globalAlpha = 1;

  // fog
  if (ENV.fog > 0.01){
    ctx.globalAlpha = ENV.fog;
    const fg = ctx.createLinearGradient(0, H*0.25, 0, H);
    fg.addColorStop(0, "rgba(255,255,255,0.00)");
    fg.addColorStop(1, "rgba(230,240,255,1.00)");
    ctx.fillStyle = fg;
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;
  }
}

// ===== V10: Warwar (Bee-eater) visual =====
class Warwar {
  constructor(){
    this.reset(true);
  }
  reset(newSide=false){
    this.alive = true;
    this.fromLeft = newSide ? (Math.random()<0.5) : this.fromLeft;
    this.x = this.fromLeft ? -180 : W + 180;
    this.y = rnd(H*0.16, H*0.60);

    // speed increases slightly with level
    const base = 260 + level*28;
    this.vx = this.fromLeft ? base : -base;
    this.vy = rnd(-90, 90);

    this.scale = rnd(0.85, 1.25);
    this.wing = rnd(0, 10);
    this.fear = 0; // 0..1
    this.state = "fly"; // fly / fall
    this.headR = 12 * this.scale;
    this.bodyR = 20 * this.scale;
  }

  headPos(){
    const dir = this.vx >= 0 ? 1 : -1;
    return { x: this.x + dir*(20*this.scale), y: this.y - (8*this.scale) };
  }

  update(dt){
    if (!this.alive) return;

    // wind
    if (this.state === "fly") this.vx += (ENV.wind * 0.05) * dt;

    // fear decay
    this.fear *= Math.pow(0.92, dt*60);

    // if falling
    if (this.state === "fall"){
      this.vy += 980 * dt;
      this.vx *= 0.992;
    }

    // clamp speed while flying
    if (this.state === "fly"){
      const sp = Math.sqrt(this.vx*this.vx + this.vy*this.vy) || 1;
      const target = clamp(sp, 220, 620);
      this.vx = (this.vx/sp)*target;
      this.vy = (this.vy/sp)*target;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // bounce vertically
    if (this.state === "fly"){
      if (this.y < 60) { this.y = 60; this.vy *= -0.6; }
      if (this.y > H - 220) { this.y = H - 220; this.vy *= -0.6; }
    }

    // out of screen = respawn
    if (this.state === "fly"){
      if (this.fromLeft && this.x > W + 220) { this.alive = false; misses++; }
      if (!this.fromLeft && this.x < -220) { this.alive = false; misses++; }
    }

    if (this.state === "fall" && this.y > H - 130) this.alive = false;

    this.wing += dt * 16;
  }

  scareFrom(x,y){
    if (!this.alive || this.state!=="fly") return;
    const dx = this.x - x, dy = this.y - y;
    const d2 = dx*dx + dy*dy;
    if (d2 > 220*220) return;
    const d = Math.sqrt(d2) || 1;
    const [nx, ny] = [dx/d, dy/d];
    const strength = (1 - d/220);
    this.vx += nx * (520 * strength);
    this.vy += ny * (420 * strength);
    this.fear = clamp(this.fear + 0.6*strength, 0, 1);
  }

  kill(){
    if (this.state !== "fall"){
      this.state = "fall";
      this.fear = 1;
    }
  }

  draw(){
    const dir = this.vx >= 0 ? 1 : -1;
    const s = this.scale;

    // shadow
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(this.x, H - 120, 34*s, 10*s, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const green1="#2fb46b", green2="#1f8a52";
    const blue1="#3b8cff", blue2="#1f5fbf";
    const yellow="#f4d24b", chest="#9a6a3a", mask="#1b1b1b";

    // body
    const bodyGrad = ctx.createLinearGradient(this.x-30*s, this.y-10*s, this.x+30*s, this.y+10*s);
    bodyGrad.addColorStop(0, green2);
    bodyGrad.addColorStop(1, green1);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 32*s, 13*s, 0, 0, Math.PI*2);
    ctx.fill();

    // chest
    ctx.fillStyle = chest;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.ellipse(this.x + 6*dir*s, this.y + 4*s, 18*s, 7.5*s, 0.15*dir, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // wing
    const flap = 1 + 0.32*Math.sin(this.wing);
    const wingGrad = ctx.createLinearGradient(this.x, this.y, this.x + 30*dir*s, this.y + 10*s);
    wingGrad.addColorStop(0, blue2);
    wingGrad.addColorStop(1, blue1);
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(this.x - 6*dir*s, this.y + 1*s);
    ctx.quadraticCurveTo(this.x + 10*dir*s, this.y - 22*flap*s, this.x + 30*dir*s, this.y - 2*s);
    ctx.quadraticCurveTo(this.x + 8*dir*s, this.y + 12*s, this.x - 6*dir*s, this.y + 1*s);
    ctx.closePath();
    ctx.fill();

    // head
    const hx = this.x + dir*(20*s);
    const hy = this.y - (8*s);

    ctx.fillStyle = yellow;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 12.5*s, 10.5*s, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = mask;
    ctx.beginPath();
    ctx.ellipse(hx + dir*(2*s), hy, 8.5*s, 6.8*s, 0, 0, Math.PI*2);
    ctx.fill();

    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(hx + dir*(4*s), hy - (1*s), 2.0*s, 0, Math.PI*2);
    ctx.fill();

    // beak
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3.2*s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx + dir*(10*s), hy + (1*s));
    ctx.lineTo(hx + dir*(34*s), hy + (6*s));
    ctx.stroke();

    // tail
    ctx.strokeStyle = green2;
    ctx.lineWidth = 4*s;
    ctx.beginPath();
    ctx.moveTo(this.x - dir*(24*s), this.y + (2*s));
    ctx.lineTo(this.x - dir*(50*s), this.y + (12*s));
    ctx.stroke();

    // streamers
    ctx.strokeStyle = blue2;
    ctx.lineWidth = 2.2*s;
    ctx.beginPath();
    ctx.moveTo(this.x - dir*(20*s), this.y + (5*s));
    ctx.lineTo(this.x - dir*(60*s), this.y + (18*s));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.x - dir*(22*s), this.y + (3*s));
    ctx.lineTo(this.x - dir*(56*s), this.y + (22*s));
    ctx.stroke();

    // fear dark tint
    if (this.fear > 0.2){
      ctx.globalAlpha = clamp(this.fear*0.18, 0, 0.18);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 40*s, 16*s, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// ===== V10: simple flock =====
let flock = [];
function spawnFlock(){
  const count = clamp(4 + Math.floor(level/2), 4, 10);
  flock = [];
  for (let i=0;i<count;i++){
    const b = new Warwar();
    b.fromLeft = Math.random()<0.5;
    b.reset(false);
    b.x += rnd(-220,220);
    b.y += rnd(-90,90);
    b.vx += rnd(-70,70);
    b.vy += rnd(-50,50);
    flock.push(b);
  }
}
spawnFlock();

// ===== shooting =====
function shoot(x,y){
  if (paused || gameOver) return;
  if (bullets <= 0) return;
  bullets--;

  // scare all nearby birds
  for (const b of flock) b.scareFrom(x,y);

  let hit = false;
  // check hit on birds (simple)
  for (const b of flock){
    if (!b.alive || b.state!=="fly") continue;
    const h = b.headPos();
    const dxh = x - h.x, dyh = y - h.y;
    if (dxh*dxh + dyh*dyh <= (b.headR*b.headR)){
      // headshot
      score += 3;
      b.kill();
      hit = true;
      break;
    }
    const dxb = x - b.x, dyb = y - b.y;
    if (dxb*dxb + dyb*dyb <= (b.bodyR*b.bodyR)){
      // body shot
      score += 1;
      b.kill();
      hit = true;
      break;
    }
  }
  if (!hit) misses++;
}

// ===== HUD + crosshair =====
function updateHUD(){
  statsEl.textContent = `Score: ${score}  |  Misses: ${misses}/12  |  Level: ${level}  |  Map: ${currentMap+1}/3  |  Wind: ${ENV.wind.toFixed(0)}`;
  ammoEl.textContent = `Bullets: ${bullets}/${MAG}`;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
}

function drawCrosshair(){
  ctx.strokeStyle = "#0b0b0b";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.95;

  ctx.beginPath();
  ctx.arc(aimX, aimY, 18, 0, Math.PI*2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(aimX - 30, aimY);
  ctx.lineTo(aimX + 30, aimY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(aimX, aimY - 30);
  ctx.lineTo(aimX, aimY + 30);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// ===== controls =====
canvas.addEventListener("mousemove", (e) => setAim(e.clientX, e.clientY));
canvas.addEventListener("mousedown", (e) => { setAim(e.clientX, e.clientY); shoot(e.clientX, e.clientY); });

canvas.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  if (!t) return;
  setAim(t.clientX, t.clientY);
  shoot(t.clientX, t.clientY);
}, { passive: false });

reloadBtn.addEventListener("click", () => { bullets = MAG; });
pauseBtn.addEventListener("click", () => { paused = !paused; });
callBtn.addEventListener("click", () => {
  // V10: call = birds gather near center (no audio yet)
  const tx = W * 0.58, ty = H * 0.34;
  for (const b of flock){
    if (!b.alive || b.state!=="fly") continue;
    const dx = tx - b.x, dy = ty - b.y;
    const [nx, ny] = norm(dx, dy);
    b.vx += nx * 60;
    b.vy += ny * 50;
    b.fear *= 0.6;
  }
});

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "r") bullets = MAG;
  if (k === "p") paused = !paused;
  if (k === "m") nextMap();
});

// ===== loop =====
let lastT = performance.now();
function tick(t){
  let dt = Math.min(0.033, (t - lastT)/1000);
  lastT = t;

  level = 1 + Math.floor(score / 12);

  if (!paused && !gameOver){
    updateEnv(dt);

    // respawn adjust
    if (t % 7000 < 16) {
      const desired = clamp(4 + Math.floor(level/2), 4, 10);
      if (flock.length !== desired) spawnFlock();
    }

    for (const b of flock){
      b.update(dt);
      if (!b.alive) b.reset(true);
    }

    if (misses >= 12) gameOver = true;
  } else {
    updateEnv(dt*0.35);
  }

  drawBackground(t);

  // birds
  for (const b of flock) b.draw();

  // crosshair
  drawCrosshair();

  updateHUD();

  if (gameOver){
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#fff";
    ctx.font = "700 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", W/2, H/2 - 10);

    ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Reload لإعادة الطلق — حدّث الصفحة لإعادة اللعب", W/2, H/2 + 20);
  }

  requestAnimationFrame(tick);
}
updateHUD();
requestAnimationFrame(tick);
