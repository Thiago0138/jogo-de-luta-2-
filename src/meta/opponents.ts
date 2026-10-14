// ─────────────────────────────────────────────────────────────────────────────
//  Builds FighterSpecs for the player, tag partners, random rivals and bosses.
// ─────────────────────────────────────────────────────────────────────────────
import type { FighterSpec } from '../fight/fighter';
import {
  Appearance, BASE_HAIR, BOSSES, CONSUMABLES, HAIR_COLORS, ITEMS, NAMES_FIRST, NAMES_LAST, PARTNERS, RARITY, Rarity,
  SKIN_TONES, STATS, STAT_BASE, STAT_POINTS_PER_LEVEL, StatKey,
} from './data';
import { pick, playerStats, rand, randi, save } from './save';

export function playerSpec(): FighterSpec {
  const l = save.loadout;
  const consumables = l.items.filter((id): id is string => !!id && (save.consumables[id] ?? 0) > 0);
  // the same consumable in both slots needs two in stock
  const counted: string[] = [];
  for (const id of consumables) if (counted.filter((c) => c === id).length < (save.consumables[id] ?? 0)) counted.push(id);
  return {
    app: { ...save.fighter },
    name: save.fighter.name,
    level: save.level,
    stats: playerStats(),
    specials: l.specials.filter((x): x is string => !!x),
    super: l.super,
    passives: l.passives.filter((x): x is string => !!x),
    consumables: counted,
    isPlayer: true,
  };
}

function distribute(level: number, bias: StatKey[] = []): Record<StatKey, number> {
  const s = Object.fromEntries(STATS.map((x) => [x.key, STAT_BASE])) as Record<StatKey, number>;
  let pts = (level - 1) * STAT_POINTS_PER_LEVEL + 3;
  const keys = STATS.map((x) => x.key);
  while (pts-- > 0) {
    const k = bias.length && Math.random() < 0.45 ? pick(bias) : pick(keys);
    s[k]++;
  }
  return s;
}

function rarityCap(level: number): number {
  return level < 4 ? 1 : level < 8 ? 2 : level < 14 ? 3 : level < 22 ? 4 : level < 32 ? 5 : 6;
}

function randomOf(kind: 'skin' | 'hair' | 'special' | 'super' | 'passive', level: number) {
  const cap = rarityCap(level);
  const pool = ITEMS.filter((i) => i.kind === kind && RARITY[i.rarity].tier <= cap && !i.source.includes('challenge'));
  // weight lower rarities heavier
  const w = pool.map((i) => 1 / (1 + RARITY[i.rarity].tier * 0.9));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[0];
}

export function randomAppearance(name: string, level: number): Appearance {
  const premiumHair = Math.random() < 0.25 + level * 0.01 ? randomOf('hair', level)?.id : undefined;
  return {
    name,
    skinTone: randi(0, SKIN_TONES.length - 3),
    height: rand(0.95, 1.05),
    build: randi(0, 2),
    eyes: randi(0, 5),
    eyeColor: randi(0, 7),
    brows: randi(0, 5),
    mouth: randi(0, 5),
    beard: Math.random() < 0.45 ? randi(1, 5) : 0,
    hair: premiumHair ?? pick(BASE_HAIR).id,
    hairColor: randi(0, HAIR_COLORS.length - 1),
    skin: randomOf('skin', level).id,
  };
}

export function randomName() { return `${pick(NAMES_FIRST)} ${pick(NAMES_LAST)}`; }

export function rivalSpec(level: number): FighterSpec {
  const name = randomName();
  const lvl = Math.max(1, level + (Math.random() < 0.3 ? 1 : Math.random() < 0.3 ? -1 : 0));
  const sp1 = randomOf('special', lvl);
  const sp2 = lvl > 6 ? randomOf('special', lvl) : null;
  const passives = lvl > 4 ? [randomOf('passive', lvl).id] : [];
  const cons = lvl > 3 ? [pick(CONSUMABLES.filter((c) => RARITY[c.rarity].tier <= Math.min(2, rarityCap(lvl)))).id] : [];
  return {
    app: randomAppearance(name, lvl),
    name,
    level: lvl,
    stats: distribute(lvl, [pick(STATS).key, pick(STATS).key]),
    specials: [sp1.id, sp2 && sp2.id !== sp1.id ? sp2.id : null].filter((x): x is string => !!x),
    super: lvl >= 2 || Math.random() < 0.5 ? randomOf('super', lvl).id : 'su_bomba',
    passives,
    consumables: cons,
  };
}

export function partnerSpec(index: number, level: number): FighterSpec {
  const p = PARTNERS[index % PARTNERS.length];
  const base = randomAppearance(p.name, level);
  return {
    app: { ...base, ...p.app, name: p.name, height: 1 },
    name: p.name,
    level,
    stats: distribute(level, p.bias),
    specials: [level > 5 ? 'sp_chuva' : 'sp_abraco'],
    super: level > 10 ? 'su_gigante' : 'su_bomba',
    passives: [],
    consumables: [],
  };
}

export function bossSpec(id: string, playerLevel: number): FighterSpec {
  const b = BOSSES[id];
  const lvl = Math.max(b.levelReq, playerLevel) + b.levelBonus;
  const app = { ...randomAppearance(b.name, lvl), ...b.app, name: b.name } as Appearance;
  return {
    app, name: b.name, title: b.title, level: lvl,
    stats: distribute(lvl, ['str', 'vit', 'tec']),
    specials: b.specials, super: b.super, passives: b.passives,
    consumables: ['c_vida'], hpMul: b.hpMul, boss: id,
  };
}

export const rarityOf = (r: Rarity) => RARITY[r];
