import { describe, expect, it } from 'vitest';
import { Box3, Vector3, Group, Mesh, PlaneGeometry, MeshBasicMaterial } from 'three';
import { vehicleTransform, rebuildVehicleNormals } from './vehicle-fit';

describe('vehicle placement relative to the simulation rear axle', () => {
  it('fits an asymmetric source to the physical body and puts the tires on the ground', () => {
    const bounds = new Box3(new Vector3(-3, -1, -8), new Vector3(5, 3, 2));
    const transform = vehicleTransform(bounds);
    const fitted = bounds.clone().applyMatrix4(transform);
    expect(fitted.min.x).toBeCloseTo(-.9);
    expect(fitted.max.x).toBeCloseTo(.9);
    expect(fitted.min.z).toBeCloseTo(-3.6);
    expect(fitted.max.z).toBeCloseTo(.9);
    expect(fitted.min.y).toBeCloseTo(0);
    expect(fitted.max.y).toBeCloseTo(1.35);
  });
  it('rejects empty or flat bounds instead of producing infinite scale', () => {
    expect(() => vehicleTransform(new Box3())).toThrow();
    expect(() => vehicleTransform(new Box3(new Vector3(), new Vector3(0, 1, 1)))).toThrow();
  });
  it('rebuilds decoded normals against the final indexed topology before cloning', () => {
    const geometry = new PlaneGeometry(2, 2, 3, 3);
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 1, 0, 0);
    const source = new Group(); source.add(new Mesh(geometry, new MeshBasicMaterial()));
    rebuildVehicleNormals(source);
    for (let i = 0; i < normals.count; i++) {
      expect(normals.getX(i)).toBeCloseTo(0);
      expect(normals.getY(i)).toBeCloseTo(0);
      expect(normals.getZ(i)).toBeCloseTo(1);
    }
  });
});
