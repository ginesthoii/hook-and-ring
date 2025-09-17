// ================= HUD / DOM =================
const canvas  = document.getElementById("game");
const ctx     = canvas.getContext("2d");
const score1El= document.getElementById("score1");
const score2El= document.getElementById("score2");
const sets1El = document.getElementById("sets1");
const sets2El = document.getElementById("sets2");
const bestofEl= document.getElementById("bestof");
const playerEl= document.getElementById("player");
const angleEl = document.getElementById("angle");
const powerEl = document.getElementById("power");
document.getElementById("reset").addEventListener("click", hardReset);

// Ready / Release buttons (no HTML edits required)
const hud = document.querySelector(".hud");
const readyBtn = document.createElement("button");
readyBtn.id = "readyBtn"; readyBtn.textContent = "Ready (R)";
const releaseBtn = document.createElement("button");
releaseBtn.id = "releaseBtn"; releaseBtn.textContent = "Release (Space)";
releaseBtn.disabled = true;
const modeTag = document.createElement("span");
modeTag.style.paddingLeft = "8px";
modeTag.style.color = "#6b7280";
hud.appendChild(readyBtn);
hud.appendChild(releaseBtn);
hud.appendChild(modeTag);

// ================= Layout / Play Area =================
const FLOOR_Y   = 500;
const MARGIN_X  = canvas.width * 0.12;
const PLAY_LEFT = MARGIN_X;
const PLAY_RIGHT= canvas.width - MARGIN_X;
const LEFT_WALL_X  = PLAY_LEFT;
const RIGHT_WALL_X = PLAY_RIGHT;

// Anchor near top-center
const ANCHOR = { x: (PLAY_LEFT + PLAY_RIGHT) / 2, y: 90 };

// =================== Config (live-tunable) ===================
const DEFAULTS = {
  THETA_HOOK: -0.22,   // rad (left of down negative)
  ROPE_L: 260,         // px
  HOOK_INSET: 0,       // px (0 = tip exactly on arc)
  CAPTURE_R: 28,       // px (a bit more forgiving)
  GRAVITY: 0.0040,     // rad/frame^2
  DAMPING: 0.9990,     // [0.98..1]
  RELEASE_SCALE: 0.30, // initial velocity multiplier
  HOLD_START_ANGLE: 0.95 // rad, hold on right
};

const STORAGE_KEY = "hook-and-ring-config-v1";
function loadConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
function saveConfig(cfg) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {} }

let CFG = loadConfig();

// Hook (TIP used for scoring; we draw a J without a knob)
const HOOK = {
  tipX: 0, tipY: 0,
  plateW: 12, plateH: 44,     // small wall plate
  stemFromWall: 22, curveRise: 12,
  pegR: 9 // kept in case you want a tip circle later
};
function positionHookTip() {
  const r = CFG.ROPE_L - CFG.HOOK_INSET;
  HOOK.tipX = ANCHOR.x + r * Math.sin(CFG.THETA_HOOK);
  HOOK.tipY = ANCHOR.y + r * Math.cos(CFG.THETA_HOOK);
}
positionHookTip();

// ================= Physics & Rules =================
const MAX_SWING   = 1.55;     // ≈ ±89°
const STOP_VEL    = 0.0025;
const STOP_NEAR   = 0.05;
const MAX_THROW_MS= 5500;
const RING_RADIUS = 14;

const TARGET  = 21;
const BEST_OF = 3;
bestofEl.textContent = BEST_OF;
document.getElementById("target").textContent = TARGET;

// ================= Game State =================
let game = { p1:0, p2:0, sets1:0, sets2:0, current:1 };
score1El.textContent = 0; score2El.textContent = 0;
sets1El.textContent  = 0; sets2El.textContent  = 0;
playerEl.textContent = "P1";

let mode = "idle"; updateModeTag();
let ring = { angle: CFG.HOLD_START_ANGLE, angVel: 0, angAcc: 0 };
let dragging = false, dragAngle = null, scoreLatch = false, attemptStartMs = 0;

// ================= Audio =================
let audioCtx;
function beep(freq = 880, ms = 90) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "square"; o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); setTimeout(() => o.stop(), ms);
  } catch {}
}

// ================= Helpers =================
function ringPosFromAngle(a) {
  return { x: ANCHOR.x + CFG.ROPE_L * Math.sin(a),
           y: ANCHOR.y + CFG.ROPE_L * Math.cos(a) };
}
function angleFromPoint(x, y) {
  return Math.atan2(x - ANCHOR.x, y - ANCHOR.y); // 0 at DOWN
}
function updateAimUI(a) {
  const deg = (a * 180) / Math.PI;
  angleEl.textContent = `${deg.toFixed(0)}°`;
  powerEl.textContent = Math.min(100, Math.abs(deg) / 180 * 100).toFixed(0);
}
function updateModeTag(){ modeTag.textContent = `Mode: ${mode.toUpperCase()}`; }

