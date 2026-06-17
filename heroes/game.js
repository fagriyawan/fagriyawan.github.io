/* =============================================================
   Heroes Tropis — Auto Battler
   Genre: Side-view auto-battle RPG
   5 Heroes vs Mobs, stage-based, skill system
   ============================================================= */

// ===== CONFIGURATION =====
const CANVAS_W = 960;
const CANVAS_H = 480;
const GROUND_Y = 0.78; // ground line as ratio of canvas height
const HERO_START_X = 0.08;
const ENEMY_START_X = 0.92;
const UNIT_SPACING = 55;


// ===== HERO DEFINITIONS =====
const HEROES = [
  {
    id: "knight", name: "Ksatria", emoji: "🛡️", type: "melee",
    hp: 800, atk: 45, def: 30, atkSpeed: 1.2, range: 60, moveSpeed: 80,
    skill: { name: "Tameng Hentakan", emoji: "💥", cd: 8, dmg: 80, effect: "stun", dur: 1.5, area: 0 },
    color: "#4488ff"
  },
  {
    id: "berserker", name: "Berserker", emoji: "⚔️", type: "melee",
    hp: 600, atk: 75, def: 15, atkSpeed: 0.9, range: 55, moveSpeed: 100,
    skill: { name: "Whirlwind", emoji: "🌀", cd: 10, dmg: 120, effect: "aoe", dur: 0, area: 100 },
    color: "#ff4444"
  },
  {
    id: "archer", name: "Pemanah", emoji: "🏹", type: "ranged",
    hp: 400, atk: 55, def: 10, atkSpeed: 1.0, range: 280, moveSpeed: 60,
    skill: { name: "Multi-shot", emoji: "🎯", cd: 7, dmg: 40, effect: "multi", dur: 0, area: 0, hits: 3 },
    color: "#44dd44"
  },
  {
    id: "mage", name: "Penyihir", emoji: "🔮", type: "ranged",
    hp: 350, atk: 65, def: 8, atkSpeed: 1.4, range: 300, moveSpeed: 50,
    skill: { name: "Bola Api", emoji: "🔥", cd: 12, dmg: 150, effect: "aoe", dur: 0, area: 120 },
    color: "#dd44ff"
  },
  {
    id: "healer", name: "Tabib", emoji: "✨", type: "support",
    hp: 450, atk: 30, def: 12, atkSpeed: 1.5, range: 200, moveSpeed: 55,
    skill: { name: "Berkat Hijau", emoji: "💚", cd: 15, dmg: 0, effect: "heal", dur: 0, area: 999, healAmt: 150 },
    color: "#44ffaa"
  },
];


