import * as T from 'three';
import { vehicleTransform } from './vehicle-fit';

export function detailedVehicle(source: T.Object3D, color: number) {
  const model = source.clone(true), fitted = new T.Group(), group = new T.Group();
  fitted.add(model); group.add(fitted);
  fitted.applyMatrix4(vehicleTransform(new T.Box3().setFromObject(model)));
  const paint = new T.MeshPhysicalMaterial({ color, metalness: .65, roughness: .23, clearcoat: 1, clearcoatRoughness: .12 });
  const glass = new T.MeshPhysicalMaterial({ color: 0x101c28, metalness: .25, roughness: .1, clearcoat: 1 });
  const rearLight = new T.MeshStandardMaterial({ color: 0xa9131a, roughness: .25, emissive: 0xff1b12, emissiveIntensity: .25 });
  model.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    // The exterior silhouette casts the same parking shadow without rendering
    // dashboard, badges, engine and brake hardware into the shadow map again.
    object.castShadow = object.name === 'body' || object.name.startsWith('tire');
    object.receiveShadow = true;
    if (object.name === 'body') object.material = paint;
    else if (object.name === 'glass') object.material = glass;
    else if (object.name === 'lights_red') object.material = rearLight;
  });
  // World-aligned pivots retain the imported wheel's bind rotation.
  const frontWheels: T.Group[] = [], rolling: T.Group[] = [];
  model.updateMatrixWorld(true);
  for (const name of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
    const wheel = model.getObjectByName(name);
    if (!wheel) continue;
    const pivot = new T.Group(); pivot.position.copy(wheel.position);
    wheel.position.set(0, 0, 0); wheel.parent!.add(pivot); pivot.add(wheel);
    const spin = new T.Group(); pivot.add(spin); spin.add(wheel); rolling.push(spin);
    if (name.startsWith('wheel_f')) frontWheels.push(pivot);
  }
  return { group, frontWheels, rearLight, roll(distance: number) { rolling.forEach(w => w.rotation.x = -distance / .33); } };
}
