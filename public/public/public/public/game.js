const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const statsEl = document.getElementById("stats");
const ammoEl = document.getElementById("ammo");
const reloadBtn = document.getElementById("reloadBtn");
const pauseBtn = document.getElementById("pauseBtn");
const callBtn = document.getElementById("callBtn");

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function rndi(a, b) { return Math.floor(rnd(a, b + 1)); }
function norm(x, y) { const L = Math.sqrt(x*x + y*y) || 1; return [x / L, y / L]; }

let W = 1280, H = 720, DPR = 1;

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

// iOS prevent scroll
document.body.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

// ================= MAPS =================
let currentMap = 0;
const MAPS = ["sunset_marsh", "mountain_valley", "river_delta"];
function nextMap() { currentMap = (currentMap + 1) % MAPS.length; }

// ================= ENV =================
const ENV = { time: 0, wind: 0, windTarget: 0, fog: 0, light: 1 };

function updateEnv(dt) {
  ENV.time += dt;

  if (Math.floor(ENV.time) % 4 === 0) ENV.windTarget = rnd(-90, 90);
  ENV.wind += (ENV.windTarget - ENV.wind) * (dt * 0.6);

  const cycle = (ENV.time / 90) % 1;
  let s = Math.sin(cycle * Math.PI);
  ENV.light = clamp(0.35 + 0.65 * s, 0.35, 1);
  ENV.fog = clamp(0.12 + (1 - ENV.light) * 0.40, 0, 0.60);
}

// ================= GAME STATE =================
let score = 0;
let misses = 0;
let level = 1;

const MAG = 5;
let bullets = MAG;

let paused = false;
let gameOver = false;

let recoil = 0;
let spread = 0;
let lastShot = 0;

let combo = 0;
let comboTimer = 0;

let aimX = W * 0.5;
let aimY = H * 0.55;
function setAim(x, y) { aimX = clamp(x, 0, W); aimY = clamp(y, 0, H); }

const bulletMarks = []; // {x,y,life}
const particles = [];   // smoke particles

// ================= AMMO TYPES =================
const AMMO = {
  "12ga": { name: "12GA", pellets: 10, pelletSpread: 26, recoilKick: 12 },
  "32ga": { name: "32GA", pellets:  6, pelletSpread: 16, recoilKick:  8 },
};
let ammoType = "12ga";
function cycleAmmo() { ammoType = (ammoType === "12ga") ? "32ga" : "12ga"; }

// ================= REAL WARWAR CALL AUDIO =================
const warwarCall = new Audio("assets/warwar_call.mp3");
warwarCall.preload = "auto";
warwarCall.volume = 0.9;

let lastCallAt = 0;
const CALL_COOLDOWN_MS = 1800;

function playWarwarCall() {
  const now = performance.now();
  if (now - lastCallAt < CALL_COOLDOWN_MS) return;
  lastCallAt = now;
  try {
    warwarCall.currentTime = 0;
    const p = warwarCall.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) {}
}

// ================= V8 WEAPON =================
let weaponKick = 0;
let muzzleFlash = 0;
let slowMotion = 0;

