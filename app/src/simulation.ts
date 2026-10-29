export type Gear = 'P' | 'R' | 'N' | 'D';
export type Point = { x: number; z: number };
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
export type World = { bounds: Rect; obstacles: Rect[]; target: Rect; targetYaw?: number };
export type Input = { throttle: boolean; brake: boolean; steer: number; center: boolean; targetSteer?: number };
export type State = Point & { yaw: number; steer: number; speed: number; gear: Gear; brakeHold: boolean; collisions: number; contact: boolean; parkedTime: number; parked: boolean };
export const VEHICLE = { width: 1.8, front: 3.6, rear: .9, wheelbase: 2.7, maxSteer: Math.PI * 32 / 180 };
export const BAY_CENTERS = [3.9, 7.6, 11.3, 15, 18.7];
export const WORLD: World = {
  bounds: { minX: .65, maxX: 23.35, minZ: 1, maxZ: 16.5 },
  obstacles: BAY_CENTERS.filter(x => x !== 11.3).map(x => ({ minX: x - .9, maxX: x + .9, minZ: 9, maxZ: 13.5 })),
  target: { minX: 9.8, maxX: 12.8, minZ: 8.2, maxZ: 14.3 },
};
export function createState(): State { return { x: 13, z: 6.8, yaw: .75, steer: .35, speed: 0, gear: 'P', brakeHold: true, collisions: 0, contact: false, parkedTime: 0, parked: false }; }
export function shift(s: State, gear: Gear, brake: boolean): boolean {
  if (s.gear === gear) return true;
  if (Math.abs(s.speed) > .01 || !(brake || s.brakeHold)) return false;
  s.gear = gear; s.speed = 0;
  return true;
}
const approach = (v: number, target: number, amount: number) => v < target ? Math.min(target, v + amount) : Math.max(target, v - amount);
export function localPoint(s: Pick<State, 'x' | 'z' | 'yaw'>, right: number, forward: number): Point {
  return { x: s.x + Math.cos(s.yaw) * right + Math.sin(s.yaw) * forward, z: s.z + Math.sin(s.yaw) * right - Math.cos(s.yaw) * forward };
}
export function corners(s: Pick<State, 'x' | 'z' | 'yaw'>): Point[] {
  return [[-.9, 3.6], [.9, 3.6], [.9, -.9], [-.9, -.9]].map(([x, z]) => localPoint(s, x, z));
}
const rectPoints = (r: Rect): Point[] => [{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }];
const inside = (p: Point, r: Rect) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;
function overlap(a: Point[], b: Point[]): boolean {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const axis = { x: q.z - p.z, z: p.x - q.x };
    const ap = a.map(v => v.x * axis.x + v.z * axis.z), bp = b.map(v => v.x * axis.x + v.z * axis.z);
    if (Math.max(...ap) < Math.min(...bp) || Math.max(...bp) < Math.min(...ap)) return false;
  }
  return true;
}
export function intersects(s: Pick<State, 'x' | 'z' | 'yaw'>, world: World = WORLD): boolean {
  const points = corners(s);
  return points.some(p => !inside(p, world.bounds)) || world.obstacles.some(r => overlap(points, rectPoints(r)));
}
function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
export function clearance(s: State, world: World = WORLD): number {
  if (intersects(s, world)) return 0;
  const points = corners(s), b = world.bounds;
  let distance = Math.min(...points.flatMap(p => [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z]));
  for (const rect of world.obstacles) {
    const other = rectPoints(rect);
    for (const [a, b] of [[points, other], [other, points]]) for (const p of a) for (let i = 0; i < 4; i++) {
      distance = Math.min(distance, pointSegmentDistance(p, b[i], b[(i + 1) % 4]));
    }
  }
  return distance;
}
// Exact integration of a constant-steering bicycle arc; state origin is the rear axle.
function move(s: Pick<State, 'x' | 'z' | 'yaw' | 'steer'>, distance: number) {
  const curvature = Math.tan(s.steer) / VEHICLE.wheelbase, nextYaw = s.yaw + distance * curvature;
  if (Math.abs(curvature) < 1e-8) {
    s.x += distance * Math.sin(s.yaw); s.z -= distance * Math.cos(s.yaw);
  } else {
    s.x += (Math.cos(s.yaw) - Math.cos(nextYaw)) / curvature;
    s.z += (Math.sin(s.yaw) - Math.sin(nextYaw)) / curvature;
  }
  s.yaw = Math.atan2(Math.sin(nextYaw), Math.cos(nextYaw));
}
export function step(s: State, input: Input, dt: number, world: World = WORLD): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  // Substeps also protect non-animation callers from skipping thin obstacles.
  const count = Math.ceil(Math.min(dt, 2) * 120), h = Math.min(dt, 2) / count;
  for (let i = 0; i < count; i++) {
    s.steer = Number.isFinite(input.targetSteer) ? approach(s.steer, Math.max(-VEHICLE.maxSteer, Math.min(VEHICLE.maxSteer, input.targetSteer!)), 1.8 * h) : input.center ? approach(s.steer, 0, .7 * h) : Math.max(-VEHICLE.maxSteer, Math.min(VEHICLE.maxSteer, s.steer + input.steer * .4 * h));
    if (s.gear === 'P') s.speed = 0;
    else if (input.brake || s.brakeHold) s.speed = approach(s.speed, 0, 3.2 * h);
    else if (s.gear === 'N') s.speed = approach(s.speed, 0, .32 * h);
    else {
      const sign = s.gear === 'D' ? 1 : -1;
      s.speed = approach(s.speed, sign * (input.throttle ? (s.gear === 'D' ? 2.2 : 1.65) : .32), (input.throttle ? 1.1 : .55) * h);
    }
    const candidate = { ...s }; move(candidate, s.speed * h);
    if (s.speed !== 0 && intersects(candidate, world)) {
      if (!s.contact) s.collisions++;
      s.contact = true; s.speed = 0; s.brakeHold = true;
    } else {
      s.x = candidate.x; s.z = candidate.z; s.yaw = candidate.yaw;
      if (s.contact && clearance(s, world) > .08) s.contact = false;
    }
    const heading = s.yaw - (world.targetYaw ?? 0);
    const aligned = Math.abs(Math.atan2(Math.sin(heading), Math.cos(heading))) < Math.PI * 7 / 180;
    const parkedNow = Math.abs(s.speed) < .01 && aligned && !intersects(s, world) && corners(s).every(p => inside(p, world.target));
    s.parkedTime = parkedNow ? s.parkedTime + h : 0;
    s.parked = s.parkedTime >= 1;
  }
}
export function trajectory(s: State, world = WORLD): { left: Point[]; right: Point[] } {
  const result = { left: [] as Point[], right: [] as Point[] };
  if (s.gear !== 'D' && s.gear !== 'R') return result;
  const pose = { ...s }, direction = s.gear === 'D' ? 1 : -1;
  for (let i = 0; i < 65; i++) {
    if (i > 0 && intersects(pose, world)) break;
    const edge = direction > 0 ? VEHICLE.front : -VEHICLE.rear;
    result.left.push(localPoint(pose, -.82, edge)); result.right.push(localPoint(pose, .82, edge));
    move(pose, .08 * direction);
  }
  return result;
}
