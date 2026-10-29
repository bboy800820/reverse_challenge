import { describe, expect, it } from 'vitest';
import { RemoteInput, motionRoll, tiltSteering } from './remote-input';
import { createState, step, VEHICLE } from './simulation';
const frame = (epoch: string, seq = 1, stamp = 100) => ({ type: 'input', epoch, seq, stamp, steering: .6, throttle: false, brake: false, ready: true });
describe('remote control safety', () => {
  it('latches an expired stream before the watchdog gets its next tick', () => {
    const r = new RemoteInput(); r.connected = true;
    r.accept(frame(r.epoch, 1, 20), 20); r.resume(20);
    expect(r.expired(600)).toBe(false);
    expect(r.read(621).brake).toBe(true);
    expect(r.accept({ ...frame(r.epoch, 2, 650), throttle: true }, 650)).toBe(false);
    expect(r.read(650).throttle).toBe(false); expect(r.expired(650)).toBe(true);
  });
  it('requires fresh neutral resume and refuses stale or duplicate controls', () => {
    const r = new RemoteInput(); r.connected = true;
    expect(r.accept(frame(r.epoch), 100)).toBe(true); expect(r.armed).toBe(false);
    expect(r.resume(100)).toBe(true); expect(r.read(100).targetSteer).toBeCloseTo(.6 * VEHICLE.maxSteer);
    expect(r.accept(frame(r.epoch), 110)).toBe(false);
    expect(r.accept(frame(r.epoch, 2, 0), 1000)).toBe(false);
    expect(r.expired(701)).toBe(true); r.stop(); expect(r.read(701).throttle).toBe(false);
  });
  it('rejects queued throttle from a previous epoch and refuses resume with throttle', () => {
    const r = new RemoteInput(); r.connected = true; const old = r.epoch; r.stop();
    expect(r.accept(frame(old), 100)).toBe(false);
    r.accept({ ...frame(r.epoch), throttle: true }, 100); expect(r.resume(100)).toBe(false);
    expect(r.accept({ ...frame(r.epoch, 2), steering: NaN }, 100)).toBe(false);
    expect(r.accept({ ...frame(r.epoch, 2), stamp: 200 }, 100)).toBe(false);
  });
  it('handles sensor wrap, dead zone, screen orientation and invalid values', () => {
    expect(tiltSteering(-179, 179, 45)).toBe(0);
    expect(tiltSteering(-150, 179, 45)).toBeGreaterThan(.5);
    expect(tiltSteering(100, 0, 45)).toBe(1);
    expect(motionRoll(null, 0, 90)).toBeNull();
    expect(motionRoll(0, 0, 0)).toBeNull();
    expect(motionRoll(30, -90, 90)).toBeCloseTo(30);
    expect(motionRoll(-30, 90, 270)).toBeCloseTo(30);
  });
  it('absolute steering holds target and keyboard braking still wins', () => {
    const s = createState(); s.gear = 'D'; s.brakeHold = false; s.speed = 1;
    const controls = { throttle: true, brake: true, steer: 0, center: false, targetSteer: .2 };
    step(s, controls, 1); expect(s.steer).toBeCloseTo(.2); expect(s.speed).toBe(0);
    step(s, controls, 1); expect(s.steer).toBeCloseTo(.2);
  });
});
