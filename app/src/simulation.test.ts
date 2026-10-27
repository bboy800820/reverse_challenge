import { describe, expect, it } from 'vitest';
import { createState, shift, step, intersects, WORLD, type Input, type State, type World } from './simulation';

const idle: Input = { throttle: false, brake: false, steer: 0, center: false };
const empty: World = { ...WORLD, bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, obstacles: [] };
function run(s: State, seconds: number, input: Partial<Input> = {}, world = empty) {
  for (let i = 0; i < seconds * 120; i++) step(s, { ...idle, ...input }, 1 / 120, world);
}
function car(gear: State['gear'] = 'D'): State { return { ...createState(), x: 0, z: 0, yaw: 0, steer: 0, brakeHold: false, gear }; }

describe('automatic transmission and pedals', () => {
  it('requires both standstill and brake before changing direction', () => {
    const s = car();
    expect(shift(s, 'R', false)).toBe(false);
    s.speed = .2;
    expect(shift(s, 'R', true)).toBe(false);
    s.speed = 0;
    expect(shift(s, 'R', true)).toBe(true);
    expect(s.gear).toBe('R');
  });
  it.each([['D', 1], ['R', -1]] as const)('%s creeps in its selected direction with no throttle', (gear, sign) => {
    const s = car(gear); run(s, 1);
    expect(s.speed * sign).toBeGreaterThan(.1);
    expect(s.z * sign).toBeLessThan(-.05);
  });
  it('brake wins over throttle and never reverses the car', () => {
    const s = car(); run(s, 1, { throttle: true }); expect(s.speed).toBeGreaterThan(.5);
    run(s, 1, { brake: true, throttle: true }); expect(s.speed).toBe(0);
    const z = s.z; run(s, 2, { brake: true, throttle: true }); expect(s.z).toBe(z);
  });
  it('P holds and N coasts without responding to throttle', () => {
    const p = car('P'); run(p, 2, { throttle: true }); expect(p.z).toBe(0);
    const n = car('N'); run(n, 2, { throttle: true }); expect(n.speed).toBe(0);
    n.speed = 1; run(n, 1, { throttle: true }); expect(n.speed).toBeGreaterThan(0); expect(n.speed).toBeLessThan(1);
  });
});

describe('steering and geometry', () => {
  it('right steering rotates oppositely when reversing', () => {
    const forward = car(), reverse = car('R'); forward.steer = reverse.steer = .3;
    run(forward, 2, { throttle: true }); run(reverse, 2, { throttle: true });
    expect(forward.yaw).toBeGreaterThan(.1); expect(reverse.yaw).toBeLessThan(-.1);
  });
  it('retains steering on release and centers only with assistance', () => {
    const s = car('P'); run(s, 1, { steer: 1 }); expect(s.steer).toBeGreaterThan(.1);
    const angle = s.steer; run(s, 1); expect(s.steer).toBe(angle);
    run(s, 2, { center: true }); expect(s.steer).toBe(0);
  });
  it('stops before a thin obstacle and can reverse away after impact', () => {
    const wallWorld = { ...empty, obstacles: [{ minX: -3, maxX: 3, minZ: -5, maxZ: -4.9 }] };
    const s = car(); run(s, 4, { throttle: true }, wallWorld);
    expect(s.collisions).toBe(1); expect(s.speed).toBe(0); expect(s.brakeHold).toBe(true);
    expect(intersects(s, wallWorld)).toBe(false);
    expect(s.z).toBeGreaterThan(-1.31);
    expect(shift(s, 'R', true)).toBe(true); s.brakeHold = false;
    const z = s.z; run(s, 2, {}, wallWorld); expect(s.z).toBeGreaterThan(z); expect(s.collisions).toBe(1);
  });
  it('checks rotated corners against parked vehicles and boundaries', () => {
    const s = { ...car(), x: 11, z: 13, yaw: 1.2 };
    expect(intersects(s, WORLD)).toBe(true);
    s.x = .8; s.z = 6; s.yaw = 0;
    expect(intersects(s, WORLD)).toBe(true);
  });
  it('does not tunnel when a caller passes a large timestep', () => {
    const s = car(); s.speed = 2;
    step(s, idle, 2, { ...empty, obstacles: [{ minX: -3, maxX: 3, minZ: -4.2, maxZ: -4.19 }] });
    expect(s.collisions).toBe(1); expect(s.z).toBeGreaterThan(-.6);
  });
});

describe('parking completion', () => {
  it('requires all corners, alignment and a one second stationary hold', () => {
    const s = { ...car('P'), x: 11.3, z: 12.9 };
    run(s, .5, {}, WORLD); expect(s.parked).toBe(false);
    run(s, .6, {}, WORLD); expect(s.parked).toBe(true);
    s.yaw = .25; run(s, 2, {}, WORLD); expect(s.parked).toBe(false);
    s.yaw = 0; s.x = 12.2; run(s, 2, {}, WORLD); expect(s.parked).toBe(false);
  });
});
