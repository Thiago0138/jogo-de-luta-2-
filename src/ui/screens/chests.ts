// Chests: list owned chests, then the in-ring opening cinematic + card reveal.
import { sfx } from '../../engine/audio';
import { CHEST, CHESTS, CONSUMABLE, ITEM, KIND_LABEL, RARITY } from '../../meta/data';
import { LootEntry, lootPeak, openChest, pay, save, emitChange } from '../../meta/save';
import { ChestStage } from '../../stages';
import type { App } from '../app';
import { chestArt, COIN, fmt, GEM, h, ICON, itemArt, rarityChip, rarityVars, svg, toast } from '../dom';
import { ensureHubStage } from './common';

export function chestsScreen(app: App, params?: Record<string, unknown>): HTMLElement {
  if (params?.open && (save.chests[params.open as string] ?? 0) > 0) return openingScreen(app, params.open as string);
  ensureHubStage(app);
  const list = CHESTS.map((c) => {
    const n = save.chests[c.id] ?? 0;
    const r = RARITY[c.rarity];
    return h('div', { class: 'card', style: `display:flex;gap:14px;align-items:center;box-shadow:inset 0 0 0 2px ${n ? r.color : 'rgba(255,255,255,.06)'}, 0 0 ${n ? 22 : 0}px ${r.glow}` },
      h('div', { style: 'width:92px;height:92px;flex:none', html: chestArt(c.id) }),
      h('div', { class: 'grow' },
        h('div', { class: 'display', style: 'font-size:18px' }, c.name),
        h('div', { class: 'small muted', style: 'margin:2px 0 6px' }, c.desc),
        h('div', { class: 'row', style: 'gap:4px;flex-wrap:wrap' }, Object.entries(c.weights).map(([rk, w]) => h('span', { class: 'tiny', style: `color:${RARITY[rk as keyof typeof RARITY].color};font-weight:700;margin-right:6px` }, `${RARITY[rk as keyof typeof RARITY].name} ${w}%`))),
      ),
      h('div', { class: 'col', style: 'gap:6px;align-items:stretch;min-width:96px' },
        h('div', { class: 'display', style: 'text-align:center;font-size:20px' }, 'x' + n),
        n ? h('button', { class: 'btn sm go', onclick: () => { sfx.ui('buy'); app.go('chests', { open: c.id }); } }, 'ABRIR')
          : h('button', { class: 'btn sm ' + (c.price?.gems ? 'primary' : 'gold'), onclick: () => {
            if (!pay(c.price)) { sfx.ui('error'); toast('Saldo insuficiente.', c.price?.gems ? GEM : COIN); return; }
            save.chests[c.id] = (save.chests[c.id] ?? 0) + 1; emitChange(); sfx.ui('buy'); app.go('chests', { open: c.id });
          } }, h('span', { class: 'price' }, svg(c.price?.gems ? GEM : COIN), fmt(c.price?.gems ?? c.price?.coins ?? 0))),
      ),
    );
  });
  return app.sheet('Baús', [h('div', { class: 'col', style: 'gap:12px;margin-top:6px' }, list),
    h('p', { class: 'tiny muted', style: 'text-align:center;margin-top:16px' }, 'Ganha baús ao vencer lutas, completar missões, subir de nível e em desafios lendários.')], { back: 'hub' });
}

