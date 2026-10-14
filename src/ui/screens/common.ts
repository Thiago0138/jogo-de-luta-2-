import { save } from '../../meta/save';
import { MenuStage } from '../../stages';
import type { App } from '../app';

/** sheets float above the hub showcase; make sure it is there */
export function ensureHubStage(app: App) {
  if (!(app.stage instanceof MenuStage) || app.stage.mode !== 'hub' || app.stage.hero.rig.app !== save.fighter) {
    app.setStage(new MenuStage(app.world, save.fighter, 'hub'));
  }
}