// ===== STAGE DEFINITIONS =====
const STAGES = [
  {
    id: 1, name: "Hutan Gelap", bg: "#1a2a1a",
    enemies: [
      { name: "Goblin", emoji: "👹", hp: 200, atk: 20, def: 5, atkSpeed: 1.0, range: 50, moveSpeed: 70, type: "melee", color: "#88aa44" },
      { name: "Goblin", emoji: "👹", hp: 200, atk: 20, def: 5, atkSpeed: 1.0, range: 50, moveSpeed: 70, type: "melee", color: "#88aa44" },
      { name: "Goblin", emoji: "👹", hp: 200, atk: 20, def: 5, atkSpeed: 1.0, range: 50, moveSpeed: 70, type: "melee", color: "#88aa44" },
      { name: "Slime", emoji: "🟢", hp: 400, atk: 15, def: 20, atkSpeed: 1.8, range: 50, moveSpeed: 40, type: "melee", color: "#22cc66" },
    ],
    reward: 80,
  },
  {
    id: 2, name: "Gua Tulang", bg: "#1a1a2a",
    enemies: [
      { name: "Skeleton", emoji: "💀", hp: 250, atk: 35, def: 8, atkSpeed: 1.2, range: 220, moveSpeed: 50, type: "ranged", color: "#ccccaa" },
      { name: "Skeleton", emoji: "💀", hp: 250, atk: 35, def: 8, atkSpeed: 1.2, range: 220, moveSpeed: 50, type: "ranged", color: "#ccccaa" },
      { name: "Goblin", emoji: "👹", hp: 250, atk: 25, def: 8, atkSpeed: 1.0, range: 50, moveSpeed: 75, type: "melee", color: "#88aa44" },
      { name: "Goblin", emoji: "👹", hp: 250, atk: 25, def: 8, atkSpeed: 1.0, range: 50, moveSpeed: 75, type: "melee", color: "#88aa44" },
      { name: "Slime", emoji: "🟢", hp: 500, atk: 20, def: 25, atkSpeed: 1.8, range: 50, moveSpeed: 35, type: "melee", color: "#22cc66" },
    ],
    reward: 120,
  },
  {
    id: 3, name: "Rawa Bayangan", bg: "#1a1025",
    enemies: [
      { name: "Bayangan", emoji: "🦇", hp: 180, atk: 50, def: 5, atkSpeed: 0.7, range: 50, moveSpeed: 120, type: "melee", color: "#6633aa" },
      { name: "Bayangan", emoji: "🦇", hp: 180, atk: 50, def: 5, atkSpeed: 0.7, range: 50, moveSpeed: 120, type: "melee", color: "#6633aa" },
      { name: "Bayangan", emoji: "🦇", hp: 180, atk: 50, def: 5, atkSpeed: 0.7, range: 50, moveSpeed: 120, type: "melee", color: "#6633aa" },
      { name: "Skeleton", emoji: "💀", hp: 300, atk: 40, def: 10, atkSpeed: 1.1, range: 240, moveSpeed: 50, type: "ranged", color: "#ccccaa" },
      { name: "Skeleton", emoji: "💀", hp: 300, atk: 40, def: 10, atkSpeed: 1.1, range: 240, moveSpeed: 50, type: "ranged", color: "#ccccaa" },
    ],
    reward: 160,
  },
  {
    id: 4, name: "Gunung Api", bg: "#2a1010",
    enemies: [
      { name: "Iblis Api", emoji: "😈", hp: 400, atk: 55, def: 15, atkSpeed: 1.0, range: 50, moveSpeed: 85, type: "melee", color: "#ff6622" },
      { name: "Iblis Api", emoji: "😈", hp: 400, atk: 55, def: 15, atkSpeed: 1.0, range: 50, moveSpeed: 85, type: "melee", color: "#ff6622" },
      { name: "Naga Kecil", emoji: "🐉", hp: 350, atk: 60, def: 12, atkSpeed: 1.3, range: 250, moveSpeed: 55, type: "ranged", color: "#ff4400" },
      { name: "Slime Api", emoji: "🔴", hp: 600, atk: 30, def: 30, atkSpeed: 2.0, range: 50, moveSpeed: 30, type: "melee", color: "#cc2200" },
    ],
    reward: 200,
  },
  {
    id: 5, name: "Pohon Iblis — BOSS", bg: "#0a1a0a",
    enemies: [
      { name: "Pohon Iblis", emoji: "🌳", hp: 2000, atk: 80, def: 35, atkSpeed: 2.0, range: 80, moveSpeed: 25, type: "melee", color: "#336622", isBoss: true },
      { name: "Akar Jahat", emoji: "🌿", hp: 300, atk: 30, def: 10, atkSpeed: 1.2, range: 50, moveSpeed: 60, type: "melee", color: "#447733" },
      { name: "Akar Jahat", emoji: "🌿", hp: 300, atk: 30, def: 10, atkSpeed: 1.2, range: 50, moveSpeed: 60, type: "melee", color: "#447733" },
    ],
    reward: 350,
  },
];


// ===== GAME STATE =====
let state = { gold: 0, maxStage: 1 };
const SAVE_KEY = "heroes_tropis_v1";
let canvas, ctx;
let units = [];       // all active units (heroes + enemies)
let projectiles = []; // active projectiles
let particles = [];   // visual particles
let dmgTexts = [];    // floating damage numbers
let gameSpeed = 1;
let battleActive = false;
let currentStage = null;
let animFrame = null;
let lastTime = 0;

// ===== HELPERS =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const rand = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.abs(a.x - b.x);

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e) {}
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d) { state.gold = d.gold || 0; state.maxStage = d.maxStage || 1; }
  } catch(e) {}
}


