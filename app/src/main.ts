import './style.css';
import { shift, step, clearance, type Gear } from './simulation';
import { bindInput } from './input';
import { createScene } from './scene';
import { SCENARIOS, scenarioState } from './scenarios';

const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
  <header class="topbar"><div class="brand"><span class="brand-icon">↶</span><div><h1>倒車練習室</h1><p>深藍儀表板</p></div></div><div class="lesson"><span data-lesson-level>入門</span><strong data-lesson-name>垂直倒車入庫</strong><span class="lesson-target" data-target-name>03 號車位</span></div><div class="session"><i></i><span data-session>練習中</span></div></header>
  <section class="scenario-bar" aria-label="場景選擇"><div><label for="scenario">選擇練習場景</label><select id="scenario" data-scenario>${SCENARIOS.map(s => `<option value="${s.id}">${s.name} · ${s.difficulty}</option>`).join('')}</select></div><p data-lesson-description>${SCENARIOS[0].description}</p><span>切換後重新開始</span></section>
  <div class="workspace">
    <section class="driver panel" aria-label="駕駛視角">
      <div class="panel-heading"><h2>駕駛視角</h2><span>左駕 · 三面後視鏡</span></div>
      <div class="drive-window" data-view="driver" tabindex="0" aria-label="駕駛畫面，使用方向鍵操作">
        <div class="windshield-frame" aria-hidden="true"></div>
        <div class="mirror central" data-view="rear"><span>中央後視鏡</span></div>
        <div class="mirror left" data-view="left"><span>左後視鏡</span></div>
        <div class="mirror right" data-view="right"><span>右後視鏡</span></div>
        <div class="cockpit" aria-hidden="true"><div class="dash-trim"></div><div class="vent vent-left"></div><div class="vent vent-right"></div><div class="instrument"><span data-dash-gear>P</span><strong data-dash-speed>0.0</strong><small>km/h</small><div class="meter-ticks"></div></div><div class="wheel" data-wheel><div class="wheel-spoke"></div><div class="wheel-hub"><span>↶</span></div></div></div>
        <div class="pause-cover" hidden><strong>練習已暫停</strong><span>按 Esc 或「繼續練習」返回</span></div>
        <div class="render-error" hidden role="alert"></div>
      </div>
      <div class="driver-footer"><span class="view-dot"></span><span data-visual-status>正在載入實景環境…</span><span class="keyboard-note">鍵盤操作</span></div>
    </section>
    <aside class="sidebar" aria-label="俯瞰與車輛操控">
      <section class="overhead panel"><div class="panel-heading"><h2>俯瞰輔助</h2><label class="aids-toggle"><input type="checkbox" data-aids checked>軌跡輔助</label></div><div class="map-window" data-view="overhead"></div><div class="map-legend"><span><i class="legend-car"></i>你的車</span><span><i class="legend-target"></i><span data-map-target>03 號車位</span></span><span>車頭朝箭頭方向</span></div></section>
      <section class="transmission"><div class="gear-panel panel"><div class="small-title">檔位 <small>停穩＋煞車後切換</small></div><div class="gears" role="group" aria-label="排檔">${(['P', 'R', 'N', 'D'] as Gear[]).map((g, i) => `<button data-shift="${g}" aria-label="${g} 檔" aria-pressed="${g === 'P'}"><strong>${g}</strong><kbd>${i + 1}</kbd></button>`).join('')}</div></div><div class="speed-panel panel"><b data-gear>P</b><strong data-speed-label>0.0</strong><span>km/h</span></div></section>
      <section class="control-row"><div class="steering-panel panel"><div class="small-title">轉向 <span data-steer-label>右 20°</span></div><div class="mini-wheel" data-wheel aria-hidden="true">⊕</div><div class="steering-buttons"><button data-action="left" aria-label="向左轉向">←</button><button data-center title="C 輔助回正">回正 <kbd>C</kbd></button><button data-action="right" aria-label="向右轉向">→</button></div></div><button class="pedal panel" data-action="brake" title="按住 ↓、空白鍵或踏板煞車；放開後恢復蠕行"><span>煞車 <kbd>↓</kbd></span><i class="brake-pedal"></i><small data-brake-label>按住減速</small></button><button class="pedal panel" data-action="throttle"><span>油門 <kbd>↑</kbd></span><i class="gas-pedal"></i><small>按住加速</small></button></section>
      <button class="hold-button" data-hold aria-pressed="true"><span class="hold-mark">Ⓑ</span><span data-hold-label>保持煞車中</span><small data-hold-help>點擊放開</small></button>
      <div class="session-buttons"><button data-pause>Ⅱ 暫停 <kbd>Esc</kbd></button><button data-reset>↻ 重新開始</button></div>
    </aside>
  </div>
  <section class="feedback" aria-label="練習狀態"><div class="coach"><span class="coach-icon">↳</span><div><strong data-coach-title>準備倒車</strong><p data-message role="status" aria-live="polite">已保持煞車，切入 R 檔後，再放開煞車。</p></div></div><div class="metric"><small>最近障礙</small><strong data-clearance>—<span>m</span></strong></div><div class="metric"><small>碰撞次數</small><strong data-collisions>0</strong></div></section>
  <footer class="page-footer"><span>↑ 油門　↓ / 空白鍵 煞車　← → 轉向　1–4 換檔</span><span>低速操作示意 · 尚未以真車校準　<a href="${import.meta.env.BASE_URL}assets/credits.html" target="_blank" rel="noopener">素材來源</a></span></footer>`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
let scenario = SCENARIOS[0];
let graphics: ReturnType<typeof createScene> | undefined;
let state = scenarioState(scenario), paused = false, aids = true, centerAssist = false;
let messageUntil = 0, lastCollision = 0, accumulator = 0, lastTime = 0, uiElapsed = 0;
let unavailable = false;
function notice(message: string) { $('[data-message]').textContent = message; messageUntil = performance.now() + 4500; }
function pause(value: boolean, blur = false) {
  if (unavailable) return;
  paused = value; input.clear(); accumulator = 0;
  if (!value) { state.speed = 0; state.brakeHold = true; }
  if (blur) notice('已離開操作視窗，練習自動暫停。');
  updateUI();
}
function selectGear(gear: Gear) {
  if (paused || unavailable) return;
  if (!shift(state, gear, input.read().brake)) notice('請先停穩並踩住煞車，再切換檔位。');
  else { messageUntil = 0; updateUI(); }
}
const input = bindInput(root, { shift: selectGear, pause: () => pause(!paused), blur: () => pause(true, true), center: () => { centerAssist = true; }, changed: () => updateUI() });
root.querySelectorAll<HTMLButtonElement>('[data-shift]').forEach(button => button.onclick = () => selectGear(button.dataset.shift as Gear));
$('[data-hold]').onclick = () => { if (!unavailable) { state.brakeHold = !state.brakeHold; messageUntil = 0; updateUI(); } };
$('[data-center]').onclick = () => { centerAssist = true; };
$('[data-pause]').onclick = () => pause(!paused);
$('[data-reset]').onclick = () => {
  if (unavailable) { location.reload(); return; }
  state = scenarioState(scenario); paused = false; centerAssist = false; accumulator = 0; lastCollision = 0; messageUntil = 0; input.clear(); updateUI();
};
$<HTMLInputElement>('[data-aids]').onchange = e => { aids = (e.target as HTMLInputElement).checked; };

function updateUI() {
  const speed = (Math.abs(state.speed) * 3.6).toFixed(1), angle = state.steer * 180 / Math.PI, controls = input.read();
  Object.assign(root.dataset, { speed: String(state.speed), x: String(state.x), z: String(state.z), steer: String(state.steer), paused: String(paused), scenario: scenario.id, parked: String(state.parked) });
  $('[data-gear]').textContent = state.gear;
  $('[data-dash-gear]').textContent = state.gear;
  $('[data-speed-label]').textContent = speed; $('[data-dash-speed]').textContent = speed;
  $('[data-steer-label]').textContent = Math.abs(angle) < .5 ? '0°' : `${angle > 0 ? '右' : '左'} ${Math.round(Math.abs(angle))}°`;
  root.querySelectorAll<HTMLElement>('[data-wheel]').forEach(w => w.style.setProperty('--steering', `${angle * 14}deg`));
  root.querySelectorAll<HTMLElement>('[data-shift]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.shift === state.gear)));
  const brake = state.brakeHold || controls.brake;
  $('[data-brake-label]').textContent = paused ? '已暫停' : controls.brake ? '踩下中' : state.brakeHold ? '保持中' : '按住減速';
  root.querySelectorAll<HTMLElement>('[data-action]').forEach(button => button.dataset.active = String(!paused && (button.dataset.action === 'brake' ? brake : button.dataset.action === 'throttle' ? controls.throttle && !brake : button.dataset.action === 'left' ? controls.steer < 0 : controls.steer > 0)));
  $('[data-hold]').setAttribute('aria-pressed', String(state.brakeHold));
  $('[data-hold-label]').textContent = state.brakeHold ? '保持煞車中' : '保持煞車';
  $('[data-hold-help]').textContent = state.brakeHold ? '點擊放開' : '點擊踩住';
  $('[data-pause]').innerHTML = paused ? '▶ 繼續練習 <kbd>Esc</kbd>' : 'Ⅱ 暫停 <kbd>Esc</kbd>';
  $('.pause-cover').hidden = !paused || unavailable;
  $('[data-session]').textContent = unavailable ? '畫面無法啟動' : paused ? '已暫停' : state.parked ? '停車完成' : '練習中';
  $('[data-collisions]').textContent = String(state.collisions);
  const gap = clearance(state, scenario.world);
  $('[data-clearance]').innerHTML = `${gap.toFixed(2)}<span> m</span>`;
  $('[data-clearance]').classList.toggle('warning', gap < .4);
  $('[data-coach-title]').textContent = state.parked ? '停車完成' : paused ? '練習已暫停' : controls.brake ? Math.abs(state.speed) > .01 ? '煞車減速中' : '已煞停' : state.contact ? '注意車身距離' : state.gear === 'P' ? '準備倒車' : state.gear === 'R' ? '倒車中' : state.gear === 'N' ? '空檔' : '前進調整';
  if (state.collisions > lastCollision) { notice('車身碰到障礙，已煞停。踩住煞車換檔，向反方向慢慢駛離。'); lastCollision = state.collisions; }
  if (performance.now() > messageUntil && !unavailable) $('[data-message]').textContent = state.parked ? `已完整進入${scenario.targetName}並停穩，可切入 P 檔。` : paused ? '返回後會保持煞車，確認檔位再繼續。' : controls.brake ? '煞車已踩下，請持續按住直到停穩。放開後 D／R 會恢復蠕行；要持續停止可啟用「保持煞車」。' : state.gear === 'P' ? state.brakeHold ? '已保持煞車，切入 R 檔後，再放開煞車。' : '目前為 P 檔。按住 ↓ 或空白鍵踩煞車，再切入 R／D 檔。' : state.gear === 'N' ? 'N 檔不提供動力；換檔前記得踩住煞車。' : state.brakeHold ? '煞車保持中。確認周圍後，點擊「保持煞車中」放開。' : scenario.kind === 'parallel' ? '觀察右後視鏡與前後車距，倒入路邊車位；車身與路緣平行後停穩。' : '輕踩油門或利用蠕行，從後視鏡觀察車尾與白線的距離。';
}
function renderFailure(reason: string) {
  unavailable = true; paused = true; input.clear(); root.dataset.ready = 'false';
  $('.render-error').hidden = false;
  $('.render-error').textContent = reason;
  root.querySelectorAll<HTMLButtonElement>('button:not([data-reset])').forEach(b => b.disabled = true);
  updateUI();
}
function startGraphics() {
  graphics?.dispose(); graphics = undefined;
  root.dataset.ready = 'false';
  $('[data-visual-status]').textContent = '正在載入實景環境…';
  try {
  const current = createScene(root, () => renderFailure('3D 畫面已中斷，請點「重新開始」重新載入。'), scenario);
  graphics = current;
  void current.ready.then(() => {
    if (graphics !== current) return;
    $('[data-visual-status]').textContent = root.dataset.assets === 'fallback' ? '部分場景細節未載入，仍可繼續練習；重新整理可重試。' : `實景環境 · ${scenario.name} · 留意後視鏡與車距`;
  });
  current.renderer.setAnimationLoop(time => {
    const elapsed = lastTime ? Math.max(0, (time - lastTime) / 1000) : 0; lastTime = time;
    if (!paused && !unavailable) {
      accumulator += Math.min(elapsed, .1);
      const controls = input.read();
      if (controls.steer !== 0) centerAssist = false;
      controls.center = centerAssist;
      while (accumulator >= 1 / 120) { step(state, controls, 1 / 120, scenario.world); accumulator -= 1 / 120; }
      if (Math.abs(state.steer) < .001) centerAssist = false;
    }
    if (!unavailable) current.render(state, aids, input.read().brake);
    uiElapsed += elapsed;
    if (uiElapsed > .05) { updateUI(); uiElapsed = 0; }
  });
  root.dataset.ready = 'true';
} catch (error) {
  console.error(error);
  renderFailure('無法啟動 3D 畫面，請使用支援 WebGL 2 的 Chrome 或 Edge，並啟用硬體加速後重試。');
}

}
$<HTMLSelectElement>('[data-scenario]').onchange = event => {
  const next = SCENARIOS.find(s => s.id === (event.target as HTMLSelectElement).value);
  if (!next || next === scenario) return;
  scenario = next; state = scenarioState(scenario);
  paused = false; unavailable = false; centerAssist = false; accumulator = 0; lastTime = 0; uiElapsed = 0;
  lastCollision = 0; messageUntil = 0; input.clear();
  $('.render-error').hidden = true;
  root.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.disabled = false);
  $('[data-lesson-level]').textContent = scenario.difficulty;
  $('[data-lesson-name]').textContent = scenario.kind === 'parallel' ? '路邊停車' : '垂直倒車入庫';
  $('[data-target-name]').textContent = scenario.targetName;
  $('[data-map-target]').textContent = scenario.targetName;
  $('[data-lesson-description]').textContent = scenario.description;
  updateUI(); startGraphics();
  $('[data-view="driver"]').focus({ preventScroll: true });
};
updateUI(); startGraphics();
if (import.meta.hot) import.meta.hot.dispose(() => { graphics?.dispose(); input.dispose(); });
