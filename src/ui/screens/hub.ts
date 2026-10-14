// Main menu: the player's fighter in the ring, currencies, play button.
import { sfx } from '../../engine/audio';
import { MenuStage } from '../../stages';
import { save } from '../../meta/save';
import { ITEM, RARITY } from '../../meta/data';
import type { App } from '../app';
import { chestArt, h, ICON, svg } from '../dom';

export function hubScreen(app: App): HTMLElement {
  if (!(app.stage instanceof MenuStage) || app.stage.mode !== 'hub' || app.stage.hero.rig.app !== save.fighter) {
    app.setStage(new MenuStage(app.world, save.fighter, 'hub'));
  }
  app.world.arena.setScreen(save.fighter.name, `NÍVEL ${save.level}`);
  const skin = ITEM[save.fighter.skin];
  const side = (label: string, icon: string, go: string, badge?: string, extra?: Node) =>
    h('button', { class: 'side-btn', onclick: () => { sfx.ui(); app.go(go); } }, h('div', { class: 'ic' }, extra ?? svg(icon)), label, badge ? app.badge(badge) : null);

  return h('div', { class: 'screen' },
    h('div', { class: 'topbar' }, app.profile(), h('div', { class: 'spacer' }), app.currencies()),
    h('div', { class: 'hub-side left' },
      side('NOVIDADES', ICON.news, 'news', 'news'),
      side('DEFINIÇÕES', ICON.gear, 'settings'),
    ),
    h('div', { class: 'hub-side right' },
      side('BAÚS', ICON.chest, 'chests', 'chests', svg(chestArt('ch_ouro'))),
      side('TROCAS', ICON.trade, 'trade'),
      side('DESAFIOS', ICON.crown, 'missions-legend'),
    ),
    h('div', { class: 'hub-bottom' },
      h('div', { class: 'fighter-tag' },
        h('div', { class: 'n' }, save.fighter.name),
        h('div', { class: 't', style: `color:${RARITY[skin?.rarity ?? 'comum'].color}` }, skin?.name ?? ''),
      ),
      h('div', { class: 'play-btn' }, h('button', { class: 'btn go', onclick: () => { sfx.ui('buy'); app.go('play'); } }, svg(ICON.swords), 'LUTAR')),
    ),
    app.nav('hub'),
  );
}
