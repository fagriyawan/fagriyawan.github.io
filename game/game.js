/* =============================================================
   Kebun Tropis — Farming Game Logic
   Tema: Kebun tropis Indonesia (mangga, rambutan, durian, kelapa)
   Save: localStorage
   ============================================================= */

// ---------- Konfigurasi tanaman ----------
// growTime dalam detik. Tahap pertumbuhan: seed -> sapling -> young -> ripe
const PLANTS = {
  cabai: {
    name: "Cabai", emoji: "🌶️", seedCost: 3, sellPrice: 8, growTime: 15,
    xp: 5, unlockLevel: 1,
    stages: ["🌱", "🌿", "🪴", "🌶️"],
  },
  mangga: {
    name: "Mangga", emoji: "🥭", seedCost: 8, sellPrice: 22, growTime: 30,
    xp: 12, unlockLevel: 1,
    stages: ["🌱", "🌿", "🌳", "🥭"],
  },
  rambutan: {
    name: "Rambutan", emoji: "🍒", seedCost: 18, sellPrice: 55, growTime: 60,
    xp: 25, unlockLevel: 2,
    stages: ["🌱", "🌿", "🌳", "🍒"],
  },
  kelapa: {
    name: "Kelapa", emoji: "🥥", seedCost: 35, sellPrice: 110, growTime: 90,
    xp: 50, unlockLevel: 4,
    stages: ["🌱", "🌿", "🌴", "🥥"],
  },
  durian: {
    name: "Durian", emoji: "🥝", seedCost: 70, sellPrice: 220, growTime: 150,
    xp: 100, unlockLevel: 6,
    stages: ["🌱", "🌿", "🌳", "🥝"],
  },
};

const GRID_SIZE = 6; // 6x6 = 36 petak
const XP_PER_LEVEL = (lv) => Math.floor(50 * Math.pow(1.4, lv - 1));

// ---------- Quest templates ----------
const QUEST_POOL = [
  { id: "harvest_any", desc: (n) => `Panen ${n} buah apa saja`, target: () => rand(3, 8), reward: () => rand(20, 50), xp: () => rand(10, 30), kind: "harvest_any" },
  { id: "harvest_mangga", desc: (n) => `Panen ${n} mangga 🥭`, target: () => rand(2, 5), reward: () => rand(30, 70), xp: () => rand(15, 35), kind: "harvest", item: "mangga" },
  { id: "plant_any", desc: (n) => `Tanam ${n} bibit`, target: () => rand(3, 6), reward: () => rand(15, 40), xp: () => rand(8, 20), kind: "plant_any" },
  { id: "earn_coins", desc: (n) => `Hasilkan ${n} 💰 dari panen`, target: () => rand(50, 200), reward: () => rand(40, 90), xp: () => rand(20, 50), kind: "earn_coins" },
  { id: "harvest_cabai", desc: (n) => `Panen ${n} cabai 🌶️`, target: () => rand(5, 12), reward: () => rand(20, 50), xp: () => rand(10, 25), kind: "harvest", item: "cabai" },
];

// ---------- State ----------
const STATE_KEY = "kebun_tropis_save_v1";
let state = null;
let selectedSeed = "cabai";
let soundOn = true;
let lastSave = 0;

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const now = () => Date.now();

function defaultState() {
  return {
    coins: 25,
    xp: 0,
    level: 1,
    farm: Array.from({ length: GRID_SIZE * GRID_SIZE }, () => ({
      plant: null,        // key di PLANTS
      plantedAt: null,    // timestamp ms
      stage: 0,           // 0..3
    })),
    inventory: {},        // { mangga: 3, rambutan: 1, ... }
    quests: [],           // { id, desc, target, progress, reward, xp, kind, item, done }
    stats: {
      totalHarvests: 0,
      totalCoinsEarned: 0,
      totalPlants: 0,
    },
    createdAt: now(),
  };
}

