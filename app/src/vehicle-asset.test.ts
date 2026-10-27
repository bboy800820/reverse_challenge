/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';

const directory = new URL('../public/assets/realistic/', import.meta.url);
it('ships a bounded-complexity model with the nodes needed by steering and materials', () => {
  const data = readFileSync(new URL('ferrari.glb', directory));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const triangles = gltf.meshes.reduce((sum: number, mesh: {primitives: {indices: number}[]}) => sum + mesh.primitives.reduce((total, primitive) => total + gltf.accessors[primitive.indices].count / 3, 0), 0);
  expect(triangles).toBeLessThan(90000);
  const names = gltf.nodes.map((node: {name: string}) => node.name);
  for (const name of ['body', 'glass', 'lights_red', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) expect(names).toContain(name);
});

it('matches the shipped assets to their provenance manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'));
  for (const entry of manifest) {
    const data = readFileSync(new URL(entry.file, directory));
    expect(data.length, entry.file).toBe(entry.bytes);
    expect(createHash('sha256').update(new Uint8Array(data)).digest('hex'), entry.file).toBe(entry.sha256);
  }
});
