import { VEHICLE, type Input } from './simulation';

export type RemoteFrame = { type: string; epoch: string; seq: number; stamp: number; steering: number; throttle: boolean; brake: boolean; ready: boolean; action?: 'resume' | 'pause' | 'hold' | 'gear'; gear?: 'P' | 'R' | 'N' | 'D' };
export const INPUT_TIMEOUT = 600;
export class RemoteInput {
  epoch = crypto.randomUUID();
  connected = false;
  armed = false;
  private seq = -1;
  private last = -Infinity;
  private frame: RemoteFrame | null = null;
  stop() { this.armed = false; this.frame = null; this.last = -Infinity; this.seq = -1; this.epoch = crypto.randomUUID(); }
  accept(value: unknown, now: number): value is RemoteFrame {
    // Latch an expired armed stream until the watchdog stops it and rotates epoch.
    // Otherwise a late packet can overwrite the timeout between watchdog ticks.
    if (this.expired(now)) return false;
    const f = value as RemoteFrame;
    if (!this.connected || !f || f.type !== 'input' || f.epoch !== this.epoch || !Number.isSafeInteger(f.seq) || f.seq <= this.seq || !Number.isFinite(f.stamp) || f.stamp > now || now - f.stamp > INPUT_TIMEOUT || !Number.isFinite(f.steering) || Math.abs(f.steering) > 1 || typeof f.brake !== 'boolean' || typeof f.throttle !== 'boolean' || typeof f.ready !== 'boolean') return false;
    this.seq = f.seq; this.last = f.stamp; this.frame = f; return true;
  }
  fresh(now: number) { return this.connected && this.frame !== null && now - this.last <= INPUT_TIMEOUT; }
  expired(now: number) { return this.armed && !this.fresh(now); }
  resume(now: number) {
    if (!this.fresh(now) || !this.frame?.ready || this.frame.throttle) return false;
    this.armed = true; return true;
  }
  read(now: number): Input {
    const f = this.fresh(now) ? this.frame : null;
    return { throttle: this.armed && !!f?.throttle, brake: !this.armed || !f || f.brake, steer: 0, center: false, ...(this.armed && f ? { targetSteer: f.steering * VEHICLE.maxSteer } : {}) };
  }
}
export function tiltSteering(roll: number, zero: number, range: number) {
  const delta = ((roll - zero + 540) % 360) - 180;
  return Math.abs(delta) <= 3 ? 0 : Math.max(-1, Math.min(1, Math.sign(delta) * (Math.abs(delta) - 3) / (Math.max(15, range) - 3)));
}
// Gravity projected onto the current screen plane; alpha/compass is unnecessary.
export function motionRoll(beta: number | null, gamma: number | null, angle: number): number | null {
  if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma) || !Number.isFinite(angle)) return null;
  const b = beta * Math.PI / 180, g = gamma * Math.PI / 180, a = angle * Math.PI / 180;
  const x = -Math.cos(b) * Math.sin(g), y = Math.sin(b);
  const sx = x * Math.cos(a) + y * Math.sin(a), sy = -x * Math.sin(a) + y * Math.cos(a);
  if (Math.hypot(sx, sy) < .25) return null;
  return Math.atan2(sx, -sy) * 180 / Math.PI;
}
