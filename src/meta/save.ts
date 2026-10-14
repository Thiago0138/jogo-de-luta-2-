// ─────────────────────────────────────────────────────────────────────────────
//  Persistent player state + all economy / progression rules.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Appearance, CHALLENGES, CHEST, CHEST_GUARANTEE, CONSUMABLES, DAILY_POOL, EventKey, ITEM, ITEMS, LEVEL_REWARDS,
  MAX_LEVEL, MissionDef, RARITIES, RARITY, Rarity, Reward, STATS, STAT_BASE, STAT_POINTS_PER_LEVEL, StatKey,
  WEEKLY_BONUS, WEEKLY_POOL, xpToNext,
} from './data';

export interface OwnedItem { uid: string; id: string; serial: number; at: number; src: string }
export interface MissionState { id: string; progress: number; claimed: boolean }
export interface Settings { quality: 'auto' | 'low' | 'medium' | 'high'; sfx: number; music: number; vibrate: boolean; dmgNumbers: boolean; speed: number }
export interface Loadout { specials: (string | null)[]; super: string | null; passives: (string | null)[]; items: (string | null)[] }

export interface SaveData {
  v: number;
  created: boolean;
  fighter: Appearance;
  level: number;
  xp: number;
  statPoints: number;
  stats: Record<StatKey, number>;
  coins: number;
  gems: number;
  inventory: OwnedItem[];
  consumables: Record<string, number>;
  chests: Record<string, number>;
  loadout: Loadout;
  daily: { key: string; list: MissionState[] };
  weekly: { key: string; list: MissionState[]; bonusClaimed: boolean };
  challenges: Record<string, { progress: number; claimed: boolean }>;
  totals: Partial<Record<EventKey, number>> & { fights?: number; losses?: number };
  streak: number;
  bestStreak: number;
  seenPatch: string;
  settings: Settings;
  tradeRedeemed: string[];
  shop: { day: string; bought: string[] };
  partner: number;
  lastLogin: string;
  loginStreak: number;
}

const KEY = 'ringue-lendas-save-v1';

export const defaultAppearance = (): Appearance => ({
  name: 'Novato', skinTone: 2, height: 1, build: 1, eyes: 1, eyeColor: 0, brows: 0, mouth: 0, beard: 0,
  hair: 'curto', hairColor: 1, skin: 'sk_classico',
});

function emptyStats(): Record<StatKey, number> {
  return Object.fromEntries(STATS.map((s) => [s.key, 0])) as Record<StatKey, number>;
}

function fresh(): SaveData {
  return {
    v: 1, created: false, fighter: defaultAppearance(), level: 1, xp: 0, statPoints: 3, stats: emptyStats(),
    coins: 500, gems: 60,
    inventory: [], consumables: { c_vida: 3, c_energia: 1 }, chests: { ch_madeira: 1, ch_prata: 1 },
    loadout: { specials: ['sp_abraco', null], super: 'su_bomba', passives: [null, null], items: ['c_vida', 'c_energia'] },
    daily: { key: '', list: [] }, weekly: { key: '', list: [], bonusClaimed: false }, challenges: {}, totals: {},
    streak: 0, bestStreak: 0, seenPatch: '', tradeRedeemed: [], shop: { day: '', bought: [] }, partner: 0,
    settings: { quality: 'auto', sfx: 0.8, music: 0.5, vibrate: true, dmgNumbers: true, speed: 1 },
    lastLogin: '', loginStreak: 0,
  };
}

// initialised at the bottom of the module (helpers below must exist first)
export let save: SaveData;

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveData;
      const base = fresh();
      // shallow-merge to survive future additions
      const merged = { ...base, ...data, settings: { ...base.settings, ...data.settings }, stats: { ...base.stats, ...data.stats }, loadout: { ...base.loadout, ...data.loadout } };
      return merged;
    }
  } catch { /* corrupted or unavailable storage */ }
  const s = fresh();
  grantStarter(s);
  return s;
}

function grantStarter(s: SaveData) {
  for (const it of ITEMS) if (it.source.includes('starter')) addItemTo(s, it.id, 'starter');
}

let saveTimer = 0;
export function persist(now = false) {
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* quota / private mode */ } };
  if (now) { write(); return; }
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(write, 250);
}

export function resetSave() {
  save = fresh();
  grantStarter(save);
  persist(true);
}

// ── listeners (UI refresh on currency/state changes) ─────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();
export const onChange = (fn: Listener) => { listeners.add(fn); return () => listeners.delete(fn); };
export const emitChange = () => { persist(); listeners.forEach((l) => l()); };

