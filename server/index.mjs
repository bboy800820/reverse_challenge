import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

export async function createRelay({ port = Number(process.env.PORT || 8787), origins = (process.env.ALLOWED_ORIGINS || 'https://bboy800820.github.io,http://127.0.0.1:5189,http://localhost:5189,http://127.0.0.1:5188').split(',') } = {}) {
  const rooms = new Map();
  const server = createServer((req, res) => { res.writeHead(req.url === '/health' ? 200 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ ok: req.url === '/health' })); });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  const send = (socket, data) => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 8192) { socket.terminate(); return; }
    socket.send(JSON.stringify(data));
  };
  const fail = (ws, code) => { send(ws, { type: 'error', code }); ws.close(1008, code); };
  function endRoom(id, reason) {
    const room = rooms.get(id); if (!room) return;
    rooms.delete(id); send(room.phone, { type: 'ended', reason }); room.phone?.close(1000, reason);
    send(room.host, { type: 'ended', reason }); room.host.close(1000, reason);
  }
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws' || !origins.includes(req.headers.origin) || wss.clients.size >= 256) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  wss.on('connection', ws => {
    ws.alive = true; ws.role = ''; ws.room = ''; ws.count = 0; ws.window = Date.now();
    const joinTimer = setTimeout(() => { if (!ws.role) ws.close(1008, 'join-timeout'); }, 10000);
    ws.on('error', () => {});
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (raw, binary) => {
      if (binary) return fail(ws, 'invalid-input');
      if (Date.now() - ws.window > 1000) { ws.window = Date.now(); ws.count = 0; }
      if (++ws.count > 100) return fail(ws, 'rate-limit');
      let m; try { m = JSON.parse(raw.toString()); } catch { return fail(ws, 'invalid-input'); }
      if (!m || typeof m !== 'object') return fail(ws, 'invalid-input');
      if (!ws.role && m.type === 'create') {
        if (rooms.size >= 64) return fail(ws, 'server-busy');
        const id = randomBytes(4).toString('hex').toUpperCase(), token = randomBytes(24).toString('hex');
        ws.room = id; ws.role = 'host'; clearTimeout(joinTimer);
        rooms.set(id, { host: ws, phone: null, token, created: Date.now() });
        return send(ws, { type: 'created', room: id, token });
      }
      if (!ws.role && m.type === 'join') {
        const room = rooms.get(m.room);
        if (!room || m.token !== room.token) return fail(ws, 'invalid-room');
        if (room.phone) return fail(ws, 'room-busy');
        ws.room = m.room; ws.role = 'phone'; clearTimeout(joinTimer); room.phone = ws;
        send(ws, { type: 'joined' }); return send(room.host, { type: 'peer', connected: true });
      }
      const room = rooms.get(ws.room); if (!room) return fail(ws, 'invalid-room');
      if (ws.role === 'phone' && m.type === 'input') {
        const valid = Number.isSafeInteger(m.seq) && m.seq >= 0 && Number.isFinite(m.stamp) && typeof m.epoch === 'string' && m.epoch.length <= 64 && Number.isFinite(m.steering) && Math.abs(m.steering) <= 1 && ['throttle', 'brake', 'ready'].every(k => typeof m[k] === 'boolean') && (m.action === undefined || ['resume', 'pause', 'hold', 'gear'].includes(m.action)) && (m.action !== 'gear' || ['P', 'R', 'N', 'D'].includes(m.gear));
        if (!valid) return fail(ws, 'invalid-input');
        return send(room.host, { type: 'input', seq: m.seq, stamp: m.stamp, epoch: m.epoch, steering: m.steering, throttle: m.throttle, brake: m.brake, ready: m.ready, ...(m.action ? { action: m.action } : {}), ...(m.action === 'gear' ? { gear: m.gear } : {}) });
      }
      if (ws.role === 'host' && m.type === 'status') return send(room.phone, m);
      fail(ws, 'invalid-input');
    });
    ws.on('close', () => {
      clearTimeout(joinTimer); const room = rooms.get(ws.room); if (!room) return;
      if (ws.role === 'host') endRoom(ws.room, 'host-left');
      else if (room.phone === ws) { room.phone = null; send(room.host, { type: 'peer', connected: false }); }
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } }
    for (const [id, room] of rooms) if (Date.now() - room.created > 2 * 60 * 60 * 1000) endRoom(id, 'expired');
  }, 15000);
  await new Promise(resolve => server.listen(port, '0.0.0.0', resolve));
  return { url: `ws://127.0.0.1:${server.address().port}/ws`, close: async () => { clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); await new Promise(resolve => server.close(resolve)); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const relay = await createRelay(); console.log(`Phone relay listening at ${relay.url}`);
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await relay.close(); process.exit(0); });
}
