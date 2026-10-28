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
  const leather = new T.MeshStandardMaterial({ color: 0x252b32, roughness: .85, bumpMap: texture, bumpScale: .0025 });
  const saddle = new T.MeshStandardMaterial({ color: 0x705244, roughness: .82, bumpMap: texture, bumpScale: .002 });
  const rubber = new T.MeshStandardMaterial({ color: 0x080c12, roughness: .72 });
  const silver = new T.MeshStandardMaterial({ color: 0x99a4ab, metalness: .75, roughness: .42 });
  function rounded(parent: T.Object3D, size: [number, number, number], pos: [number, number, number], material: T.Material, radius = .025) {
    const mesh = new T.Mesh(new RoundedBoxGeometry(...size, 3, radius), material);
    mesh.position.set(...pos); parent.add(mesh); return mesh;
  }
  rounded(group, [1.94, .38, .78], [0, .64, -2.55], leather, .12);
  rounded(group, [1.84, .5, .44], [0, .42, -2.32], leather, .07);
  rounded(group, [1.84, .06, 2.3], [0, .18, -1.68], rubber, .02);
  rounded(group, [1.85, .075, .72], [0, .86, -2.58], leather, .035);
  rounded(group, [1.78, .018, .025], [0, .71, -2.145], silver, .007);
  rounded(group, [1.78, .12, .045], [0, .64, -2.14], saddle, .018);
  // Double stitching across the fascia; short, raised thread segments catch daylight.
  const thread = new T.MeshStandardMaterial({ color: 0xb7a394, roughness: .95 });
  const seams = new T.InstancedMesh(new T.BoxGeometry(.012, .002, .002), thread, 140);
  const seamTransform = new T.Matrix4(); let seamIndex = 0;
  for (let x = -.86; x < .87; x += .025) for (const y of [.673, .66]) seams.setMatrixAt(seamIndex++, seamTransform.makeTranslation(x, y, -2.115));
  seams.count = seamIndex; group.add(seams);
  // Instrument binnacle, facing the driver's eye. Text redraws only when values change.
  const housing = rounded(group, [.67, .27, .2], [-.38, .96, -2.24], rubber, .065);
  housing.rotation.x = -.1;
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 320;
  const ctx = canvas.getContext('2d')!, displayTexture = new T.CanvasTexture(canvas); displayTexture.colorSpace = T.SRGBColorSpace;
  const display = new T.Mesh(new T.PlaneGeometry(.58, .22), new T.MeshBasicMaterial({ map: displayTexture, toneMapped: false }));
  display.position.set(0, 0, .102); housing.add(display);
  const wheelMount = new T.Group(); wheelMount.position.set(-.38, .65, -1.97); wheelMount.rotation.x = -.18; group.add(wheelMount);
  const wheel = new T.Group(); wheelMount.add(wheel);
  const ring = new T.Mesh(new T.TorusGeometry(.255, .029, 14, 72), leather); wheel.add(ring);
  const stitch = new T.Mesh(new T.TorusGeometry(.233, .0016, 5, 96), thread); stitch.position.z = .017; wheel.add(stitch);
  for (const side of [-1, 1]) {
    const spoke = rounded(wheel, [.17, .052, .035], [side * .15, -.015, 0], silver, .012); spoke.rotation.z = side * .17;
    rounded(wheel, [.084, .033, .039], [side * .16, -.01, .012], rubber, .009);
    for (let i = 0; i < 3; i++) rounded(wheel, [.014, .004, .004], [side * .16 + (i - 1) * .023, -.008, .034], silver, .001);
  }
  rounded(wheel, [.045, .18, .035], [0, -.145, 0], silver, .012);
  rounded(wheel, [.18, .13, .07], [0, -.015, .035], leather, .05);
  const badge = new T.Mesh(new T.RingGeometry(.015, .018, 24), silver); badge.position.set(0, 0, .073); wheel.add(badge);
  // Vent slats, hazard switch and a passenger fascia.
  for (const x of [-.83, .18, .48, .79]) {
    rounded(group, [.235, .09, .035], [x, .75, -2.13], silver, .018);
    rounded(group, [.22, .075, .036], [x, .75, -2.122], rubber, .014);
    for (let i = 0; i < 4; i++) rounded(group, [.20, .004, .012], [x, .725 + i * .017, -2.101], leather, .001);
    rounded(group, [.032, .013, .009], [x, .75, -2.091], silver, .003);
  }
  rounded(group, [.06, .09, .034], [.345, .75, -2.095], leather, .008);
  const hazard = new T.Mesh(new T.RingGeometry(.012, .015, 3), new T.MeshBasicMaterial({ color: 0xc76e68 })); hazard.position.set(.345, .75, -2.075); group.add(hazard);
  // Center touchscreen and physical climate controls, separate from the driver's cluster.
  rounded(group, [.5, .285, .055], [.34, .96, -2.25], rubber, .025);
  const infoCanvas = document.createElement('canvas'); infoCanvas.width = 768; infoCanvas.height = 400;
  const info = infoCanvas.getContext('2d')!, infoTexture = new T.CanvasTexture(infoCanvas); infoTexture.colorSpace = T.SRGBColorSpace;
  const screen = new T.Mesh(new T.PlaneGeometry(.455, .237), new T.MeshBasicMaterial({ map: infoTexture, toneMapped: false }));
  screen.position.set(.34, .96, -2.218); group.add(screen);
  const rearMaterial = new T.MeshBasicMaterial({ toneMapped: false });
  const rearScreen = new T.Mesh(new T.PlaneGeometry(.455, .237), rearMaterial);
  const uv = rearScreen.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  rearScreen.position.copy(screen.position); rearScreen.position.z += .001; group.add(rearScreen); rearScreen.visible = false;
  rounded(group, [.43, .11, .06], [.34, .58, -2.16], rubber, .018);
  for (const x of [.18, .49]) {
    const knob = new T.Mesh(new T.CylinderGeometry(.027, .027, .025, 24), silver); knob.rotation.x = Math.PI / 2; knob.position.set(x, .58, -2.11); group.add(knob);
    rounded(group, [.004, .012, .003], [x, .594, -2.095], whiteMaterial(), .001);
  }
  // Raised center tunnel, leather gaiter and PRND gate. Lever moves with the selected gear.
  rounded(group, [.32, .29, .8], [.25, .35, -1.83], saddle, .07);
  rounded(group, [.26, .035, .5], [.25, .51, -1.94], silver, .024);
  rounded(group, [.18, .04, .36], [.25, .53, -1.94], rubber, .025);
  const lever = new T.Group(); lever.position.set(.25, .55, -1.99); group.add(lever);
  rounded(lever, [.04, .12, .04], [0, .05, 0], silver, .012);
  rounded(lever, [.09, .075, .1], [0, .12, 0], leather, .025);
  rounded(lever, [.06, .012, .065], [0, .157, 0], silver, .005);
  const gateCanvas = document.createElement('canvas'); gateCanvas.width = 128; gateCanvas.height = 512;
  const gate = gateCanvas.getContext('2d')!, gateTexture = new T.CanvasTexture(gateCanvas); gateTexture.colorSpace = T.SRGBColorSpace;
  const gatePanel = new T.Mesh(new T.PlaneGeometry(.045, .28), new T.MeshBasicMaterial({ map: gateTexture, toneMapped: false }));
  gatePanel.rotation.x = -Math.PI / 2; gatePanel.position.set(.35, .555, -1.94); group.add(gatePanel);
  // Column stalks and door trim add familiar depth at the edge of vision.
  for (const side of [-1, 1]) {
    rounded(group, [.13, .022, .035], [-.38 + side * .2, .76, -2.03], rubber, .01);
    rounded(group, [.055, .07, 1.3], [side * .87, .68, -1.8], saddle, .02);
    rounded(group, [.03, .014, .7], [side * .84, .735, -1.9], silver, .005);
  }
  // Windshield pillars and door tops remain outside the useful central sightline.
  for (const side of [-1, 1]) {
    const a = new T.Vector3(side * .91, .77, -2.86), b = new T.Vector3(side * .78, 1.62, -1.95);
    const pillar = new T.Mesh(new T.CylinderGeometry(.043, .065, a.distanceTo(b), 10), leather);
    pillar.position.copy(a).add(b).multiplyScalar(.5); pillar.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize()); group.add(pillar);
    rounded(group, [.095, .2, 1.6], [side * .92, .65, -1.8], leather, .035);
    rounded(group, [.13, .56, 1.9], [side * .94, .39, -1.7], leather, .045);
  }
  rounded(group, [1.68, .08, .12], [0, 1.62, -1.95], leather, .035);
  group.traverse(o => o.layers.set(2));
  let previous = '';
  function whiteMaterial() { return new T.MeshBasicMaterial({ color: 0xb6d9e5 }); }
  return { group, setRearView(texture: T.Texture) { rearMaterial.map = texture; rearMaterial.needsUpdate = true; }, update(s: State, braking = false) {
    group.position.set(s.x, 0, s.z); group.rotation.y = -s.yaw;
    wheel.rotation.z = -s.steer * 14;
    lever.position.z = -2.04 + ['P', 'R', 'N', 'D'].indexOf(s.gear) * .055;
    rearScreen.visible = s.gear === 'R' && rearMaterial.map !== null;
    const speed = (Math.abs(s.speed) * 3.6).toFixed(1), brake = braking || s.brakeHold;
    const key = `${s.gear}/${speed}/${brake}/${Math.round(s.steer * 180 / Math.PI)}`;
    if (key === previous) return;
    previous = key;
    ctx.fillStyle = '#06111b'; ctx.fillRect(0, 0, 768, 320);
    for (const [index, x] of [185, 583].entries()) {
      const glow = ctx.createRadialGradient(x, 175, 20, x, 175, 114); glow.addColorStop(0, '#1b2a35'); glow.addColorStop(1, '#03070c'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, 175, 113, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#637682'; ctx.lineWidth = 4; ctx.stroke();
      for (let i = 0; i <= 40; i++) {
        const a = Math.PI * (.75 + i / 40 * 1.5), major = i % 5 === 0;
        ctx.strokeStyle = major ? '#e1edf3' : '#7892a0'; ctx.lineWidth = major ? 3 : 1;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (major ? 87 : 95), 175 + Math.sin(a) * (major ? 87 : 95)); ctx.lineTo(x + Math.cos(a) * 103, 175 + Math.sin(a) * 103); ctx.stroke();
        if (major) { ctx.textAlign = 'center'; ctx.font = '18px Segoe UI'; ctx.fillStyle = '#e2eaf0'; ctx.fillText(String(index === 0 ? i / 2 : i / 5 * 8 - 32), x + Math.cos(a) * 72, 181 + Math.sin(a) * 72); }
      }
      const value = index === 0 ? Math.min(1, Number(speed) / 20) : (s.steer * 180 / Math.PI + 32) / 64;
      const angle = Math.PI * (.75 + value * 1.5);
      ctx.strokeStyle = '#f66e5e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, 175); ctx.lineTo(x + Math.cos(angle) * 84, 175 + Math.sin(angle) * 84); ctx.stroke();
      ctx.fillStyle = '#a7bac5'; ctx.beginPath(); ctx.arc(x, 175, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9eb7c6'; ctx.font = '18px Segoe UI'; ctx.fillText(index === 0 ? 'km/h' : 'STEER °', x, 233);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#7bdced'; ctx.font = '500 64px Segoe UI'; ctx.fillText(s.gear, 384, 91);
    ctx.fillStyle = '#e6f5ff'; ctx.font = '500 100px Segoe UI'; ctx.fillText(speed, 384, 215);
    ctx.fillStyle = '#90a8b8'; ctx.font = '24px Segoe UI'; ctx.fillText('km/h', 384, 258);
    ctx.fillStyle = brake ? '#ffb677' : '#6b8492'; ctx.font = '20px Segoe UI'; ctx.fillText(brake ? '(P)  BRAKE' : 'READY', 384, 298);
    displayTexture.needsUpdate = true;
    info.fillStyle = '#07131e'; info.fillRect(0, 0, 768, 400);
    info.fillStyle = '#6f9bb4'; info.font = '24px Segoe UI'; info.fillText('PARKING ASSIST', 38, 48);
    info.fillStyle = '#e0f4ff'; info.font = '72px Segoe UI'; info.fillText(s.gear, 42, 158);
    info.font = '26px Segoe UI'; info.fillText(brake ? 'BRAKE HOLD' : 'READY TO DRIVE', 145, 143);
    info.strokeStyle = '#426577'; info.strokeRect(42, 188, 684, 1);
    info.fillStyle = '#88c5d8'; info.font = '30px Segoe UI'; info.fillText('21.0°     AUTO          A/C', 40, 335);
    info.fillStyle = '#819cad'; info.font = '24px Segoe UI'; info.fillText('REVERSE CAMERA IN R', 42, 244); infoTexture.needsUpdate = true;
    gate.fillStyle = '#0a1018'; gate.fillRect(0, 0, 128, 512); gate.textAlign = 'center'; gate.font = 'bold 78px Segoe UI';
    ['P', 'R', 'N', 'D'].forEach((letter, i) => { gate.fillStyle = letter === s.gear ? '#88e4ee' : '#73818e'; gate.fillText(letter, 64, i * 124 + 91); }); gateTexture.needsUpdate = true;
  } };
}
