// Fighter screen: 10 attributes, loadout (skin, hair, specials, super, passives, consumables), level road.
import { sfx } from '../../engine/audio';
import {
  BASE_HAIR, CONSUMABLE, CONSUMABLES, ITEM, ItemDef, ItemKind, KIND_LABEL, LEVEL_REWARDS, MAX_LEVEL, maxHpFor, RARITY, STATS, STAT_BASE, xpToNext,
} from '../../meta/data';
import { emitChange, owns, save } from '../../meta/save';
import type { App } from '../app';
import { h, ICON, itemArt, modal, rarityChip, rarityVars, rewardChips, STAT_ICON, svg, toast } from '../dom';
import { ensureHubStage } from './common';

let tabMem = 0;

export function fighterScreen(app: App, params?: Record<string, unknown>): HTMLElement {
  ensureHubStage(app);
  if (typeof params?.tab === 'number') tabMem = params.tab;
  const body = h('div');
  const tabs = h('div', { class: 'tabs' });
  const names = ['Atributos', 'Equipamento', 'Níveis'];

  function render() {
    tabs.replaceChildren(...names.map((n, i) => h('button', { class: 'tab' + (tabMem === i ? ' on' : ''), onclick: () => { tabMem = i; sfx.ui(); render(); } }, n, i === 0 && save.statPoints > 0 ? h('span', { class: 'badge', style: 'top:-4px;right:-2px' }, String(save.statPoints)) : null)));
    body.replaceChildren(tabMem === 0 ? statsView() : tabMem === 1 ? loadoutView() : levelsView());
  }

  function statsView() {
    const vit = STAT_BASE + save.stats.vit;
    const hp = maxHpFor(save.level, vit);
    return h('div', null,
      h('div', { class: 'hp-preview' }, h('div', null, h('div', { class: 'small muted' }, 'VIDA MÁXIMA'), h('b', null, String(hp))),
        h('div', { style: 'text-align:right' }, h('div', { class: 'small muted' }, 'PONTOS LIVRES'), h('b', { class: 'pts' }, String(save.statPoints)))),
      h('div', { class: 'col', style: 'gap:8px' }, STATS.map((s) => {
        const v = STAT_BASE + save.stats[s.key];
        return h('div', { class: 'stat' },
          h('div', { class: 'si', style: `background:${s.color}22;color:${s.color}` }, svg(STAT_ICON[s.icon])),
          h('div', null,
            h('div', { class: 'sn' }, h('span', null, s.name), h('span', { style: `color:${s.color}` }, String(v))),
            h('div', { class: 'sd' }, s.desc),
            h('div', { class: 'sbar' }, h('i', { style: `width:${Math.min(100, (v / 120) * 100)}%;background:${s.color}` })),
          ),
          h('button', {
            class: 'plus-btn', disabled: save.statPoints <= 0,
            onclick: () => { if (save.statPoints <= 0) return; save.statPoints--; save.stats[s.key]++; sfx.ui('claim'); emitChange(); render(); },
          }, '+'),
        );
      })),
      h('button', { class: 'btn ghost block', style: 'margin-top:14px', onclick: () => { sfx.ui(); app.go('creator', { edit: true }); } }, 'Editar Aparência'),
    );
  }

  function slot(label: string, id: string | null, onPick: () => void, kind?: string) {
    const it = id ? ITEM[id] ?? null : null;
    const cons = id ? CONSUMABLE[id] : null;
    if (!id || (!it && !cons)) return h('button', { class: 'slot empty', onclick: onPick }, h('div', { class: 'sl' }, label), svg(ICON.plus), h('div', { class: 'tiny' }, kind ?? 'Vazio'));
    const r = (it ?? cons)!.rarity;
    return h('button', { class: 'slot', style: `${rarityVars(r)};box-shadow:inset 0 0 0 2px ${RARITY[r].color}`, onclick: onPick },
      h('div', { class: 'sl' }, label), h('div', { class: 'art', html: itemArt(id) }), h('div', { class: 'nm' }, (it ?? cons)!.name),
      cons ? h('div', { class: 'tiny muted' }, `x${save.consumables[id] ?? 0}`) : null);
  }

  function loadoutView() {
    const l = save.loadout;
    const f = save.fighter;
    const hairName = f.hair.startsWith('h_') ? f.hair : null;
    return h('div', null,
      h('div', { class: 'section-title' }, 'Visual'),
      h('div', { class: 'slots' },
        slot('Skin', f.skin, () => picker('skin', (id) => { save.fighter = { ...save.fighter, skin: id! }; })),
        hairName ? slot('Penteado', hairName, () => picker('hair', (id) => { save.fighter = { ...save.fighter, hair: id ?? 'curto' }; }, true))
          : h('button', { class: 'slot', onclick: () => picker('hair', (id) => { save.fighter = { ...save.fighter, hair: id ?? 'curto' }; }, true) }, h('div', { class: 'sl' }, 'Penteado'), svg(ICON.fighter), h('div', { class: 'nm' }, BASE_HAIR.find((b) => b.id === f.hair)?.name ?? 'Base')),
      ),
      h('div', { class: 'section-title' }, 'Golpes Especiais'),
      h('div', { class: 'slots' }, [0, 1].map((i) => slot('Especial ' + (i + 1), l.specials[i], () => picker('special', (id) => { l.specials[i] = id; if (id && l.specials[1 - i] === id) l.specials[1 - i] = null; }, true), 'Especial'))),
      h('div', { class: 'section-title' }, 'Super Ataque'),
      h('div', { class: 'slots' }, slot('Super', l.super, () => picker('super', (id) => { l.super = id; }, true), 'Super')),
      h('div', { class: 'section-title' }, 'Passivas'),
      h('div', { class: 'slots' }, [0, 1].map((i) => slot('Passiva ' + (i + 1), l.passives[i], () => picker('passive', (id) => { l.passives[i] = id; if (id && l.passives[1 - i] === id) l.passives[1 - i] = null; }, true), 'Passiva'))),
      h('div', { class: 'section-title' }, 'Consumíveis (uso automático)'),
      h('div', { class: 'slots' }, [0, 1].map((i) => slot('Bolso ' + (i + 1), l.items[i], () => consumablePicker(i), 'Poção'))),
    );
  }

  function picker(kind: ItemKind, apply: (id: string | null) => void, allowNone = false) {
    const ownedIds = [...new Set(save.inventory.map((i) => i.id))].filter((id) => ITEM[id]?.kind === kind);
    const list: ItemDef[] = ownedIds.map((id) => ITEM[id]).sort((a, b) => RARITY[b.rarity].tier - RARITY[a.rarity].tier);
    modal((close) => h('div', null,
      h('h2', null, KIND_LABEL[kind]),
      h('p', { class: 'muted small' }, 'Escolhe o que levas para o ringue.'),
      kind === 'hair' ? h('div', { class: 'chips', style: 'justify-content:center;margin:8px 0' }, BASE_HAIR.map((b) => h('button', { class: 'chip' + (save.fighter.hair === b.id ? ' on' : ''), onclick: () => { save.fighter = { ...save.fighter, hair: b.id }; sfx.ui(); emitChange(); close(); render(); } }, b.name))) : null,
      list.length ? h('div', { class: 'grid', style: 'margin-top:10px' }, list.map((it) => h('button', { class: 'item ' + it.rarity, style: rarityVars(it.rarity), onclick: () => { apply(it.id); sfx.ui('claim'); emitChange(); close(); render(); } },
        h('div', { class: 'art', html: itemArt(it.id) }), h('div', { class: 'nm' }, it.name), h('div', { class: 'rt' }, RARITY[it.rarity].name),
        it.cost && kind === 'special' ? h('div', { class: 'tiny muted' }, `Custo ${it.cost}% Super`) : null))) : h('div', { class: 'empty-state' }, 'Ainda não tens itens deste tipo. Abre baús ou visita a loja!'),
      allowNone && kind !== 'hair' ? h('button', { class: 'btn ghost block', style: 'margin-top:12px', onclick: () => { apply(null); emitChange(); close(); render(); } }, 'Remover') : null,
    ));
  }

  function consumablePicker(i: number) {
    modal((close) => h('div', null,
      h('h2', null, 'Consumíveis'),
      h('p', { class: 'muted small' }, 'São usados automaticamente quando a luta aperta.'),
      h('div', { class: 'grid', style: 'margin-top:10px' }, CONSUMABLES.map((c) => {
        const n = save.consumables[c.id] ?? 0;
        return h('button', { class: 'item' + (n ? '' : ' locked'), style: rarityVars(c.rarity), onclick: () => { if (!n) { sfx.ui('error'); toast('Não tens nenhum. Compra na loja!', ICON.shop); return; } save.loadout.items[i] = c.id; sfx.ui('claim'); emitChange(); close(); render(); } },
          h('span', { class: 'cnt' }, 'x' + n), h('div', { class: 'art', html: itemArt(c.id) }), h('div', { class: 'nm' }, c.name), h('div', { class: 'tiny muted' }, c.desc));
      })),
      h('button', { class: 'btn ghost block', style: 'margin-top:12px', onclick: () => { save.loadout.items[i] = null; emitChange(); close(); render(); } }, 'Esvaziar bolso'),
    ));
  }

  function levelsView() {
    const nodes: Node[] = [];
    const levels = Object.keys(LEVEL_REWARDS).map(Number).sort((a, b) => a - b);
    nodes.push(h('div', { class: 'card', style: 'margin-bottom:12px' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'display', style: 'font-size:22px' }, `Nível ${save.level}`), h('div', { class: 'small muted' }, save.level >= MAX_LEVEL ? 'Nível máximo!' : `${save.xp} / ${xpToNext(save.level)} XP`)),
        h('div', { class: 'small muted', style: 'text-align:right' }, 'Cada nível: +3 pontos', h('br'), '+vida e +5 gemas')),
      h('div', { class: 'bar cyan', style: 'margin-top:10px' }, h('i', { style: `width:${Math.min(100, (save.xp / xpToNext(save.level)) * 100)}%` })),
    ));
    const nextL = levels.find((l) => l > save.level);
    for (const l of levels) {
      const got = save.level >= l;
      nodes.push(h('div', { class: 'lvl-node' + (got ? ' got' : '') + (l === nextL ? ' next' : '') },
        h('div', { class: 'ln' }, String(l)),
        h('div', { class: 'grow row', style: 'flex-wrap:wrap;gap:6px' }, rewardChips(LEVEL_REWARDS[l])),
        got ? svg(ICON.check) : null,
      ));
    }
    return h('div', { class: 'lvl-road' }, nodes);
  }

  render();
  return app.sheet('Lutador', [tabs, h('div', { class: 'sp' }), body], { nav: 'fighter' });
}

