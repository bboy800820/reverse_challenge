import type { State } from './simulation';
import type { DrivingSide } from './driving-side';

/** Photographic foreground; windows and monitor opening reveal the live WebGL scene. */
export function createPhotoCabin(root: HTMLElement, drivingSide: DrivingSide = 'left') {
  const view = root.querySelector<HTMLElement>('[data-view="driver"]')!;
  const stage = document.createElement('div'); stage.className = 'photo-cabin'; stage.hidden = true;
  stage.dataset.drivingSide = drivingSide;
  stage.setAttribute('aria-hidden', 'true');
  const base = `${import.meta.env.BASE_URL}assets/cabin/`;
  function dial(x: number, label: string, maximum: number) {
    return `<g transform="translate(${x} 90)"><circle r="73" fill="url(#dial-face)" stroke="#67727a" stroke-width="3"/><circle r="68" fill="none" stroke="#202a31" stroke-width="2"/>${Array.from({ length: 41 }, (_, i) => {
      const a = (135 + i * 6.75) * Math.PI / 180, major = i % 5 === 0;
      return `<path d="M ${Math.cos(a) * (major ? 53 : 60)} ${Math.sin(a) * (major ? 53 : 60)} L ${Math.cos(a) * 65} ${Math.sin(a) * 65}" stroke="${i > 34 ? '#d45749' : '#dbe2e6'}" stroke-width="${major ? 2 : 1}"/>${major ? `<text x="${Math.cos(a) * 43}" y="${Math.sin(a) * 43 + 3}" text-anchor="middle" fill="#dde3e7" font-size="9">${Math.round(i / 40 * maximum) - (label === 'STEER' ? 32 : 0)}</text>` : ''}`;
    }).join('')}<text y="42" text-anchor="middle" fill="#abb9c1" font-size="9">${label}</text><g data-needle="${label}"><path d="M -7 0 L 57 0" stroke="#ef614d" stroke-width="3"/><circle r="5" fill="#8b979e"/></g></g>`;
  }
  stage.innerHTML = `<img class="photo-fascia" alt="" src="${base}dashboard.png"><svg class="photo-instruments" viewBox="0 0 520 180"><defs><radialGradient id="dial-face"><stop stop-color="#172028"/><stop offset="1" stop-color="#030608"/></radialGradient></defs>${dial(94, 'km/h', 20)}${dial(426, 'STEER', 64)}<text data-photo-gear x="260" y="48" text-anchor="middle" fill="#f2f5f6" font-size="30">P</text><text data-photo-speed x="260" y="99" text-anchor="middle" fill="#f2f5f6" font-size="40">0.0</text><text x="260" y="119" text-anchor="middle" fill="#93a4b0" font-size="11">km/h</text><text data-photo-brake x="260" y="148" text-anchor="middle" fill="#f7b47f" font-size="11">BRAKE HOLD</text></svg><div class="photo-monitor" data-view="cabin"><div class="photo-monitor-info"><small>PARKING ASSIST</small><strong data-photo-screen-gear>P</strong><span data-photo-screen-state>BRAKE HOLD</span><small>21.0°　 AUTO　 A/C</small></div><span class="photo-reverse-label" hidden>倒車影像 · 請確認周圍</span></div><img class="photo-wheel" alt="" src="${base}wheel.png">`;
  view.prepend(stage);
  const wheel = stage.querySelector<HTMLElement>('.photo-wheel')!;
  const monitor = stage.querySelector<HTMLElement>('.photo-monitor')!;
  const info = stage.querySelector<HTMLElement>('.photo-monitor-info')!;
  const reverseLabel = stage.querySelector<HTMLElement>('.photo-reverse-label')!;
  const speed = stage.querySelector('[data-photo-speed]')!;
  const gear = stage.querySelector('[data-photo-gear]')!;
  const brakeLabel = stage.querySelector('[data-photo-brake]')!;
  const screenGear = stage.querySelector('[data-photo-screen-gear]')!;
  const screenState = stage.querySelector('[data-photo-screen-state]')!;
  const needles = stage.querySelectorAll('[data-needle]');
  let active = false, disposed = false, last = '';
  function resize() {
    const width = Math.max(view.clientWidth, view.clientHeight * 1.5);
    stage.style.width = `${width}px`; stage.style.height = `${width / 1.5}px`;
    if (!active) return;
    const bounds = stage.getBoundingClientRect();
    const holes = ['rear', 'left', 'right'].map(name => {
      const rect = root.querySelector<HTMLElement>(`[data-view="${name}"]`)!.getBoundingClientRect();
      const left = (rect.left - bounds.left) / bounds.width * 100, right = (rect.right - bounds.left) / bounds.width * 100;
      const top = (rect.top - bounds.top) / bounds.height * 100, bottom = (rect.bottom - bounds.top) / bounds.height * 100;
      return `0% 0%,${left}% ${top}%,${right}% ${top}%,${right}% ${bottom}%,${left}% ${bottom}%,${left}% ${top}%`;
    });
    // The single WebGL canvas also paints mirrors below this DOM foreground.
    // Cut their apertures through every cockpit layer, including the rotating wheel.
    stage.style.clipPath = `polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${holes.join(',')})`;
  }
  const observer = new ResizeObserver(resize); observer.observe(view); resize();
  root.dataset.cabin = 'loading';
  const ready = Promise.all(Array.from(stage.querySelectorAll('img')).map(img => img.decode())).then(() => {
    if (disposed) return;
    active = true; stage.hidden = false; root.classList.add('photo-cockpit'); root.dataset.cabin = 'photo'; resize();
  }).catch(error => {
    if (!disposed) root.dataset.cabin = 'fallback';
    throw error;
  });
  return {
    ready, monitor, get active() { return active; },
    setDrivingSide(side: DrivingSide) { stage.dataset.drivingSide = side; resize(); },
    update(s: State, braking: boolean) {
      if (!active) return;
      wheel.style.transform = `translate(-50%, -50%) rotate(${s.steer * 180 / Math.PI * 14}deg)`;
      stage.dataset.interiorGear = s.gear;
      const kph = (Math.abs(s.speed) * 3.6).toFixed(1), brake = braking || s.brakeHold;
      const key = `${s.gear}/${kph}/${brake}/${Math.round(s.steer * 180 / Math.PI)}`;
      if (key === last) return; last = key;
      gear.textContent = screenGear.textContent = s.gear; speed.textContent = kph;
      brakeLabel.textContent = screenState.textContent = brake ? 'BRAKE HOLD' : 'READY';
      info.hidden = s.gear === 'R'; reverseLabel.hidden = s.gear !== 'R';
      needles[0].setAttribute('transform', `rotate(${135 + Number(kph) / 20 * 270})`);
      needles[1].setAttribute('transform', `rotate(${135 + (s.steer * 180 / Math.PI + 32) / 64 * 270})`);
    },
    dispose() { disposed = true; active = false; observer.disconnect(); stage.remove(); root.classList.remove('photo-cockpit'); },
  };
}