// ===== SOUND (Web Audio) =====
let audioCtx = null;
function getAudio() {
  if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  return audioCtx;
}
function sfx(freq, dur, type = "sine", vol = 0.12) {
  const ctx = getAudio(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
}
const SFX = {
  hit: () => sfx(200, 0.08, "square", 0.15),
  skill: () => { sfx(600, 0.1, "sine"); setTimeout(() => sfx(800, 0.12), 50); },
  heal: () => { sfx(500, 0.15, "triangle"); setTimeout(() => sfx(700, 0.1, "triangle"), 80); },
  die: () => sfx(100, 0.2, "sawtooth", 0.18),
  win: () => { sfx(523, 0.12); setTimeout(() => sfx(659, 0.12), 100); setTimeout(() => sfx(784, 0.2), 200); },
  lose: () => { sfx(200, 0.2, "sawtooth"); setTimeout(() => sfx(150, 0.3, "sawtooth"), 150); },
  shoot: () => sfx(900, 0.06, "sine", 0.08),
};


// ===== UNIT FACTORY =====
function createUnit(def, side, index, total) {
  const groundY = CANVAS_H * GROUND_Y;
  const spacing = UNIT_SPACING;
  let x, y;
  if (side === "hero") {
    x = CANVAS_W * HERO_START_X + index * spacing;
    y = groundY - (total - 1 - index) * 12;
  } else {
    x = CANVAS_W * ENEMY_START_X - index * spacing;
    y = groundY - (total - 1 - index) * 12;
  }
  return {
    ...def,
    side,
    x, y,
    maxHp: def.hp,
    atkTimer: 0,
    skillTimer: def.skill ? def.skill.cd * 0.3 : 999, // start partly charged
    stunTimer: 0,
    alive: true,
    flashTimer: 0,
    scale: def.isBoss ? 1.6 : 1.0,
  };
}


// ===== COMBAT AI =====
function getTarget(unit) {
  const enemies = units.filter(u => u.alive && u.side !== unit.side);
  if (enemies.length === 0) return null;
  // target closest
  let closest = null, minD = Infinity;
  for (const e of enemies) {
    const d = dist(unit, e);
    if (d < minD) { minD = d; closest = e; }
  }
  return closest;
}

function updateUnit(unit, dt) {
  if (!unit.alive) return;
  // Stun
  if (unit.stunTimer > 0) { unit.stunTimer -= dt; return; }
  // Skill cooldown
  if (unit.skill) unit.skillTimer -= dt;
  // Attack cooldown
  unit.atkTimer -= dt;
  // Flash decay
  if (unit.flashTimer > 0) unit.flashTimer -= dt;

  const target = getTarget(unit);
  if (!target) return;

  const d = dist(unit, target);
  const inRange = d <= unit.range + 20;

  // Move toward target if not in range
  if (!inRange) {
    const dir = unit.side === "hero" ? 1 : -1;
    unit.x += dir * unit.moveSpeed * dt;
    // Don't overshoot
    if (unit.side === "hero" && unit.x > target.x - unit.range) {
      unit.x = target.x - unit.range;
    }
    if (unit.side === "enemy" && unit.x < target.x + unit.range) {
      unit.x = target.x + unit.range;
    }
    return;
  }

  // In range — try skill first, then basic attack
  if (unit.skill && unit.skillTimer <= 0 && unit.side === "hero") {
    // Heroes only auto-cast if AI (we use manual skill for player)
    // skip auto-cast; player controls skill
  } else if (unit.skill && unit.skillTimer <= 0 && unit.side === "enemy") {
    useSkill(unit);
  }

  // Basic attack
  if (unit.atkTimer <= 0) {
    basicAttack(unit, target);
    unit.atkTimer = unit.atkSpeed;
  }
}

function basicAttack(attacker, target) {
  if (attacker.type === "ranged" || attacker.type === "support") {
    // Fire projectile
    projectiles.push({
      x: attacker.x, y: attacker.y - 20,
      tx: target.x, ty: target.y - 20,
      speed: 500,
      dmg: calcDmg(attacker.atk, target.def),
      target,
      side: attacker.side,
      color: attacker.color,
      emoji: attacker.type === "support" ? "✦" : "•",
    });
    SFX.shoot();
  } else {
    // Melee instant hit
    dealDamage(target, calcDmg(attacker.atk, target.def));
    SFX.hit();
    // Slash particle
    spawnParticle(target.x, target.y - 25, "slash");
  }
}

function calcDmg(atk, def) {
  const base = Math.max(1, atk - def * 0.4);
  return Math.round(base * rand(0.85, 1.15));
}


// ===== SKILL SYSTEM =====
function useSkill(unit) {
  if (!unit.skill || unit.skillTimer > 0) return;
  unit.skillTimer = unit.skill.cd;
  const sk = unit.skill;
  SFX.skill();

  if (sk.effect === "stun") {
    const target = getTarget(unit);
    if (target) {
      dealDamage(target, sk.dmg);
      target.stunTimer = sk.dur;
      spawnParticle(target.x, target.y - 30, "stun");
      spawnDmgText(target.x, target.y - 40, "STUN!", "#ffff00");
    }
  } else if (sk.effect === "aoe") {
    const enemies = units.filter(u => u.alive && u.side !== unit.side);
    const center = unit.x + (unit.side === "hero" ? 100 : -100);
    for (const e of enemies) {
      if (Math.abs(e.x - center) <= sk.area) {
        dealDamage(e, Math.round(sk.dmg * rand(0.9, 1.1)));
        spawnParticle(e.x, e.y - 25, "explosion");
      }
    }
    spawnParticle(center, unit.y - 30, "explosion");
  } else if (sk.effect === "multi") {
    const enemies = units.filter(u => u.alive && u.side !== unit.side);
    const targets = [];
    for (let i = 0; i < (sk.hits || 3); i++) {
      if (enemies.length > 0) targets.push(enemies[randInt(0, enemies.length - 1)]);
    }
    for (const t of targets) {
      projectiles.push({
        x: unit.x, y: unit.y - 20,
        tx: t.x + rand(-10, 10), ty: t.y - 20,
        speed: 600, dmg: sk.dmg, target: t,
        side: unit.side, color: "#88ff44", emoji: "→",
      });
    }
  } else if (sk.effect === "heal") {
    const allies = units.filter(u => u.alive && u.side === unit.side);
    for (const a of allies) {
      const heal = Math.min(sk.healAmt, a.maxHp - a.hp);
      a.hp += heal;
      if (heal > 0) {
        spawnDmgText(a.x, a.y - 50, `+${heal}`, "#44ffaa");
        spawnParticle(a.x, a.y - 25, "heal");
      }
    }
    SFX.heal();
  }
}

function dealDamage(target, dmg) {
  if (!target.alive) return;
  target.hp -= dmg;
  target.flashTimer = 0.12;
  spawnDmgText(target.x + rand(-10, 10), target.y - 50, dmg.toString(), "#ff4444");
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    SFX.die();
    // Death particles
    for (let i = 0; i < 6; i++) {
      spawnParticle(target.x + rand(-15, 15), target.y - rand(10, 40), "death");
    }
  }
}


