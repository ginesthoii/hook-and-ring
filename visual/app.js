// DOM refs
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const score1El = document.getElementById("score1");
const score2El = document.getElementById("score2");
const sets1El  = document.getElementById("sets1");
const sets2El  = document.getElementById("sets2");
const bestofEl = document.getElementById("bestof");
const playerEl = document.getElementById("player");
const angleEl  = document.getElementById("angle");
const powerEl  = document.getElementById("power");
document.getElementById("reset").addEventListener("click", hardReset);

// World
const GRAVITY = 0.0022;       // pendulum gravity (rad/frame^2 scale)
const DAMPING = 0.9992;       // angular damping (air resistance)
const RING_RADIUS = 14;
const FLOOR_Y = 500;

// Rope anchor + length
const ANCHOR = { x: 240, y: 120 };
const ROPE_L = 220;  // pixels

// Hook geometry
const HOOK = { x: 670, y: 210, pegR: 10, captureR: 26 };

// Game
const TARGET = 21;
const BEST_OF = 3; // 3 => first to 2 sets
bestofEl.textContent = BEST_OF;

let gameState = {
  p1: 0, p2: 0,
  sets1: 0, sets2: 0,
  current: 1,
};

score1El.textContent = gameState.p1;
score2El.textContent = gameState.p2;
sets1El.textContent = gameState.sets1;
sets2El.textContent = gameState.sets2;
playerEl.textContent = "P1";
document.getElementById("target").textContent = TARGET;

// Ring as a pendulum: position set by angle
let ring = {
  angle: Math.PI / 2 + 0.15,  // down-right-ish
  angVel: 0,
  angAcc: 0
};

// Dragging along arc
let dragging = false;
let dragAngle = null;

// Audio blip
let audioCtx;
function beep(freq = 880, ms = 100) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square"; o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); setTimeout(() => o.stop(), ms);
  } catch {}
}

// Helpers
function ringPosFromAngle(a) {
  return {
    x: ANCHOR.x + ROPE_L * Math.sin(a),
    y: ANCHOR.y + ROPE_L * Math.cos(a)
  };
}

function angleFromPoint(x, y) {
  // Angle measured from vertical downward, positive to right (sin/cos mapping above)
  const dx = x - ANCHOR.x;
  const dy = y - ANCHOR.y;
  // clamp to circle of radius ROPE_L
  const len = Math.hypot(dx, dy) || 1e-6;
  const nx = (dx / len) * Math.min(len, ROPE_L);
  const ny = (dy / len) * Math.min(len, ROPE_L);
  // inverse mapping: sin(a)=nx/L, cos(a)=ny/L -> a = atan2(nx, ny)
  return Math.atan2(nx, ny);
}

