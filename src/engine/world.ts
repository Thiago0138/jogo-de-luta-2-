// ─────────────────────────────────────────────────────────────────────────────
//  World: the single long-lived 3D context shared by menus, fights and chests.
// ─────────────────────────────────────────────────────────────────────────────
import { Arena } from './arena';
import { Director } from './director';
import { Fx } from './fx';
import { Gfx } from './gfx';

export interface World {
  gfx: Gfx;
  arena: Arena;
  fx: Fx;
  director: Director;
}

export function createWorld(canvas: HTMLCanvasElement, quality: 'auto' | 'low' | 'medium' | 'high'): World {
  const gfx = new Gfx(canvas);
  gfx.setQuality(quality);
  const arena = new Arena(gfx, gfx.quality);
  const fx = new Fx(gfx.quality);
  gfx.scene.add(fx.root);
  const director = new Director(gfx.camera);
  return { gfx, arena, fx, director };
}
