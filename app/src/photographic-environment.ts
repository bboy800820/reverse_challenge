import { type Texture } from 'three';
import { GroundedSkybox } from 'three/addons/objects/GroundedSkybox.js';

export const ENVIRONMENT_ROTATION = .6;

export function photographicEnvironment(texture: Texture, rotation = ENVIRONMENT_ROTATION) {
  // Project the surrounding photographic pavement below the practice surface.
  // Distant buildings remain scenery; collision belongs to the simulation world.
  const height = 10;
  const environment = new GroundedSkybox(texture, height, 100, 64);
  environment.position.set(12, height - .2, 8.5);
  environment.rotation.y = rotation;
  environment.material.toneMapped = false;
  environment.material.fog = false;
  environment.renderOrder = -1000;
  return environment;
}