export function itemDetail(app: App, id: string, uid?: string, onChange?: () => void) {
  const it = ITEM[id];
  const owned = uid ? save.inventory.find((i) => i.uid === uid) : save.inventory.find((i) => i.id === id);
  const r = RARITY[it.rarity];
  void app;
  modal((close) => {
    const acts: Node[] = [];
    if (owned) {
      const equipped = isEquippedId(id);
      if (!equipped && (it.kind === 'skin' || it.kind === 'hair' || it.kind === 'super')) {
        acts.push(h('button', { class: 'btn green', onclick: () => {
          if (it.kind === 'skin') save.fighter = { ...save.fighter, skin: id };
          else if (it.kind === 'hair') save.fighter = { ...save.fighter, hair: id };
          else save.loadout.super = id;
          sfx.ui('claim'); emitChange(); toast(`${it.name} equipado!`, ICON.check); close(); onChange?.();
        } }, 'Equipar'));
      }
      if (!equipped && (it.kind === 'special' || it.kind === 'passive')) {
        acts.push(h('button', { class: 'btn green', onclick: () => {
          const arr = it.kind === 'special' ? save.loadout.specials : save.loadout.passives;
          const free = arr.indexOf(null);
          arr[free >= 0 ? free : 0] = id;
          sfx.ui('claim'); emitChange(); toast(`${it.name} equipado!`, ICON.check); close(); onChange?.();
        } }, 'Equipar'));
      }
    }
    return h('div', null,
      h('div', { class: 'art-big', style: `background:radial-gradient(circle, ${r.glow}, transparent 70%)`, html: itemArt(id) }),
      rarityChip(it.rarity),
      h('h2', { style: 'margin-top:8px' }, it.name),
      h('div', { class: 'small muted', style: 'letter-spacing:1px;text-transform:uppercase;font-weight:700' }, KIND_LABEL[it.kind]),
      h('p', null, it.desc),
      it.cost && it.kind === 'special' ? h('p', { class: 'small muted' }, `Custa ${it.cost}% da barra de Super.`) : null,
      owned ? h('div', { class: 'row', style: 'justify-content:center;gap:8px;flex-wrap:wrap' }, h('span', { class: 'serial' }, `#${owned.serial} / ${r.mint}`), h('span', { class: 'serial' }, `Tens: ${save.inventory.filter((i) => i.id === id).length}`)) : h('div', { class: 'small muted' }, 'Ainda não tens este item.'),
      h('div', { class: 'acts' }, acts, h('button', { class: 'btn ghost', onclick: () => close() }, 'Fechar')),
    );
  });
}

function isEquippedId(id: string) {
  const f = save.fighter, l = save.loadout;
  return f.skin === id || f.hair === id || l.super === id || l.specials.includes(id) || l.passives.includes(id);
}

export { owns };