// ---------- Save / Load ----------
function save() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    lastSave = now();
  } catch (e) {
    console.warn("Save gagal:", e);
  }
}
function load() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function resetSave() {
  localStorage.removeItem(STATE_KEY);
  state = defaultState();
  ensureQuests();
  save();
}

// ---------- Sound (Web Audio, no files) ----------
let audioCtx = null;
function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
  return audioCtx;
}
function beep(freq = 440, dur = 0.12, type = "sine", vol = 0.18) {
  if (!soundOn) return;
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}
const SFX = {
  plant:   () => beep(380, 0.1, "triangle"),
  harvest: () => { beep(660, 0.08); setTimeout(() => beep(880, 0.12), 60); },
  buy:     () => beep(520, 0.06, "square", 0.1),
  reject:  () => beep(140, 0.15, "sawtooth", 0.15),
  level:   () => { beep(523, 0.12); setTimeout(() => beep(659, 0.12), 100); setTimeout(() => beep(784, 0.18), 200); },
  quest:   () => { beep(700, 0.1); setTimeout(() => beep(900, 0.15), 90); },
};

// ---------- Toast ----------
let toastTimer = null;
function toast(msg, kind = "") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

// ---------- Stage compute ----------
function computeStage(tile) {
  if (!tile.plant) return 0;
  const p = PLANTS[tile.plant];
  const elapsed = (now() - tile.plantedAt) / 1000;
  const ratio = Math.min(1, elapsed / p.growTime);
  if (ratio >= 1) return 3;        // ripe
  if (ratio >= 0.66) return 2;     // young tree
  if (ratio >= 0.33) return 1;     // sapling
  return 0;                        // seed
}

// ---------- Render: stats ----------
function renderStats() {
  $("#coins").textContent = state.coins.toLocaleString("id-ID");
  $("#level").textContent = state.level;
  const need = XP_PER_LEVEL(state.level);
  const pct = Math.min(100, (state.xp / need) * 100);
  $("#xpFill").style.width = pct + "%";
  $("#xpText").textContent = `${state.xp}/${need}`;
}

// ---------- Render: seeds ----------
function renderSeeds() {
  const list = $("#seedList");
  list.innerHTML = "";
  Object.entries(PLANTS).forEach(([key, p]) => {
    const locked = state.level < p.unlockLevel;
    const sel = key === selectedSeed && !locked;
    const el = document.createElement("div");
    el.className = `seed ${sel ? "selected" : ""} ${locked ? "locked" : ""}`;
    el.innerHTML = `
      <div class="seed-emoji">${locked ? "🔒" : p.emoji}</div>
      <div class="seed-info">
        <div class="seed-name">${p.name}</div>
        <div class="seed-meta">${locked ? `Buka di Lv ${p.unlockLevel}` : `${p.growTime}s · jual ${p.sellPrice}💰`}</div>
      </div>
      <div class="seed-cost">${locked ? "" : p.seedCost + "💰"}</div>
    `;
    if (!locked) el.addEventListener("click", () => {
      selectedSeed = key;
      renderSeeds();
      toast(`${p.emoji} ${p.name} dipilih`, "");
    });
    list.appendChild(el);
  });
}

// ---------- Render: farm ----------
function renderFarm() {
  const farm = $("#farm");
  // First time build
  if (farm.children.length !== state.farm.length) {
    farm.innerHTML = "";
    state.farm.forEach((_, i) => {
      const tile = document.createElement("div");
      tile.className = "tile empty";
      tile.dataset.idx = i;
      tile.addEventListener("click", () => onTileClick(i));
      farm.appendChild(tile);
    });
  }
  // Update each tile
  state.farm.forEach((cell, i) => {
    const tileEl = farm.children[i];
    if (!cell.plant) {
      tileEl.className = "tile empty";
      tileEl.innerHTML = "";
      return;
    }
    const p = PLANTS[cell.plant];
    const stage = computeStage(cell);
    cell.stage = stage;
    const ready = stage === 3;
    const elapsed = (now() - cell.plantedAt) / 1000;
    const pct = Math.min(100, (elapsed / p.growTime) * 100);

    tileEl.className = `tile planted ${ready ? "ready" : ""}`;
    tileEl.innerHTML = `
      <div class="tile-plant">${p.stages[stage]}</div>
      ${!ready ? `<div class="tile-progress"><div class="tile-progress-fill" style="width:${pct}%"></div></div>` : ""}
    `;
  });
}

