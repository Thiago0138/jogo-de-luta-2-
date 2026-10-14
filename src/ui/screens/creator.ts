// Character creator: live 3D preview with drag-to-rotate and tabbed options.
import { sfx } from '../../engine/audio';
import {
  Appearance, BASE_HAIR, BEARD_STYLES, BROW_STYLES, BUILDS, EYE_COLORS, EYE_STYLES, HAIR_COLORS, HAIRS, ITEM, MOUTH_STYLES, RARITY, SKIN_TONES,
} from '../../meta/data';
import { randomName } from '../../meta/opponents';
import { emitChange, owns, persist, save } from '../../meta/save';
import { MenuStage } from '../../stages';
import type { App } from '../app';
import { h, hexs, ICON, svg, toast } from '../dom';

export function creatorScreen(app: App, params?: Record<string, unknown>): HTMLElement {
  const editing = !!params?.edit;
  const draft: Appearance = { ...save.fighter };
  if (!save.created) draft.name = randomName();
  const stage = new MenuStage(app.world, draft, 'creator');
  app.setStage(stage);
  let yaw = 0.35;
  stage.setYaw(yaw);
  let rebuildQueued = false;
  const rebuild = () => {
    if (rebuildQueued) return;
    rebuildQueued = true;
    requestAnimationFrame(() => { rebuildQueued = false; stage.rebuild(draft); stage.setYaw(yaw); });
  };

  // drag to rotate
  const canvas = app.world.gfx.renderer.domElement;
  let dragging = false, lastX = 0;
  const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; };
  const move = (e: PointerEvent) => { if (!dragging) return; yaw += (e.clientX - lastX) * 0.012; lastX = e.clientX; stage.setYaw(yaw); };
  const up = () => { dragging = false; };
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  app.onLeave(() => { canvas.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); });

  const tabs = ['Corpo', 'Cara', 'Cabelo', 'Nome'];
  let tab = 0;
  const opts = h('div', { class: 'opts' });
  const tabBar = h('div', { class: 'tabs' });

  const swatches = (list: number[], key: keyof Appearance) => h('div', { class: 'swatches' }, list.map((c, i) =>
    h('button', { class: 'swatch' + (draft[key] === i ? ' on' : ''), style: `background:${hexs(c)}`, onclick: () => { (draft as unknown as Record<string, number>)[key] = i; sfx.ui(); rebuild(); render(); } })));
  const chips = (list: string[], key: keyof Appearance) => h('div', { class: 'chips' }, list.map((label, i) =>
    h('button', { class: 'chip' + (draft[key] === i ? ' on' : ''), onclick: () => { (draft as unknown as Record<string, number>)[key] = i; sfx.ui(); rebuild(); render(); } }, label)));

  function render() {
    tabBar.replaceChildren(...tabs.map((t, i) => h('button', { class: 'tab' + (i === tab ? ' on' : ''), onclick: () => { tab = i; sfx.ui(); render(); } }, t)));
    const L = (t: string) => h('div', { class: 'opt-label' }, t);
    let body: Node[] = [];
    if (tab === 0) {
      const heightSlider = h('input', { type: 'range', class: 'slider', min: '94', max: '106', value: String(Math.round(draft.height * 100)) }) as HTMLInputElement;
      heightSlider.addEventListener('input', () => { draft.height = +heightSlider.value / 100; rebuild(); });
      body = [L('Tom de pele'), swatches(SKIN_TONES, 'skinTone'), L('Físico'), chips(BUILDS, 'build'), L('Altura (só visual)'), heightSlider];
    } else if (tab === 1) {
      body = [L('Olhos'), chips(EYE_STYLES, 'eyes'), L('Cor dos olhos'), swatches(EYE_COLORS, 'eyeColor'), L('Sobrancelhas'), chips(BROW_STYLES, 'brows'), L('Boca'), chips(MOUTH_STYLES, 'mouth'), L('Barba'), chips(BEARD_STYLES, 'beard')];
    } else if (tab === 2) {
      const premium = HAIRS.map((it) => {
        const have = owns(it.id);
        const r = RARITY[it.rarity];
        return h('button', {
          class: 'chip' + (draft.hair === it.id ? ' on' : '') + (have ? '' : ' lock'),
          onclick: () => {
            if (!have) { sfx.ui('error'); toast(`${it.name} (${r.name}) — desbloqueia em baús, na loja ou em desafios.`, ICON.lock); return; }
            draft.hair = it.id; sfx.ui(); rebuild(); render();
          },
        }, h('span', { class: 'rdot', style: `background:${r.color}` }), it.name, have ? null : svg(ICON.lock));
      });
      const forced = draft.hair.startsWith('h_') && ITEM[draft.hair]?.hair?.color !== undefined;
      body = [
        L('Penteados'), h('div', { class: 'chips' }, BASE_HAIR.map((s) => h('button', { class: 'chip' + (draft.hair === s.id ? ' on' : ''), onclick: () => { draft.hair = s.id; sfx.ui(); rebuild(); render(); } }, s.name))),
        L('Penteados premium'), h('div', { class: 'chips' }, premium),
        L(forced ? 'Cor do cabelo (este penteado tem cor própria)' : 'Cor do cabelo'), swatches(HAIR_COLORS, 'hairColor'),
      ];
    } else {
      const input = h('input', { class: 'text-input', maxlength: '16', value: draft.name, placeholder: 'Nome do lutador' }) as HTMLInputElement;
      input.addEventListener('input', () => { draft.name = input.value.slice(0, 16); });
      body = [L('Nome de ringue'), h('div', { class: 'row' }, input, h('button', { class: 'icon-btn', style: 'flex:none', onclick: () => { draft.name = randomName(); input.value = draft.name; sfx.ui(); }, html: ICON.dice })),
        h('p', { class: 'muted small' }, 'A altura e o visual não mudam as estatísticas — o que conta é o treino (níveis e atributos).')];
    }
    opts.replaceChildren(...body);
  }
  render();

  const confirm = h('button', {
    class: 'btn go block', style: 'margin-top:10px',
    onclick: () => {
      draft.name = (draft.name || '').trim() || randomName();
      save.fighter = { ...draft };
      const first = !save.created;
      save.created = true;
      persist(true);
      emitChange();
      sfx.ui('claim');
      if (first) toast('Bem-vindo ao Ringue de Lendas!', ICON.sparkles);
      app.go(editing ? 'fighter' : 'hub');
    },
  }, editing ? 'GUARDAR' : 'ENTRAR NO RINGUE');

  return h('div', { class: 'creator' },
    h('div', { class: 'creator-top' },
      editing ? h('button', { class: 'icon-btn', style: 'position:absolute;left:16px;top:calc(14px + var(--safe-t))', onclick: () => { sfx.ui('back'); app.go('fighter'); }, html: ICON.back }) : null,
      h('h1', null, editing ? 'APARÊNCIA' : 'CRIA O TEU LUTADOR')),
    h('div', { class: 'rot-hint' }, '⟲ arrasta para rodar'),
    h('div', { class: 'creator-panel' }, tabBar, opts, confirm),
  );
}
