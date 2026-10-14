// ─────────────────────────────────────────────────────────────────────────────
//  Ringue de Lendas — entry point.
// ─────────────────────────────────────────────────────────────────────────────
import '@fontsource/russo-one/latin-400.css';
import '@fontsource-variable/rubik/wght.css';
import './styles/main.css';
import { sfx } from './engine/audio';
import { createWorld } from './engine/world';
import { checkLogin, refreshPeriodic, save } from './meta/save';
import { App } from './ui/app';
import { chestsScreen } from './ui/screens/chests';
import { collectionScreen } from './ui/screens/collection';
import { creatorScreen } from './ui/screens/creator';
import { fighterScreen } from './ui/screens/fighter';
import { fightScreen } from './ui/screens/fight';
import { hubScreen } from './ui/screens/hub';
import { dailyLoginModal, newsScreen, settingsScreen, tradeScreen } from './ui/screens/misc';
import { legendScreen, missionsScreen } from './ui/screens/missions';
import { playScreen, vsScreen } from './ui/screens/play';
import { shopScreen } from './ui/screens/shop';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const world = createWorld(canvas, save.settings.quality);
const app = new App(world);
sfx.setVolumes(save.settings.sfx, save.settings.music);

app.register('creator', creatorScreen);
app.register('hub', hubScreen);
app.register('play', playScreen);
app.register('vs', vsScreen);
app.register('fight', fightScreen);
app.register('fighter', fighterScreen);
app.register('collection', collectionScreen);
app.register('shop', shopScreen);
app.register('chests', chestsScreen);
app.register('missions', missionsScreen);
app.register('missions-legend', legendScreen);
app.register('news', newsScreen);
app.register('trade', tradeScreen);
app.register('settings', (a) => settingsScreen(a, (q) => world.gfx.setQuality(q)));

// first interaction unlocks audio + starts the menu groove
const unlock = () => {
  sfx.unlock();
  if (app.current !== 'fight') sfx.music(true);
  window.removeEventListener('pointerdown', unlock);
};
window.addEventListener('pointerdown', unlock);

refreshPeriodic();
app.go(save.created ? 'hub' : 'creator');

// render loop — pauses with the tab, lighter frame pacing in menus on low quality
let last = performance.now();
let skip = false;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  if (world.gfx.quality === 'low' && app.current !== 'fight') { skip = !skip; if (skip) return; }
  last = now;
  app.update(dt);
  world.gfx.render();
  world.gfx.sample(dt, now);
}
requestAnimationFrame((t) => { last = t; frame(t); });

// boot overlay out, daily login in
requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  boot?.classList.add('hide');
  setTimeout(() => boot?.remove(), 700);
  if (save.created) {
    const login = checkLogin();
    if (login) setTimeout(() => dailyLoginModal(login.day, login.reward), 600);
  }
});

// PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