// ── RNG helpers ──────────────────────────────────────────────────────────────
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ── Items ────────────────────────────────────────────────────────────────────
function rollSerial(r: Rarity) {
  const mint = RARITY[r].mint;
  // low serials are rarer: bias toward high numbers
  return Math.max(1, Math.floor(mint * Math.pow(Math.random(), 0.45)));
}

function addItemTo(s: SaveData, id: string, src: string): OwnedItem {
  const def = ITEM[id];
  const it: OwnedItem = { uid: uid(), id, serial: rollSerial(def.rarity), at: Date.now(), src };
  s.inventory.push(it);
  return it;
}
export const addItem = (id: string, src: string) => addItemTo(save, id, src);
export const owns = (id: string) => save.inventory.some((i) => i.id === id);
export const countOwned = (id: string) => save.inventory.reduce((n, i) => n + (i.id === id ? 1 : 0), 0);
export const distinctOwned = () => new Set(save.inventory.map((i) => i.id)).size;

export function isEquipped(id: string): boolean {
  const f = save.fighter, l = save.loadout;
  return f.skin === id || f.hair === id || l.super === id || l.specials.includes(id) || l.passives.includes(id);
}

/** Remove one instance (by uid). Refuses the last copy of an equipped item. */
export function removeItem(uidStr: string): boolean {
  const idx = save.inventory.findIndex((i) => i.uid === uidStr);
  if (idx < 0) return false;
  const it = save.inventory[idx];
  if (isEquipped(it.id) && countOwned(it.id) <= 1) return false;
  save.inventory.splice(idx, 1);
  return true;
}

export function recycle(uidStr: string): number {
  const it = save.inventory.find((i) => i.uid === uidStr);
  if (!it) return 0;
  if (!removeItem(uidStr)) return 0;
  const coins = RARITY[ITEM[it.id].rarity].recycle;
  save.coins += coins;
  emitChange();
  return coins;
}

// ── Stats & level ────────────────────────────────────────────────────────────
export function playerStats(): Record<StatKey, number> {
  const out = {} as Record<StatKey, number>;
  for (const s of STATS) out[s.key] = STAT_BASE + save.stats[s.key];
  return out;
}

export interface LevelUpInfo { from: number; to: number; rewards: Reward[] }

export function addXp(amount: number): LevelUpInfo | null {
  if (save.level >= MAX_LEVEL) return null;
  const from = save.level;
  save.xp += amount;
  const rewards: Reward[] = [];
  while (save.level < MAX_LEVEL && save.xp >= xpToNext(save.level)) {
    save.xp -= xpToNext(save.level);
    save.level++;
    save.statPoints += STAT_POINTS_PER_LEVEL;
    save.gems += 5;
    const r = LEVEL_REWARDS[save.level];
    if (r) { grantReward(r, 'level'); rewards.push(r); }
  }
  if (save.level >= MAX_LEVEL) save.xp = 0;
  return save.level > from ? { from, to: save.level, rewards } : null;
}

export function grantReward(r: Reward, src: string) {
  if (r.coins) save.coins += r.coins;
  if (r.gems) save.gems += r.gems;
  if (r.chest) save.chests[r.chest] = (save.chests[r.chest] ?? 0) + 1;
  if (r.item) addItem(r.item, src);
  if (r.xp) addXp(r.xp);
}

// ── Day / week keys ──────────────────────────────────────────────────────────
export function dayKey(d = new Date()) { return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function weekKey(d = new Date()) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (t.getDay() + 6) % 7; // monday = 0
  t.setDate(t.getDate() - dow);
  return dayKey(t);
}
export function msToMidnight() { const n = new Date(); const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return m.getTime() - n.getTime(); }
export function msToMonday() {
  const n = new Date(); const dow = (n.getDay() + 6) % 7;
  const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + (7 - dow));
  return m.getTime() - n.getTime();
}

function pickMissions(pool: MissionDef[], n: number, seed: string): MissionState[] {
  const r = seeded(seed);
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(0, n).map((m) => ({ id: m.id, progress: 0, claimed: false }));
}

export function refreshPeriodic() {
  const dk = dayKey(), wk = weekKey();
  let changed = false;
  if (save.daily.key !== dk) { save.daily = { key: dk, list: pickMissions(DAILY_POOL, 4, 'd' + dk) }; changed = true; }
  if (save.weekly.key !== wk) { save.weekly = { key: wk, list: pickMissions(WEEKLY_POOL, 5, 'w' + wk), bonusClaimed: false }; changed = true; }
  if (save.shop.day !== dk) { save.shop = { day: dk, bought: [] }; changed = true; }
  if (changed) persist();
}

