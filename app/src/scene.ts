import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { localPoint, trajectory, type State } from './simulation';
import { VisualAssets } from './visual-assets';
import { detailedVehicle } from './detailed-vehicle';
import { createCockpit } from './cockpit';
import { createPhotoCabin } from './photo-cabin';
import { parkedVehicle } from './parked-vehicle';
import { photographicEnvironment } from './photographic-environment';
import { parkingLayout } from './parking-layout';
import { SCENARIOS, type Scenario } from './scenarios';
import type { DrivingSide } from './driving-side';

const mat = (color: number, roughness = .7, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
const unitBox = new T.BoxGeometry(1, 1, 1);
function box<M extends T.Material>(parent: T.Object3D, size: [number, number, number], position: [number, number, number], material: M, round = false) {
  const mesh = new T.Mesh(round ? new RoundedBoxGeometry(...size, 2, Math.min(...size) * .18) : unitBox, material);
  if (!round) mesh.scale.set(...size);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}
function car(color: number) {
  const group = new T.Group(), paint = mat(color, .3, .28), dark = mat(0x122432, .26, .25), rubber = mat(0x10171d), silver = mat(0x9aafbf, .3, .6);
  box(group, [1.74, .25, 4.34], [0, .42, -1.35], rubber, true);
  box(group, [1.8, .64, 4.5], [0, .73, -1.35], paint, true);
  box(group, [1.53, .65, 2.38], [0, 1.21, -1.25], dark, true);
  box(group, [1.45, .12, 1.88], [0, 1.53, -1.18], paint, true);
  box(group, [1.6, .08, .81], [0, 1.04, -2.99], paint, true);
  for (const side of [-1, 1]) {
    box(group, [.045, .57, .1], [side * .77, 1.2, -1.25], rubber);
    box(group, [.035, .07, .23], [side * .905, .95, -.64], silver, true);
    box(group, [.035, .07, .23], [side * .905, .95, -1.9], silver, true);
    box(group, [.47, .14, .035], [side * .56, .8, -3.607], new T.MeshStandardMaterial({ color: 0xe3f5ff, emissive: 0x96cfff, emissiveIntensity: .35 }));
  }
  const rearLight = new T.MeshStandardMaterial({ color: 0x8f222a, emissive: 0xff2337, emissiveIntensity: .2 });
  for (const side of [-1, 1]) box(group, [.49, .16, .035], [side * .56, .82, .907], rearLight);
  box(group, [.8, .15, .035], [0, .54, -3.61], rubber);
  box(group, [.41, .12, .035], [0, .56, .915], silver);
  const wheels: T.Group[] = [], frontWheels: T.Group[] = [];
  const tireGeometry = new T.CylinderGeometry(.33, .33, .22, 20), rimGeometry = new T.CylinderGeometry(.21, .21, .225, 12);
  for (const z of [0, -2.7]) for (const side of [-1, 1]) {
    const pivot = new T.Group(); pivot.position.set(side * .78, .34, z); group.add(pivot);
    for (const [geometry, material] of [[tireGeometry, rubber], [rimGeometry, silver]] as const) {
      const mesh = new T.Mesh(geometry, material); mesh.rotation.z = Math.PI / 2; mesh.castShadow = true; pivot.add(mesh);
    }
    wheels.push(pivot); if (z < 0) frontWheels.push(pivot);
  }
  return { group, wheels, frontWheels, rearLight };
}
function groundLabel(text: string, color = '#e0e5df') {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.font = '600 84px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 64);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(new T.PlaneGeometry(1.3, .65), new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; return mesh;
}
function asphalt() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!, pixels = ctx.createImageData(256, 256);
  let seed = 781;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const value = 73 + seed % 26;
    pixels.data[i] = value; pixels.data[i + 1] = value + 5; pixels.data[i + 2] = value + 8; pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.repeat.set(17, 13);
  return texture;
}

