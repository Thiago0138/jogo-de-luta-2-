// Shop: daily featured items, chests, consumables, premium gem packs.
import { sfx } from '../../engine/audio';
import { CHESTS, CONSUMABLES, GEM_PACKS, ITEM, RARITY } from '../../meta/data';
import { addItem, dailyShop, emitChange, msToMidnight, owns, pay, refreshPeriodic, save } from '../../meta/save';
import type { App } from '../app';
import { chestArt, COIN, countdown, fmt, GEM, h, ICON, itemArt, modal, rarityVars, svg, toast } from '../dom';
import { ensureHubStage } from './common';
import { itemDetail } from './fighter';

const priceBtn = (p: { coins?: number; gems?: number } | undefined, onBuy: () => void, disabled = false, label?: string) =>
  h('button', { class: 'btn sm block ' + (p?.gems ? 'primary' : 'gold'), disabled, onclick: (e: Event) => { e.stopPropagation(); onBuy(); } },
    label ?? h('span', { class: 'price' }, svg(p?.gems ? GEM : COIN), fmt(p?.gems ?? p?.coins ?? 0)));

function buy(p: { coins?: number; gems?: number } | undefined, what: string, give: () => void) {
  if (!pay(p)) { sfx.ui('error'); toast(p?.gems ? 'Gemas insuficientes.' : 'Moedas insuficientes.', p?.gems ? GEM : COIN); return false; }
  give();
  sfx.ui('buy');
  toast(`Compraste ${what}!`, ICON.check);
  emitChange();
  return true;
}

export function shopScreen(app: App, params?: Record<string, unknown>): HTMLElement {
  ensureHubStage(app);
  refreshPeriodic();
  const body = h('div');
  const timer = h('span', { class: 'timer' });
  app.tick(() => { timer.textContent = 'Renova em ' + countdown(msToMidnight()); });

  function render() {
    const daily = dailyShop();
    const featured = daily.map((id) => {
      const it = ITEM[id];
      const bought = save.shop.bought.includes(id);
      const have = owns(id);
      return h('div', { class: 'item ' + it.rarity, style: rarityVars(it.rarity), onclick: () => { sfx.ui(); itemDetail(app, id); } },
        RARITY[it.rarity].tier >= 3 ? h('div', { class: 'shine' }) : null,
        have ? h('span', { class: 'eq', style: 'background:var(--cyan);color:#022' }, 'TENS') : null,
        h('div', { class: 'art', html: itemArt(id) }), h('div', { class: 'nm' }, it.name), h('div', { class: 'rt' }, RARITY[it.rarity].name),
        h('div', { class: 'price-tag' }, priceBtn(it.price, () => { if (buy(it.price, it.name, () => { addItem(id, 'shop'); save.shop.bought.push(id); })) render(); }, bought, bought ? 'COMPRADO' : undefined)),
      );
    });
    const chests = CHESTS.map((c) => h('div', { class: 'item ' + c.rarity, style: rarityVars(c.rarity) },
      h('span', { class: 'cnt' }, 'x' + (save.chests[c.id] ?? 0)),
      h('div', { class: 'art', html: chestArt(c.id) }), h('div', { class: 'nm' }, c.name), h('div', { class: 'tiny muted' }, c.desc),
      h('div', { class: 'price-tag' }, priceBtn(c.price, () => { if (buy(c.price, c.name, () => { save.chests[c.id] = (save.chests[c.id] ?? 0) + 1; })) render(); })),
    ));
    const cons = CONSUMABLES.map((c) => h('div', { class: 'item', style: rarityVars(c.rarity) },
      h('span', { class: 'cnt' }, 'x' + (save.consumables[c.id] ?? 0)),
      h('div', { class: 'art', html: itemArt(c.id) }), h('div', { class: 'nm' }, c.name), h('div', { class: 'tiny muted' }, c.desc),
      h('div', { class: 'price-tag' }, priceBtn(c.price, () => { if (buy(c.price, c.name, () => { save.consumables[c.id] = (save.consumables[c.id] ?? 0) + 1; })) render(); })),
    ));
    const gems = GEM_PACKS.map((g, i) => h('div', { class: 'item', style: rarityVars(i >= 3 ? 'lendario' : i >= 1 ? 'epico' : 'raro') },
      g.tag ? h('span', { class: 'eq', style: 'background:var(--gold);color:#3a2100' }, g.tag.toUpperCase()) : null,
      h('div', { class: 'art' }, h('div', { style: 'display:grid;place-items:center;width:100%;height:100%' }, h('div', { style: `width:${50 + i * 9}%`, html: GEM }))),
      h('div', { class: 'nm' }, `${fmt(g.gems)} Gemas`), g.bonus ? h('div', { class: 'tiny', style: 'color:var(--green);font-weight:700' }, `+${fmt(g.bonus)} bónus`) : h('div', { class: 'tiny' }, ' '),
      h('div', { class: 'price-tag' }, h('button', { class: 'btn sm block cyan', onclick: () => premiumModal(g.price) }, g.price)),
    ));
    body.replaceChildren(
      h('div', { class: 'section-title' }, 'Destaques do dia', timer),
      h('div', { class: 'grid' }, featured),
      h('div', { class: 'section-title' }, 'Baús'),
      h('div', { class: 'grid' }, chests),
      h('div', { class: 'section-title' }, 'Consumíveis'),
      h('div', { class: 'grid' }, cons),
      h('div', { class: 'section-title', id: 'gems' }, 'Gemas'),
      h('div', { class: 'grid' }, gems),
      h('p', { class: 'tiny muted', style: 'text-align:center;margin-top:16px' }, 'As skins mais raras saem de baús e desafios. Todos os itens podem ser trocados com outros jogadores.'),
    );
    if (params?.tab === 'gems') requestAnimationFrame(() => document.getElementById('gems')?.scrollIntoView({ behavior: 'smooth' }));
  }

  render();
  return app.sheet('Loja', [body], { nav: 'shop' });
}

function premiumModal(price: string) {
  sfx.ui();
  modal((close) => h('div', null,
    h('div', { class: 'art-big', html: GEM }),
    h('h2', null, 'Loja Premium'),
    h('p', { class: 'muted' }, `Os pagamentos reais (${price}) ainda não estão ativos nesta versão. Enquanto isso, ganha gemas a subir de nível, em missões, no prémio diário e em baús!`),
    h('div', { class: 'acts' }, h('button', { class: 'btn green', onclick: () => close() }, 'Entendido')),
  ));
}
