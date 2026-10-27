// Usage: node scripts/optimize-vehicle.cjs <gltf-transform npm tool root> <input.glb> <output.glb>
// Offline preparation only. No extra runtime dependencies are added to the app.
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const [, , toolRoot, input, output] = process.argv;
  const toolRequire = createRequire(resolve(toolRoot, 'package.json'));
  const { NodeIO } = toolRequire('@gltf-transform/core');
  const { ALL_EXTENSIONS } = toolRequire('@gltf-transform/extensions');
  const { weld, simplify, draco, prune } = toolRequire('@gltf-transform/functions');
  const { MeshoptSimplifier } = toolRequire('meshoptimizer');
  const draco3d = toolRequire('draco3dgltf');
  const T = await import(pathToFileURL(resolve(__dirname, '../app/node_modules/three/build/three.module.js')).href);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  const document = await io.read(resolve(input));
  if (document.getRoot().listTextures().length) throw new Error('Only untextured models are supported');
  // This model has no image textures. Rebuild its highly split normals after
  // simplification, allowing shared positions to weld across unnecessary seams.
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    for (const name of primitive.listSemantics()) if (name !== 'POSITION') primitive.setAttribute(name, null);
  }
  await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: .15, error: .005 }));
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(primitive.getAttribute('POSITION').getArray(), 3));
    geometry.setIndex(new T.BufferAttribute(primitive.getIndices().getArray(), 1));
    triangles += geometry.index.count / 3;
    geometry.computeVertexNormals();
    primitive.setAttribute('NORMAL', document.createAccessor().setType('VEC3').setArray(geometry.getAttribute('normal').array).setBuffer(primitive.getAttribute('POSITION').getBuffer()));
    geometry.dispose();
  }
  if (triangles >= 90000) throw new Error(`Triangle budget exceeded: ${triangles}`);
  await document.transform(prune(), draco());
  await io.write(resolve(output), document);
  console.log(JSON.stringify({ triangles, output }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