// ---------- Render: inventory ----------
function renderInventory() {
  const inv = $("#inventory");
  inv.innerHTML = "";
  const keys = Object.keys(state.inventory).filter(k => state.inventory[k] > 0);
  if (keys.length === 0) {
    inv.innerHTML = `<div class="muted small" style="grid-column: 1/-1; text-align:center; padding: .5rem;">Tas masih kosong 🌾</div>`;
    return;
  }
  keys.forEach(k => {
    const p = PLANTS[k];
    if (!p) return;
    const count = state.inventory[k];
    const el = document.createElement("div");
    el.className = "inv-slot";
    el.innerHTML = `
      <div class="inv-emoji">${p.emoji}</div>
      <div class="inv-info">
        <div class="inv-count">${count}</div>
        <div class="inv-value">${count * p.sellPrice}💰</div>
      </div>
    `;
    inv.appendChild(el);
  });
}

// ---------- Render: quests ----------
function renderQuests() {
  const list = $("#questList");
  list.innerHTML = "";
  if (!state.quests || state.quests.length === 0) {
    list.innerHTML = `<div class="muted small">Tidak ada misi aktif</div>`;
    return;
  }
  state.quests.forEach(q => {
    const pct = Math.min(100, (q.progress / q.target) * 100);
    const el = document.createElement("div");
    el.className = `quest ${q.done ? "done" : ""}`;
    el.innerHTML = `
      <div class="quest-desc">${q.desc}</div>
      <div class="quest-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <span>${q.progress}/${q.target}</span>
        <span class="quest-reward">+${q.reward}💰</span>
      </div>
    `;
    list.appendChild(el);
  });
}

function renderAll() {
  renderStats();
  renderSeeds();
  renderFarm();
  renderInventory();
  renderQuests();
}

// ---------- Tile interaction ----------
function onTileClick(i) {
  const cell = state.farm[i];
  // 1. Empty tile -> plant
  if (!cell.plant) {
    plantSeed(i);
    return;
  }
  // 2. Ripe -> harvest
  if (computeStage(cell) === 3) {
    harvest(i);
    return;
  }
  // 3. Otherwise: nothing (could show info)
  toast("Masih tumbuh 🌿", "warn");
}

function plantSeed(i) {
  const p = PLANTS[selectedSeed];
  if (!p) return;
  if (state.level < p.unlockLevel) {
    toast(`Buka di Level ${p.unlockLevel}`, "warn");
    SFX.reject();
    return;
  }
  if (state.coins < p.seedCost) {
    toast("Koin kurang 💸", "error");
    SFX.reject();
    return;
  }
  state.coins -= p.seedCost;
  state.farm[i] = { plant: selectedSeed, plantedAt: now(), stage: 0 };
  state.stats.totalPlants++;
  SFX.plant();
  spawnParticle(i, p.stages[0]);
  trackQuest({ kind: "plant_any", amount: 1 });
  trackQuest({ kind: "plant", item: selectedSeed, amount: 1 });
  renderAll();
  save();
}

function harvest(i) {
  const cell = state.farm[i];
  if (!cell.plant) return;
  const p = PLANTS[cell.plant];
  const item = cell.plant;

  // Add to inventory
  state.inventory[item] = (state.inventory[item] || 0) + 1;
  state.stats.totalHarvests++;
  // XP
  addXP(p.xp);

  // Reset tile
  state.farm[i] = { plant: null, plantedAt: null, stage: 0 };

  SFX.harvest();
  spawnParticle(i, p.emoji);

  trackQuest({ kind: "harvest_any", amount: 1 });
  trackQuest({ kind: "harvest", item, amount: 1 });

  renderAll();
  save();
}