// ================= Input =================
function getPoint(evt) {
  const r = canvas.getBoundingClientRect();
  if (evt.touches && evt.touches[0]) return { x: evt.touches[0].clientX - r.left, y: evt.touches[0].clientY - r.top };
  return { x: evt.clientX - r.left, y: evt.clientY - r.top };
}
function beginDrag(p) {
  if (mode !== "ready") return;
  const pos = ringPosFromAngle(ring.angle);
  if (Math.hypot(p.x - pos.x, p.y - pos.y) <= RING_RADIUS + 16) {
    dragging = true; dragAngle = angleFromPoint(p.x, p.y);
    ring.angVel = 0; updateAimUI(dragAngle);
  }
}
function moveDrag(p) {
  if (!dragging || mode !== "ready") return;
  dragAngle = angleFromPoint(p.x, p.y);
  dragAngle = Math.max(-MAX_SWING, Math.min(MAX_SWING, dragAngle));
  ring.angle = dragAngle; ring.angVel = 0; updateAimUI(dragAngle);
}
function endDrag(){ if (dragging){ dragging=false; dragAngle=null; } }

canvas.addEventListener("mousedown", e => beginDrag(getPoint(e)));
canvas.addEventListener("mousemove", e => moveDrag(getPoint(e)));
window.addEventListener("mouseup",   endDrag);

canvas.addEventListener("touchstart", e => { e.preventDefault(); beginDrag(getPoint(e)); }, {passive:false});
canvas.addEventListener("touchmove",  e => { e.preventDefault(); moveDrag(getPoint(e));  }, {passive:false});
canvas.addEventListener("touchend",   e => { e.preventDefault(); endDrag();              }, {passive:false});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); doRelease(); }
  if (e.key.toLowerCase() === "r") { e.preventDefault(); doReady(); }
});
readyBtn.addEventListener("click",  doReady);
releaseBtn.addEventListener("click", doRelease);

function doReady() {
  if (mode !== "idle") return;
  mode = "ready"; updateModeTag();
  ring.angle = CFG.HOLD_START_ANGLE; ring.angVel = 0;
  releaseBtn.disabled = false; readyBtn.disabled = true;
  angleEl.textContent = "0°"; powerEl.textContent = "0";
}
function doRelease() {
  if (mode !== "ready") return;
  const displacement = ring.angle; // from DOWN
  const power = Math.max(-0.6, Math.min(0.6, -displacement * CFG.RELEASE_SCALE));
  ring.angVel = power;
  mode = "flying"; updateModeTag();
  attemptStartMs = performance.now();
  releaseBtn.disabled = true; readyBtn.disabled = true;
  angleEl.textContent = "—"; powerEl.textContent = "—";
}

// ================= Scoring / Sets =================
function winByTwo(a,b,t){ const hi=Math.max(a,b), lo=Math.min(a,b); return hi>=t && (hi-lo)>=2; }
function setsToWin(){ return Math.floor(BEST_OF/2)+1; }
function gameWinner(){ return winByTwo(game.p1, game.p2, TARGET) ? (game.p1>game.p2?1:2) : 0; }
function matchWinner(){ const n=setsToWin(); return game.sets1>=n?1:(game.sets2>=n?2:0); }

function scorePoint(){
  if (game.current===1){ game.p1++; score1El.textContent=game.p1; }
  else { game.p2++; score2El.textContent=game.p2; }
  beep(1100,110);

  const gw = gameWinner();
  if (gw){
    if (gw===1) game.sets1++; else game.sets2++;
    sets1El.textContent=game.sets1; sets2El.textContent=game.sets2; beep(1400,140);
    const mw = matchWinner();
    if (mw){
      setTimeout(()=>{ alert(`Match: Player ${mw} wins! Sets ${game.sets1}-${game.sets2}`); hardReset(); }, 90);
      return;
    }
    // next game: clear points; serve to set loser
    game.p1=game.p2=0; score1El.textContent=0; score2El.textContent=0;
    game.current = (gw===1)?2:1; playerEl.textContent = game.current===1?"P1":"P2";
  }
}
function endAttempt(){
  mode="idle"; updateModeTag();
  releaseBtn.disabled=true; readyBtn.disabled=false;
  scoreLatch=false;
  game.current = (game.current===1)?2:1; playerEl.textContent = game.current===1?"P1":"P2";
  ring.angle = CFG.HOLD_START_ANGLE; ring.angVel=0;
}
function hardReset(){
  game={p1:0,p2:0,sets1:0,sets2:0,current:1};
  score1El.textContent=0; score2El.textContent=0; sets1El.textContent=0; sets2El.textContent=0;
  playerEl.textContent="P1";
  ring.angle=CFG.HOLD_START_ANGLE; ring.angVel=0; ring.angAcc=0;
  scoreLatch=false; mode="idle"; updateModeTag();
  releaseBtn.disabled=true; readyBtn.disabled=false;
}

