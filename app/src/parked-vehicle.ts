import * as T from 'three';
import type { FleetCar } from './fleet';

export function parkedVehicleTransform(bounds: T.Box3, car: FleetCar): T.Matrix4 {
  const size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
  if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid parked vehicle bounds');
  const scale = new T.Vector3(car.width / size.x, car.height / size.y, car.length / size.z);
  return new T.Matrix4().makeScale(scale.x, scale.y, scale.z).setPosition(-center.x * scale.x, -bounds.min.y * scale.y, -center.z * scale.z);
}

export function parkedVehicle(source: T.Object3D, car: FleetCar) {
  const model = source.clone(true), aligned = new T.Group(), fitted = new T.Group(), group = new T.Group();
  // This roadster download displays its two removable roof panels beside the car.
  // Exclude these detached display parts before calculating the driving silhouette.
  if (car.id === 'aventador') for (const name of ['roof001_3', 'roof003_4', 'roof.001_3', 'roof.003_4']) model.getObjectByName(name)?.removeFromParent();
  aligned.add(model); aligned.rotation.y = car.sourceYaw; fitted.add(aligned); group.add(fitted);
  fitted.applyMatrix4(parkedVehicleTransform(new T.Box3().setFromObject(aligned), car));
  model.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    object.castShadow = true; object.receiveShadow = true;
    // Keep the imported textures, glass, grilles and brand details intact.
    if (car.color && object.name === car.paint) object.material = new T.MeshPhysicalMaterial({ color: car.color, metalness: .65, roughness: .2, clearcoat: 1 });
  });
  return group;
}