// ---------- XP / Level ----------
function addXP(amount) {
  state.xp += amount;
  let leveled = false;
  while (state.xp >= XP_PER_LEVEL(state.level)) {
    state.xp -= XP_PER_LEVEL(state.level);
    state.level++;
    leveled = true;
  }
  if (leveled) {
    SFX.level();
    toast(`🎉 Naik ke Level ${state.level}!`, "success");
    // Check newly unlocked plants
    const newlyUnlocked = Object.values(PLANTS).filter(p => p.unlockLevel === state.level);
    if (newlyUnlocked.length) {
      setTimeout(() => {
        toast(`🔓 Bibit baru: ${newlyUnlocked.map(p => p.emoji + p.name).join(", ")}`, "success");
      }, 1200);
    }
  }
}

// ---------- Quests ----------
function ensureQuests() {
  if (!state.quests) state.quests = [];
  // Refill to 3 active quests
  while (state.quests.filter(q => !q.done).length < 3) {
    state.quests.push(makeQuest());
  }
  // Cap stored quest count
  if (state.quests.length > 6) {
    state.quests = state.quests.slice(-6);
  }
}
function makeQuest() {
  const tmpl = QUEST_POOL[rand(0, QUEST_POOL.length - 1)];
  const target = tmpl.target();
  return {
    id: tmpl.id + "_" + now() + "_" + rand(0, 9999),
    desc: tmpl.desc(target),
    target,
    progress: 0,
    reward: tmpl.reward(),
    xp: tmpl.xp(),
    kind: tmpl.kind,
    item: tmpl.item || null,
    done: false,
  };
}

function trackQuest({ kind, item, amount = 1, coins = 0 }) {
  let updated = false;
  state.quests.forEach(q => {
    if (q.done) return;
    let inc = 0;
    if (q.kind === "harvest_any" && kind === "harvest_any") inc = amount;
    else if (q.kind === "plant_any" && kind === "plant_any") inc = amount;
    else if (q.kind === "harvest" && kind === "harvest" && q.item === item) inc = amount;
    else if (q.kind === "plant" && kind === "plant" && q.item === item) inc = amount;
    else if (q.kind === "earn_coins" && kind === "earn_coins") inc = coins;

    if (inc > 0) {
      q.progress = Math.min(q.target, q.progress + inc);
      updated = true;
      if (q.progress >= q.target) {
        q.done = true;
        state.coins += q.reward;
        addXP(q.xp);
        SFX.quest();
        toast(`✅ Misi selesai! +${q.reward}💰 +${q.xp}XP`, "success");
        // Replace quest after short delay
        setTimeout(() => {
          state.quests = state.quests.filter(qq => qq.id !== q.id);
          ensureQuests();
          renderQuests();
          save();
        }, 1500);
      }
    }
  });
  if (updated) renderQuests();
}

// ---------- Sell all ----------
function sellAll() {
  let total = 0;
  let count = 0;
  Object.entries(state.inventory).forEach(([k, n]) => {
    if (n > 0 && PLANTS[k]) {
      total += n * PLANTS[k].sellPrice;
      count += n;
      state.inventory[k] = 0;
    }
  });
  if (total === 0) {
    toast("Tas kosong 🌾", "warn");
    SFX.reject();
    return;
  }
  state.coins += total;
  state.stats.totalCoinsEarned += total;
  SFX.buy();
  toast(`💰 +${total} dari ${count} buah`, "success");
  spawnCoinFly(total);
  trackQuest({ kind: "earn_coins", coins: total });
  renderAll();
  save();
}