// ================= Loop =================
function step(){
  if (mode==="flying"){
    ring.angAcc = -CFG.GRAVITY * Math.sin(ring.angle);
    ring.angVel = (ring.angVel + ring.angAcc) * CFG.DAMPING;
    ring.angle  = ring.angle + ring.angVel;

    if (ring.angle >  MAX_SWING){ ring.angle= MAX_SWING; ring.angVel*=-0.2; }
    if (ring.angle < -MAX_SWING){ ring.angle=-MAX_SWING; ring.angVel*=-0.2; }

    // ---- scoring uses TIP with a gentle "magnet" funnel ----
    const pos = ringPosFromAngle(ring.angle);
    const d   = Math.hypot(pos.x - HOOK.tipX, pos.y - HOOK.tipY);
    const towardTip = (pos.x - HOOK.tipX) * ring.angVel < 0 || Math.abs(ring.angVel) > 0.01;

    if (!scoreLatch) {
      if (d < CFG.CAPTURE_R) {
        scoreLatch = true;
        ring.angVel = 0;
        draw(true);
        setTimeout(() => { scorePoint(); endAttempt(); }, 110);
      } else if (d < CFG.CAPTURE_R * 1.35 && towardTip) {
        // small pull toward the tip so near-misses sit onto the hook
        const k = 0.0008;
        const dx = (HOOK.tipX - pos.x);
        const dy = (HOOK.tipY - pos.y);
        // simple angular nudge consistent with approach
        const tangent = Math.sign(ring.angVel) || (dx * Math.cos(ring.angle) - dy * Math.sin(ring.angle) >= 0 ? 1 : -1);
        ring.angVel += tangent * 0.0009;
      }
    }

    // stop when settled or timeout
    const elapsed = performance.now() - attemptStartMs;
    if (!scoreLatch && (elapsed > MAX_THROW_MS ||
        (Math.abs(ring.angVel) < STOP_VEL && Math.abs(ring.angle) < STOP_NEAR))){
      endAttempt();
    }
  }

  draw(false);
  requestAnimationFrame(step);
}