function drawWeapon() {
  const baseY = H - 44 + weaponKick;

  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(W * 0.34, baseY, W * 0.32, 22);

  ctx.fillStyle = "#111";
  ctx.fillRect(W * 0.62, baseY - 7, W * 0.20, 14);

  ctx.fillStyle = "#6b3e26";
  ctx.fillRect(W * 0.28, baseY + 10, 92, 34);

  if (muzzleFlash > 0.05) {
    ctx.globalAlpha = muzzleFlash;
    ctx.fillStyle = "orange";
    ctx.beginPath();
    ctx.arc(W * 0.83, baseY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ================= BACKGROUNDS =================
function drawSunsetMarsh(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ff914d");
  g.addColorStop(0.55, "#ff5e62");
  g.addColorStop(1, "#2b1b55");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ffe1a3";
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.28, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const rg = ctx.createLinearGradient(0, H * 0.62, W, H * 0.86);
  rg.addColorStop(0, "rgba(255,120,90,0.38)");
  rg.addColorStop(1, "rgba(120,60,160,0.60)");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.76);
  ctx.bezierCurveTo(W * 0.25, H * 0.66, W * 0.55, H * 0.90, W, H * 0.78);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1f6f3f";
  ctx.fillRect(0, H * 0.82, W, H * 0.18);

  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "#2f9256";
  ctx.lineWidth = 2;
  const reeds = Math.floor(W / 9);
  for (let i = 0; i < reeds; i++) {
    const x = (i / reeds) * W + Math.sin(i * 1.7) * 4;
    const hh = 45 + (i % 10) * 7;
    ctx.beginPath();
    ctx.moveTo(x, H * 0.99);
    ctx.quadraticCurveTo(x + 7, H * 0.91, x + 2, H * 0.99 - hh);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawMountainValley(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#8ec5fc");
  g.addColorStop(1, "#e0f7fa");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#2b3a4a";
  for (let i = -1; i < 7; i++) {
    const baseX = i * (W / 5);
    ctx.beginPath();
    ctx.moveTo(baseX, H * 0.68);
    ctx.lineTo(baseX + (W / 10), H * 0.34 + Math.sin(i + t * 0.0004) * 12);
    ctx.lineTo(baseX + (W / 5), H * 0.68);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(35,140,220,0.70)";
  ctx.beginPath();
  ctx.moveTo(0, H * 0.78);
  ctx.quadraticCurveTo(W * 0.52, H * 0.60, W, H * 0.82);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1f6f3f";
  ctx.fillRect(0, H * 0.84, W, H * 0.16);
}

function drawRiverDelta(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#4facfe");
  g.addColorStop(1, "#00f2fe");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(2,136,209,0.88)";
  ctx.fillRect(0, H * 0.62, W, H);

  ctx.globalAlpha = 0.30;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (let y = H * 0.62; y < H; y += 14) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 40) {
      const yy = y + Math.sin(x * 0.02 + t * 0.003) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#f4d35e";
  ctx.fillRect(0, H * 0.86, W, H * 0.14);
}

function drawBackground(t) {
  switch (MAPS[currentMap]) {
    case "sunset_marsh": drawSunsetMarsh(t); break;
    case "mountain_valley": drawMountainValley(t); break;
    case "river_delta": drawRiverDelta(t); break;
  }

  ctx.globalAlpha = (1 - ENV.light) * 0.55;
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  if (ENV.fog > 0.01) {
    ctx.globalAlpha = ENV.fog;
    const fg = ctx.createLinearGradient(0, H * 0.25, 0, H);
    fg.addColorStop(0, "rgba(255,255,255,0.00)");
    fg.addColorStop(1, "rgba(230,240,255,1.00)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ================= V9 FLOCK SETTINGS =================
const FLOCK = {
  sepRadius: 58,
  alignRadius: 120,
  cohRadius: 160,
  wSep: 1.30,
  wAlign: 0.70,
  wCoh: 0.55,
  minSpeed: 220,
  maxSpeed: 720,
  fearRadius: 220,
  fearKick: 560,
  fearDecay: 0.92,
  callPull: 420,
};

let lastShotPos = null; // {x,y,ttl}
function registerShotFear(x, y) { lastShotPos = { x, y, ttl: 0.9 }; }

// ================= BIRD =================
class BeeEater {
  constructor(type = "fast") {
    this.type = type;
    this.state = "fly"; // fly / perch / fall
    this.health = 1;
    this.fear = 0;
    this.reset(true);
  }

  reset(newSide = false) {
    this.state = "fly";
    this.escaped = false;
    this.alive = true;
    this.health = 1;
    this.fear = 0;

    if (newSide) this.fromLeft = Math.random() < 0.5;

    const isFast = this.type === "fast";
    const base = (isFast ? 380 : 300) + level * (isFast ? 52 : 36);
    const sizeMul = isFast ? 1.0 : 1.25;

    this.scale = sizeMul;
    this.x = this.fromLeft ? -220 : W + 220;
    this.y = rnd(H * 0.16, H * 0.62);

    this.vx = this.fromLeft ? base : -base;
    this.vy = rnd(isFast ? -140 : -110, isFast ? 110 : 90);

    this.wing = rnd(0, 10);

    this.headR = 14 * sizeMul;
    this.bodyR = 22 * sizeMul;

    this.perchTimer = rnd(2.5, 6.5);
  }

  headPos() {
    const dir = this.vx >= 0 ? 1 : -1;
    return { x: this.x + dir * (22 * this.scale), y: this.y - (8 * this.scale) };
  }

  applySteer(ax, ay, dt) {
    this.vx += ax * dt;
    this.vy += ay * dt;
  }

  update(dt) {
    if (!this.alive) return;

    this.fear *= Math.pow(FLOCK.fearDecay, dt * 60);

    if (this.state === "fly") this.vx += (ENV.wind * 0.06) * dt;

    if (this.health < 1 && this.state === "fly") {
      this.vy += 120 * dt;
      this.vx *= (1 - 0.03 * dt);
    }

    this.perchTimer -= dt;
    if (this.state === "fly" && this.perchTimer <= 0 && this.fear < 0.12 && this.health === 1) {
      if (Math.random() < 0.15) {
        this.state = "perch";
        this.vx *= 0.2;
        this.vy = 0;
        this.y = clamp(this.y, H * 0.55, H * 0.72);
        this.perchHold = rnd(1.0, 2.6);
      } else {
        this.perchTimer = rnd(2.5, 6.5);
      }
    }

    if (this.state === "perch") {
      this.perchHold -= dt;
      this.x += Math.sin(ENV.time * 4 + this.wing) * 2.0 * dt;
      if (this.perchHold <= 0 || this.fear > 0.15) {
        this.state = "fly";
        const dir = (Math.random() < 0.5) ? -1 : 1;
        this.vx = dir * rnd(260, 420);
        this.vy = rnd(-220, -120);
        this.perchTimer = rnd(2.5, 6.5);
      }
    }

    if (this.state === "fall") {
      this.vy += 980 * dt;
      this.vx *= 0.992;
    }

    const sp = Math.sqrt(this.vx*this.vx + this.vy*this.vy) || 1;
    const minS = FLOCK.minSpeed * (this.type === "fast" ? 1.0 : 0.9);
    const maxS = FLOCK.maxSpeed * (this.type === "fast" ? 1.0 : 0.92);

    if (this.state === "fly") {
      let target = clamp(sp, minS, maxS);
      this.vx = (this.vx / sp) * target;
      this.vy = (this.vy / sp) * target;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y < 60) { this.y = 60; this.vy *= -0.55; }
    if (this.y > H - 210 && this.state === "fly") { this.y = H - 210; this.vy *= -0.55; }

    if (this.state === "fly") {
      if (this.fromLeft && this.x > W + 240) { this.escaped = true; this.alive = false; }
      if (!this.fromLeft && this.x < -240) { this.escaped = true; this.alive = false; }
    }

    if (this.state === "fall" && this.y > H - 160) this.alive = false;

    this.wing += dt * (this.type === "fast" ? 16 : 14);
  }

  kill() { if (this.state !== "fall") this.state = "fall"; }

  injure() {
    if (this.health === 1 && this.state === "fly") {
      this.health = 0.5;
      this.fear = 1;
      const [nx, ny] = norm(this.vx, this.vy);
      this.vx += nx * 260;
      this.vy += ny * 120;
    }
  }

  draw() {
    const dir = this.vx >= 0 ? 1 : -1;
    const s = this.scale;

    ctx.globalAlpha = (this.state === "perch") ? 0.22 : 0.12;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(this.x, H - 125, 36 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const green1 = "#2fb46b", green2 = "#1f8a52";
    const blue1 = "#3b8cff", blue2 = "#1f5fbf";
    const yellow = "#f4d24b", chest = "#9a6a3a", mask = "#1b1b1b";

    const bodyGrad = ctx.createLinearGradient(this.x - 30*s, this.y - 10*s, this.x + 30*s, this.y + 10*s);
    bodyGrad.addColorStop(0, green2);
    bodyGrad.addColorStop(1, green1);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 34*s, 14*s, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = chest;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.ellipse(this.x + 6*dir*s, this.y + 4*s, 19*s, 8*s, 0.15*dir, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const flap = 1 + 0.32 * Math.sin(this.wing);
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

    const hx = this.x + dir * 22*s;
    const hy = this.y - 8*s;

    ctx.fillStyle = yellow;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 13*s, 11*s, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = mask;
    ctx.beginPath();
    ctx.ellipse(hx + dir*2*s, hy, 9*s, 7*s, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(hx + dir*4*s, hy - 1*s, 2.1*s, 0, Math.PI*2);
    ctx.fill();

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3.2*s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx + dir*10*s, hy + 1*s);
    ctx.lineTo(hx + dir*34*s, hy + 6*s);
    ctx.stroke();

    ctx.strokeStyle = green2;
    ctx.lineWidth = 4*s;
    ctx.beginPath();
    ctx.moveTo(this.x - dir*26*s, this.y + 2*s);
    ctx.lineTo(this.x - dir*52*s, this.y + 12*s);
    ctx.stroke();

    ctx.strokeStyle = blue2;
    ctx.lineWidth = 2.2*s;
    ctx.beginPath();
    ctx.moveTo(this.x - dir*22*s, this.y + 5*s);
    ctx.lineTo(this.x - dir*62*s, this.y + 18*s);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.x - dir*24*s, this.y + 3*s);
    ctx.lineTo(this.x - dir*58*s, this.y + 22*s);
    ctx.stroke();

    if (this.fear > 0.2) {
      ctx.globalAlpha = clamp(this.fear * 0.18, 0, 0.18);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 42*s, 18*s, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// ================= FLOCK =================
let flock = [];

function spawnFlock() {
  const count = clamp(3 + Math.floor(level / 2), 3, 9);
  flock = [];
  for (let i = 0; i < count; i++) {
    const type = (Math.random() < 0.35) ? "big" : "fast";
    const b = new BeeEater(type);
    b.fromLeft = Math.random() < 0.5;
    b.reset(false);
    b.x += rnd(-240, 240);
    b.y += rnd(-90, 90);
    b.vx += rnd(-80, 80);
    b.vy += rnd(-60, 60);
    flock.push(b);
  }
}
spawnFlock();

function flockingSteer(bird) {
  if (!bird.alive || bird.state !== "fly") return [0, 0];

  let sepX = 0, sepY = 0, sepN = 0;
  let aliX = 0, aliY = 0, aliN = 0;
  let cohX = 0, cohY = 0, cohN = 0;

  for (const other of flock) {
    if (other === bird || !other.alive || other.state !== "fly") continue;

    const dx = other.x - bird.x;
    const dy = other.y - bird.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < 1) continue;
    const d = Math.sqrt(d2);

    if (d < FLOCK.sepRadius) { sepX -= dx / d; sepY -= dy / d; sepN++; }
    if (d < FLOCK.alignRadius) { aliX += other.vx; aliY += other.vy; aliN++; }
    if (d < FLOCK.cohRadius) { cohX += other.x; cohY += other.y; cohN++; }
  }

  let ax = 0, ay = 0;

  if (sepN > 0) {
    sepX /= sepN; sepY /= sepN;
    ax += sepX * (FLOCK.wSep * 420);
    ay += sepY * (FLOCK.wSep * 420);
  }
  if (aliN > 0) {
    aliX /= aliN; aliY /= aliN;
    ax += (aliX - bird.vx) * (FLOCK.wAlign * 0.9);
    ay += (aliY - bird.vy) * (FLOCK.wAlign * 0.9);
  }
  if (cohN > 0) {
    cohX /= cohN; cohY /= cohN;
    ax += (cohX - bird.x) * (FLOCK.wCoh * 0.9);
    ay += (cohY - bird.y) * (FLOCK.wCoh * 0.9);
  }

  if (lastShotPos && lastShotPos.ttl > 0) {
    const dx = bird.x - lastShotPos.x;
    const dy = bird.y - lastShotPos.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < FLOCK.fearRadius * FLOCK.fearRadius) {
      const d = Math.sqrt(d2) || 1;
      const fx = dx / d, fy = dy / d;
      const strength = (1 - d / FLOCK.fearRadius);
      ax += fx * (FLOCK.fearKick * strength);
      ay += fy * (FLOCK.fearKick * strength);
      bird.fear = clamp(bird.fear + 0.55 * strength, 0, 1);
    }
  }

  const margin = 120;
  if (bird.x < margin) ax += (margin - bird.x) * 2.0;
  if (bird.x > W - margin) ax -= (bird.x - (W - margin)) * 2.0;
  if (bird.y < 90) ay += (90 - bird.y) * 2.2;
  if (bird.y > H - 240) ay -= (bird.y - (H - 240)) * 2.2;

  return [ax, ay];
}

// ================= FX =================
function addSmoke(x, y) {
  for (let i = 0; i < 12; i++) {
    particles.push({ x, y, vx: rnd(-120, 120), vy: rnd(-90, 50), life: rnd(0.18, 0.34), r: rnd(6, 14) });
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.98; p.vy *= 0.98;
    p.vy += 60 * dt;
    p.life -= dt;
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
}
function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life * 3.2, 0, 0.28);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#e6e6e6";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function updateMarks() {
  for (const m of bulletMarks) m.life -= 1;
  for (let i = bulletMarks.length - 1; i >= 0; i--) if (bulletMarks[i].life <= 0) bulletMarks.splice(i, 1);
}
function drawMarks() {
  for (const m of bulletMarks) {
    ctx.globalAlpha = clamp(m.life / 60, 0, 1);
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ================= ACTIONS =================
function reload() { if (!gameOver) bullets = MAG; }

function restart() {
  score = 0; misses = 0; level = 1; bullets = MAG;
  recoil = 0; spread = 0; combo = 0; comboTimer = 0;
  paused = false; gameOver = false; lastShotPos = null;
  spawnFlock();
}

function callBirds() {
  if (gameOver || paused) return;
  playWarwarCall();

  const targetX = W * 0.58;
  const targetY = H * 0.34;

  for (const b of flock) {
    if (!b.alive || b.state !== "fly") continue;
    const calm = 1 - b.fear;
    const dx = targetX - b.x;
    const dy = targetY - b.y;
    const [nx, ny] = norm(dx, dy);
    const pull = FLOCK.callPull * (0.45 + 0.55 * calm);
    b.vx += nx * pull * 0.06;
    b.vy += ny * pull * 0.06;
    b.fear *= 0.7;
  }
}

function applyHit(bird, sx, sy) {
  const h = bird.headPos();
  const dxh = sx - h.x, dyh = sy - h.y;
  const dxb = sx - bird.x, dyb = sy - bird.y;

  if (dxh*dxh + dyh*dyh <= bird.headR*bird.headR) {
    score += 3 + Math.min(5, combo);
    combo++; comboTimer = 1.6;
    bird.kill();
    slowMotion = 0.28;
    return true;
  }

  if (dxb*dxb + dyb*dyb <= bird.bodyR*bird.bodyR) {
    const injureChance = (ammoType === "32ga") ? 0.35 : 0.20;
    if (Math.random() < injureChance) bird.injure();
    else bird.kill();
    score += 1 + Math.min(3, Math.floor(combo / 2));
    combo++; comboTimer = 1.6;
    return true;
  }

  return false;
}

function shoot(x, y) {
  if (gameOver || paused) return;
  if (bullets <= 0) return;

  bullets--;

  weaponKick = 18;
  muzzleFlash = 1;

  recoil = Math.min(30, recoil + AMMO[ammoType].recoilKick);
  const gap = performance.now() - lastShot;
  lastShot = performance.now();
  spread += (gap < 200) ? 7 : 4;
  spread = Math.min(36, spread);

  addSmoke(x, y);
  registerShotFear(x, y);

  let anyHit = false;
  const cfg = AMMO[ammoType];

  for (let i = 0; i < cfg.pellets; i++) {
    const dist = clamp(1.0 + (1 - (y / H)) * 1.2, 1.0, 2.2);
    const flightTime = 0.05 + dist * 0.05;
    const windDriftX = ENV.wind * flightTime;

    const s = (spread + cfg.pelletSpread) * dist;
    const sx = x + windDriftX + rnd(-s, s);
    const sy = y + rnd(-s, s);

    if (i < 3) bulletMarks.push({ x: sx, y: sy, life: 55 });

    const ordered = flock
      .filter(b => b.alive && b.state === "fly")
      .sort((a, b) => ((a.x-sx)**2+(a.y-sy)**2) - ((b.x-sx)**2+(b.y-sy)**2));

    for (const b of ordered) {
      if (applyHit(b, sx, sy)) { anyHit = true; break; }
    }
  }

  if (!anyHit) {
    misses++;
    combo = 0;
    comboTimer = 0;
  }
}

// ================= INPUT =================
canvas.addEventListener("mousemove", (e) => setAim(e.clientX, e.clientY));
canvas.addEventListener("mousedown", (e) => { setAim(e.clientX, e.clientY); shoot(e.clientX, e.clientY); });

canvas.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  if (!t) return;
  setAim(t.clientX, t.clientY);
  shoot(t.clientX, t.clientY);
}, { passive: false });

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "r") reload();
  if (k === "p") paused = !paused;
  if (k === "c") callBirds();
  if (k === "x") restart();
  if (k === "t") cycleAmmo();
  if (k === "m") nextMap();
});

reloadBtn.addEventListener("click", reload);
callBtn.addEventListener("click", callBirds);
pauseBtn.addEventListener("click", () => paused = !paused);

// iPhone: long press Call = change ammo
let pressTimer = null;
callBtn.addEventListener("touchstart", () => { pressTimer = setTimeout(() => cycleAmmo(), 450); }, { passive: true });
callBtn.addEventListener("touchend", () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; }, { passive: true });

// ================= HUD + CROSSHAIR + OVERLAY =================
function updateHUD() {
  const cfg = AMMO[ammoType];
  statsEl.textContent =
    `Score: ${score} · Misses: ${misses}/12 · Level: ${level} · Combo: ${combo} · Ammo: ${cfg.name} · Map: ${currentMap+1}/3 · Wind: ${ENV.wind.toFixed(0)}`;
  ammoEl.textContent = `Bullets: ${bullets}/${MAG}`;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
}

function drawCrosshair() {
  const jx = rnd(-recoil, recoil) * 0.12;
  const jy = recoil * 0.45;
  const cx = aimX + jx;
  const cy = aimY + jy;

  ctx.strokeStyle = "#0b0b0b";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.95;

  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 30, cy);
  ctx.lineTo(cx + 30, cy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - 30);
  ctx.lineTo(cx, cy + 30);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

function drawRestartOverlay() {
  const bw = Math.min(280, W * 0.62);
  const bh = 56;
  const bx = (W - bw) / 2;
  const by = H * 0.62;

  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "#111827";
  ctx.fillRect(bx, by, bw, bh);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fff";
  ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.fillText("Restart (tap هنا) أو زر X", W / 2, by + 35);

  return { bx, by, bw, bh };
}

canvas.addEventListener("click", (e) => {
  if (!gameOver) return;
  const r = drawRestartOverlay();
  const x = e.clientX, y = e.clientY;
  if (x >= r.bx && x <= r.bx + r.bw && y >= r.by && y <= r.by + r.bh) restart();
});
canvas.addEventListener("touchstart", (e) => {
  if (!gameOver) return;
  const t = e.touches[0];
  if (!t) return;
  const r = drawRestartOverlay();
  const x = t.clientX, y = t.clientY;
  if (x >= r.bx && x <= r.bx + r.bw && y >= r.by && y <= r.by + r.bh) restart();
}, { passive: false });

// ================= LOOP =================
let lastT = performance.now();

function tick(t) {
  let dt = Math.min(0.033, (t - lastT) / 1000);
  lastT = t;

  weaponKick *= 0.85;
  muzzleFlash *= 0.80;

  if (slowMotion > 0) {
    slowMotion -= dt;
    dt *= 0.35;
  }

  level = 1 + Math.floor(score / 14);

  if (!paused && !gameOver) {
    updateEnv(dt);

    recoil = Math.max(0, recoil - 26 * dt);
    spread = Math.max(0, spread - 30 * dt);

    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer === 0) combo = 0;

    if (lastShotPos) {
      lastShotPos.ttl -= dt;
      if (lastShotPos.ttl <= 0) lastShotPos = null;
    }

    // flocking
    for (const b of flock) {
      if (!b.alive) continue;
      const [ax, ay] = flockingSteer(b);
      const maxA = 900;
      b.applySteer(clamp(ax, -maxA, maxA), clamp(ay, -maxA, maxA), dt);
    }

    for (const b of flock) b.update(dt);

    for (const b of flock) {
      if (!b.alive && b.escaped) misses += 1;
      if (!b.alive) b.reset(true);

      if (b.alive && b.health < 1 && b.state === "fly") {
        if (b.y > H * 0.78 || Math.abs(b.x) > W + 120) { b.escaped = true; b.alive = false; }
      }
    }

    if (t % 6000 < 16) {
      const desired = clamp(3 + Math.floor(level / 2), 3, 9);
      if (flock.length !== desired) spawnFlock();
    }

    if (misses >= 12) gameOver = true;
  } else {
    updateEnv(dt * 0.35);
  }

  drawBackground(t);
  drawMarks();
  updateParticles(dt);
  drawParticles();

  for (const b of flock) b.draw();

  drawWeapon();
  drawCrosshair();

  updateMarks();
  updateHUD();

  if (gameOver) {
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#fff";
    ctx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", W / 2, H / 2 - 14);

    ctx.font = "600 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("V9: السرب يهرب من الطلقة ويتجاوب مع النداء — M خريطة — T طلق", W / 2, H / 2 + 18);

    drawRestartOverlay();
  }

  requestAnimationFrame(tick);
}

updateHUD();
requestAnimationFrame(tick);

setInterval(() => {
  if (!paused && !gameOver) callBirds();
}, 18000);
