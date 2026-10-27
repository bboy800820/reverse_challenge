import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { State } from './simulation';

export function createCockpit() {
  const group = new T.Group();
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  const g = grain.getContext('2d')!, pixels = g.createImageData(256, 256);
  let seed = 42;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const value = 100 + seed % 70;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
  }
  g.putImageData(pixels, 0, 0);
  const texture = new T.CanvasTexture(grain); texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.repeat.set(5, 5);
  const leather = new T.MeshStandardMaterial({ color: 0x111923, roughness: .82, bumpMap: texture, bumpScale: .0015 });
  const rubber = new T.MeshStandardMaterial({ color: 0x080c12, roughness: .72 });
  const silver = new T.MeshStandardMaterial({ color: 0x70838e, metalness: .85, roughness: .3 });
  function rounded(parent: T.Object3D, size: [number, number, number], pos: [number, number, number], material: T.Material, radius = .025) {
    const mesh = new T.Mesh(new RoundedBoxGeometry(...size, 3, radius), material);
    mesh.position.set(...pos); parent.add(mesh); return mesh;
  }
  rounded(group, [1.94, .38, .78], [0, .64, -2.55], leather, .12);
  rounded(group, [1.84, .5, .44], [0, .42, -2.32], leather, .07);
  rounded(group, [1.84, .06, 2.3], [0, .18, -1.68], rubber, .02);
  rounded(group, [1.85, .075, .72], [0, .86, -2.58], leather, .035);
  rounded(group, [1.78, .018, .025], [0, .71, -2.145], silver, .007);
  // Instrument binnacle, facing the driver's eye. Text redraws only when values change.
  const housing = rounded(group, [.67, .27, .2], [-.38, .96, -2.24], rubber, .065);
  housing.rotation.x = -.1;
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 320;
  const ctx = canvas.getContext('2d')!, displayTexture = new T.CanvasTexture(canvas); displayTexture.colorSpace = T.SRGBColorSpace;
  const display = new T.Mesh(new T.PlaneGeometry(.58, .22), new T.MeshBasicMaterial({ map: displayTexture, toneMapped: false }));
  display.position.set(0, 0, .102); housing.add(display);
  const wheelMount = new T.Group(); wheelMount.position.set(-.38, .65, -1.91); wheelMount.rotation.x = -.18; group.add(wheelMount);
  const wheel = new T.Group(); wheelMount.add(wheel);
  const ring = new T.Mesh(new T.TorusGeometry(.255, .029, 14, 72), leather); wheel.add(ring);
  const stitch = new T.Mesh(new T.TorusGeometry(.233, .0016, 5, 96), silver); stitch.position.z = .017; wheel.add(stitch);
  for (const side of [-1, 1]) {
    const spoke = rounded(wheel, [.17, .052, .035], [side * .15, -.015, 0], silver, .012); spoke.rotation.z = side * .17;
    rounded(wheel, [.084, .033, .039], [side * .16, -.01, .012], rubber, .009);
    for (let i = 0; i < 3; i++) rounded(wheel, [.014, .004, .004], [side * .16 + (i - 1) * .023, -.008, .034], silver, .001);
  }
  rounded(wheel, [.045, .18, .035], [0, -.145, 0], silver, .012);
  rounded(wheel, [.18, .13, .07], [0, -.015, .035], leather, .05);
  const badge = new T.Mesh(new T.RingGeometry(.015, .018, 24), silver); badge.position.set(0, 0, .073); wheel.add(badge);
  // Vent slats, hazard switch and a passenger fascia.
  for (const x of [-.83, .2, .49, .79]) {
    rounded(group, [.22, .12, .05], [x, .75, -2.13], rubber, .018);
    for (let i = 0; i < 5; i++) rounded(group, [.19, .006, .03], [x, .706 + i * .022, -2.097], silver, .002);
  }
  rounded(group, [.06, .09, .034], [.345, .75, -2.095], leather, .008);
  const hazard = new T.Mesh(new T.RingGeometry(.012, .015, 3), new T.MeshBasicMaterial({ color: 0xc76e68 })); hazard.position.set(.345, .75, -2.075); group.add(hazard);
  rounded(group, [.42, .3, .12], [.36, .52, -2.22], rubber, .045);
  rounded(group, [.34, .19, .01], [.36, .54, -2.153], new T.MeshStandardMaterial({ color: 0x091a25, metalness: .35, roughness: .18 }), .02);
  // Windshield pillars and door tops remain outside the useful central sightline.
  for (const side of [-1, 1]) {
    const a = new T.Vector3(side * .91, .77, -2.86), b = new T.Vector3(side * .78, 1.62, -1.95);
    const pillar = new T.Mesh(new T.CylinderGeometry(.043, .065, a.distanceTo(b), 10), leather);
    pillar.position.copy(a).add(b).multiplyScalar(.5); pillar.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize()); group.add(pillar);
    rounded(group, [.095, .2, 1.6], [side * .92, .65, -1.8], leather, .035);
  }
  rounded(group, [1.68, .08, .12], [0, 1.62, -1.95], leather, .035);
  group.traverse(o => o.layers.set(2));
  let previous = '';
  return { group, update(s: State) {
    group.position.set(s.x, 0, s.z); group.rotation.y = -s.yaw;
    wheel.rotation.z = -s.steer * 14;
    const speed = (Math.abs(s.speed) * 3.6).toFixed(1), key = `${s.gear}/${speed}`;
    if (key === previous) return;
    previous = key;
    ctx.fillStyle = '#06111b'; ctx.fillRect(0, 0, 768, 320);
    for (const x of [185, 583]) {
      ctx.strokeStyle = '#326078'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, 180, 108, .8 * Math.PI, 2.2 * Math.PI); ctx.stroke();
      ctx.strokeStyle = '#72dcf1'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, 180, 98, .8 * Math.PI, 2.2 * Math.PI); ctx.stroke();
      for (let i = 0; i < 18; i++) { const a = Math.PI * (.8 + i / 17 * 1.4); ctx.strokeStyle = '#7796a7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 87, 180 + Math.sin(a) * 87); ctx.lineTo(x + Math.cos(a) * 96, 180 + Math.sin(a) * 96); ctx.stroke(); }
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#7bdced'; ctx.font = '500 64px Segoe UI'; ctx.fillText(s.gear, 384, 91);
    ctx.fillStyle = '#e6f5ff'; ctx.font = '500 100px Segoe UI'; ctx.fillText(speed, 384, 215);
    ctx.fillStyle = '#90a8b8'; ctx.font = '24px Segoe UI'; ctx.fillText('km/h', 384, 258);
    displayTexture.needsUpdate = true;
  } };
}
