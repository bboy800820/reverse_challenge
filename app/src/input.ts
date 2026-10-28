import type { Gear, Input } from './simulation';
import { controlCode } from './keyboard';

type Action = 'throttle' | 'brake' | 'left' | 'right';
type Commands = { shift: (gear: Gear) => void; pause: () => void; blur: () => void; center: () => void; changed: () => void };
export function bindInput(root: HTMLElement, commands: Commands) {
  const sources = new Map<string, Action>();
  const controller = new AbortController(), options = { signal: controller.signal };
  const keys: Record<string, Action> = { ArrowUp: 'throttle', ArrowDown: 'brake', Space: 'brake', ArrowLeft: 'left', ArrowRight: 'right' };
  const gears: Record<string, Gear> = { Digit1: 'P', Digit2: 'R', Digit3: 'N', Digit4: 'D' };
  const source = (e: KeyboardEvent) => 'key-' + (e.code && e.code !== 'Unidentified' ? e.code : controlCode(e));
  window.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || (e.target instanceof HTMLElement && e.target.matches('input:not([type=checkbox]),textarea,select,option,[contenteditable=true]'))) return;
    const code = controlCode(e);
    if (!code) return;
    e.preventDefault();
    if (keys[code]) { sources.set(source(e), keys[code]); commands.changed(); }
    if (!e.repeat) {
      if (gears[code]) commands.shift(gears[code]);
      if (code === 'KeyC') commands.center();
      if (code === 'Escape') commands.pause();
    }
  }, { ...options, capture: true });
  window.addEventListener('keyup', e => {
    if (sources.delete(source(e))) { e.preventDefault(); commands.changed(); }
  }, { ...options, capture: true });
  window.addEventListener('blur', () => { sources.clear(); commands.blur(); }, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { sources.clear(); commands.blur(); } }, options);
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
    button.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); button.setPointerCapture(e.pointerId);
      sources.set('pointer-' + e.pointerId, button.dataset.action as Action);
      commands.changed();
    }, options);
    const release = (e: PointerEvent) => { if (sources.delete('pointer-' + e.pointerId)) commands.changed(); };
    button.addEventListener('pointerup', release, options);
    button.addEventListener('pointercancel', release, options);
    button.addEventListener('lostpointercapture', release, options);
  });
  return {
    read(): Input {
      const values = new Set(sources.values());
      return { throttle: values.has('throttle'), brake: values.has('brake'), steer: Number(values.has('right')) - Number(values.has('left')), center: false };
    },
    clear: () => sources.clear(),
    dispose: () => { sources.clear(); controller.abort(); },
  };
}
