import { Box3, Matrix4, Vector3, Mesh, type BufferGeometry, type Object3D } from 'three';

/** Rebuild once from decoded triangles, before instances share the geometry. */
export function rebuildVehicleNormals(source: Object3D) {
  const rebuilt = new Set<BufferGeometry>();
  source.traverse(object => {
    if (!(object instanceof Mesh) || rebuilt.has(object.geometry)) return;
    object.geometry.computeVertexNormals(); rebuilt.add(object.geometry);
  });
}

/** The source faces -Z; the simulation origin is the rear axle, not body center. */
export function vehicleTransform(bounds: Box3): Matrix4 {
  const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
  if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid vehicle bounds');
  const scale = new Vector3(1.8 / size.x, 1.35 / size.y, 4.5 / size.z);
  return new Matrix4().makeScale(scale.x, scale.y, scale.z).setPosition(
    -center.x * scale.x, -bounds.min.y * scale.y, -1.35 - center.z * scale.z,
  );
}