/** daily login bonus; returns reward if newly granted */
export function checkLogin(): { day: number; reward: Reward } | null {
  const dk = dayKey();
  if (save.lastLogin === dk) return null;
  const y = new Date(); y.setDate(y.getDate() - 1);
  save.loginStreak = save.lastLogin === dayKey(y) ? save.loginStreak + 1 : 1;
  save.lastLogin = dk;
  const day = ((save.loginStreak - 1) % 7) + 1;
  const table: Reward[] = [
    { coins: 150 }, { coins: 250, }, { gems: 10 }, { chest: 'ch_madeira' }, { coins: 500 }, { gems: 25 }, { chest: 'ch_prata', gems: 20 },
  ];
  const reward = table[day - 1];
  grantReward(reward, 'login');
  persist();
  return { day, reward };
}

export const missionDef = (id: string) => DAILY_POOL.find((m) => m.id === id) ?? WEEKLY_POOL.find((m) => m.id === id)!;

/** Apply fight/session events to missions, challenges and lifetime totals. */
export function track(events: Partial<Record<EventKey, number>>) {
  refreshPeriodic();
  for (const [k, v] of Object.entries(events) as [EventKey, number][]) {
    if (!v) continue;
    save.totals[k] = (save.totals[k] ?? 0) + v;
    for (const m of [...save.daily.list, ...save.weekly.list]) {
      const def = missionDef(m.id);
      if (def.event === k && !m.claimed) m.progress = Math.min(def.target, m.progress + v);
    }
  }
  persist();
}

export function claimMission(m: MissionState): Reward | null {
  const def = missionDef(m.id);
  if (m.claimed || m.progress < def.target) return null;
  m.claimed = true;
  grantReward(def.reward, 'mission');
  emitChange();
  return def.reward;
}

export function weeklyBonusReady() { return !save.weekly.bonusClaimed && save.weekly.list.every((m) => m.claimed); }
export function claimWeeklyBonus(): Reward | null {
  if (!weeklyBonusReady()) return null;
  save.weekly.bonusClaimed = true;
  grantReward(WEEKLY_BONUS, 'mission');
  emitChange();
  return WEEKLY_BONUS;
}

export function challengeProgress(id: string): number {
  const def = CHALLENGES.find((c) => c.id === id)!;
  const st = save.challenges[id];
  if (def.kind === 'collection') return Math.min(def.target, distinctOwned());
  if (def.kind === 'streak') return Math.min(def.target, save.bestStreak);
  if (def.kind === 'counter') return Math.min(def.target, save.totals[def.event!] ?? 0);
  return st?.progress ?? 0;
}
export function markBossBeaten(boss: string) {
  const def = CHALLENGES.find((c) => c.boss === boss);
  if (!def) return;
  const st = save.challenges[def.id] ?? { progress: 0, claimed: false };
  st.progress = 1;
  save.challenges[def.id] = st;
}
export function claimChallenge(id: string): Reward | null {
  const def = CHALLENGES.find((c) => c.id === id)!;
  const st = save.challenges[id] ?? { progress: 0, claimed: false };
  if (st.claimed || challengeProgress(id) < def.target) return null;
  st.claimed = true;
  save.challenges[id] = st;
  grantReward(def.reward, 'challenge');
  emitChange();
  return def.reward;
}

export function pendingClaims(): number {
  refreshPeriodic();
  let n = 0;
  for (const m of [...save.daily.list, ...save.weekly.list]) if (!m.claimed && m.progress >= missionDef(m.id).target) n++;
  for (const c of CHALLENGES) if (!(save.challenges[c.id]?.claimed) && challengeProgress(c.id) >= c.target) n++;
  if (weeklyBonusReady()) n++;
  return n;
}

// ── Chests / loot ────────────────────────────────────────────────────────────
export interface LootEntry { type: 'item' | 'consumable' | 'coins' | 'gems'; id?: string; amount?: number; rarity: Rarity; owned?: OwnedItem; duplicate?: boolean }