// Input
canvas.addEventListener("mousedown", (e) => {
  const { x, y } = mouse(e);
  const pos = ringPosFromAngle(ring.angle);
  const d = Math.hypot(x - pos.x, y - pos.y);
  // allow grab near ring
  if (d <= RING_RADIUS + 14) {
    dragging = true;
    dragAngle = angleFromPoint(x, y);
    ring.angVel = 0;
    updateAimUI(dragAngle);
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const { x, y } = mouse(e);
  dragAngle = angleFromPoint(x, y);
  ring.angle = dragAngle;   // preview ring along arc
  ring.angVel = 0;
  updateAimUI(dragAngle);
});

window.addEventListener("mouseup", () => {
  if (!dragging) return;
  // Throw: give angular velocity based on how far from vertical you pulled
  // Use simple proportional "power" derived from displacement from down (PI)
  const displacement = dragAngle - Math.PI; // ~[-PI, PI]
  const power = Math.max(-0.35, Math.min(0.35, -displacement * 0.18)); // tuned
  ring.angVel = power;
  dragging = false;
  dragAngle = null;
  angleEl.textContent = "—";
  powerEl.textContent = "—";
});

function mouse(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function updateAimUI(a) {
  // convert to degrees relative to vertical down (PI rad)
  let deg = ((a - Math.PI) * 180) / Math.PI;
  angleEl.textContent = `${deg.toFixed(0)}°`;
  // "power" proxy (how far from vertical)
  const p = Math.abs(deg) / 180 * 100;
  powerEl.textContent = p.toFixed(0);
}

// Scoring
function gameWinner() {
  const a = Math.max(gameState.p1, gameState.p2);
  const b = Math.min(gameState.p1, gameState.p2);
  if (a >= TARGET && a - b >= 2) return gameState.p1 > gameState.p2 ? 1 : 2;
  return null;
}

function setsToWin() {
  return Math.floor(BEST_OF / 2) + 1; // e.g. BO3 -> 2
}

function matchWinner() {
  const need = setsToWin();
  if (gameState.sets1 >= need) return 1;
  if (gameState.sets2 >= need) return 2;
  return null;
}

function scorePoint() {
  if (gameState.current === 1) {
    gameState.p1++; score1El.textContent = gameState.p1;
  } else {
    gameState.p2++; score2El.textContent = gameState.p2;
  }
  beep(1100, 110);

  const gw = gameWinner();
  if (gw) {
    // award set
    if (gw === 1) gameState.sets1++; else gameState.sets2++;
    sets1El.textContent = gameState.sets1;
    sets2El.textContent = gameState.sets2;
    beep(1400, 140);

    // check match
    const mw = matchWinner();
    if (mw) {
      setTimeout(() => {
        alert(`Match: Player ${mw} wins! Sets ${gameState.sets1}-${gameState.sets2}`);
        hardReset(); // whole match
      }, 60);
      return;
    }

    // new game, alternate start player
    gameState.p1 = gameState.p2 = 0;
    score1El.textContent = 0;
    score2El.textContent = 0;
    gameState.current = (gw === 1) ? 2 : 1;
    playerEl.textContent = gameState.current === 1 ? "P1" : "P2";
  } else {
    // change turn after made hook
    gameState.current = gameState.current === 1 ? 2 : 1;
    playerEl.textContent = gameState.current === 1 ? "P1" : "P2";
  }
}

function hardReset() {
  gameState = { p1:0, p2:0, sets1:0, sets2:0, current:1 };
  score1El.textContent = 0; score2El.textContent = 0;
  sets1El.textContent = 0;  sets2El.textContent = 0;
  playerEl.textContent = "P1";
  ring.angle = Math.PI / 2 + 0.15;
  ring.angVel = 0;
}

// Physics step (pendulum)
function step() {
  if (!dragging) {
    // simple pendulum with small damping
    // angle measured from vertical down (PI is down)
    // torque ~ -sin(angle - PI)
    ring.angAcc = -GRAVITY * Math.sin(ring.angle - Math.PI);
    ring.angVel = (ring.angVel + ring.angAcc);
    ring.angVel *= DAMPING;
    ring.angle += ring.angVel;
  }

  // Collision/capture with hook
  const pos = ringPosFromAngle(ring.angle);
  const dist = Math.hypot(pos.x - HOOK.x, pos.y - HOOK.y);
  if (dist < HOOK.captureR) {
    // snap onto hook visually, then score and re-tee
    // freeze briefly
    ring.angVel = 0;
    draw(true); // draw snapped frame
    setTimeout(() => {
      scorePoint();
      // re-tee to right-hand side, mild offset
      ring.angle = Math.PI / 2 + 0.15;
      ring.angVel = 0;
    }, 80);
  }

  draw(false);
  requestAnimationFrame(step);
}

// Draw
function draw(snapped) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGround();
  drawBackboard();
  drawHook();
  drawRopeAndRing(snapped);
}

function drawGround() {
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, FLOOR_Y, canvas.width, canvas.height - FLOOR_Y);
}

function drawBackboard() {
  ctx.fillStyle = "#d1d5db";
  ctx.fillRect(HOOK.x - 70, HOOK.y - 60, 140, 70);
}

function drawHook() {
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(HOOK.x - 4, HOOK.y, 8, 130);
  ctx.beginPath();
  ctx.arc(HOOK.x, HOOK.y, HOOK.pegR, 0, Math.PI * 2);
  ctx.fillStyle = "#111827"; ctx.fill();

  // debug capture radius:
  // ctx.beginPath(); ctx.arc(HOOK.x, HOOK.y, HOOK.captureR, 0, Math.PI*2);
  // ctx.strokeStyle="#60a5fa"; ctx.stroke();
}

function drawRopeAndRing(snapped) {
  const pos = snapped ? { x: HOOK.x, y: HOOK.y + 4 } : ringPosFromAngle(ring.angle);

  // Rope
  ctx.beginPath();
  ctx.moveTo(ANCHOR.x, ANCHOR.y);
  ctx.lineTo(pos.x, pos.y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#7c858f";
  ctx.stroke();

  // Anchor cap
  ctx.beginPath();
  ctx.arc(ANCHOR.x, ANCHOR.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#374151"; ctx.fill();

  // Ring
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, RING_RADIUS, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#111827";
  ctx.stroke();
}

// Start
hardReset();
step();