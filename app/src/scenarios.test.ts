import { describe, expect, it } from 'vitest';
import { SCENARIOS, scenarioState } from './scenarios';
import { intersects, step, type Input } from './simulation';

const idle: Input = { throttle: false, brake: false, steer: 0, center: false };
describe('parking scenarios', () => {
  it.each(['mall', 'residential', 'city'])('%s starts safely and resets all controls', id => {
    const lesson = SCENARIOS.find(s => s.id === id)!;
    const state = scenarioState(lesson);
    expect(intersects(state, lesson.world)).toBe(false);
    expect(state.gear).toBe('P'); expect(state.brakeHold).toBe(true);
    expect(state.speed).toBe(0); expect(state.parked).toBe(false);
  });
  it.each(['residential', 'city'])('%s accepts parallel parking only when fully in the bay and stopped', id => {
    const lesson = SCENARIOS.find(s => s.id === id)!;
    const t = lesson.world.target;
    const state = { ...scenarioState(lesson), x: (t.minX + t.maxX) / 2 - 1.35, z: (t.minZ + t.maxZ) / 2, yaw: Math.PI / 2 };
    expect(intersects(state, lesson.world)).toBe(false);
    step(state, idle, .5, lesson.world); expect(state.parked).toBe(false);
    step(state, idle, .6, lesson.world); expect(state.parked).toBe(true);
    state.yaw += Math.PI * 2;
    step(state, idle, 1.1, lesson.world); expect(state.parked).toBe(true);
    state.yaw = -Math.PI / 2;
    step(state, idle, 1.1, lesson.world); expect(state.parked).toBe(false);
    state.yaw = Math.PI / 2; state.z = t.minZ;
    step(state, idle, 1.1, lesson.world); expect(state.parked).toBe(false);
  });
  it.each(['residential', 'city'])('%s collides with front/rear cars and curb, not the open lane', id => {
    const lesson = SCENARIOS.find(s => s.id === id)!;
    for (const r of lesson.world.obstacles) {
      expect(intersects({ x: (r.minX + r.maxX) / 2 - 1.35, z: (r.minZ + r.maxZ) / 2, yaw: Math.PI / 2 }, lesson.world)).toBe(true);
    }
    expect(intersects({ x: 12, z: lesson.world.bounds.maxZ - .5, yaw: Math.PI / 2 }, lesson.world)).toBe(true);
    expect(intersects({ x: 12, z: 8, yaw: Math.PI / 2 }, lesson.world)).toBe(false);
  });
  it.each(['residential', 'city'])('%s can actually be parked using two reverse arcs and a forward correction', id => {
    const lesson = SCENARIOS.find(s => s.id === id)!;
    const s = scenarioState(lesson), world = lesson.world;
    // Steer at standstill, creep around each arc, brake before countersteering.
    const tick = (input: Partial<Input> = {}) => step(s, { ...idle, ...input }, 1 / 120, world);
    const stationarySteer = (direction: number) => { s.brakeHold = true; for (let i = 0; i < 400; i++) tick({ steer: direction }); };
    const brake = () => { for (let i = 0; i < 50; i++) tick({ brake: true }); };
    stationarySteer(1); s.gear = 'R'; s.brakeHold = false;
    for (let i = 0; i < 2500 && s.yaw > .69 && !s.contact; i++) tick();
    brake(); stationarySteer(-1); s.brakeHold = false;
    for (let i = 0; i < 2500 && s.yaw < Math.PI / 2 - .004 && !s.contact; i++) tick();
    brake(); s.brakeHold = true;
    for (let i = 0; i < 150; i++) tick({ center: true });
    s.gear = 'D'; s.brakeHold = false;
    for (let i = 0; i < 1000 && s.x < 11.05 && !s.contact; i++) tick();
    brake(); for (let i = 0; i < 150; i++) tick({ brake: true });
    expect(s.collisions).toBe(0); expect(s.parked).toBe(true);
  });
});
