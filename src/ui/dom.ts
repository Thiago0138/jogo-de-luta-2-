// ─────────────────────────────────────────────────────────────────────────────
//  Tiny DOM toolkit (no framework): element builder, icons, item art, toasts,
//  modals and formatting helpers.
// ─────────────────────────────────────────────────────────────────────────────
import { CHEST, CONSUMABLE, HAIR_COLORS, ITEM, RARITY, Rarity, Reward } from '../meta/data';
import { sfx } from '../engine/audio';

type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & { class?: string; style?: string; html?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v as string;
      else if (k === 'style') el.setAttribute('style', v as string);
      else if (k === 'html') el.innerHTML = v as string;
      else if (k.startsWith('on') && typeof v === 'function') {
        const ev = k.slice(2).toLowerCase();
        if (ev === 'click') el.addEventListener('click', (e) => { sfx.unlock(); (v as (e: Event) => void)(e); });
        else el.addEventListener(ev, v as EventListener);
      } else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}
function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}
export const svg = (markup: string, cls = '') => { const s = document.createElement('span'); s.className = cls; s.style.display = 'contents'; s.innerHTML = markup; return s; };
export const fmt = (n: number) => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.0', '') + 'k' : n.toLocaleString('pt-PT');
export const hexs = (n: number) => '#' + n.toString(16).padStart(6, '0');
export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${hh}h` : hh > 0 ? `${hh}h ${mm}m` : `${mm}m ${s % 60}s`;
}

// ── icons (inline SVG, 24×24 viewBox unless noted) ───────────────────────────
const I = (p: string, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const ICON = {
  home: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  fighter: I('<circle cx="12" cy="6" r="3"/><path d="M6 21v-5a6 6 0 0112 0v5"/><path d="M4 12l3-2M20 12l-3-2"/>'),
  bag: I('<path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/>'),
  shop: I('<path d="M3 9l2-5h14l2 5"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0"/>'),
  missions: I('<path d="M9 4h6l1 2h3v15H5V6h3l1-2z"/><path d="M9 12l2 2 4-4"/>'),
  chest: I('<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9a9 5 0 0118 0"/><path d="M10 13h4v3h-4z"/>'),
  trade: I('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 010-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z"/>'),
  news: I('<path d="M4 5h13v14H6a2 2 0 01-2-2V5z"/><path d="M17 9h3v8a2 2 0 01-2 2"/><path d="M8 9h5M8 13h5"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  lock: I('<rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" stroke="none"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  check: I('<path d="M5 12l5 5 9-10"/>'),
  play: I('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  ff: I('<path d="M4 5l8 7-8 7zM12 5l8 7-8 7z" fill="currentColor"/>'),
  dice: I('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h10"/>'),
  crown: I('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" fill="currentColor"/>'),
  skull: I('<path d="M12 3a8 8 0 00-5 14v3h10v-3a8 8 0 00-5-14z"/><circle cx="9" cy="11" r="1.6" fill="currentColor"/><circle cx="15" cy="11" r="1.6" fill="currentColor"/>'),
  users: I('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-1a6 6 0 0112 0v1M15 20v-1a4 4 0 016-3.5"/>'),
  swords: I('<path d="M4 4l9 9M20 4l-9 9M7 17l-3 3M17 17l3 3M5 14l5 5M19 14l-5 5"/>'),
  sparkles: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor"/>'),
  recycle: I('<path d="M7 19H4l3-5M17 5l3 5h-6M10 4l2-1 3 5"/><path d="M14 20h4l-2-4"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  pause: I('<path d="M8 5v14M16 5v14"/>'),
  skip: I('<path d="M5 5l9 7-9 7zM17 5v14"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
};

export const STAT_ICON: Record<string, string> = {
  fist: I('<path d="M7 11V7a1.5 1.5 0 013 0v3M10 10V6a1.5 1.5 0 013 0v4M13 10V7a1.5 1.5 0 013 0v4M16 11V9a1.5 1.5 0 013 0v4a7 7 0 01-7 7h-1a6 6 0 01-6-6v-2a2 2 0 012-2h3"/>'),
  grab: I('<path d="M4 14c3-1 5 1 8 0s4-4 8-3"/><path d="M4 10c3-1 5 1 8 0s4-4 8-3"/>'),
  bolt: I('<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/>'),
  wind: I('<path d="M3 8h11a3 3 0 10-3-3M3 12h16a3 3 0 11-3 3M3 16h8"/>'),
  shield: I('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  heart: I('<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" fill="currentColor"/>'),
  lungs: I('<path d="M12 4v8M12 12c-2-1-3-3-5-3-2 0-3 3-3 6s1 5 3 5 5-1 5-4zM12 12c2-1 3-3 5-3 2 0 3 3 3 6s-1 5-3 5-5-1-5-4z"/>'),
  target: I('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  star: I('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor"/>'),
  phoenix: I('<path d="M12 21c-4 0-6-3-6-6 0-4 4-5 4-10 3 2 5 5 5 8 1-1 1-2 1-3 2 2 3 4 3 6 0 3-3 5-7 5z"/>'),
};

// currency glyphs (filled, colorful)
export const COIN = `<svg viewBox="0 0 32 32"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#e08a00"/></linearGradient></defs><circle cx="16" cy="16" r="13" fill="url(#cg)" stroke="#a35b00" stroke-width="2"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="#c87800" stroke-width="2" opacity=".6"/><path d="M13 11h5a3 3 0 010 6h-5v5" stroke="#a35b00" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="11" cy="9" rx="4" ry="2" fill="#fff" opacity=".5"/></svg>`;
export const GEM = `<svg viewBox="0 0 32 32"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc2f0"/><stop offset=".45" stop-color="#ff2e88"/><stop offset="1" stop-color="#7c1d6f"/></linearGradient></defs><path d="M8 5h16l5 7-13 16L3 12z" fill="url(#gg)" stroke="#5a0f3a" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12h26M11 5l-3 7 8 16 8-16-3-7M8 12l8-7 8 7" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" fill="none"/></svg>`;
export const XP = `<svg viewBox="0 0 32 32"><defs><linearGradient id="xg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5f3fc"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><path d="M16 3l3.6 7.7 8.4 1-6.2 5.8 1.6 8.3L16 21.7 8.6 25.8l1.6-8.3L4 11.7l8.4-1z" fill="url(#xg)" stroke="#3b1a7a" stroke-width="1.6" stroke-linejoin="round"/><text x="16" y="19" font-size="7" font-weight="900" text-anchor="middle" fill="#fff" font-family="sans-serif">XP</text></svg>`;

