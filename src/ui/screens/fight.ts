// Fight screen: runs the Match in the shared world, draws the HUD, shows results.
import { Vector3 } from 'three';
import { sfx } from '../../engine/audio';
import type { Fighter } from '../../fight/fighter';
import { CalloutStyle, Match, MatchResult } from '../../fight/match';
import { CHEST, LEVEL_REWARDS, RARITY } from '../../meta/data';
import { bossSpec, partnerSpec, playerSpec, rivalSpec } from '../../meta/opponents';
import { processResult } from '../../meta/rewards';
import { persist, save } from '../../meta/save';
import type { Stage } from '../../stages';
import type { App } from '../app';
import { chestArt, COIN, fmt, GEM, h, ICON, modal, rewardChips, svg, XP } from '../dom';
import type { FightPlan } from './play';

class FightStage implements Stage {
  constructor(public match: Match) {}
  update(dt: number) { this.match.update(dt); }
  dispose() {
    for (const f of this.match.fighters) f.dispose();
    this.match.ref.rig.dispose();
    this.match['w'].fx.clear();
    sfx.crowdStop();
  }
}

const proj = new Vector3();

export function fightScreen(app: App, params?: Record<string, unknown>): HTMLElement {
  const plan = params!.plan as FightPlan;
  const world = app.world;
  sfx.music(false);

  const callouts = h('div', { class: 'callouts' });
  const flash = h('div', { class: 'flash' });
  const vsEl = h('div', { class: 'vs' },
    h('div', { class: 'side' }, plan.teams[0].map((f) => h('div', null, h('div', { class: 'n' }, f.name), h('div', { class: 'l' }, `NÍVEL ${f.level}`)))),
    h('div', { class: 'mid' }, 'VS'),
    h('div', { class: 'side r' }, plan.teams[1].map((f) => h('div', null, h('div', { class: 'n' }, f.name), h('div', { class: 'l' }, `NÍVEL ${f.level}`)))),
  );
  let dmgCount = 0;
  const stack: Record<string, { t: number; n: number }> = {};

  const hooks = {
    callout(text: string, style: CalloutStyle, team?: 0 | 1, color?: string) {
      let extra = '';
      if (style === 'move' || style === 'combo') {
        // stack quick successive callouts instead of overlapping them
        const now = performance.now();
        const key = style + (team ?? '');
        const st = stack[key] && now - stack[key].t < 700 ? stack[key] : { t: now, n: -1 };
        st.n = (st.n + 1) % 4; st.t = now; stack[key] = st;
        extra = `;margin-top:${-st.n * 34}px`;
      }
      const el = h('div', { class: `co ${style}${team !== undefined ? ' t' + team : ''}`, style: (color ? (style === 'special' ? `--sc:${color}` : `--mc:${color}`) : '') + extra }, text);
      callouts.appendChild(el);
      if (style === 'count') for (const c of Array.from(callouts.children)) if (c !== el && c.classList.contains('count')) c.remove();
      setTimeout(() => el.remove(), style === 'ko' ? 3100 : 2100);
    },
    damage(pos: Vector3, amount: number, crit: boolean, team: 0 | 1) {
      if (!save.settings.dmgNumbers || dmgCount > 14) return;
      proj.copy(pos).project(world.gfx.camera);
      if (proj.z > 1) return;
      const x = (proj.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 30;
      const y = (-proj.y * 0.5 + 0.5) * window.innerHeight - 20;
      const el = h('div', { class: `dmg${crit ? ' crit' : ''} t${team}`, style: `transform:translate(${x}px,${y}px)` }, String(amount));
      callouts.appendChild(el);
      dmgCount++;
      setTimeout(() => { el.remove(); dmgCount--; }, 820);
    },
    flash(color: string, strength: number) {
      flash.style.transition = 'none';
      flash.style.background = color;
      flash.style.opacity = String(Math.min(0.22, strength * 0.25));
      requestAnimationFrame(() => requestAnimationFrame(() => { flash.style.transition = 'opacity .45s ease-out'; flash.style.opacity = '0'; }));
    },
    phase(p: Match['phase']) {
      if (p === 'fight') { vsEl.classList.add('out'); setTimeout(() => vsEl.remove(), 600); }
      if (p === 'finish') hudTop.style.opacity = '0.4';
    },
    end(r: MatchResult) { showResults(r); },
  };

  const match = new Match(world, { mode: plan.mode, teams: plan.teams, bossId: plan.bossId }, hooks);
  match.setSpeed(save.settings.speed || 1);
  app.setStage(new FightStage(match));

  // ── HUD ──
  const side = (team: 0 | 1) => {
    const right = team === 1;
    const name = h('span'), lv = h('span', { class: 'lv' });
    const trail = h('div', { class: 'trail' }), fill = h('div', { class: 'fill' });
    const segs = [0, 1, 2, 3].map(() => h('b'));
    const meter = h('div', { class: 'meter' }, segs.map((b) => h('i', null, b)));
    const mlabel = h('div', { class: 'meter-label' }, 'SUPER');
    const partners = match.teams[team].length > 1 ? match.teams[team].map((f) => {
      const pb = h('i');
      const row = h('div', { class: 'partner-bar' }, right ? null : h('span', null, f.name), h('div', { class: 'pb' }, pb), right ? h('span', null, f.name) : null);
      return { f, pb, row };
    }) : [];
    const el = h('div', { class: 'hp-side' + (right ? ' r' : '') },
      h('div', { class: 'hp-name' }, right ? lv : name, right ? name : lv),
      h('div', { class: 'hpbar' }, trail, fill),
      h('div', { class: 'row', style: `gap:6px;width:100%;${right ? 'flex-direction:row-reverse' : ''}` }, meter, mlabel),
      partners.length ? h('div', { class: 'col', style: `gap:3px;${right ? 'align-items:flex-end' : ''}` }, partners.map((p) => p.row)) : null,
    );
    let last = { hp: -1, disp: -1, meter: -1, legal: '' };
    const update = () => {
      const f = match.legal(team);
      if (last.legal !== f.name) { name.textContent = f.name; lv.textContent = `NV ${f.level}`; last.legal = f.name; }
      const hp = Math.round(f.hpPct * 1000), disp = Math.round(Math.max(0, f.dispHp / f.maxHp) * 1000);
      if (hp !== last.hp) {
        fill.style.width = `calc(${hp / 10}% - 4px)`;
        fill.className = 'fill' + (hp < 250 ? ' low' : hp < 500 ? ' mid' : '');
        last.hp = hp;
      }
      if (disp !== last.disp) { trail.style.width = `calc(${disp / 10}% - 4px)`; last.disp = disp; }
      const m = Math.round(f.meter);
      if (m !== last.meter) {
        segs.forEach((b, i) => { b.style.width = `${Math.max(0, Math.min(1, (m - i * 25) / 25)) * 100}%`; });
        const full = m >= 100;
        meter.classList.toggle('full', full);
        mlabel.classList.toggle('full', full);
        mlabel.textContent = full ? 'SUPER!' : 'SUPER';
        last.meter = m;
      }
      for (const p of partners) { p.pb.style.width = `${p.f.hpPct * 100}%`; p.row.classList.toggle('legal', p.f.legal); }
    };
    return { el, update };
  };
  const left = side(0), right = side(1);
  const clock = h('div', { class: 'clock' }, '0:00');
  const speedBtn = h('button', { onclick: () => { const s = match.speed >= 3 ? 1 : match.speed + 1; match.setSpeed(s); save.settings.speed = s; persist(); speedBtn.textContent = `${s}x`; sfx.ui(); } }, `${match.speed}x`);
  const skipBtn = h('button', { onclick: () => { match.skip(); sfx.ui(); }, html: ICON.skip });
  const hudTop = h('div', { class: 'hud-top' }, left.el, h('div', { class: 'hud-mid' }, clock, h('div', { class: 'hud-ctrl' }, speedBtn, skipBtn)), right.el);
  let lastSec = -1;
  app.tick(() => {
    left.update(); right.update();
    const s = Math.floor(match.time);
    if (s !== lastSec) { clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; lastSec = s; }
  });

  const root = h('div', { class: 'screen hud' }, h('div', { class: 'vignette' }), flash, callouts, vsEl, hudTop);

  // ── results ──
  function showResults(r: MatchResult) {
    const rw = processResult(r, plan.oppLevel);
    sfx.music(true);
    const win = rw.win;
    const methodText = r.method === 'KO' ? 'por K.O.' : r.method === 'PIN' ? 'por Pinfall' : 'por Decisão';
    const st = r.stats;
    const rewards = h('div', { class: 'rewards' },
      h('div', { class: 'reward', style: 'animation-delay:.15s' }, svg(COIN), h('b', null, '+' + fmt(rw.coins)), h('span', null, 'Moedas')),
      h('div', { class: 'reward', style: 'animation-delay:.3s' }, svg(XP), h('b', null, '+' + fmt(rw.xp)), h('span', null, 'XP')),
      rw.gems ? h('div', { class: 'reward', style: 'animation-delay:.45s' }, svg(GEM), h('b', null, '+' + rw.gems), h('span', null, 'Gemas')) : null,
      rw.chest ? h('div', { class: 'reward', style: `animation-delay:.6s;box-shadow:inset 0 0 0 2px ${RARITY[CHEST[rw.chest].rarity].color}` }, svg(chestArt(rw.chest)), h('b', { style: 'font-size:13px' }, CHEST[rw.chest].name), h('span', null, 'Novo baú!')) : null,
    );
    const missions = rw.completed.length || rw.challengesReady.length ? h('div', { class: 'mis-up' },
      rw.completed.map((t) => h('div', { class: 'ok' }, h('span', null, t), h('span', null, '✓ Concluída'))),
      rw.challengesReady.map((t) => h('div', { class: 'ok' }, h('span', null, 'Desafio: ' + t), h('span', null, '★ Pronto'))),
    ) : null;
    const again = () => {
      const me = playerSpec();
      let next: FightPlan;
      if (plan.mode === 'tag') { const a = rivalSpec(save.level), b = rivalSpec(save.level); next = { mode: 'tag', teams: [[me, partnerSpec(save.partner, save.level)], [a, b]], oppLevel: Math.round((a.level + b.level) / 2) }; }
      else if (plan.mode === 'boss' && plan.bossId) { const b = bossSpec(plan.bossId, save.level); next = { mode: 'boss', teams: [[me], [b]], bossId: plan.bossId, oppLevel: b.level }; }
      else { const a = rivalSpec(save.level); next = { mode: '1v1', teams: [[me], [a]], oppLevel: a.level }; }
      app.go('vs', { plan: next });
    };
    const box = h('div', { class: 'box' },
      h('div', { class: 'res-title ' + (win ? 'win' : 'lose') }, win ? 'VITÓRIA!' : 'DERROTA'),
      h('div', { class: 'res-method' }, `${win ? 'Venceste' : 'Perdeste'} ${methodText}${rw.streak > 1 ? ` · ${rw.streak} vitórias seguidas` : ''}`),
      rewards,
      h('div', { class: 'res-stats' },
        ...([['Golpes', st.hits], ['Críticos', st.crits], ['Dano', Math.round(st.dmg)], ['Especiais', st.specials], ['Supers', st.supers], ['Kick-outs', st.kickouts]] as [string, number][]).map(([l, v]) => h('div', null, h('b', null, String(v)), h('span', null, l))),
      ),
      missions,
      h('div', { class: 'row', style: 'gap:10px;margin-top:14px' },
        h('button', { class: 'btn ghost grow', onclick: () => { sfx.ui('back'); app.go('hub'); } }, 'MENU'),
        rw.chest ? h('button', { class: 'btn gold grow', onclick: () => { sfx.ui(); app.go('chests', { open: rw.chest }); } }, 'ABRIR BAÚ') : null,
        h('button', { class: 'btn go grow', onclick: () => { sfx.ui('buy'); again(); } }, plan.mode === 'boss' && !win ? 'REVANCHE' : 'LUTAR'),
      ),
    );
    root.appendChild(h('div', { class: 'results' }, h('div', { class: 'panel', style: 'padding:22px 16px;width:min(460px,100%)' }, box)));
    if (rw.levelUp) setTimeout(() => levelUpModal(app, rw.levelUp!.from, rw.levelUp!.to), 900);
  }

  return root;
}

export function levelUpModal(app: App, from: number, to: number) {
  sfx.ui('level');
  const rewards: Node[] = [];
  for (let l = from + 1; l <= to; l++) { const r = LEVEL_REWARDS[l]; if (r) rewards.push(...rewardChips(r)); }
  modal((close) => h('div', null,
    h('div', { class: 'res-title win', style: 'font-size:46px' }, 'NÍVEL ' + to + '!'),
    h('p', { class: 'muted' }, `Ganhaste ${(to - from) * 3} pontos de atributo, +vida e ${(to - from) * 5} gemas.`),
    rewards.length ? h('div', { class: 'rewards' }, rewards) : null,
    h('div', { class: 'acts' },
      h('button', { class: 'btn ghost', onclick: () => close() }, 'Depois'),
      h('button', { class: 'btn green', onclick: () => { close(); app.go('fighter'); } }, 'Distribuir Pontos'),
    ),
  ));
}

export type { Fighter };