// ================= Drawing =================
function draw(snapped){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawGround(); drawWalls(); /* no big backboard */ drawHook(); drawGuideArc(); drawPerson();
  drawRopeAndRing(snapped);
}
function drawGround(){ ctx.fillStyle="#e5e7eb"; ctx.fillRect(0,FLOOR_Y,canvas.width,canvas.height-FLOOR_Y); }
function drawWalls(){
  ctx.beginPath(); ctx.moveTo(LEFT_WALL_X,0); ctx.lineTo(LEFT_WALL_X,canvas.height);
  ctx.lineWidth=2; ctx.strokeStyle="#e5e7eb"; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(RIGHT_WALL_X,0); ctx.lineTo(RIGHT_WALL_X,canvas.height);
  ctx.lineWidth=2; ctx.strokeStyle="#eef2f7"; ctx.stroke();
}
function drawHook(){
  // small wall plate (delete this rect if you want absolutely no box)
  ctx.fillStyle="#9ca3af";
  ctx.fillRect(LEFT_WALL_X - HOOK.plateW, HOOK.tipY - HOOK.plateH/2, HOOK.plateW, HOOK.plateH);

  // stem from wall
  const stemStartX = LEFT_WALL_X;
  const stemEndX   = LEFT_WALL_X + HOOK.stemFromWall;
  const stemY      = HOOK.tipY;
  ctx.beginPath(); ctx.moveTo(stemStartX, stemY); ctx.lineTo(stemEndX, stemY);
  ctx.lineWidth=5; ctx.strokeStyle="#111827"; ctx.stroke();

  // curved "J" toward the (invisible) tip
  ctx.beginPath();
  ctx.arc(stemEndX, stemY - HOOK.curveRise, HOOK.curveRise, Math.PI/2, -Math.PI/2, true);
  ctx.lineWidth=5; ctx.strokeStyle="#111827"; ctx.stroke();

  // No round knob at the tip
  // Optional flat end marker:
  // ctx.beginPath(); ctx.moveTo(HOOK.tipX - 6, HOOK.tipY); ctx.lineTo(HOOK.tipX + 6, HOOK.tipY);
  // ctx.lineWidth = 3; ctx.strokeStyle = "#111827"; ctx.stroke();
}
function drawGuideArc(){
  ctx.beginPath(); ctx.setLineDash([6,6]);
  ctx.arc(ANCHOR.x, ANCHOR.y, CFG.ROPE_L, -MAX_SWING, MAX_SWING);
  ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=1.5; ctx.stroke(); ctx.setLineDash([]);
  // eye hook
  ctx.beginPath(); ctx.arc(ANCHOR.x, ANCHOR.y, 6, 0, Math.PI*2);
  ctx.fillStyle="#374151"; ctx.fill();
}
function drawPerson(){
  const baseX = canvas.width * 0.93;   // farther right
  const baseY = FLOOR_Y;

  ctx.save();
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 3;

  // legs + taller torso
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX, baseY - 96);
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(baseX, baseY - 118, 12, 0, Math.PI * 2);
  ctx.stroke();

  // arm with elbow → hand (reaches ring in Ready)
  const shoulderX = baseX - 2;
  const shoulderY = baseY - 96;

  if (mode === "ready") {
    const grip = ringPosFromAngle(ring.angle);
    const upperLen = 40;
    const dx = grip.x - shoulderX, dy = grip.y - shoulderY;
    const totalLen = Math.hypot(dx, dy) || 1;
    const ux = shoulderX + (dx / totalLen) * upperLen;
    const uy = shoulderY + (dy / totalLen) * upperLen;

    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(ux, uy);
    ctx.lineTo(grip.x, grip.y);
    ctx.stroke();
  } else {
    // neutral longer arm
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(shoulderX - 26, shoulderY - 18);
    ctx.lineTo(shoulderX - 56, shoulderY - 28);
    ctx.stroke();
  }
  ctx.restore();
}
function drawRopeAndRing(snapped){
  const pos = snapped ? { x: HOOK.tipX, y: HOOK.tipY } : ringPosFromAngle(ring.angle);
  // rope
  ctx.beginPath(); ctx.moveTo(ANCHOR.x, ANCHOR.y); ctx.lineTo(pos.x, pos.y);
  ctx.lineWidth=2; ctx.strokeStyle="#f59e0b"; ctx.stroke();
  // ring
  ctx.beginPath(); ctx.arc(pos.x, pos.y, RING_RADIUS, 0, Math.PI*2);
  ctx.lineWidth=4; ctx.strokeStyle="#111827"; ctx.stroke();
}

