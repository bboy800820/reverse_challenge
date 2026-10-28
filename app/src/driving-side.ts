export type DrivingSide = 'left' | 'right';
const key = 'reverse-parking-driving-side';

export function savedDrivingSide(): DrivingSide {
  try { return localStorage.getItem(key) === 'right' ? 'right' : 'left'; }
  catch { return 'left'; }
}

export function saveDrivingSide(side: DrivingSide) {
  try { localStorage.setItem(key, side); } catch { /* Storage is optional. */ }
}