function rollRarity(weights: Partial<Record<Rarity, number>>): Rarity {
  const entries = Object.entries(weights) as [Rarity, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

const droppable = ITEMS.filter((i) => i.source.includes('chest'));

function itemOfRarity(r: Rarity): string {
  let tier = RARITY[r].tier;
  while (tier >= 0) {
    const pool = droppable.filter((i) => RARITY[i.rarity].tier === tier);
    if (pool.length) {
      // prefer items the player doesn't own yet (collector-friendly, still allows duplicates)
      const fresh = pool.filter((i) => !owns(i.id));
      return pick(fresh.length && Math.random() < 0.7 ? fresh : pool).id;
    }
    tier--;
  }
  return droppable[0].id;
}

export function openChest(chestId: string): LootEntry[] | null {
  const def = CHEST[chestId];
  if (!def || !(save.chests[chestId] > 0)) return null;
  save.chests[chestId]--;
  const loot: LootEntry[] = [];
  const rarities: Rarity[] = [];
  for (let i = 0; i < def.items; i++) rarities.push(rollRarity(def.weights));
  // guarantee
  const g = RARITY[CHEST_GUARANTEE[chestId]].tier;
  if (!rarities.some((r) => RARITY[r].tier >= g)) rarities[0] = CHEST_GUARANTEE[chestId];
  rarities.sort((a, b) => RARITY[a].tier - RARITY[b].tier);
  const consumablePool = CONSUMABLES.filter((c) => RARITY[c.rarity].tier <= RARITY[def.rarity].tier + 1);
  for (let i = 0; i < def.consumables; i++) {
    const c = pick(consumablePool.filter((x) => Math.random() < 1 / (1 + RARITY[x.rarity].tier * 0.8)).concat(consumablePool[0]));
    const amount = c.rarity === 'comum' ? randi(1, 3) : 1;
    save.consumables[c.id] = (save.consumables[c.id] ?? 0) + amount;
    loot.push({ type: 'consumable', id: c.id, amount, rarity: c.rarity });
  }
  const coins = randi(def.coins[0], def.coins[1]);
  save.coins += coins;
  loot.unshift({ type: 'coins', amount: coins, rarity: 'comum' });
  if (def.gems) { const gems = randi(def.gems[0], def.gems[1]); save.gems += gems; loot.splice(1, 0, { type: 'gems', amount: gems, rarity: 'raro' }); }
  for (const r of rarities) {
    const id = itemOfRarity(r);
    const duplicate = owns(id);
    const owned = addItem(id, 'chest');
    loot.push({ type: 'item', id, rarity: ITEM[id].rarity, owned, duplicate });
  }
  track({ chest: 1 });
  emitChange();
  return loot;
}

/** highest rarity among item drops — used to color the chest glow before reveal */
export const lootPeak = (loot: LootEntry[]): Rarity =>
  loot.filter((l) => l.type === 'item').reduce<Rarity>((best, l) => (RARITY[l.rarity].tier > RARITY[best].tier ? l.rarity : best), 'comum');

// ── Shop ─────────────────────────────────────────────────────────────────────
export function dailyShop(): string[] {
  const r = seeded('shop' + dayKey());
  const pool = ITEMS.filter((i) => i.price && !i.source.includes('starter'));
  const tiers: Rarity[] = ['comum', 'incomum', 'raro', 'raro', 'epico', 'lendario'];
  const out: string[] = [];
  for (const t of tiers) {
    const cands = pool.filter((i) => i.rarity === t && !out.includes(i.id));
    if (cands.length) out.push(cands[Math.floor(r() * cands.length)].id);
  }
  return out;
}

export function canAfford(p?: { coins?: number; gems?: number }) {
  if (!p) return false;
  return (p.coins ?? 0) <= save.coins && (p.gems ?? 0) <= save.gems;
}
export function pay(p?: { coins?: number; gems?: number }): boolean {
  if (!p || !canAfford(p)) return false;
  save.coins -= p.coins ?? 0;
  save.gems -= p.gems ?? 0;
  return true;
}

// ── Trade codes (offline prototype for a future online market) ──────────────
const TRADE_SALT = 'rdl-mercado-v1';
function hash(str: string) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

export function createTradeCode(uidStr: string): string | null {
  const it = save.inventory.find((i) => i.uid === uidStr);
  if (!it) return null;
  const def = ITEM[it.id];
  if (def.tradable === false) return null;
  if (!removeItem(uidStr)) return null;
  const payload = `${it.id}.${it.serial}.${it.uid}`;
  const code = btoa(`${payload}.${hash(payload + TRADE_SALT)}`).replace(/=+$/, '');
  emitChange();
  return code;
}

export function redeemTradeCode(code: string): { ok: true; item: OwnedItem } | { ok: false; error: string } {
  try {
    const raw = atob(code.trim());
    const parts = raw.split('.');
    if (parts.length !== 4) throw 0;
    const [id, serial, u, sig] = parts;
    if (hash(`${id}.${serial}.${u}` + TRADE_SALT) !== sig || !ITEM[id]) return { ok: false, error: 'Código inválido.' };
    if (save.tradeRedeemed.includes(u) || save.inventory.some((i) => i.uid === u)) return { ok: false, error: 'Este código já foi usado.' };
    const item: OwnedItem = { uid: u, id, serial: +serial, at: Date.now(), src: 'trade' };
    save.inventory.push(item);
    save.tradeRedeemed.push(u);
    emitChange();
    return { ok: true, item };
  } catch {
    return { ok: false, error: 'Código inválido.' };
  }
}

export const rarityTier = (r: Rarity) => RARITY[r].tier;
export const rarityList = RARITIES;

save = load();
