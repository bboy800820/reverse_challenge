import './controller.css';
import { motionRoll, tiltSteering } from './remote-input';

const root = document.querySelector<HTMLElement>('#controller')!;
root.innerHTML = `<header class="phone-header"><div><span class="eyebrow">倒車練習室 · 手機控制</span><strong data-connection>準備連線</strong></div><div class="phone-speed"><b data-gear>P</b><strong data-speed>0.0</strong><small>km/h</small></div></header>
<section class="phone-setup"><button data-motion>啟用方向感應</button><button data-calibrate disabled>校正置中</button><button data-touch aria-pressed="true">觸控轉向</button><label>轉向幅度<select data-range><option value="30">小 · 30°</option><option value="45" selected>標準 · 45°</option><option value="70">大 · 70°</option></select></label></section>
<p class="phone-notice" data-notice role="status">橫拿手機較好操作；也可直接拖曳中央方向盤。</p>
<section class="phone-controls"><button class="phone-pedal phone-brake" data-pedal="brake"><span>煞車</span><small>按住減速</small><i></i></button><div class="phone-wheel-area"><div class="phone-wheel" data-touch-wheel role="slider" tabindex="0" aria-label="方向盤，向左右拖曳" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><div data-wheel-face><span>↶</span></div></div><div class="phone-steering"><span data-angle>0°</span><button data-center>回正</button></div><p data-mode>觸控：左右拖曳，放開維持角度</p></div><button class="phone-pedal phone-throttle" data-pedal="throttle"><span>油門</span><small>按住加速</small><i></i></button></section>
<footer class="phone-footer"><div class="phone-gears" aria-label="排檔">${['P', 'R', 'N', 'D'].map(g => `<button data-gear-button="${g}" aria-pressed="${g === 'P'}">${g}</button>`).join('')}</div><button data-hold aria-pressed="true">保持煞車中</button><button data-resume>開始／繼續</button><button data-pause>暫停</button><button data-reconnect hidden>重新連線</button></footer><p class="phone-footnote">換檔需停穩並煞車 · 連線中請保持此頁開啟</p>`;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
const params = new URLSearchParams(location.hash.slice(1));
let socket: WebSocket | null = null, joined = false, stamp = 0, epoch = '', seq = 0, lastStatus = 0;
let awaitingEpoch: string | null = null;
let mode: 'touch' | 'motion' = 'touch', calibrated = false, roll: number | null = null, rollAt = 0, zero = 0, steering = 0, smooth = 0;
let paused = true, hold = true, wake: { release: () => Promise<void> } | null = null;
const pointers = new Map<number, string>();
const notice = (text: string) => { $('[data-notice]').textContent = text; };
const ready = () => mode === 'touch' || calibrated;
function clearPedals() { pointers.clear(); root.querySelectorAll('[data-pedal]').forEach(e => e.removeAttribute('data-active')); }
function drawSteering() {
  $('[data-wheel-face]').style.transform = `rotate(${steering * 120}deg)`;
  $('[data-angle]').textContent = Math.abs(steering) < .01 ? '0°' : `${steering > 0 ? '右' : '左'} ${Math.round(Math.abs(steering) * 32)}°`;
  $('[data-touch-wheel]').setAttribute('aria-valuenow', String(Math.round(steering * 100)));
}
function send(action?: string, gear?: string) {
  if (!joined || socket?.readyState !== WebSocket.OPEN || !epoch || awaitingEpoch || performance.now() - lastStatus > 600 || socket.bufferedAmount > 4096) return false;
  const brake = [...pointers.values()].includes('brake');
  socket.send(JSON.stringify({ type: 'input', epoch, seq: ++seq, stamp, steering, throttle: !paused && ready() && !brake && [...pointers.values()].includes('throttle'), brake, ready: ready(), ...(action ? { action } : {}), ...(gear ? { gear } : {}) }));
  return true;
}
function requestPause() {
  clearPedals();
  if (send('pause')) awaitingEpoch = epoch;
  paused = true; updateAvailability();
}
function connection(text: string, retry = false) { $('[data-connection]').textContent = text; $('[data-reconnect]').hidden = !retry; }
function updateAvailability() {
  const linked = joined && !!epoch && !awaitingEpoch && performance.now() - lastStatus <= 600;
  root.querySelectorAll<HTMLButtonElement>('[data-pedal], [data-gear-button], [data-hold]').forEach(b => b.disabled = !linked || paused || !ready());
  $<HTMLButtonElement>('[data-resume]').disabled = !linked || !paused || !ready();
  $<HTMLButtonElement>('[data-pause]').disabled = !joined || paused;
}
function stop(reason: string, close = false) {
  requestPause(); calibrated = false;
  if (close) { joined = false; const old = socket; socket = null; old?.close(); connection('連線已暫停', true); }
  notice(reason); updateAvailability();
}
function connect() {
  const endpoint = params.get('server'), room = params.get('room'), token = params.get('token');
  let url: URL;
  try {
    url = new URL(endpoint || '');
    if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error();
    if (!room || !token || url.username || url.password) throw new Error();
  } catch { connection('尚未配對'); notice('請在電腦的「連接手機」開啟 QR Code，再用手機相機掃描。'); updateAvailability(); return; }
  clearPedals(); calibrated = false; paused = true; joined = false; epoch = ''; awaitingEpoch = null; seq = 0; lastStatus = 0;
  const old = socket; socket = null; old?.close();
  connection('正在連線…'); updateAvailability();
  const ws = new WebSocket(url); socket = ws;
  ws.onopen = () => { if (socket === ws) ws.send(JSON.stringify({ type: 'join', room, token })); };
  ws.onmessage = event => {
    if (socket !== ws) return;
    let m; try { m = JSON.parse(event.data); } catch { return; }
    if (m.type === 'joined') { joined = true; connection('已連接電腦'); notice('選擇觸控或啟用感應，按「開始／繼續」後換檔，再放開保持煞車。'); }
    else if (m.type === 'status') {
      if (typeof m.epoch !== 'string' || !Number.isFinite(m.stamp)) return;
      // Wait for the desktop's pause acknowledgement before enabling resume.
      // An older status or immediate resume must not reuse the retired epoch.
      if (awaitingEpoch === m.epoch) return;
      awaitingEpoch = null;
      if (epoch !== m.epoch) { epoch = m.epoch; clearPedals(); }
      const wasPaused = paused;
      stamp = m.stamp; lastStatus = performance.now(); paused = !!m.paused || !m.armed || !m.available; hold = !!m.hold;
      $('[data-gear]').textContent = m.gear; $('[data-speed]').textContent = Number(m.speed).toFixed(1);
      $('[data-hold]').textContent = hold ? '保持煞車中' : '保持煞車'; $('[data-hold]').setAttribute('aria-pressed', String(hold));
      root.querySelectorAll<HTMLElement>('[data-gear-button]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gearButton === m.gear)));
      if (wasPaused && !paused) notice('操作已開始；確認檔位後放開保持煞車，利用蠕行或輕踩油門練習。');
      if (m.message) $('.phone-footnote').textContent = m.message;
      connection(paused ? '已連線 · 已暫停' : '已連線 · 操作中');
    } else if (m.type === 'error' || m.type === 'ended') {
      const messages: Record<string, string> = { 'room-busy': '這個練習室已有手機控制，請先中斷另一支手機。', 'invalid-room': '配對已失效，請重新掃描電腦上的 QR Code。', 'expired': '練習室已到期，請在電腦重新建立配對。' };
      stop(messages[m.code || m.reason] || '電腦已結束連線，請重新掃碼配對。', true); connection('配對已結束', true);
    }
    updateAvailability();
  };
  ws.onerror = () => { if (socket === ws) notice('連線失敗，請確認網路後重新連線。'); };
  ws.onclose = () => { if (socket === ws) { joined = false; paused = true; clearPedals(); calibrated = false; connection('已斷線', true); notice('電腦將自動暫停。請重新連線並按繼續。'); updateAvailability(); } };
}
root.querySelectorAll<HTMLButtonElement>('[data-pedal]').forEach(button => {
  button.onpointerdown = e => { e.preventDefault(); if (button.disabled) return; button.setPointerCapture(e.pointerId); pointers.set(e.pointerId, button.dataset.pedal!); button.dataset.active = 'true'; send(); };
  const release = (e: PointerEvent) => { pointers.delete(e.pointerId); button.dataset.active = String([...pointers.values()].includes(button.dataset.pedal!)); send(); };
  button.onpointerup = release; button.onpointercancel = release; button.onlostpointercapture = release;
});
root.querySelectorAll<HTMLButtonElement>('[data-gear-button]').forEach(b => b.onclick = () => send('gear', b.dataset.gearButton));
$('[data-hold]').onclick = () => send('hold');
$('[data-pause]').onclick = requestPause;
$('[data-resume]').onclick = async () => {
  clearPedals(); send('resume');
  try { wake = await (navigator as Navigator & { wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') || null; } catch { /* optional */ }
};
$('[data-reconnect]').onclick = connect;
function touchMode() { stop('觸控轉向：左右拖曳，放開維持角度。'); mode = 'touch'; steering = smooth = 0; drawSteering(); $('[data-mode]').textContent = '觸控：左右拖曳，放開維持角度'; $('[data-touch]').setAttribute('aria-pressed', 'true'); $<HTMLButtonElement>('[data-calibrate]').disabled = true; updateAvailability(); }
$('[data-touch]').onclick = touchMode;
$('[data-motion]').onclick = async () => {
  stop('正在啟用方向感應…');
  try {
    if (!window.isSecureContext || !('DeviceOrientationEvent' in window)) throw new Error('目前瀏覽器無法使用方向感應，請使用觸控轉向。');
    const sensor = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    if (sensor.requestPermission && await sensor.requestPermission() !== 'granted') throw new Error('未取得感應器權限，仍可使用觸控轉向。');
    mode = 'motion'; calibrated = false; roll = null; rollAt = 0;
    $('[data-mode]').textContent = '感應轉向：請橫拿手機，按校正置中'; $('[data-touch]').setAttribute('aria-pressed', 'false'); $<HTMLButtonElement>('[data-calibrate]').disabled = false;
    notice('將手機像方向盤一樣立起橫拿，保持正中，點「校正置中」。');
  } catch (e) { mode = 'touch'; notice((e as Error).message); }
  updateAvailability();
};
window.addEventListener('deviceorientation', e => {
  roll = motionRoll(e.beta, e.gamma, screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0); rollAt = performance.now();
  if (mode === 'motion' && calibrated) {
    if (roll === null) { stop('請把手機立起並重新校正，或改用觸控轉向。'); return; }
    const target = tiltSteering(roll, zero, Number($<HTMLSelectElement>('[data-range]').value));
    smooth += (target - smooth) * .3; steering = smooth; drawSteering();
  }
});
$('[data-calibrate]').onclick = () => {
  if (roll === null || performance.now() - rollAt > 1000) { notice('尚未收到感應資料；請把手機立起，確認權限，或改用觸控轉向。'); return; }
  requestPause(); zero = roll; calibrated = true; steering = smooth = 0; drawSteering();
  $('[data-mode]').textContent = '感應轉向：左右轉動手機'; notice('置中完成，按「開始／繼續」開始練習。'); updateAvailability();
};
$<HTMLSelectElement>('[data-range]').onchange = () => { if (mode === 'motion') stop('轉向幅度已變更，請重新校正置中。'); };
$('[data-center]').onclick = () => { if (mode === 'motion') $<HTMLButtonElement>('[data-calibrate]').click(); else { steering = smooth = 0; drawSteering(); send(); } };
const wheel = $('[data-touch-wheel]'); let drag: { id: number; x: number; steering: number } | null = null;
wheel.onpointerdown = e => { if (mode !== 'touch') return; e.preventDefault(); wheel.setPointerCapture(e.pointerId); drag = { id: e.pointerId, x: e.clientX, steering }; };
// Coalesce high-refresh touch events into the 30Hz sender below.
wheel.onpointermove = e => { if (!drag || drag.id !== e.pointerId) return; steering = Math.max(-1, Math.min(1, drag.steering + (e.clientX - drag.x) / (wheel.clientWidth * .45))); drawSteering(); };
wheel.onpointerup = wheel.onpointercancel = wheel.onlostpointercapture = () => { drag = null; };
wheel.onkeydown = e => { if (mode === 'touch' && ['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) { e.preventDefault(); steering = e.key === 'Home' ? 0 : Math.max(-1, Math.min(1, steering + (e.key === 'ArrowRight' ? .1 : -.1))); drawSteering(); send(); } };
const reorient = () => { drag = null; if (mode === 'motion') stop('手機方向已改變，請重新校正置中。'); else requestPause(); };
screen.orientation?.addEventListener('change', reorient); window.addEventListener('orientationchange', reorient);
document.addEventListener('visibilitychange', () => { if (document.hidden) { stop('手機切到背景，請重新連線。', true); void wake?.release(); wake = null; } });
window.addEventListener('pagehide', () => stop('頁面已離開。', true));
window.addEventListener('blur', () => { if (joined) stop('操作已暫停，請確認後繼續。'); });
const timer = window.setInterval(() => {
  if (joined && lastStatus && performance.now() - lastStatus > 800) { stop('連線訊號逾時，請重新連線。', true); return; }
  if (mode === 'motion' && calibrated && performance.now() - rollAt > 1000) stop('方向感應已中斷，請重新校正或改用觸控。');
  send();
}, 33);
connect(); drawSteering(); updateAvailability();
if (import.meta.hot) import.meta.hot.dispose(() => { clearInterval(timer); socket?.close(); void wake?.release(); });
