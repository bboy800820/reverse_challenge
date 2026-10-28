import { Box3, Vector3, Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { expect, it } from 'vitest';
import { FLEET, neighborSpec } from './fleet';
import { parkedVehicleTransform, parkedVehicle } from './parked-vehicle';
import { SCENARIOS } from './scenarios';

it('fits imported vehicles into centered declared physical dimensions', () => {
  const bounds = new Box3(new Vector3(-4, -2, 10), new Vector3(8, 4, 20));
  for (const car of Object.values(FLEET)) {
    const fitted = bounds.clone().applyMatrix4(parkedVehicleTransform(bounds, car));
    expect(fitted.min.x).toBeCloseTo(-car.width / 2);
    expect(fitted.max.x).toBeCloseTo(car.width / 2);
    expect(fitted.min.y).toBeCloseTo(0);
    expect(fitted.max.y).toBeCloseTo(car.height);
    expect(fitted.min.z).toBeCloseTo(-car.length / 2);
    expect(fitted.max.z).toBeCloseTo(car.length / 2);
  }
});
it('uses the same luxury dimensions for the scene and collision world', () => {
  for (const scenario of SCENARIOS) scenario.world.obstacles.forEach((rect, i) => {
    const car = neighborSpec(i, scenario.kind);
    const parallel = scenario.kind === 'parallel';
    expect(rect.maxX - rect.minX).toBeCloseTo(parallel ? car.length : car.width);
    expect(rect.maxZ - rect.minZ).toBeCloseTo(parallel ? car.width : car.length);
  });
});
it('excludes detached roadster roof panels without modifying the shared source', () => {
  const source = new Group(), body = new Mesh(new BoxGeometry(2, 1, 5), new MeshBasicMaterial());
  source.add(body);
  const roof = new Mesh(new BoxGeometry(.5,.1,.8), new MeshBasicMaterial()); roof.name = 'roof001_3'; roof.position.x = 4; source.add(roof);
  const fitted = parkedVehicle(source, FLEET.aventador);
  expect(fitted.getObjectByName('roof001_3')).toBeUndefined();
  expect(source.getObjectByName('roof001_3')).toBe(roof);
  expect(new Box3().setFromObject(fitted).getSize(new Vector3()).x).toBeCloseTo(FLEET.aventador.width);
});