// ===== PROJECTILES =====
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 10) {
      // Hit
      if (p.target && p.target.alive) {
        dealDamage(p.target, p.dmg);
        SFX.hit();
        spawnParticle(p.target.x, p.target.y - 25, "hit");
      }
      projectiles.splice(i, 1);
      continue;
    }
    const speed = p.speed * dt;
    p.x += (dx / d) * speed;
    p.y += (dy / d) * speed;
  }
}

// ===== PARTICLES & DAMAGE TEXT =====
function spawnParticle(x, y, type) {
  particles.push({ x, y, type, life: 0.4, maxLife: 0.4, vx: rand(-30, 30), vy: rand(-50, -10) });
}
function spawnDmgText(x, y, text, color) {
  dmgTexts.push({ x, y, text, color, life: 0.9, maxLife: 0.9, vy: -60 });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = dmgTexts.length - 1; i >= 0; i--) {
    const d = dmgTexts[i];
    d.life -= dt;
    d.y += d.vy * dt;
    if (d.life <= 0) dmgTexts.splice(i, 1);
  }
}


// ===== RENDERING =====
function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background gradient
  const grd = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grd.addColorStop(0, "#1a2a3a");
  grd.addColorStop(0.5, "#2d1f3d");
  grd.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Ground
  const gy = CANVAS_H * GROUND_Y + 20;
  ctx.fillStyle = "rgba(30,20,10,0.6)";
  ctx.fillRect(0, gy, CANVAS_W, CANVAS_H - gy);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CANVAS_W, gy); ctx.stroke();

  // Units
  for (const u of units) {
    if (!u.alive) continue;
    renderUnit(u);
  }

  // Projectiles
  for (const p of projectiles) {
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Particles
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.type === "slash") {
      ctx.fillStyle = "#ffffff";
      ctx.font = "18px sans-serif";
      ctx.fillText("✦", p.x, p.y);
    } else if (p.type === "explosion") {
      ctx.fillStyle = "#ff6600";
      ctx.beginPath(); ctx.arc(p.x, p.y, 12 * (1 - alpha) + 4, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === "heal") {
      ctx.fillStyle = "#44ffaa";
      ctx.font = "14px sans-serif";
      ctx.fillText("✚", p.x, p.y);
    } else if (p.type === "stun") {
      ctx.fillStyle = "#ffff00";
      ctx.font = "16px sans-serif";
      ctx.fillText("⚡", p.x, p.y);
    } else if (p.type === "hit") {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(p.x, p.y, 6 * (1 - alpha), 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = "#aaaaaa";
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Damage texts
  for (const d of dmgTexts) {
    const alpha = d.life / d.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = d.color;
    ctx.font = `bold ${14 + (1 - alpha) * 6}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(d.text, d.x, d.y);
    ctx.restore();
  }
}


function renderUnit(u) {
  ctx.save();
  const bx = u.x;
  const by = u.y;
  const s = u.scale || 1;

  // Flash white on hit
  if (u.flashTimer > 0) {
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 20;
  }

  // Body circle
  const radius = 18 * s;
  ctx.fillStyle = u.color;
  ctx.beginPath();
  ctx.arc(bx, by - radius, radius, 0, Math.PI * 2);
  ctx.fill();

  // Emoji face
  ctx.font = `${Math.round(22 * s)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(u.emoji, bx, by - radius);

  // HP bar
  const barW = 40 * s;
  const barH = 5;
  const barX = bx - barW / 2;
  const barY = by - radius * 2 - 12;
  const hpRatio = u.hp / u.maxHp;
  // Background
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(barX, barY, barW, barH);
  // Fill
  ctx.fillStyle = hpRatio > 0.5 ? "#44dd44" : hpRatio > 0.25 ? "#ddaa00" : "#dd2222";
  ctx.fillRect(barX, barY, barW * hpRatio, barH);
  // Border
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.strokeRect(barX, barY, barW, barH);

  // Stun indicator
  if (u.stunTimer > 0) {
    ctx.font = "14px sans-serif";
    ctx.fillText("💫", bx, barY - 8);
  }

  // Name tag (only for bosses)
  if (u.isBoss) {
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#ff8844";
    ctx.fillText(u.name, bx, barY - 12);
  }

  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(bx, by + 5, radius * 0.8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}


// ===== SKILL BAR UI =====
function renderSkillBar() {
  const bar = $("#skillBar");
  bar.innerHTML = "";
  const heroes = units.filter(u => u.side === "hero" && u.alive && u.skill);
  heroes.forEach((h, i) => {
    const slot = document.createElement("div");
    slot.className = "skill-slot";
    const cdRatio = h.skillTimer > 0 ? h.skillTimer / h.skill.cd : 0;
    if (cdRatio > 0) slot.classList.add("on-cooldown");
    slot.innerHTML = `
      <span>${h.skill.emoji}</span>
      <div class="skill-cooldown" style="height:${cdRatio * 100}%"></div>
      <span class="skill-key">${i + 1}</span>
    `;
    slot.title = `${h.name}: ${h.skill.name}`;
    slot.addEventListener("click", () => {
      if (h.skillTimer <= 0 && h.alive) useSkill(h);
    });
    bar.appendChild(slot);
  });
}

// ===== BATTLE LOOP =====
function battleLoop(time) {
  if (!battleActive) return;
  const rawDt = (time - lastTime) / 1000;
  lastTime = time;
  const dt = Math.min(rawDt, 0.1) * gameSpeed;

  // Update units
  for (const u of units) updateUnit(u, dt);
  updateProjectiles(dt);
  updateParticles(dt);

  // Render
  render();

  // Update skill bar every few frames
  if (Math.floor(time / 200) !== Math.floor((time - rawDt * 1000) / 200)) {
    renderSkillBar();
  }

  // Check win/loss
  const heroesAlive = units.filter(u => u.side === "hero" && u.alive).length;
  const enemiesAlive = units.filter(u => u.side === "enemy" && u.alive).length;

  if (enemiesAlive === 0) {
    endBattle(true);
    return;
  }
  if (heroesAlive === 0) {
    endBattle(false);
    return;
  }

  animFrame = requestAnimationFrame(battleLoop);
}

function startBattle(stageId) {
  currentStage = STAGES.find(s => s.id === stageId);
  if (!currentStage) return;

  // Setup units
  units = [];
  projectiles = [];
  particles = [];
  dmgTexts = [];

  // Heroes
  HEROES.forEach((h, i) => {
    units.push(createUnit({ ...h }, "hero", i, HEROES.length));
  });
  // Enemies
  currentStage.enemies.forEach((e, i) => {
    units.push(createUnit({ ...e, skill: null }, "enemy", i, currentStage.enemies.length));
  });

  // Show battle screen
  $("#stageSelect").classList.add("hidden");
  $("#battleScreen").classList.remove("hidden");
  $("#stageTitle").textContent = `Stage ${currentStage.id}: ${currentStage.name}`;

  // Resize canvas
  resizeCanvas();
  renderSkillBar();

  battleActive = true;
  lastTime = performance.now();
  animFrame = requestAnimationFrame(battleLoop);
}

function endBattle(won) {
  battleActive = false;
  if (animFrame) cancelAnimationFrame(animFrame);

  if (won) {
    SFX.win();
    state.gold += currentStage.reward;
    if (currentStage.id >= state.maxStage) {
      state.maxStage = Math.min(STAGES.length, currentStage.id + 1);
    }
    save();
    showResult(true, currentStage.reward);
  } else {
    SFX.lose();
    showResult(false, 0);
  }
}

function showResult(won, reward) {
  $("#resultIcon").textContent = won ? "🏆" : "💀";
  $("#resultTitle").textContent = won ? "Kemenangan!" : "Kalah...";
  $("#resultText").textContent = won ? `+${reward} 💰` : "Coba lagi!";
  $("#resultModal").classList.remove("hidden");
}


// ===== STAGE SELECT UI =====
function renderStageSelect() {
  $("#goldDisplay").textContent = state.gold;
  const list = $("#stageList");
  list.innerHTML = "";
  STAGES.forEach(s => {
    const unlocked = s.id <= state.maxStage;
    const card = document.createElement("div");
    card.className = `stage-card ${unlocked ? "" : "locked"}`;
    card.innerHTML = `
      <div class="stage-num">${unlocked ? s.id : "🔒"}</div>
      <div class="stage-label">${unlocked ? s.name : "???"}</div>
    `;
    if (unlocked) card.addEventListener("click", () => startBattle(s.id));
    list.appendChild(card);
  });
}

// ===== CANVAS RESIZE =====
function resizeCanvas() {
  canvas = $("#battleCanvas");
  ctx = canvas.getContext("2d");
  // Fit to container but keep aspect
  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = container.clientHeight - 130; // minus hud + skillbar
  const scale = Math.min(w / CANVAS_W, h / CANVAS_H, 2);
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.width = (CANVAS_W * scale) + "px";
  canvas.style.height = (CANVAS_H * scale) + "px";
  canvas.style.margin = "auto";
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener("keydown", (e) => {
  if (!battleActive) return;
  const num = parseInt(e.key);
  if (num >= 1 && num <= 5) {
    const heroes = units.filter(u => u.side === "hero" && u.alive && u.skill);
    const h = heroes[num - 1];
    if (h && h.skillTimer <= 0) useSkill(h);
  }
});

// ===== SPEED CONTROLS =====
function setupSpeedControls() {
  $$(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".speed-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      gameSpeed = parseInt(btn.dataset.speed);
    });
  });
}

// ===== INIT =====
function init() {
  load();
  canvas = $("#battleCanvas");
  ctx = canvas.getContext("2d");

  // Splash
  $("#btnPlay").addEventListener("click", () => {
    getAudio(); // unlock audio on gesture
    $("#splash").classList.add("hidden");
    $("#stageSelect").classList.remove("hidden");
    renderStageSelect();
  });

  // Result modal
  $("#btnNext").addEventListener("click", () => {
    $("#resultModal").classList.add("hidden");
    $("#battleScreen").classList.add("hidden");
    $("#stageSelect").classList.remove("hidden");
    renderStageSelect();
  });

  setupSpeedControls();
  window.addEventListener("resize", () => { if (battleActive) resizeCanvas(); });
}

document.addEventListener("DOMContentLoaded", init);
