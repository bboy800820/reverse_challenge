import { createState, WORLD, type State, type World } from './simulation';
import { neighborSpec } from './fleet';

export type Scenario = {
  id: string; name: string; difficulty: string; description: string; targetName: string;
  kind: 'perpendicular' | 'parallel'; world: World;
  start: Pick<State, 'x' | 'z' | 'yaw' | 'steer'>;
  panorama: string; lighting: string; rotation: number; sunlight: number;
};

function parallelWorld(length: number): World {
  const minX = 12.4 - length / 2, maxX = 12.4 + length / 2;
  return {
    bounds: { minX: .65, maxX: 23.35, minZ: 1, maxZ: 14.9 },
    target: { minX, maxX, minZ: 12.05, maxZ: 14.65 }, targetYaw: Math.PI / 2,
    obstacles: [0, 1].map(i => {
      const car = neighborSpec(i, 'parallel');
      return { minX: i === 0 ? minX - .7 - car.length : maxX + .7, maxX: i === 0 ? minX - .7 : maxX + .7 + car.length,
        minZ: 13.35 - car.width / 2, maxZ: 13.35 + car.width / 2 };
    }),
  };
}

export const SCENARIOS: Scenario[] = [
  { id: 'mall', name: '商場停車場', difficulty: '入門', kind: 'perpendicular',
    description: '垂直倒車入庫 · 觀察兩側車距，倒入 03 號車位。', targetName: '03 號車位',
    world: { ...WORLD, obstacles: WORLD.obstacles.map((r, i) => {
      const car = neighborSpec(i, 'perpendicular'), x = (r.minX + r.maxX) / 2;
      return { minX: x - car.width / 2, maxX: x + car.width / 2, minZ: 11.25 - car.length / 2, maxZ: 11.25 + car.length / 2 };
    }) }, start: { x: 13, z: 6.8, yaw: .75, steer: .35 },
    panorama: 'parking-panorama.jpg', lighting: 'parking-light.hdr', rotation: .6, sunlight: 2.7 },
  { id: 'residential', name: '住宅街道', difficulty: '標準', kind: 'parallel',
    description: '路邊停車 · 6.8 m 車位，練習倒入前後兩車之間。', targetName: '路邊車位',
    world: parallelWorld(6.8), start: { x: 17.15, z: 10, yaw: Math.PI / 2, steer: 0 },
    panorama: 'residential-panorama.jpg', lighting: 'residential-light.hdr', rotation: 0, sunlight: .5 },
  { id: 'city', name: '市區窄位', difficulty: '進階', kind: 'parallel',
    description: '路邊停車 · 5.8 m 車位，需要更精準的轉向與前後修正。', targetName: '窄路邊車位',
    world: parallelWorld(5.8), start: { x: 16.65, z: 9.8, yaw: Math.PI / 2, steer: 0 },
    panorama: 'city-panorama.jpg', lighting: 'city-light.hdr', rotation: Math.PI / 2, sunlight: .45 },
];

export function scenarioState(scenario: Scenario): State { return { ...createState(), ...scenario.start }; }
