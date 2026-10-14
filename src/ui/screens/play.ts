// Mode select → opponent preview (VS) → fight.
import { sfx } from '../../engine/audio';
import type { FighterSpec } from '../../fight/fighter';
import type { MatchMode } from '../../fight/match';
import { BOSSES, CHALLENGES, ITEM, PARTNERS, RARITY } from '../../meta/data';
import { bossSpec, partnerSpec, playerSpec, rivalSpec } from '../../meta/opponents';
import { persist, save } from '../../meta/save';
import { MenuStage } from '../../stages';
import type { App } from '../app';
import { h, ICON, svg, toast } from '../dom';
import { ensureHubStage } from './common';

export interface FightPlan { mode: MatchMode; teams: FighterSpec[][]; bossId?: string; oppLevel: number }

export function playScreen(app: App): HTMLElement {
  ensureHubStage(app);
  const partnerPick = h('div', { class: 'partner-pick' });
  const renderPartners = () => partnerPick.replaceChildren(...PARTNERS.map((p, i) => h('button', {
    class: save.partner === i ? 'on' : '',
    onclick: () => { save.partner = i; persist(); sfx.ui(); renderPartners(); },
  }, svg(ICON.fighter), p.name, h('span', { class: 'tiny muted' }, p.bias.map((b) => b.toUpperCase()).join(' · ')))));
  renderPartners();

  const start = (mode: MatchMode, bossId?: string) => {
    sfx.ui('buy');
    const me = playerSpec();
    let plan: FightPlan;
    if (mode === 'boss' && bossId) {
      const b = bossSpec(bossId, save.level);
      plan = { mode, teams: [[me], [b]], bossId, oppLevel: b.level };
    } else if (mode === 'tag') {
      const r1 = rivalSpec(save.level), r2 = rivalSpec(save.level);
      plan = { mode, teams: [[me, partnerSpec(save.partner, save.level)], [r1, r2]], oppLevel: Math.round((r1.level + r2.level) / 2) };
    } else {
      const r = rivalSpec(save.level);
      plan = { mode, teams: [[me], [r]], oppLevel: r.level };
    }
    app.go('vs', { plan });
  };

  const bosses = CHALLENGES.filter((c) => c.kind === 'boss').map((c) => {
    const b = BOSSES[c.boss!];
    const locked = save.level < b.levelReq;
    const beaten = (save.challenges[c.id]?.progress ?? 0) >= 1;
    return h('button', {
      class: 'boss' + (locked ? ' locked' : ''),
      onclick: () => { if (locked) { sfx.ui('error'); toast(`Precisas de nível ${b.levelReq}.`, ICON.lock); return; } start('boss', b.id); },
    },
    h('div', { class: 'bi', style: `background:${RARITY[c.rarity].glow}` }, svg(beaten ? ICON.check : locked ? ICON.lock : ICON.skull)),
    h('div', { class: 'grow', style: 'text-align:left' },
      h('div', { class: 'display', style: 'font-size:17px' }, b.name),
      h('div', { class: 'small muted' }, `${b.title} · Nível ${b.levelReq}+`),
      h('div', { class: 'small', style: `color:${RARITY[c.rarity].color};font-weight:700;margin-top:2px` }, `Prémio: ${ITEM[c.reward.item!]?.name ?? ''}${beaten ? ' (já ganho)' : ''}`),
    ));
  });

  return app.sheet('Escolhe o Combate', [
    h('div', { class: 'col', style: 'gap:14px' },
      h('button', { class: 'mode-card m1', onclick: () => start('1v1') },
        h('div', { class: 'deco', html: ICON.swords.replace('<svg', '<svg style="width:100%;height:100%;opacity:.25"') }),
        h('h3', null, '1 CONTRA 1'), h('p', null, 'Boxe, suplexes e super ataques. Combate intenso, puro espetáculo.')),
      h('button', { class: 'mode-card m2', onclick: () => start('tag') },
        h('div', { class: 'deco', html: ICON.users.replace('<svg', '<svg style="width:100%;height:100%;opacity:.25"') }),
        h('h3', null, 'TAG TEAM 2v2'), h('p', null, 'O teu parceiro espera no canto. Toca-lhe na mão e troca! +35% moedas.')),
    ),
    h('div', { class: 'section-title' }, 'Parceiro de Tag Team'),
    partnerPick,
    h('div', { class: 'section-title' }, 'Desafios Lendários'),
    h('div', { class: 'col' }, bosses),
  ], { back: 'hub' });
}

export function vsScreen(app: App, params?: Record<string, unknown>): HTMLElement {
  const plan = params!.plan as FightPlan;
  const me = plan.teams[0][0], rival = plan.teams[1][0];
  app.setStage(new MenuStage(app.world, me.app, 'vs', rival.app));
  app.world.arena.setScreen(`${me.name} vs ${rival.name}`, plan.mode === 'tag' ? 'TAG TEAM' : plan.mode === 'boss' ? 'DESAFIO LENDÁRIO' : 'A SEGUIR');
  sfx.crowdStart();
  sfx.crowdCheer(0.6);
  const sideInfo = (team: FighterSpec[], right: boolean) => h('div', { class: 'side' + (right ? ' r' : '') },
    team.map((f, i) => h('div', { style: i ? 'opacity:.8;margin-top:6px' : '' },
      h('div', { class: 'n', style: i ? 'font-size:clamp(16px,4vw,28px)' : '' }, f.name),
      h('div', { class: 'l' }, `NÍVEL ${f.level}${f.title ? ' · ' + f.title.toUpperCase() : ''}`),
      h('div', { class: 'tiny', style: `color:${RARITY[ITEM[f.app.skin]?.rarity ?? 'comum'].color};font-weight:700;letter-spacing:1px` }, (ITEM[f.app.skin]?.name ?? '').toUpperCase()),
    )));
  return h('div', { class: 'screen' },
    h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', onclick: () => { sfx.ui('back'); sfx.crowdStop(); app.go('play'); }, html: ICON.back }), h('div', { class: 'spacer' })),
    h('div', { class: 'vs', style: 'position:relative;flex:1' }, sideInfo(plan.teams[0], false), h('div', { class: 'mid' }, 'VS'), sideInfo(plan.teams[1], true)),
    h('div', { class: 'hub-bottom', style: 'padding-bottom:calc(24px + var(--safe-b))' },
      h('div', { class: 'play-btn' }, h('button', { class: 'btn primary', onclick: () => { sfx.ui('buy'); app.go('fight', { plan }); } }, svg(ICON.play), 'COMEÇAR')),
    ),
  );
}