// ---------- Particle effects ----------
function spawnParticle(tileIndex, emoji) {
  const tileEl = $("#farm").children[tileIndex];
  if (!tileEl) return;
  const part = document.createElement("div");
  part.className = "particle";
  part.textContent = emoji;
  part.style.setProperty("--dx", (rand(-20, 20)) + "px");
  tileEl.appendChild(part);
  setTimeout(() => part.remove(), 800);
}

function spawnCoinFly(amount) {
  // Emit a few coins flying from inventory toward coin counter
  const start = $("#btnSellAll").getBoundingClientRect();
  const target = $("#coins").getBoundingClientRect();
  const num = Math.min(8, Math.max(3, Math.floor(amount / 30)));
  for (let i = 0; i < num; i++) {
    setTimeout(() => {
      const c = document.createElement("div");
      c.className = "coin-fly";
      c.textContent = "💰";
      c.style.left = (start.left + start.width / 2) + "px";
      c.style.top = (start.top - 10) + "px";
      c.style.setProperty("--cx", (target.left - start.left) + "px");
      c.style.setProperty("--cy", (target.top - start.top - 30) + "px");
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 900);
    }, i * 80);
  }
}

// ---------- Mobile dock tabs ----------
function setupDock() {
  const tabs = {
    farm:   () => { $(".farm-wrap").classList.remove("hide"); $(".panel-left").classList.remove("show"); $(".panel-right").classList.remove("show"); },
    seeds:  () => { $(".farm-wrap").classList.add("hide");    $(".panel-left").classList.add("show");    $(".panel-right").classList.remove("show"); },
    quests: () => { $(".farm-wrap").classList.add("hide");    $(".panel-left").classList.add("show");    $(".panel-right").classList.remove("show"); },
    inv:    () => { $(".farm-wrap").classList.add("hide");    $(".panel-left").classList.remove("show"); $(".panel-right").classList.add("show"); },
  };
  $$(".dock-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".dock-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      tabs[tab] && tabs[tab]();
    });
  });
}

// ---------- Game loop ----------
function tick() {
  // Re-render farm to update growth stages every second
  renderFarm();
  // Save every 10s
  if (now() - lastSave > 10000) save();
}

// ---------- Boot ----------
function startGame() {
  $("#splash").classList.add("hidden");
  $("#game").classList.remove("hidden");
  // Resume audio context after user gesture
  getCtx();
}

function init() {
  // Load or default
  state = load() || defaultState();
  // Migrate / repair
  if (!state.farm) state = defaultState();
  if (!state.inventory) state.inventory = {};
  if (!state.stats) state.stats = { totalHarvests: 0, totalCoinsEarned: 0, totalPlants: 0 };
  ensureQuests();
  save();

  renderAll();

  // Splash buttons
  $("#btnStart").addEventListener("click", startGame);
  $("#btnReset").addEventListener("click", () => {
    if (confirm("Yakin reset save? Progress akan hilang.")) {
      resetSave();
      renderAll();
      toast("Save direset 🌱", "success");
    }
  });

  // Menu modal
  $("#btnMenu").addEventListener("click", () => $("#menuModal").classList.remove("hidden"));
  $("#btnResume").addEventListener("click", () => $("#menuModal").classList.add("hidden"));
  $("#btnHardReset").addEventListener("click", () => {
    if (confirm("Yakin reset semua progress?")) {
      resetSave();
      renderAll();
      $("#menuModal").classList.add("hidden");
      toast("Game direset 🌱", "success");
    }
  });
  $("#btnSound").addEventListener("click", () => {
    soundOn = !soundOn;
    $("#btnSound").textContent = `🔊 Suara: ${soundOn ? "ON" : "OFF"}`;
  });

  // Sell button
  $("#btnSellAll").addEventListener("click", sellAll);

  setupDock();

  // Game loop
  setInterval(tick, 1000);

  // Save on tab close
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
}

document.addEventListener("DOMContentLoaded", init);