export function createScene(root: HTMLElement, contextLost: () => void, scenario: Scenario = SCENARIOS[0], drivingSide: DrivingSide = 'left') {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.domElement.className = 'world-canvas'; renderer.domElement.setAttribute('aria-hidden', 'true');
  document.body.prepend(renderer.domElement);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  const onContextLost = (event: Event) => { event.preventDefault(); contextLost(); };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  const scene = new T.Scene(); scene.background = new T.Color(0xb7cddd); scene.fog = new T.Fog(0xb7cddd, 35, 95);
  const ambient = new T.HemisphereLight(0xe0f0ff, 0x64725a, .85); ambient.layers.enableAll(); scene.add(ambient);
  const sun = new T.DirectionalLight(0xfff0d9, scenario.sunlight); sun.position.set(-9, 23, -12); sun.target.position.set(12, 0, 9); scene.add(sun, sun.target); sun.layers.enableAll();
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 }); sun.shadow.bias = -.0002; sun.shadow.normalBias = .025;
  const fallbackGround = box(scene, [180, .1, 160], [12, -.3, 9], mat(0x66675d));
  const { road, concrete, parked } = parkingLayout(scene, scenario);
  road.material.map = asphalt();
  const parkedCars = parked.map(pose => {
    const fallback = parkedVehicle(car(pose.spec.color ?? 0x545b60).group, { ...pose.spec, sourceYaw: 0 });
    fallback.position.set(pose.x, 0, pose.z); fallback.rotation.y = -pose.yaw;
    scene.add(fallback); return { fallback, spec: pose.spec };
  });
  const ego = car(0xdcae65); ego.group.traverse(o => o.layers.set(1)); scene.add(ego.group);
  const cockpit = createCockpit(drivingSide); scene.add(cockpit.group);
  const photoCabin = createPhotoCabin(root, drivingSide);
  root.classList.add('realistic-cockpit');
  const assets = new VisualAssets();
  let disposed = false, detailedEgo: ReturnType<typeof detailedVehicle> | undefined;
  root.dataset.assets = 'loading';
  root.dataset.scenery = 'loading';
  const egoSource = assets.vehicle();
  const neighborSources = new Map<string, Promise<T.Object3D>>();
  const ready = Promise.allSettled([
    photoCabin.ready,
    ...parkedCars.map(async ({ fallback, spec }) => {
      if (!neighborSources.has(spec.id)) neighborSources.set(spec.id, spec.id === 'ferrari' ? egoSource : assets.luxury(spec.file));
      const source = await neighborSources.get(spec.id)!;
      if (disposed) return;
      const model = parkedVehicle(source, spec);
      model.position.copy(fallback.position); model.rotation.copy(fallback.rotation);
      fallback.visible = false; scene.add(model);
    }),
    assets.sky(scenario.lighting).then(texture => { if (!disposed) { scene.environment = texture; scene.background = texture; scene.environmentIntensity = .65; scene.backgroundIntensity = .85; scene.backgroundRotation.y = scenario.rotation; scene.environmentRotation.y = scenario.rotation; } }),
    assets.panorama(scenario.panorama).then(texture => {
      if (disposed) return;
      scene.add(photographicEnvironment(texture, scenario.rotation));
      fallbackGround.visible = false;
      root.dataset.scenery = 'photo';
    }),
    assets.texture('asphalt_02/Diffuse.jpg', 8, true).then(t => { if (!disposed) { road.material.map!.dispose(); road.material.map = t; road.material.needsUpdate = true; } }),
    assets.texture('asphalt_02/nor_gl.jpg', 8).then(t => { if (!disposed) { road.material.normalMap = t; road.material.normalScale.set(.45, .45); road.material.needsUpdate = true; } }),
    assets.texture('asphalt_02/Rough.jpg', 8).then(t => { if (!disposed) { road.material.roughnessMap = t; road.material.needsUpdate = true; } }),
    assets.texture('concrete_layers_02/Diffuse.jpg', 1, true).then(t => { if (!disposed) { concrete.map = t; concrete.color.set(0xffffff); concrete.needsUpdate = true; } }),
    assets.texture('concrete_layers_02/nor_gl.jpg', 1).then(t => { if (!disposed) { concrete.normalMap = t; concrete.normalScale.set(.3, .3); concrete.needsUpdate = true; } }),
    egoSource.then(source => {
      if (disposed) return;
      detailedEgo = detailedVehicle(source, 0xc99545);
      detailedEgo.group.traverse(o => o.layers.set(1)); scene.add(detailedEgo.group);
      ego.group.visible = false;
      // Retain the overhead heading cue when replacing the body.
      detailedEgo.group.add(arrow); arrow.position.y = 1.41;
    }),
  ]).then(results => {
    if (disposed) return;
    if (root.dataset.scenery !== 'photo') root.dataset.scenery = 'fallback';
    const failed = results.filter(r => r.status === 'rejected');
    root.dataset.assets = failed.length ? 'fallback' : 'ready';
    root.dispatchEvent(new CustomEvent('visuals-ready', { detail: { fallback: failed.length > 0 } }));
  });
  const arrow = groundLabel('↑', '#172d37'); arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, 1.601, -1.2); arrow.scale.set(.65, .65, .65); arrow.layers.set(1); ego.group.add(arrow);
  const rails = [0, 1].map(() => {
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(65 * 3), 3)); geometry.setDrawRange(0, 0);
    const line = new T.Line(geometry, new T.LineDashedMaterial({ color: 0x83e8f0, dashSize: .26, gapSize: .18, depthTest: true })); line.frustumCulled = false; scene.add(line); return line;
  });
  const driver = new T.PerspectiveCamera(65, 1, .08, 140), rear = new T.PerspectiveCamera(48, 1, .08, 140), left = new T.PerspectiveCamera(58, 1, .08, 140), right = new T.PerspectiveCamera(58, 1, .08, 140);
  driver.layers.enable(2);
  left.layers.enable(1); right.layers.enable(1);
  const overhead = new T.OrthographicCamera(-12, 12, 9, -9, .1, 100); overhead.layers.enable(1); overhead.position.set(12, 35, 8.5); overhead.up.set(0, 0, -1); overhead.lookAt(12, 0, 8.5);
  const mirrorScene = new T.Scene(), mirrorCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 2); mirrorCamera.position.z = 1;
  const quadGeometry = new T.PlaneGeometry(2, 2), uv = quadGeometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  const quadMaterial = new T.MeshBasicMaterial({ depthTest: false, depthWrite: false, toneMapped: false }); mirrorScene.add(new T.Mesh(quadGeometry, quadMaterial));
  const targets = [rear, left, right].map(() => new T.WebGLRenderTarget(256, 128, { depthBuffer: true }));
  cockpit.setRearView(targets[0].texture);
  const elements = Object.fromEntries(['driver', 'overhead', 'rear', 'left', 'right'].map(name => [name, root.querySelector<HTMLElement>(`[data-view="${name}"]`)!]));
  let width = 0, height = 0, previousX: number | undefined, previousZ = 0, distance = 0;
  function cameraPose(camera: T.PerspectiveCamera, s: State, lateral: number, forward: number, y: number, relativeYaw: number, slope: number) {
    const p = localPoint(s, lateral, forward), yaw = s.yaw + relativeYaw;
    camera.position.set(p.x, y, p.z); camera.lookAt(p.x + Math.sin(yaw) * 10, y + slope * 10, p.z - Math.cos(yaw) * 10);
  }
  function viewport(rect: DOMRect, clip = rect) {
    renderer.setViewport(rect.left, height - rect.bottom, rect.width, rect.height);
    const left = Math.max(rect.left, clip.left), right = Math.min(rect.right, clip.right);
    const top = Math.max(rect.top, clip.top), bottom = Math.min(rect.bottom, clip.bottom);
    renderer.setScissor(left, height - bottom, Math.max(0, right - left), Math.max(0, bottom - top));
  }
  function visible(rect: DOMRect) { return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height; }
  function render(s: State, aids: boolean, braking = false) {
    if (width !== innerWidth || height !== innerHeight) { width = innerWidth; height = innerHeight; renderer.setSize(width, height); }
    ego.group.position.set(s.x, 0, s.z); ego.group.rotation.y = -s.yaw;
    ego.frontWheels.forEach(wheel => wheel.rotation.y = -s.steer);
    ego.rearLight.emissiveIntensity = s.brakeHold || s.speed === 0 ? 1.3 : .2;
    cockpit.group.visible = !photoCabin.active;
    if (photoCabin.active) photoCabin.update(s, braking); else cockpit.update(s, braking);
    if (previousX !== undefined) { const delta = Math.hypot(s.x - previousX, s.z - previousZ); if (delta < .5) distance += delta * Math.sign(s.speed); }
    previousX = s.x; previousZ = s.z;
    if (detailedEgo) {
      detailedEgo.group.position.copy(ego.group.position); detailedEgo.group.rotation.y = -s.yaw;
      detailedEgo.frontWheels.forEach(wheel => wheel.rotation.y = -s.steer);
      detailedEgo.rearLight.emissiveIntensity = s.brakeHold || braking ? 2 : .2;
      detailedEgo.roll(distance);
    }
    const path = aids ? trajectory(s, scenario.world) : { left: [], right: [] };
    [path.left, path.right].forEach((points, index) => {
      const line = rails[index], attribute = line.geometry.getAttribute('position') as T.BufferAttribute;
      points.forEach((p, i) => attribute.setXYZ(i, p.x, .045, p.z));
      attribute.needsUpdate = true; line.geometry.setDrawRange(0, points.length); line.computeLineDistances(); line.visible = points.length > 1;
    });
    const sideSign = drivingSide === 'right' ? -1 : 1;
    cameraPose(driver, s, -.38 * sideSign, 1.05, 1.22, photoCabin.active ? 0 : .12 * sideSign, photoCabin.active ? -.1 : -.27);
    cameraPose(rear, s, 0, 1.6, 1.4, Math.PI, -.12);
    cameraPose(left, s, -1.01, 2.2, 1.14, Math.PI + .18, -.2);
    cameraPose(right, s, 1.01, 2.2, 1.14, Math.PI - .18, -.2);
    renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setClearColor(0x091827, 0); renderer.clear(); renderer.setScissorTest(true);
    renderer.shadowMap.needsUpdate = true;
    for (const [name, camera] of [['driver', driver], ['overhead', overhead]] as const) {
      const rect = elements[name].getBoundingClientRect(); if (!visible(rect)) continue;
      const aspect = rect.width / rect.height;
      if (camera instanceof T.PerspectiveCamera) camera.aspect = aspect;
      else { const halfHeight = Math.max(9.2, 12.7 / aspect); camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; }
      camera.updateProjectionMatrix(); viewport(rect); renderer.render(scene, camera);
    }
    (['rear', 'left', 'right'] as const).forEach((name, i) => {
      const rect = elements[name].getBoundingClientRect(), mirrorVisible = visible(rect);
      // The dashboard uses this texture too, even when scrolling hides the DOM mirror.
      const cabinNeedsRear = name === 'rear' && s.gear === 'R' && visible(elements.driver.getBoundingClientRect());
      if ((!mirrorVisible && !cabinNeedsRear) || rect.width <= 0 || rect.height <= 0) return;
      const camera = [rear, left, right][i], target = targets[i];
      const w = Math.max(1, Math.round(rect.width * renderer.getPixelRatio())), h = Math.max(1, Math.round(rect.height * renderer.getPixelRatio()));
      if (target.width !== w || target.height !== h) target.setSize(w, h);
      camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
      // setRenderTarget already installs a viewport in physical target pixels.
      // setViewport would apply the screen pixel ratio again and crop mirrors.
      renderer.setRenderTarget(target); renderer.setScissorTest(false); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.setScissorTest(true);
      if (mirrorVisible) { viewport(rect); quadMaterial.map = target.texture; renderer.render(mirrorScene, mirrorCamera); }
      if (name === 'rear' && photoCabin.active && s.gear === 'R') {
        const screen = photoCabin.monitor.getBoundingClientRect();
        if (visible(screen)) {
          // Crop the shared wide mirror image to the photographed monitor's aspect.
          const crop = Math.min(1, (screen.width / screen.height) / camera.aspect);
          for (let v = 0; v < uv.count; v++) uv.setX(v, .5 + (v % 2 === 0 ? .5 : -.5) * crop);
          uv.needsUpdate = true; viewport(screen, elements.driver.getBoundingClientRect()); quadMaterial.map = target.texture; renderer.render(mirrorScene, mirrorCamera);
          for (let v = 0; v < uv.count; v++) uv.setX(v, v % 2 === 0 ? 1 : 0);
          uv.needsUpdate = true;
        }
      }
    });
  }
  function dispose() {
    disposed = true; photoCabin.dispose();
    renderer.setAnimationLoop(null);
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
    for (const tree of [scene, mirrorScene]) tree.traverse(object => {
      if (!(object instanceof T.Mesh || object instanceof T.Line)) return;
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => {
        materials.add(material); Object.values(material).forEach(value => { if (value instanceof T.Texture) textures.add(value); });
      });
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); targets.forEach(t => t.dispose());
    assets.dispose(); sun.shadow.dispose();
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  }
  return { renderer, render, dispose, ready, setDrivingSide(side: DrivingSide) {
    drivingSide = side; cockpit.setDrivingSide(side); photoCabin.setDrivingSide(side);
  } };
}