function openingScreen(app: App, chestId: string): HTMLElement {
  const loot = openChest(chestId)!;
  const peak = lootPeak(loot);
  const stage = new ChestStage(app.world, chestId, peak);
  app.setStage(stage);
  sfx.crowdStart();
  app.onLeave(() => sfx.crowdStop());
  const def = CHEST[chestId];
  const hint = h('div', { class: 'hint' }, 'TOCA PARA ABRIR');
  const ui = h('div', { class: 'chest-ui' }, h('div', { class: 'display', style: `font-size:26px;margin-bottom:auto;padding-top:calc(30px + var(--safe-t));text-shadow:0 4px 12px #000;color:${RARITY[def.rarity].color}` }, def.name.toUpperCase()), hint);
  const root = h('div', { class: 'screen' }, ui);
  ui.addEventListener('click', () => { sfx.unlock(); stage.tap(); if (stage.phase === 'shake') hint.textContent = ['', 'MAIS UMA VEZ!', 'QUASE...'][Math.min(2, (hint.dataset.n = String(+(hint.dataset.n ?? 0) + 1), +hint.dataset.n))] || 'TOCA!'; });
  stage.onOpened = () => { ui.remove(); reveal(); };

  // the reveal: coins/gems first, consumables, then items from low → high rarity
  const order: LootEntry[] = [...loot.filter((l) => l.type === 'coins' || l.type === 'gems'), ...loot.filter((l) => l.type === 'consumable'), ...loot.filter((l) => l.type === 'item')];
  let i = 0;
  const stageEl = h('div', { class: 'reveal' });
  function card(l: LootEntry): HTMLElement {
    const r = RARITY[l.rarity];
    let art = '', name = '', kind = '';
    if (l.type === 'coins') { art = COIN; name = `${fmt(l.amount!)} Moedas`; kind = 'Moedas'; }
    else if (l.type === 'gems') { art = GEM; name = `${fmt(l.amount!)} Gemas`; kind = 'Gemas'; }
    else if (l.type === 'consumable') { art = itemArt(l.id!); name = `${CONSUMABLE[l.id!].name} x${l.amount}`; kind = 'Consumível'; }
    else { art = itemArt(l.id!); name = ITEM[l.id!].name; kind = KIND_LABEL[ITEM[l.id!].kind]; }
    const el = h('div', { class: 'rcard' + (l.duplicate ? ' dup' : ''), style: rarityVars(l.rarity) },
      h('div', { class: 'face' + (l.rarity === 'cosmico' ? ' cosmico' : '') },
        r.tier >= 2 && l.type === 'item' ? h('div', { class: 'rays' }) : null,
        l.type === 'item' && !l.duplicate ? h('span', { class: 'new' }, 'NOVO') : null,
        h('div', { class: 'art', html: art }),
        l.type === 'item' ? rarityChip(l.rarity) : null,
        h('div', { class: 'nm' }, name),
        h('div', { class: 'kd' }, kind),
        l.owned ? h('span', { class: 'serial' }, `#${l.owned.serial} / ${r.mint}`) : null,
      ));
    return el;
  }
  function next() {
    if (i >= order.length) { summary(); return; }
    const l = order[i++];
    stageEl.replaceChildren(card(l), h('div', { class: 'hint', style: 'position:absolute;bottom:calc(30px + var(--safe-b));font-family:var(--display)' }, `${i}/${order.length} · toca para continuar`));
    const tier = RARITY[l.rarity].tier;
    if (l.type === 'item') {
      sfx.reveal(tier);
      if (tier >= 3) app.world.director.shake(0.2 + tier * 0.08);
      if (tier >= 4) app.world.arena.hype(1);
    } else sfx.ui('claim');
  }
  function reveal() {
    root.appendChild(stageEl);
    stageEl.addEventListener('click', next);
    next();
  }
  function summary() {
    stageEl.removeEventListener('click', next);
    const items = loot.filter((l) => l.type === 'item');
    stageEl.replaceChildren(h('div', { class: 'panel summary', style: 'padding:18px 14px;margin:16px' },
      h('h2', { style: 'font-size:26px;text-align:center' }, 'Recompensas'),
      h('div', { class: 'grid', style: 'margin:14px 0' }, items.map((l) => h('div', { class: 'item ' + l.rarity, style: rarityVars(l.rarity) },
        l.duplicate ? h('span', { class: 'cnt' }, 'DUP') : null, h('div', { class: 'art', html: itemArt(l.id!) }), h('div', { class: 'nm' }, ITEM[l.id!].name), h('div', { class: 'rt' }, RARITY[l.rarity].name)))),
      h('div', { class: 'row', style: 'justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:14px' }, loot.filter((l) => l.type !== 'item').map((l) => h('span', { class: 'rw-chip' }, svg(l.type === 'coins' ? COIN : l.type === 'gems' ? GEM : itemArt(l.id!)), l.type === 'consumable' ? `${CONSUMABLE[l.id!].name} x${l.amount}` : fmt(l.amount!)))),
      h('div', { class: 'row', style: 'gap:10px' },
        h('button', { class: 'btn ghost grow', onclick: () => { sfx.ui('back'); app.go('hub'); } }, 'MENU'),
        (save.chests[chestId] ?? 0) > 0 ? h('button', { class: 'btn go grow', onclick: () => { sfx.ui('buy'); app.go('chests', { open: chestId }); } }, `ABRIR OUTRO (${save.chests[chestId]})`)
          : h('button', { class: 'btn cyan grow', onclick: () => { sfx.ui(); app.go('collection'); } }, svg(ICON.bag), 'COLEÇÃO'),
      ),
    ));
  }
  return root;
}
