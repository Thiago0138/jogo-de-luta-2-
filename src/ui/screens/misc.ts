// News (patch notes), settings, trading, daily login.
import { sfx } from '../../engine/audio';
import { ITEM, RARITY, Reward } from '../../meta/data';
import { PATCH_NOTES, CURRENT_VERSION } from '../../meta/patchNotes';
import { createTradeCode, emitChange, isEquipped, persist, redeemTradeCode, resetSave, save, countOwned } from '../../meta/save';
import type { App } from '../app';
import { chestArt, COIN, confirmModal, GEM, h, ICON, itemArt, modal, rarityChip, rarityVars, rewardChips, svg, toast } from '../dom';
import { ensureHubStage } from './common';

export function newsScreen(app: App): HTMLElement {
  ensureHubStage(app);
  save.seenPatch = CURRENT_VERSION;
  persist();
  return app.sheet('Novidades', [h('div', { class: 'notes' }, PATCH_NOTES.map((n) => h('div', { class: 'card', style: 'margin-bottom:12px' },
    h('div', null, h('span', { class: 'ver' }, 'v' + n.version), h('span', { class: 'small muted' }, n.date)),
    h('h3', null, n.title),
    h('ul', null, n.items.map((i) => h('li', { html: i }))),
  )))], { back: 'hub' });
}

export function settingsScreen(app: App, onQuality: (q: 'auto' | 'low' | 'medium' | 'high') => void): HTMLElement {
  ensureHubStage(app);
  const s = save.settings;
  const body = h('div');
  const toggle = (on: boolean, fn: () => void) => h('button', { class: 'toggle' + (on ? ' on' : ''), onclick: () => { fn(); sfx.ui(); persist(); render(); } });
  const range = (v: number, fn: (v: number) => void) => {
    const el = h('input', { type: 'range', class: 'slider', min: '0', max: '100', value: String(Math.round(v * 100)), style: 'max-width:160px' }) as HTMLInputElement;
    el.addEventListener('input', () => { fn(+el.value / 100); sfx.setVolumes(s.sfx, s.music); });
    el.addEventListener('change', () => { persist(); sfx.ui(); });
    return el;
  };
  function render() {
    const q = (['auto', 'low', 'medium', 'high'] as const);
    const qn = { auto: 'Auto', low: 'Baixa', medium: 'Média', high: 'Alta' };
    body.replaceChildren(
      h('div', { class: 'section-title' }, 'Gráficos'),
      h('div', { class: 'setting' }, h('div', { class: 'lbl' }, 'Qualidade', h('div', { class: 'tiny muted' }, 'Auto ajusta a resolução para manter a fluidez.')),
        h('div', { class: 'chips' }, q.map((k) => h('button', { class: 'chip' + (s.quality === k ? ' on' : ''), onclick: () => { s.quality = k; persist(); onQuality(k); sfx.ui(); render(); } }, qn[k])))),
      h('div', { class: 'setting' }, h('div', { class: 'lbl' }, 'Números de dano'), toggle(s.dmgNumbers, () => { s.dmgNumbers = !s.dmgNumbers; })),
      h('div', { class: 'section-title' }, 'Som'),
      h('div', { class: 'setting' }, h('div', { class: 'lbl' }, 'Efeitos'), range(s.sfx, (v) => { s.sfx = v; })),
      h('div', { class: 'setting' }, h('div', { class: 'lbl' }, 'Música'), range(s.music, (v) => { s.music = v; })),
      h('div', { class: 'setting' }, h('div', { class: 'lbl' }, 'Vibração'), toggle(s.vibrate, () => { s.vibrate = !s.vibrate; })),
      h('div', { class: 'section-title' }, 'Conta'),
      h('div', { class: 'setting' }, h('div', { class: 'lbl' }, 'Apagar progresso', h('div', { class: 'tiny muted' }, 'Recomeça do zero. Não pode ser desfeito.')),
        h('button', { class: 'btn sm primary', onclick: () => confirmModal('Apagar tudo?', 'Vais perder o teu lutador, itens e progresso.', 'Apagar', () => { resetSave(); location.reload(); }, true) }, 'Apagar')),
      h('p', { class: 'tiny muted', style: 'text-align:center;margin-top:20px' }, `Ringue de Lendas v${CURRENT_VERSION} · o progresso é guardado neste dispositivo`),
    );
  }
  render();
  return app.sheet('Definições', [body], { back: 'hub' });
}

