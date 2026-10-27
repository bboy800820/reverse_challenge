import { Box3, Texture, MeshBasicMaterial } from 'three';
import { expect, it } from 'vitest';
import { photographicEnvironment } from './photographic-environment';

it('keeps the projected photograph below the physical pavement and preserves photographic colors', () => {
  const environment = photographicEnvironment(new Texture());
  const bounds = new Box3().setFromObject(environment);
  expect(bounds.min.y).toBeLessThan(-.1);
  expect(bounds.max.x).toBeGreaterThan(30);
  expect(bounds.min.x).toBeLessThan(-5);
  const material = environment.material as MeshBasicMaterial;
  expect(material.toneMapped).toBe(false);
  expect(material.fog).toBe(false);
  expect(material.depthWrite).toBe(false);
});
