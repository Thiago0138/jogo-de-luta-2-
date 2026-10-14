// ─────────────────────────────────────────────────────────────────────────────
//  App shell: screen router, shared chrome (top bar, bottom nav), stage swap.
// ─────────────────────────────────────────────────────────────────────────────
import { sfx } from '../engine/audio';
import type { World } from '../engine/world';
import { xpToNext } from '../meta/data';
import { CURRENT_VERSION } from '../meta/patchNotes';
import { onChange, pendingClaims, save } from '../meta/save';
import type { Stage } from '../stages';
import { COIN, fmt, GEM, h, ICON, svg } from './dom';

export type ScreenFn = (app: App, params?: Record<string, unknown>) => HTMLElement;

export class App {
  stage: Stage | null = null;
  root = document.getElementById('ui')!;
  private screenEl: HTMLElement | null = null;
  current = '';
  private screens: Record<string, ScreenFn> = {};
  private leave: (() => void)[] = [];
  private tickers: ((dt: number) => void)[] = [];

  constructor(public world: World) {
    onChange(() => this.refreshChrome());
  }

  register(name: string, fn: ScreenFn) { this.screens[name] = fn; }

  setStage(s: Stage | null) {
    this.stage?.dispose();
    this.stage = s;
  }

  /** run cleanup when leaving the current screen */
  onLeave(fn: () => void) { this.leave.push(fn); }
  /** per-frame callback for the current screen */
  tick(fn: (dt: number) => void) { this.tickers.push(fn); }

  go(name: string, params?: Record<string, unknown>) {
    for (const fn of this.leave) fn();
    this.leave = [];
    this.tickers = [];
    const fn = this.screens[name];
    if (!fn) return;
    this.current = name;
    const el = fn(this, params);
    if (this.screenEl) this.screenEl.remove();
    this.screenEl = el;
    this.root.appendChild(el);
    this.refreshChrome();
  }

  update(dt: number) {
    for (const t of this.tickers) t(dt);
    this.stage?.update(dt);
  }

  // ── shared chrome ──────────────────────────────────────────────────────────
  private chrome: { coins?: HTMLElement; gems?: HTMLElement; lvl?: HTMLElement; xp?: HTMLElement; name?: HTMLElement; badges: Record<string, HTMLElement> } = { badges: {} };

  refreshChrome() {
    const c = this.chrome;
    if (c.coins) c.coins.textContent = fmt(save.coins);
    if (c.gems) c.gems.textContent = fmt(save.gems);
    if (c.lvl) c.lvl.textContent = String(save.level);
    if (c.xp) c.xp.style.width = `${Math.min(100, (save.xp / xpToNext(save.level)) * 100)}%`;
    if (c.name) c.name.textContent = save.fighter.name;
    const claims = pendingClaims();
    const chests = Object.values(save.chests).reduce((a, b) => a + b, 0);
    const newsUnseen = save.seenPatch !== CURRENT_VERSION;
    const set = (k: string, n: number | boolean) => {
      const el = c.badges[k];
      if (!el) return;
      el.style.display = n ? '' : 'none';
      el.textContent = typeof n === 'number' && n > 0 ? String(n) : '';
      el.classList.toggle('dot', n === true);
    };
    set('missions', claims);
    set('chests', chests);
    set('news', newsUnseen);
    set('fighter', save.statPoints > 0 ? save.statPoints : 0);
  }

  badge(key: string) {
    const b = h('span', { class: 'badge', style: 'display:none' });
    this.chrome.badges[key] = b;
    return b;
  }

  currencies(): HTMLElement {
    this.chrome.coins = h('span', null, fmt(save.coins));
    this.chrome.gems = h('span', null, fmt(save.gems));
    return h('div', { class: 'row', style: 'gap:8px' },
      h('button', { class: 'currency', onclick: () => { sfx.ui(); this.go('shop', { tab: 'coins' }); } }, svg(COIN), this.chrome.coins, h('span', { class: 'plus' }, '+')),
      h('button', { class: 'currency', onclick: () => { sfx.ui(); this.go('shop', { tab: 'gems' }); } }, svg(GEM), this.chrome.gems, h('span', { class: 'plus' }, '+')),
    );
  }

  profile(): HTMLElement {
    this.chrome.lvl = h('span', null, String(save.level));
    this.chrome.xp = h('i', { style: `width:${Math.min(100, (save.xp / xpToNext(save.level)) * 100)}%` });
    this.chrome.name = h('div', { class: 'name' }, save.fighter.name);
    const ring = `conic-gradient(var(--cyan) ${Math.min(100, (save.xp / xpToNext(save.level)) * 100)}%, rgba(255,255,255,.12) 0)`;
    return h('button', { class: 'profile', onclick: () => { sfx.ui(); this.go('fighter'); } },
      h('div', { class: 'avatar', style: `background:${ring}` }, h('div', { class: 'lvl' }, this.chrome.lvl)),
      h('div', { style: 'min-width:0;text-align:left' }, this.chrome.name, h('div', { class: 'xpbar' }, this.chrome.xp)),
    );
  }

  nav(active: string): HTMLElement {
    const items: [string, string, string][] = [
      ['hub', 'Início', ICON.home], ['fighter', 'Lutador', ICON.fighter], ['collection', 'Coleção', ICON.bag], ['shop', 'Loja', ICON.shop], ['missions', 'Missões', ICON.missions],
    ];
    return h('nav', { class: 'nav' }, h('div', { class: 'nav-in' }, items.map(([id, label, icon]) =>
      h('button', { class: active === id ? 'on' : '', onclick: () => { if (this.current !== id) { sfx.ui(); this.go(id); } } }, svg(icon), label, this.badge(id)),
    )));
  }

  /** standard full-screen sheet with a header */
  sheet(title: string, body: Node[], opts: { back?: string; nav?: string; right?: Node } = {}): HTMLElement {
    const head = h('div', { class: 'sheet-head' },
      opts.back ? h('button', { class: 'icon-btn', onclick: () => { sfx.ui('back'); this.go(opts.back!); }, html: ICON.back }) : null,
      h('h2', null, title),
      opts.right ?? this.currencies(),
    );
    const el = h('div', { class: 'screen' },
      h('div', { class: 'sheet' }, head, h('div', { class: 'sheet-body' }, h('div', { class: 'wrap' }, body))),
      opts.nav ? this.nav(opts.nav) : null,
    );
    return el;
  }
}