// ── procedural item art ──────────────────────────────────────────────────────
let artId = 0;
function grad(stops: [number, string][], dir = '0 0 0 1') {
  const id = 'g' + (artId++);
  const [x1, y1, x2, y2] = dir.split(' ');
  return { id, def: `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>` };
}

export function itemArt(id: string): string {
  const it = ITEM[id];
  if (it?.kind === 'skin' && it.look) {
    const L = it.look;
    const p = hexs(L.primary), s = hexs(L.secondary), a = hexs(L.accent), gl = hexs(L.gloves), b = hexs(L.boots);
    const g1 = grad([[0, s], [1, p]]);
    const top = L.top === 'none'
      ? `<path d="M30 26 Q50 18 70 26 L66 54 H34 Z" fill="#e8b088"/><path d="M42 32q8 6 16 0" stroke="#b9805a" stroke-width="2" fill="none"/>`
      : L.top === 'singlet' ? `<path d="M30 26 Q50 18 70 26 L66 54 H34 Z" fill="url(#${g1.id})"/><path d="M38 24 v10 M62 24 v10" stroke="#e8b088" stroke-width="6"/>`
      : `<path d="M28 26 Q50 16 72 26 L68 56 H32 Z" fill="${s}"/><path d="M50 20 V56" stroke="${a}" stroke-width="3"/><path d="M40 21l10 10 10-10" stroke="${a}" stroke-width="3" fill="none"/>`;
    const mask = L.mask && L.mask !== 'none' ? `<circle cx="50" cy="13" r="10" fill="${L.mask === 'visor' ? '#111122' : p}"/>${L.mask === 'visor' ? `<rect x="40" y="10" width="20" height="5" rx="2" fill="${L.glow ? hexs(L.glow) : a}"/>` : `<ellipse cx="46" cy="13" rx="3" ry="2.5" fill="${a}"/><ellipse cx="54" cy="13" rx="3" ry="2.5" fill="${a}"/>`}` : `<circle cx="50" cy="13" r="9.5" fill="#e8b088"/>`;
    const glow = L.aura ? `<circle cx="50" cy="50" r="44" fill="${L.aura === 'rainbow' ? '#a78bfa' : hexs(L.aura)}" opacity=".18"/>` : '';
    return `<svg viewBox="0 0 100 100"><defs>${g1.def}</defs>${glow}
      ${top}${mask}
      <path d="M33 54 H67 L70 70 H54 L50 64 L46 70 H30 Z" fill="${p}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      <rect x="33" y="52" width="34" height="5" rx="2" fill="${a}"/>
      <rect x="32" y="70" width="12" height="16" rx="3" fill="#e8b088"/><rect x="56" y="70" width="12" height="16" rx="3" fill="#e8b088"/>
      <rect x="31" y="82" width="14" height="12" rx="3" fill="${b}"/><rect x="55" y="82" width="14" height="12" rx="3" fill="${b}"/>
      <circle cx="20" cy="40" r="10" fill="${gl}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/><circle cx="80" cy="40" r="10" fill="${gl}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      <path d="M30 30 L22 36 M70 30 L78 36" stroke="#e8b088" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="17" cy="36" rx="3" ry="2" fill="#fff" opacity=".45"/><ellipse cx="77" cy="36" rx="3" ry="2" fill="#fff" opacity=".45"/></svg>`;
  }
  if (it?.kind === 'hair' && it.hair) {
    const H = it.hair;
    const c = hexs(H.color ?? HAIR_COLORS[2]);
    const glow = H.glow ? `<circle cx="50" cy="40" r="40" fill="${hexs(H.glow)}" opacity=".25"/>` : '';
    let hair = '';
    switch (H.base) {
      case 'dreads': hair = `<path d="M24 46 Q22 18 50 16 Q78 18 76 46" fill="${c}"/>${[26, 33, 40, 60, 67, 74].map((x) => `<rect x="${x - 3}" y="40" width="6" height="34" rx="3" fill="${c}"/>`).join('')}`; break;
      case 'coque': hair = `<path d="M26 44 Q24 20 50 18 Q76 20 74 44 Q60 30 26 44" fill="${c}"/><circle cx="50" cy="13" r="9" fill="${c}"/>`; break;
      case 'topete': hair = `<path d="M26 44 Q24 22 46 20 Q40 6 62 6 Q82 10 74 44 Q60 28 26 44" fill="${c}"/>`; break;
      case 'moicano': hair = `<path d="M44 40 L42 6 L50 14 L54 4 L58 14 L62 8 L58 40 Z" fill="${c}"/>`; break;
      case 'cristal': hair = `${[[30, 30], [40, 14], [50, 6], [60, 14], [70, 30]].map(([x, y]) => `<path d="M${x} ${y} l7 14 -7 14 -7 -14z" fill="${c}" stroke="#fff" stroke-opacity=".6"/>`).join('')}`; break;
      case 'super': hair = `<path d="M24 46 L14 16 L32 28 L34 4 L46 22 L56 2 L62 24 L78 8 L74 30 L90 22 L76 46 Q50 30 24 46" fill="${c}" stroke="rgba(0,0,0,.2)"/>`; break;
      case 'chamas': hair = `<path d="M24 46 Q18 26 30 18 Q30 30 38 26 Q34 12 48 2 Q46 18 56 18 Q60 8 68 12 Q64 24 72 26 Q82 22 76 46 Q50 32 24 46" fill="${c}"/><path d="M38 40 Q36 26 46 20 Q46 30 54 28 Q58 34 62 40" fill="#fff" opacity=".35"/>`; break;
      default: hair = `<path d="M24 50 Q22 18 50 16 Q78 18 76 50 L72 74 Q50 82 28 74Z" fill="${c}"/>`;
    }
    const crown = H.crown ? `<path d="M32 22 L36 8 L44 18 L50 4 L56 18 L64 8 L68 22Z" fill="#ffcc33" stroke="#a35b00" stroke-width="1.5"/>` : '';
    return `<svg viewBox="0 0 100 100">${glow}<circle cx="50" cy="52" r="22" fill="#e8b088"/>${hair}${crown}<circle cx="43" cy="54" r="3" fill="#1a0f14"/><circle cx="57" cy="54" r="3" fill="#1a0f14"/><path d="M44 64 Q50 68 56 64" stroke="#1a0f14" stroke-width="2" fill="none"/></svg>`;
  }
  if (it && (it.kind === 'special' || it.kind === 'super')) {
    const col = RARITY[it.rarity].color;
    const fxCol: Record<string, string> = { fireupper: '#ff6a1f', icehammer: '#9fe8ff', boltkick: '#ffe14d', quake: '#ffd23f', phantom: '#a78bfa', atomic: '#ff5a1f', tornado: '#d8f3ff', flurry: '#ffffff', flyingknee: '#ffffff', bearhug: '#c08457', sup_bomb: '#ffd23f', sup_triple: '#ffd23f', sup_thunder: '#7dd3fc', sup_meteor: '#ff6a1f', sup_dragon: '#ff4500', sup_nova: '#c084fc' };
    const c = fxCol[it.move!] ?? col;
    const g = grad([[0, '#fff'], [0.4, c], [1, col]]);
    if (it.kind === 'super') {
      return `<svg viewBox="0 0 100 100"><defs>${g.def}</defs><path d="M50 4 L58 34 L90 22 L66 46 L96 60 L62 62 L72 94 L50 70 L28 94 L38 62 L4 60 L34 46 L10 22 L42 34Z" fill="url(#${g.id})" stroke="rgba(0,0,0,.3)" stroke-width="2"/><circle cx="50" cy="50" r="16" fill="#fff" opacity=".85"/><text x="50" y="56" text-anchor="middle" font-family="Russo One, sans-serif" font-size="16" fill="${col}">S</text></svg>`;
    }
    return `<svg viewBox="0 0 100 100"><defs>${g.def}</defs><circle cx="50" cy="50" r="40" fill="${c}" opacity=".2"/><path d="M30 46 V30 a6 6 0 0112 0 v12 M42 40 V26 a6 6 0 0112 0 v14 M54 40 V30 a6 6 0 0112 0 v14 M66 44 V36 a6 6 0 0112 0 v16 a26 26 0 01-26 26 h-4 a24 24 0 01-24-24 v-6 a8 8 0 018-8 h12" fill="url(#${g.id})" stroke="rgba(0,0,0,.35)" stroke-width="3" stroke-linejoin="round"/>${[0, 1, 2].map((i) => `<path d="M${12 + i * 6} ${70 - i * 18} l-10 4" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`).join('')}</svg>`;
  }
  if (it?.kind === 'passive') {
    const col = RARITY[it.rarity].color;
    const g = grad([[0, '#fff'], [0.5, col], [1, '#2a1f6b']]);
    return `<svg viewBox="0 0 100 100"><defs>${g.def}</defs><path d="M50 6 L86 20 V48 C86 72 70 88 50 94 C30 88 14 72 14 48 V20 Z" fill="url(#${g.id})" stroke="rgba(0,0,0,.35)" stroke-width="3"/><path d="M50 22 L56 40 L74 40 L60 52 L66 70 L50 59 L34 70 L40 52 L26 40 L44 40Z" fill="#fff" opacity=".85"/></svg>`;
  }
  const c = CONSUMABLE[id];
  if (c) {
    const g = grad([[0, '#fff'], [0.35, c.color], [1, '#1d1850']]);
    return `<svg viewBox="0 0 100 100"><defs>${g.def}</defs><rect x="40" y="8" width="20" height="14" rx="3" fill="#8b5a2b"/><rect x="36" y="20" width="28" height="8" rx="3" fill="#cfd6e6"/><path d="M38 28 V40 L22 64 a14 14 0 0012 22 h32 a14 14 0 0012 -22 L62 40 V28Z" fill="url(#${g.id})" stroke="rgba(255,255,255,.7)" stroke-width="3"/><ellipse cx="38" cy="62" rx="5" ry="10" fill="#fff" opacity=".45"/><circle cx="58" cy="70" r="4" fill="#fff" opacity=".5"/><circle cx="50" cy="58" r="2.5" fill="#fff" opacity=".5"/></svg>`;
  }
  const ch = CHEST[id];
  if (ch) return chestArt(id);
  return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#555"/></svg>`;
}

