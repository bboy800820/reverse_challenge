export type FleetCar = { id: string; name: string; file: string; width: number; length: number; height: number; sourceYaw: number; color?: number; paint?: string };
// Representative simulation dimensions, including the visible silhouette; not a manufacturer calibration.
export const FLEET = {
  ferrari: { id: 'ferrari', name: 'Ferrari 458 Italia', file: 'realistic/ferrari.glb', width: 1.9, length: 4.5, height: 1.3, sourceYaw: 0, color: 0xca171d, paint: 'body' },
  aventador: { id: 'aventador', name: 'Lamborghini Aventador', file: 'luxury/lamborghini-aventador-lp700-4.glb', width: 2.04, length: 4.8, height: 1.18, sourceYaw: Math.PI },
  cullinan: { id: 'cullinan', name: 'Rolls-Royce Cullinan', file: 'luxury/rolls-royce-cullinan.glb', width: 2.05, length: 5.3, height: 1.84, sourceYaw: Math.PI },
} satisfies Record<string, FleetCar>;
export function neighborSpec(index: number, kind: 'parallel' | 'perpendicular'): FleetCar {
  const fleet = kind === 'parallel' ? [FLEET.aventador, FLEET.cullinan] : [FLEET.aventador, FLEET.cullinan, FLEET.ferrari, FLEET.aventador];
  return fleet[index % fleet.length];
}
