// Post-fight economy: rewards, streaks, mission tracking, consumable usage.
import type { MatchResult } from '../fight/match';
import { CHALLENGES, EventKey } from './data';
import { addXp, challengeProgress, LevelUpInfo, markBossBeaten, missionDef, persist, save, track } from './save';

export interface FightRewards {
  win: boolean;
  coins: number;
  xp: number;
  gems: number;
  chest?: string;
  levelUp: LevelUpInfo | null;
  completed: string[]; // mission texts newly completed
  challengesReady: string[];
  streak: number;
}

export function processResult(r: MatchResult, oppLevel: number): FightRewards {
  const win = r.winner === 0;
  const before = new Set([...save.daily.list, ...save.weekly.list].filter((m) => m.progress >= missionDef(m.id).target).map((m) => m.id));
  const chBefore = new Set(CHALLENGES.filter((c) => challengeProgress(c.id) >= c.target).map((c) => c.id));

  // consumables actually drunk come out of the inventory
  for (const id of r.usedConsumables) save.consumables[id] = Math.max(0, (save.consumables[id] ?? 0) - 1);

  save.totals.fights = (save.totals.fights ?? 0) + 1;
  if (win) { save.streak++; save.bestStreak = Math.max(save.bestStreak, save.streak); }
  else { save.streak = 0; save.totals.losses = (save.totals.losses ?? 0) + 1; }

  const tag = r.mode === 'tag', boss = r.mode === 'boss';
  const streakMul = 1 + Math.min(0.5, Math.max(0, save.streak - 1) * 0.1);
  let coins = Math.round((70 + oppLevel * 9) * (tag ? 1.35 : 1) * (boss ? 2 : 1) * (win ? streakMul : 0.32));
  let xp = Math.round((55 + oppLevel * 11) * (tag ? 1.25 : 1) * (boss ? 1.8 : 1) * (win ? 1 : 0.45));
  let gems = 0;
  if (win && r.hpPct > 0.6) coins += 25;
  if (win && r.method === 'KO') xp += 10;
  let chest: string | undefined;
  if (win) {
    const roll = Math.random();
    if (boss) chest = 'ch_ouro';
    else if (roll < 0.025) chest = 'ch_ouro';
    else if (roll < 0.11) chest = 'ch_prata';
    else if (roll < 0.38) chest = 'ch_madeira';
    if (boss) gems = 25;
  }
  save.coins += coins;
  save.gems += gems;
  if (chest) save.chests[chest] = (save.chests[chest] ?? 0) + 1;

  const s = r.stats;
  const ev: Partial<Record<EventKey, number>> = {
    fight: 1, hits: s.hits, super: s.supers, special: s.specials, kickout: s.kickouts, aerial: s.aerials, grapple: s.grapples,
    crit: s.crits, dodge: s.dodges, block: s.blocks, potion: s.potions, tags: s.tags,
  };
  if (win) {
    ev.win = 1;
    if (r.method === 'PIN') ev.pinWin = 1;
    if (r.method === 'KO') ev.koWin = 1;
    if (tag) ev.tagWin = 1;
    if (r.hpPct > 0.6) ev.perfect = 1;
    if (boss) { ev.bossWin = 1; if (r.bossId) markBossBeaten(r.bossId); }
  }
  track(ev);
  const levelUp = addXp(xp);
  persist(true);

  const completed = [...save.daily.list, ...save.weekly.list].filter((m) => !before.has(m.id) && m.progress >= missionDef(m.id).target).map((m) => missionDef(m.id).text);
  const challengesReady = CHALLENGES.filter((c) => !chBefore.has(c.id) && challengeProgress(c.id) >= c.target && !save.challenges[c.id]?.claimed).map((c) => c.name);
  xp = Math.round(xp);
  return { win, coins, xp, gems, chest, levelUp, completed, challengesReady, streak: save.streak };
}
