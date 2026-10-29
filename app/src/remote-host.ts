import QRCode from 'qrcode';
import { RemoteInput, type RemoteFrame } from './remote-input';
import type { Input } from './simulation';
import './remote-host.css';

export function relayUrl(value: string) {
  const u = new URL(value.trim());
  if (u.protocol === 'https:') u.protocol = 'wss:';
  if (u.protocol === 'http:') u.protocol = 'ws:';
  if (!['wss:', 'ws:'].includes(u.protocol) || u.username || u.password || (u.protocol === 'ws:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) throw new Error('請填入 HTTPS 服務網址。');
  u.pathname = '/ws'; u.search = ''; u.hash = ''; return u.href;
}
type Hooks = { stop: (reason: string) => void; command: (frame: RemoteFrame) => void; status: () => Record<string, unknown> };
export function bindRemote(root: HTMLElement, hooks: Hooks) {
  const gate = new RemoteInput(); let owns = false, socket: WebSocket | null = null, link = '', disposed = false;
  const dialog = document.createElement('dialog'); dialog.className = 'phone-pair';
  dialog.innerHTML = `<div class="phone-pair-heading"><h2>手機方向盤</h2><button data-pair-close aria-label="關閉手機配對">✕</button></div><p data-pair-status role="status">連接手機，讓電腦專心顯示駕駛畫面。</p><form data-pair-form><label>連線服務網址<input data-relay-url type="url" placeholder="https://你的服務.onrender.com" required autocomplete="off"></label><button type="submit">建立配對</button></form><div data-pair-code hidden><canvas data-pair-qr aria-label="掃描此 QR Code 連接手機"></canvas><strong data-room></strong><p>手機掃碼後，點「開始／繼續」，再切換檔位並放開保持煞車。</p><button data-pair-copy>複製手機連結</button></div><p class="pair-help">免費服務首次連線可能需要約一分鐘喚醒。配對連結有效兩小時，只提供給自己的手機。</p><button data-pair-disconnect hidden>結束手機控制，改用鍵盤</button>`;
  root.append(dialog);
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => dialog.querySelector<T>(s)!;
  const status = (text: string) => { $('[data-pair-status]').textContent = text; };
  const address = $<HTMLInputElement>('[data-relay-url]');
  try { address.value = localStorage.getItem('parking-relay-url') || import.meta.env.VITE_RELAY_URL || ''; } catch { address.value = import.meta.env.VITE_RELAY_URL || ''; }
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-phone-connect]'));
  function label(text: string) { buttons.forEach(b => b.textContent = text); }
  function sendStatus() {
    if (socket?.readyState === WebSocket.OPEN && socket.bufferedAmount < 4096) socket.send(JSON.stringify({ type: 'status', ...hooks.status(), epoch: gate.epoch, stamp: performance.now(), armed: gate.armed }));
  }
  function halt(reason: string) { gate.stop(); hooks.stop(reason); sendStatus(); }
  function disconnect() {
    const old = socket; socket = null; old?.close(); gate.connected = false; owns = false;
    halt('已結束手機控制，保持煞車；可使用鍵盤繼續。');
    link = ''; $('[data-pair-code]').hidden = true; $('[data-pair-disconnect]').hidden = true;
    label('連接手機'); status('已切回鍵盤操作。');
  }
  async function connect() {
    let endpoint: string; try { endpoint = relayUrl(address.value); } catch { status('請輸入有效的 HTTPS 服務網址。'); return; }
    disconnect(); status('正在喚醒連線服務…首次連線請稍候。');
    try { localStorage.setItem('parking-relay-url', address.value); } catch { /* storage can be unavailable */ }
    const ws = new WebSocket(endpoint); socket = ws; $('[data-pair-disconnect]').hidden = false;
    ws.onopen = () => { if (socket === ws) ws.send(JSON.stringify({ type: 'create' })); };
    ws.onmessage = async event => {
      if (socket !== ws) return;
      let m; try { m = JSON.parse(event.data); } catch { return; }
      if (m.type === 'created') {
        const url = new URL(`${import.meta.env.BASE_URL}controller.html`, location.origin);
        url.hash = new URLSearchParams({ server: endpoint, room: m.room, token: m.token }).toString(); link = url.href;
        $('[data-room]').textContent = `練習室 ${m.room}`; $('[data-pair-code]').hidden = false;
        status('請用手機相機掃描 QR Code。'); label('手機配對中');
        try { await QRCode.toCanvas($<HTMLCanvasElement>('[data-pair-qr]'), link, { width: 224, margin: 2 }); } catch { status('QR Code 無法產生，請複製手機連結。'); }
      } else if (m.type === 'peer') {
        gate.connected = m.connected; owns = true;
        halt(m.connected ? '手機已連接，請在手機點「開始／繼續」。' : '手機已斷線，已自動暫停並保持煞車。');
        status(m.connected ? '手機已連接，可以關閉此視窗。' : '手機已斷線，可在手機點「重新連線」或重新掃碼。');
        label(m.connected ? '手機已連線' : '手機已斷線');
        if (m.connected) dialog.close();
      } else if (m.type === 'input' && gate.accept(m, performance.now())) {
        if (m.action === 'pause') halt('手機已暫停練習。');
        else if (m.action) hooks.command(m);
        if (m.action) sendStatus();
      } else if (m.type === 'error' || m.type === 'ended') status('配對已結束或服務忙碌，請重新建立配對。');
    };
    ws.onerror = () => { if (socket === ws) status('服務尚未連上，請確認網址，稍候再點「建立配對」。'); };
    ws.onclose = () => {
      if (socket !== ws) return;
      gate.connected = false; halt('連線服務已中斷，已自動暫停並保持煞車。');
      label('手機服務斷線'); $('[data-pair-code]').hidden = true;
      status('連線中斷。請重新建立配對，再讓手機掃碼。');
    };
  }
  buttons.forEach(b => b.onclick = () => { if (!dialog.open) { hooks.stop('手機配對設定中，已暫停練習。'); dialog.showModal(); } });
  $('[data-pair-close]').onclick = () => dialog.close();
  dialog.addEventListener('keydown', e => e.stopPropagation());
  $<HTMLFormElement>('[data-pair-form]').onsubmit = event => { event.preventDefault(); void connect(); };
  $('[data-pair-disconnect]').onclick = disconnect;
  $('[data-pair-copy]').onclick = async () => { try { await navigator.clipboard.writeText(link); status('手機連結已複製。'); } catch { status('無法複製，請使用手機相機掃碼。'); } };
  const timer = window.setInterval(() => {
    if (gate.expired(performance.now())) halt('手機訊號逾時，已自動暫停；請確認連線後按繼續。');
    sendStatus();
  }, 100);
  return {
    get owns() { return owns; },
    get pairingOpen() { return dialog.open; },
    stop() { gate.stop(); sendStatus(); },
    resume() { return !dialog.open && (!owns || gate.resume(performance.now())); },
    read(local: Input): Input { return owns ? { ...gate.read(performance.now()), brake: local.brake || gate.read(performance.now()).brake } : local; },
    dispose() { if (disposed) return; disposed = true; clearInterval(timer); socket?.close(); socket = null; dialog.remove(); },
  };
}
