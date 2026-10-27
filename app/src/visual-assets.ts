import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { rebuildVehicleNormals } from './vehicle-fit';

const base = `${import.meta.env.BASE_URL}assets/realistic/`;

/** Owns asynchronous resources even if a scene is closed before a load finishes. */
export class VisualAssets {
  private disposed = false;
  private textures = new Set<T.Texture>();
  private models = new Set<T.Object3D>();
  private decoder = new DRACOLoader().setDecoderPath({ js: `${base}draco/draco_wasm_wrapper.js`, wasm: `${base}draco/draco_decoder.wasm` }).setWorkerLimit(1);

  private keep(texture: T.Texture) {
    if (this.disposed) { texture.dispose(); throw new Error('Scene closed'); }
    this.textures.add(texture);
    return texture;
  }

  async texture(path: string, repeat: number, color = false) {
    const texture = this.keep(await new T.TextureLoader().loadAsync(base + path));
    texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(repeat, repeat); texture.anisotropy = 8;
    return texture;
  }

  async sky() {
    const texture = this.keep(await new HDRLoader().loadAsync(base + 'parking-light.hdr'));
    texture.mapping = T.EquirectangularReflectionMapping;
    return texture;
  }

  async panorama() {
    const texture = this.keep(await new T.TextureLoader().loadAsync(base + 'parking-panorama.jpg'));
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = T.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  }

  async vehicle() {
    try {
      const { scene } = await new GLTFLoader().setDRACOLoader(this.decoder).loadAsync(base + 'ferrari.glb');
      if (this.disposed) { disposeTree(scene); throw new Error('Scene closed'); }
      this.models.add(scene);
      rebuildVehicleNormals(scene);
      return scene;
    } finally { this.decoder.dispose(); }
  }

  dispose() {
    this.disposed = true;
    // Keep an in-flight decoder alive until its promise settles; vehicle() closes it.
    this.textures.forEach(t => t.dispose()); this.textures.clear();
    this.models.forEach(disposeTree); this.models.clear();
  }
}

export function disposeTree(tree: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  tree.traverse(object => {
    if (!(object instanceof T.Mesh || object instanceof T.Line)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      Object.values(material).forEach(value => { if (value instanceof T.Texture) textures.add(value); });
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}
