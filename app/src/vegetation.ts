import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Seeded, instanced leaf clusters: one draw call for the entire tree canopy. */
export function vegetation() {
  const group = new T.Group(), branches: T.BufferGeometry[] = [];
  const positions: [number, number][] = [];
  for (let i = 0; i < 10; i++) positions.push([-5 + i * 3.7, 21 + (i % 2) * 2]);
  for (let i = 0; i < 6; i++) positions.push([-3, -6 + i * 4.4], [27, -6 + i * 4.4]);
  const leafShape = new T.Shape(); leafShape.moveTo(0, -.13); leafShape.quadraticCurveTo(.09, -.02, 0, .13); leafShape.quadraticCurveTo(-.09, -.02, 0, -.13);
  const leaves = new T.InstancedMesh(new T.ShapeGeometry(leafShape, 3), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .85, side: T.DoubleSide }), positions.length * 1400);
  const dummy = new T.Object3D(), color = new T.Color(); let index = 0, seed = 842;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  function branch(a: T.Vector3, b: T.Vector3, radius: number) {
    const geometry = new T.CylinderGeometry(radius * .3, radius, a.distanceTo(b), 7);
    dummy.position.copy(a).add(b).multiplyScalar(.5); dummy.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); geometry.applyMatrix4(dummy.matrix); branches.push(geometry);
  }
  for (const [x, z] of positions) {
    const height = 3.3 + random() * 1.7;
    branch(new T.Vector3(x, -.1, z), new T.Vector3(x + .15, height, z), .17);
    for (let cluster = 0; cluster < 7; cluster++) {
      const angle = cluster * 2.4, radius = cluster === 6 ? .3 : 1.1 + random() * .5;
      const center = new T.Vector3(x + Math.cos(angle) * radius, height - .4 + random() * 1.3, z + Math.sin(angle) * radius);
      branch(new T.Vector3(x, height * .55, z), center, .06);
      for (let j = 0; j < 200; j++) {
        const azimuth = random() * Math.PI * 2, v = random() * 2 - 1, r = Math.cbrt(random()) * 1.25;
        dummy.position.set(center.x + Math.cos(azimuth) * Math.sqrt(1 - v * v) * r, center.y + v * r * .85, center.z + Math.sin(azimuth) * Math.sqrt(1 - v * v) * r);
        dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
        dummy.scale.setScalar(1.2 + random() * 1.1); dummy.updateMatrix(); leaves.setMatrixAt(index, dummy.matrix);
        color.setHSL(.21 + random() * .08, .28 + random() * .25, .16 + random() * .14); leaves.setColorAt(index++, color);
      }
    }
  }
  leaves.castShadow = true; leaves.receiveShadow = true; group.add(leaves);
  const wood = new T.Mesh(mergeGeometries(branches), new T.MeshStandardMaterial({ color: 0x665446, roughness: 1 })); wood.castShadow = true; group.add(wood); branches.forEach(g => g.dispose());
  return group;
}