export function tradeScreen(app: App, params?: Record<string, unknown>): HTMLElement {
  ensureHubStage(app);
  const body = h('div');
  let selected = (params?.uid as string) ?? '';
  function render() {
    const tradables = save.inventory.filter((i) => ITEM[i.id]?.tradable !== false).sort((a, b) => RARITY[ITEM[b.id].rarity].tier - RARITY[ITEM[a.id].rarity].tier);
    const input = h('textarea', { class: 'text-input', placeholder: 'Cola aqui o código de troca…' }) as HTMLTextAreaElement;
    body.replaceChildren(
      h('div', { class: 'card', style: 'margin:8px 0 14px' },
        h('div', { class: 'row' }, h('div', { style: 'width:44px;height:44px;flex:none', html: ICON.trade }), h('div', null, h('div', { class: 'display' }, 'Mercado de Lendas'), h('div', { class: 'small muted' }, 'Troca skins e habilidades com outros jogadores. Cada item tem número de série único.'))),
        h('p', { class: 'tiny muted', style: 'margin:10px 0 0' }, 'Nesta versão as trocas fazem-se com códigos: escolhe um item, gera o código e envia-o a outro jogador. O item sai do teu inventário. O mercado online com leilões chega numa atualização futura.'),
      ),
      h('div', { class: 'section-title' }, 'Resgatar código'),
      input,
      h('button', { class: 'btn green block', style: 'margin-top:10px', onclick: () => {
        const r = redeemTradeCode(input.value);
        if (!r.ok) { sfx.ui('error'); toast(r.error, ICON.close); return; }
        sfx.ui('buy');
        const it = ITEM[r.item.id];
        modal((close) => h('div', null, h('div', { class: 'art-big', html: itemArt(it.id) }), rarityChip(it.rarity), h('h2', { style: 'margin-top:8px' }, it.name), h('p', { class: 'muted' }, `Recebeste #${r.item.serial}!`), h('div', { class: 'acts' }, h('button', { class: 'btn green', onclick: () => close() }, 'Fixe!'))));
        render();
      } }, 'Resgatar'),
      h('div', { class: 'section-title' }, 'Enviar um item'),
      tradables.length ? h('div', { class: 'grid' }, tradables.map((o) => {
        const it = ITEM[o.id];
        const locked = isEquipped(o.id) && countOwned(o.id) <= 1;
        return h('button', { class: 'item ' + it.rarity + (locked ? ' locked' : ''), style: rarityVars(it.rarity) + (selected === o.uid ? ';outline:3px solid #fff;outline-offset:2px' : ''), onclick: () => { if (locked) { toast('Desequipa este item primeiro.', ICON.lock); return; } selected = o.uid; sfx.ui(); render(); } },
          h('div', { class: 'art', html: itemArt(o.id) }), h('div', { class: 'nm' }, it.name), h('div', { class: 'tiny serial' }, '#' + o.serial));
      })) : h('div', { class: 'empty-state' }, 'Não tens itens trocáveis.'),
      h('button', { class: 'btn cyan block', style: 'margin-top:12px', disabled: !selected, onclick: () => {
        const o = save.inventory.find((i) => i.uid === selected);
        if (!o) return;
        const it = ITEM[o.id];
        confirmModal('Criar código?', `${it.name} #${o.serial} sai do teu inventário. Só quem tiver o código o pode resgatar.`, 'Criar', () => {
          const code = createTradeCode(selected);
          if (!code) { sfx.ui('error'); toast('Não foi possível criar o código.'); return; }
          selected = '';
          sfx.ui('claim');
          modal((close) => h('div', null,
            h('h2', null, 'Código de troca'),
            h('p', { class: 'muted small' }, `${it.name} #${o.serial}`),
            h('div', { class: 'code-box' }, code),
            h('div', { class: 'acts' },
              h('button', { class: 'btn cyan', onclick: () => { navigator.clipboard?.writeText(code).then(() => toast('Copiado!', ICON.copy)).catch(() => toast('Seleciona e copia o código.')); } }, svg(ICON.copy), 'Copiar'),
              navigator.share ? h('button', { class: 'btn primary', onclick: () => { navigator.share({ title: 'Ringue de Lendas — troca', text: `Resgata ${it.name} no Ringue de Lendas: ${code}` }).catch(() => {}); } }, 'Partilhar') : null,
              h('button', { class: 'btn ghost', onclick: () => close() }, 'Fechar'),
            ),
          ), { closable: true });
          emitChange();
          render();
        });
      } }, 'Gerar código de troca'),
    );
  }
  render();
  return app.sheet('Trocas', [body], { back: 'hub' });
}

export function dailyLoginModal(day: number, reward: Reward) {
  sfx.ui('claim');
  const icons = [COIN, COIN, GEM, chestArt('ch_madeira'), COIN, GEM, chestArt('ch_prata')];
  modal((close) => h('div', { class: 'daily-login' },
    h('h2', null, 'Prémio Diário'),
    h('p', { class: 'muted small' }, `Dia ${day} de 7 — volta amanhã para mais!`),
    h('div', { class: 'days' }, icons.map((ic, i) => h('div', { class: i + 1 === day ? 'on' : i + 1 < day ? 'past' : '' }, svg(ic), `Dia ${i + 1}`))),
    h('div', { class: 'rewards' }, rewardChips(reward)),
    h('div', { class: 'acts' }, h('button', { class: 'btn gold', onclick: () => { close(); emitChange(); } }, 'Receber')),
  ));
}
