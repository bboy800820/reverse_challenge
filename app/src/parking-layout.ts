import * as T from 'three';
import { BAY_CENTERS } from './simulation';
import type { Scenario } from './scenarios';
import { neighborSpec } from './fleet';

/** All physical parked cars and curb edges come from the collision world. */
export function parkingLayout(scene: T.Scene, scenario: Scenario) {
  const geometry = new T.BoxGeometry(1, 1, 1);
  const concrete = new T.MeshStandardMaterial({ color: 0xb1b4b3, roughness: .9 });
  const white = new T.MeshStandardMaterial({ color: 0xe5e1cf, roughness: .9 });
  const cyan = new T.MeshBasicMaterial({ color: 0x79e0e8 });
  function box(size: [number, number, number], pos: [number, number, number], material: T.Material) {
    const mesh = new T.Mesh(geometry, material); mesh.scale.set(...size); mesh.position.set(...pos);
    mesh.receiveShadow = true; scene.add(mesh); return mesh;
  }
  function label(text: string, x: number, z: number, width = 1.3) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.font = '600 80px Segoe UI'; ctx.fillStyle = '#dce9e5'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 93);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(new T.PlaneGeometry(width, .65), new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .035, z); scene.add(mesh);
  }
  const road = new T.Mesh(new T.BoxGeometry(24, .15, 17), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .96 }));
  road.position.set(12, -.08, 8.5); road.receiveShadow = true; scene.add(road);
  const b = scenario.world.bounds, t = scenario.world.target;
  for (const x of [b.minX - .2, b.maxX + .2]) box([.4, .3, b.maxZ - b.minZ + .8], [x, .1, (b.minZ + b.maxZ) / 2], concrete);
  for (const z of [b.minZ - .2, b.maxZ + .2]) box([b.maxX - b.minX + .8, .3, .4], [(b.minX + b.maxX) / 2, .1, z], concrete);
  const goal = new T.Mesh(new T.PlaneGeometry(t.maxX - t.minX, t.maxZ - t.minZ), new T.MeshBasicMaterial({ color: 0x54b9c6, opacity: .16, transparent: true, depthWrite: false }));
  goal.rotation.x = -Math.PI / 2; goal.position.set((t.minX + t.maxX) / 2, .012, (t.minZ + t.maxZ) / 2); scene.add(goal);
  if (scenario.kind === 'perpendicular') {
    BAY_CENTERS.forEach((x, i) => {
      const material = i === 2 ? cyan : white;
      for (const side of [-1, 1]) box([.085, .012, 6.1], [x + side * 1.5, .015, 11.25], material);
      box([3.08, .012, .085], [x, .015, 14.3], material); label(String(i + 1).padStart(2, '0'), x, 15);
    });
    for (let x = 3; x < 22; x += 3.1) box([1.3, .012, .07], [x, .014, 3.6], white);
  } else {
    for (const x of [t.minX, t.maxX]) box([.075, .012, t.maxZ - t.minZ], [x, .02, (t.minZ + t.maxZ) / 2], cyan);
    for (const z of [t.minZ, t.maxZ]) box([t.maxX - t.minX, .012, .075], [(t.minX + t.maxX) / 2, .02, z], cyan);
    for (let x = 1; x < 23; x += 3.2) box([1.6, .012, .09], [x, .02, 6.5], white);
    box([24, .2, 1.7], [12, .03, 16], concrete);
    label('P', 12.4, 13.35, 1.2); label('→', 12, 8.2, 2);
    // Sidewalk joints remain behind the solid curb/collision boundary.
    const joint = new T.MeshStandardMaterial({ color: 0x747877, roughness: 1 });
    for (let x = 1; x < 24; x += 1.5) box([.018, .006, 1.5], [x, .135, 16.1], joint);
  }
  const yaw = scenario.kind === 'parallel' ? Math.PI / 2 : 0;
  const parked = scenario.world.obstacles.map((r, i) => ({
    x: (r.minX + r.maxX) / 2,
    z: (r.minZ + r.maxZ) / 2, yaw, spec: neighborSpec(i, scenario.kind),
  }));
  return { road, concrete, parked };
}