// ================= Config Panel (sliders) =================
(function makeConfigPanel(){
  const panel = document.createElement("div");
  panel.id = "config-panel";
  Object.assign(panel.style, {
    position:"absolute", top:"56px", right:"16px", padding:"10px 12px",
    background:"rgba(255,255,255,0.92)", border:"1px solid #e5e7eb",
    borderRadius:"10px", boxShadow:"0 8px 20px rgba(0,0,0,0.08)",
    fontFamily:"system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
    fontSize:"12px", color:"#111827", zIndex:"10", width:"260px"
  });

  function row(label, min, max, step, getVal, setVal){
    const wrap = document.createElement("div"); wrap.style.margin="6px 0";
    const lab = document.createElement("label"); lab.textContent=label; lab.style.display="block";
    const range = document.createElement("input"); range.type="range";
    Object.assign(range, {min, max, step}); range.value = getVal();
    range.style.width="100%";
    const valBox = document.createElement("input"); valBox.type="number"; valBox.style.width="80px";
    Object.assign(valBox, {value:getVal(), step, min, max});
    const right = document.createElement("div"); right.style.display="flex"; right.style.justifyContent="flex-end";
    right.appendChild(valBox);

    range.addEventListener("input", ()=>{ valBox.value = range.value; setVal(parseFloat(range.value)); onConfigChange(); });
    valBox.addEventListener("change", ()=>{ range.value = valBox.value; setVal(parseFloat(valBox.value)); onConfigChange(); });

    wrap.appendChild(lab); wrap.appendChild(range); wrap.appendChild(right);
    return wrap;
  }

  panel.appendChild(row("Hook Angle (rad, left negative)", -0.8, 0.4, 0.01, ()=>CFG.THETA_HOOK, v=>CFG.THETA_HOOK=v));
  panel.appendChild(row("Rope Length (px)", 160, 360, 1, ()=>CFG.ROPE_L, v=>CFG.ROPE_L=v));
  panel.appendChild(row("Hook Inset (px)", 0, 24, 1, ()=>CFG.HOOK_INSET, v=>CFG.HOOK_INSET=v));
  panel.appendChild(row("Capture Radius (px)", 10, 50, 1, ()=>CFG.CAPTURE_R, v=>CFG.CAPTURE_R=v));
  panel.appendChild(row("Gravity", 0.001, 0.01, 0.0001, ()=>CFG.GRAVITY, v=>CFG.GRAVITY=v));
  panel.appendChild(row("Damping", 0.985, 0.9995, 0.0001, ()=>CFG.DAMPING, v=>CFG.DAMPING=v));
  panel.appendChild(row("Release Scale", 0.10, 0.45, 0.01, ()=>CFG.RELEASE_SCALE, v=>CFG.RELEASE_SCALE=v));
  panel.appendChild(row("Hold Start Angle (rad)", -1.2, 1.2, 0.01, ()=>CFG.HOLD_START_ANGLE, v=>CFG.HOLD_START_ANGLE=v));

  const rowBtns = document.createElement("div");
  rowBtns.style.display="grid"; rowBtns.style.gridTemplateColumns="1fr 1fr"; rowBtns.style.gap="6px"; rowBtns.style.marginTop="8px";
  const saveBtn = document.createElement("button"); saveBtn.textContent="Save";
  const defaultsBtn = document.createElement("button"); defaultsBtn.textContent="Defaults";
  const centerBtn = document.createElement("button"); centerBtn.textContent="Recenter";
  [saveBtn, defaultsBtn, centerBtn].forEach(b=>{ Object.assign(b.style,{fontSize:"12px",padding:"6px",border:"1px solid #e5e7eb",borderRadius:"8px",background:"#f9fafb",cursor:"pointer"}); });
  saveBtn.onclick = ()=>{ saveConfig(CFG); flash("Saved"); };
  defaultsBtn.onclick = ()=>{ CFG = { ...DEFAULTS }; onConfigChange(); flash("Defaults"); };
  centerBtn.onclick = ()=>{ ANCHOR.x=(PLAY_LEFT+PLAY_RIGHT)/2; flash("Recentered"); };
  rowBtns.appendChild(saveBtn); rowBtns.appendChild(defaultsBtn);
  panel.appendChild(rowBtns);
  const single = document.createElement("div"); single.style.marginTop="6px"; single.appendChild(centerBtn);
  panel.appendChild(single);

  const presets = document.createElement("div");
  presets.style.display="grid"; presets.style.gridTemplateColumns="1fr 1fr 1fr"; presets.style.gap="6px"; presets.style.marginTop="8px";
  const pEasy = document.createElement("button"); pEasy.textContent="Easy";
  const pNorm = document.createElement("button"); pNorm.textContent="Normal";
  const pHard = document.createElement("button"); pHard.textContent="Hard";
  [pEasy,pNorm,pHard].forEach(b=>{ Object.assign(b.style,{fontSize:"12px",padding:"6px",border:"1px solid #e5e7eb",borderRadius:"8px",background:"#eef2ff",cursor:"pointer"}); });
  pEasy.onclick = ()=>{ Object.assign(CFG,{CAPTURE_R:38, RELEASE_SCALE:0.22, GRAVITY:0.0045}); onConfigChange(); flash("Preset: Easy"); };
  pNorm.onclick = ()=>{ Object.assign(CFG,{CAPTURE_R:28, RELEASE_SCALE:0.30, GRAVITY:0.0040}); onConfigChange(); flash("Preset: Normal"); };
  pHard.onclick = ()=>{ Object.assign(CFG,{CAPTURE_R:16, RELEASE_SCALE:0.34, GRAVITY:0.0036}); onConfigChange(); flash("Preset: Hard"); };
  presets.appendChild(pEasy); presets.appendChild(pNorm); presets.appendChild(pHard);
  panel.appendChild(presets);

  document.body.appendChild(panel);
  function flash(txt){ panel.style.boxShadow="0 8px 22px rgba(99,102,241,0.35)"; panel.title=txt; setTimeout(()=>panel.style.boxShadow="0 8px 20px rgba(0,0,0,0.08)", 250); }
})();

function onConfigChange(){
  positionHookTip();
  if (mode !== "flying"){
    ring.angle = CFG.HOLD_START_ANGLE; ring.angVel = 0;
  }
}

// ================= Boot =================
hardReset();
doReady(); // auto-arm first throw
requestAnimationFrame(step);