// Missions: daily, weekly (+ completion bonus) and Legendary Challenges.
import { sfx } from '../../engine/audio';
import { BOSSES, CHALLENGES, ITEM, RARITY, WEEKLY_BONUS } from '../../meta/data';
import { challengeProgress, claimChallenge, claimMission, claimWeeklyBonus, missionDef, MissionState, msToMidnight, msToMonday, refreshPeriodic, save, weeklyBonusReady } from '../../meta/save';
import type { App } from '../app';
import { countdown, h, ICON, itemArt, rarityChip, rewardChips, svg, toast } from '../dom';
import { ensureHubStage } from './common';

let tabMem = 0;

export function missionsScreen(app: App, params?: Record<string, unknown>): HTMLElement {
  ensureHubStage(app);
  refreshPeriodic();
  if (typeof params?.tab === 'number') tabMem = params.tab;
  const tabs = h('div', { class: 'tabs' });
  const body = h('div');
  const timer = h('span', { class: 'timer' });
  app.tick(() => { timer.textContent = 'Renova em ' + countdown(tabMem === 0 ? msToMidnight() : msToMonday()); });

  const mrow = (m: MissionState) => {
    const d = missionDef(m.id);
    const done = m.progress >= d.target;
    return h('div', { class: 'mission' + (m.claimed ? ' claimed' : done ? ' done' : '') },
      h('div', { class: 'mi', html: done ? ICON.check : ICON.missions }),
      h('div', { class: 'grow' },
        h('div', { class: 'txt' }, d.text),
        h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: `width:${(m.progress / d.target) * 100}%` })),
        h('div', { class: 'rw' }, h('span', { class: 'muted' }, `${m.progress}/${d.target}`), rewardChips(d.reward)),
      ),
      m.claimed ? h('span', { class: 'small muted' }, 'Feito') : h('button', { class: 'btn sm ' + (done ? 'green' : 'ghost'), disabled: !done, onclick: () => { if (claimMission(m)) { sfx.ui('claim'); toast('Recompensa recebida!', ICON.check); render(); } } }, 'Receber'),
    );
  };

  function render() {
    tabs.replaceChildren(...['Diárias', 'Semanais', 'Lendárias'].map((n, i) => h('button', { class: 'tab' + (tabMem === i ? ' on' : ''), onclick: () => { tabMem = i; sfx.ui(); render(); } }, n)));
    if (tabMem === 0) {
      body.replaceChildren(h('div', { class: 'section-title' }, 'Missões diárias', timer), h('div', { class: 'col' }, save.daily.list.map(mrow)));
    } else if (tabMem === 1) {
      const ready = weeklyBonusReady();
      body.replaceChildren(
        h('div', { class: 'section-title' }, 'Missões semanais', timer),
        h('div', { class: 'col' }, save.weekly.list.map(mrow)),
        h('div', { class: 'card ' + (ready ? 'hl' : ''), style: 'margin-top:14px;display:flex;align-items:center;gap:12px' },
          h('div', { style: 'width:64px;height:64px;flex:none', html: itemArt('sk_veterano') }),
          h('div', { class: 'grow' }, h('div', { class: 'display' }, 'Bónus semanal'), h('div', { class: 'small muted' }, 'Completa todas as missões da semana.'), h('div', { class: 'rw row', style: 'gap:6px;flex-wrap:wrap;margin-top:6px' }, rewardChips(WEEKLY_BONUS))),
          save.weekly.bonusClaimed ? h('span', { class: 'small muted' }, 'Feito') : h('button', { class: 'btn sm ' + (ready ? 'gold' : 'ghost'), disabled: !ready, onclick: () => { if (claimWeeklyBonus()) { sfx.ui('level'); toast('Bónus semanal!', ICON.sparkles); render(); } } }, 'Receber'),
        ),
      );
    } else {
      body.replaceChildren(
        h('p', { class: 'small muted', style: 'margin:10px 2px' }, 'Desafios muito difíceis que desbloqueiam as skins mais raras do jogo. Não expiram.'),
        h('div', { class: 'col' }, CHALLENGES.map((c) => {
          const p = challengeProgress(c.id);
          const claimed = save.challenges[c.id]?.claimed;
          const done = p >= c.target;
          const boss = c.boss ? BOSSES[c.boss] : null;
          const reward = c.reward.item ? ITEM[c.reward.item] : null;
          return h('div', { class: 'mission' + (claimed ? ' claimed' : done ? ' done' : ''), style: `box-shadow:inset 0 0 0 1px ${RARITY[c.rarity].color}55` },
            h('div', { class: 'mi', style: `width:58px;height:58px;background:${RARITY[c.rarity].glow}`, html: reward ? itemArt(reward.id) : ICON.crown }),
            h('div', { class: 'grow' },
              h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, h('span', { class: 'display', style: 'font-size:16px' }, c.name), rarityChip(c.rarity)),
              h('div', { class: 'small muted', style: 'margin-top:3px' }, c.desc),
              h('div', { class: 'bar gold', style: 'margin-top:6px' }, h('i', { style: `width:${(p / c.target) * 100}%` })),
              h('div', { class: 'rw' }, h('span', { class: 'muted' }, `${p}/${c.target}`), rewardChips(c.reward)),
            ),
            claimed ? h('span', { class: 'small muted' }, 'Feito')
              : done ? h('button', { class: 'btn sm gold', onclick: () => { if (claimChallenge(c.id)) { sfx.ui('level'); toast(`${c.name} conquistado!`, ICON.crown); render(); } } }, 'Receber')
              : boss ? h('button', { class: 'btn sm primary', disabled: save.level < boss.levelReq, onclick: () => { sfx.ui(); app.go('play'); } }, save.level < boss.levelReq ? `Nv ${boss.levelReq}` : 'Lutar')
              : null,
          );
        })),
      );
    }
  }
  render();
  return app.sheet('Missões', [tabs, body], { nav: 'missions' });
}

export function legendScreen(app: App) { tabMem = 2; return missionsScreen(app); }
export { svg };