export function chestArt(id: string) {
  const ch = CHEST[id];
  const [body, trim, glow] = ch.colors.map(hexs);
  const g = grad([[0, '#fff'], [0.25, body], [1, '#000']]);
  const cosmic = ch.rarity === 'cosmico';
  return `<svg viewBox="0 0 100 100"><defs>${g.def}</defs><ellipse cx="50" cy="56" rx="44" ry="34" fill="${glow}" opacity="${cosmic ? 0.45 : 0.22}"/>
    <path d="M14 46 Q14 22 50 20 Q86 22 86 46Z" fill="url(#${g.id})" stroke="${trim}" stroke-width="4"/>
    <rect x="14" y="46" width="72" height="36" rx="5" fill="${body}" stroke="${trim}" stroke-width="4"/>
    <rect x="14" y="44" width="72" height="8" fill="${trim}"/>
    <rect x="26" y="24" width="8" height="58" fill="${trim}" opacity=".85"/><rect x="66" y="24" width="8" height="58" fill="${trim}" opacity=".85"/>
    <rect x="42" y="44" width="16" height="18" rx="3" fill="${glow}" stroke="${trim}" stroke-width="3"/>
    <circle cx="50" cy="53" r="3" fill="${trim}"/>
    ${cosmic ? '<circle cx="24" cy="18" r="2" fill="#fff"/><circle cx="80" cy="14" r="2.5" fill="#fff"/><circle cx="88" cy="40" r="1.5" fill="#fff"/>' : ''}
    <path d="M20 30 Q34 22 50 22" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
}

export function rarityVars(r: Rarity) { const d = RARITY[r]; return `--rc:${d.color};--rg:${d.glow}`; }
export function rarityChip(r: Rarity) {
  const d = RARITY[r];
  return h('span', { class: 'rar ' + r, style: r === 'cosmico' ? '' : `background:${d.color}` }, d.name);
}

export function rewardChips(r: Reward): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (r.coins) out.push(h('span', { class: 'rw-chip' }, svg(COIN), fmt(r.coins)));
  if (r.gems) out.push(h('span', { class: 'rw-chip' }, svg(GEM), fmt(r.gems)));
  if (r.xp) out.push(h('span', { class: 'rw-chip' }, svg(XP), fmt(r.xp)));
  if (r.chest) out.push(h('span', { class: 'rw-chip', style: `color:${RARITY[CHEST[r.chest].rarity].color}` }, svg(chestArt(r.chest)), CHEST[r.chest].name));
  if (r.item) out.push(h('span', { class: 'rw-chip', style: `color:${RARITY[ITEM[r.item].rarity].color}` }, svg(itemArt(r.item)), ITEM[r.item].name));
  return out;
}

// ── toasts & modals ──────────────────────────────────────────────────────────
let toastHost: HTMLElement | null = null;
export function toast(text: string, icon?: string) {
  if (!toastHost) { toastHost = h('div', { class: 'toasts' }); document.body.appendChild(toastHost); }
  const t = h('div', { class: 'toast' }, icon ? svg(icon) : null, text);
  toastHost.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

export function modal(build: (close: () => void) => Node, opts: { closable?: boolean; onClose?: () => void } = {}) {
  const back = h('div', { class: 'modal-back' });
  const close = () => { back.remove(); opts.onClose?.(); };
  const box = h('div', { class: 'modal' });
  if (opts.closable !== false) box.appendChild(h('button', { class: 'x', onclick: () => { sfx.ui('back'); close(); }, html: ICON.close }));
  box.appendChild(build(close));
  back.appendChild(box);
  if (opts.closable !== false) back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.body.appendChild(back);
  return close;
}

export function confirmModal(title: string, text: string, ok: string, onOk: () => void, danger = false) {
  modal((close) => h('div', null,
    h('h2', null, title),
    h('p', { class: 'muted' }, text),
    h('div', { class: 'acts' },
      h('button', { class: 'btn ghost', onclick: () => { sfx.ui('back'); close(); } }, 'Cancelar'),
      h('button', { class: 'btn ' + (danger ? 'primary' : 'green'), onclick: () => { close(); onOk(); } }, ok),
    ),
  ));
}
