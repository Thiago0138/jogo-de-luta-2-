// Collection / inventory: owned items, full catalogue with locked silhouettes, recycling.
import { sfx } from '../../engine/audio';
import { CONSUMABLES, ITEM, ITEMS, ItemKind, RARITIES, RARITY } from '../../meta/data';
import { countOwned, distinctOwned, isEquipped, recycle, save } from '../../meta/save';
import type { App } from '../app';
import { COIN, confirmModal, fmt, h, ICON, itemArt, rarityVars, svg, toast } from '../dom';
import { ensureHubStage } from './common';
import { itemDetail } from './fighter';

type Filter = 'all' | ItemKind | 'consumable';
let filter: Filter = 'all';
let showAll = false;

export function collectionScreen(app: App): HTMLElement {
  ensureHubStage(app);
  const body = h('div');
  const tabs = h('div', { class: 'tabs' });
  const labels: [Filter, string][] = [['all', 'Tudo'], ['skin', 'Skins'], ['hair', 'Penteados'], ['special', 'Especiais'], ['super', 'Supers'], ['passive', 'Passivas'], ['consumable', 'Poções']];

  function render() {
    tabs.replaceChildren(...labels.map(([f, l]) => h('button', { class: 'tab' + (filter === f ? ' on' : ''), onclick: () => { filter = f; sfx.ui(); render(); } }, l)));
    const total = ITEMS.length;
    const have = distinctOwned();
    const perRarity = RARITIES.map((r) => {
      const all = ITEMS.filter((i) => i.rarity === r.id).length;
      const got = new Set(save.inventory.filter((i) => ITEM[i.id]?.rarity === r.id).map((i) => i.id)).size;
      return h('div', { style: 'flex:1;min-width:64px;text-align:center' }, h('div', { class: 'tiny', style: `color:${r.color};font-weight:800;letter-spacing:1px` }, r.name.toUpperCase()), h('div', { class: 'display', style: 'font-size:15px' }, `${got}/${all}`));
    });
    const header = h('div', { class: 'card', style: 'margin:12px 0' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'display', style: 'font-size:20px' }, 'Coleção'), h('div', { class: 'small muted' }, `${have} de ${total} itens descobertos`)),
        h('button', { class: 'btn sm ' + (showAll ? 'cyan' : 'ghost'), onclick: () => { showAll = !showAll; sfx.ui(); render(); } }, showAll ? 'Ver os meus' : 'Ver todos')),
      h('div', { class: 'bar gold', style: 'margin:10px 0' }, h('i', { style: `width:${(have / total) * 100}%` })),
      h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' }, perRarity),
    );

    let cards: Node[] = [];
    if (filter === 'consumable') {
      cards = CONSUMABLES.map((c) => {
        const n = save.consumables[c.id] ?? 0;
        if (!n && !showAll) return null;
        return h('div', { class: 'item' + (n ? '' : ' locked'), style: rarityVars(c.rarity) }, h('span', { class: 'cnt' }, 'x' + n), h('div', { class: 'art', html: itemArt(c.id) }), h('div', { class: 'nm' }, c.name), h('div', { class: 'rt' }, RARITY[c.rarity].name));
      }).filter(Boolean) as Node[];
    } else {
      const defs = ITEMS.filter((i) => filter === 'all' || i.kind === filter).sort((a, b) => RARITY[b.rarity].tier - RARITY[a.rarity].tier || a.kind.localeCompare(b.kind));
      cards = defs.map((it) => {
        const n = countOwned(it.id);
        if (!n && !showAll) return null;
        const eq = n > 0 && isEquipped(it.id);
        return h('button', { class: 'item ' + it.rarity + (n ? '' : ' locked'), style: rarityVars(it.rarity), onclick: () => { sfx.ui(); n ? detailWithRecycle(it.id) : itemDetail(app, it.id); } },
          RARITY[it.rarity].tier >= 4 && n ? h('div', { class: 'shine' }) : null,
          n > 1 ? h('span', { class: 'cnt' }, 'x' + n) : null,
          eq ? h('span', { class: 'eq' }, 'EQUIPADO') : null,
          h('div', { class: 'art', html: itemArt(it.id) }),
          n ? null : h('div', { class: 'lock', html: ICON.lock }),
          h('div', { class: 'nm' }, it.name), h('div', { class: 'rt' }, RARITY[it.rarity].name));
      }).filter(Boolean) as Node[];
    }
    body.replaceChildren(header, cards.length ? h('div', { class: 'grid' }, cards) : h('div', { class: 'empty-state', html: ICON.bag + '<div>Nada aqui ainda. Abre baús, completa missões e visita a loja!</div>' }));
  }

  function detailWithRecycle(id: string) {
    const copies = save.inventory.filter((i) => i.id === id);
    const it = ITEM[id];
    itemDetail(app, id, copies[0].uid, render);
    // add recycle / trade quick actions for duplicates (appended to the open modal)
    const box = document.querySelector('.modal .acts');
    if (!box) return;
    if (copies.length > 1 || !isEquipped(id)) {
      const value = RARITY[it.rarity].recycle;
      box.prepend(h('button', { class: 'btn ghost', onclick: () => {
        confirmModal('Reciclar', `Reciclar 1x ${it.name} por ${fmt(value)} moedas?`, 'Reciclar', () => {
          const pickUid = [...copies].sort((a, b) => b.serial - a.serial)[0].uid;
          const got = recycle(pickUid);
          if (got) { sfx.ui('buy'); toast(`+${fmt(got)} moedas`, COIN); } else { sfx.ui('error'); toast('Não podes reciclar a última cópia equipada.'); }
          document.querySelector('.modal-back')?.remove();
          render();
        });
      } }, svg(ICON.recycle), 'Reciclar'));
    }
    if (it.tradable !== false) box.prepend(h('button', { class: 'btn cyan', onclick: () => { document.querySelector('.modal-back')?.remove(); app.go('trade', { uid: copies[copies.length - 1].uid }); } }, svg(ICON.trade), 'Trocar'));
  }

  render();
  return app.sheet('Coleção', [tabs, body], { nav: 'collection' });
}
