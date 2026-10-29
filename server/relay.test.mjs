import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createRelay } from './index.mjs';

const origin = 'http://localhost:5189';
async function client(url) {
  const ws = new WebSocket(url, { origin });
  const inbox = [], waiters = [];
  ws.on('message', raw => { const m = JSON.parse(raw); const i = waiters.findIndex(w => w.type === m.type); if (i < 0) inbox.push(m); else waiters.splice(i, 1)[0].resolve(m); });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  return { ws, send: m => ws.send(JSON.stringify(m)), next: type => {
    const i = inbox.findIndex(m => m.type === type); if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timeout: ${type}`)), 2000); waiters.push({ type, resolve: m => { clearTimeout(timer); resolve(m); } }); });
  } };
}
test('rooms authenticate, reject takeover, forward controls, and notify disconnect', async t => {
  const relay = await createRelay({ port: 0, origins: [origin] }); t.after(() => relay.close());
  const host = await client(relay.url); host.send({ type: 'create' });
  const room = await host.next('created'); assert.match(room.token, /^[a-f0-9]{48}$/);
  const bad = await client(relay.url); bad.send({ type: 'join', room: room.room, token: 'wrong' }); assert.equal((await bad.next('error')).code, 'invalid-room');
  const phone = await client(relay.url); phone.send({ type: 'join', room: room.room, token: room.token }); await phone.next('joined'); assert.equal((await host.next('peer')).connected, true);
  const extra = await client(relay.url); extra.send({ type: 'join', room: room.room, token: room.token }); assert.equal((await extra.next('error')).code, 'room-busy');
  const frame = { type: 'input', seq: 1, stamp: 1, epoch: 'test', steering: .5, throttle: true, brake: false, ready: true };
  phone.send(frame); assert.deepEqual(await host.next('input'), frame);
  host.send({ type: 'status', epoch: 'test', stamp: 2, gear: 'R' }); assert.equal((await phone.next('status')).gear, 'R');
  phone.ws.close(); assert.equal((await host.next('peer')).connected, false);
  const rejoin = await client(relay.url); rejoin.send({ type: 'join', room: room.room, token: room.token }); await rejoin.next('joined'); await host.next('peer');
  host.ws.close(); assert.equal((await rejoin.next('ended')).reason, 'host-left');
});
test('invalid input is rejected and forbidden origins cannot connect', async t => {
  const relay = await createRelay({ port: 0, origins: [origin] }); t.after(() => relay.close());
  const host = await client(relay.url); host.send({ type: 'create' }); const room = await host.next('created');
  const phone = await client(relay.url); phone.send({ type: 'join', room: room.room, token: room.token }); await phone.next('joined');
  phone.send({ type: 'input', steering: 'NaN' }); assert.equal((await phone.next('error')).code, 'invalid-input');
  const forbidden = new WebSocket(relay.url, { origin: 'https://evil.example' });
  await new Promise(resolve => forbidden.once('error', resolve));
  const response = await fetch(relay.url.replace('ws:', 'http:').replace('/ws', '/health')); assert.equal(response.status, 200);
});
test('oversized frames are closed before parsing; rooms cannot send to each other', async t => {
  const relay = await createRelay({ port: 0, origins: [origin] }); t.after(() => relay.close());
  const host = await client(relay.url); host.send({ type: 'create' }); const room = await host.next('created');
  const other = await client(relay.url); other.send({ type: 'create' }); const otherRoom = await other.next('created');
  assert.notEqual(room.room, otherRoom.room);
  const wrongToken = await client(relay.url); wrongToken.send({ type: 'join', room: room.room, token: otherRoom.token });
  assert.equal((await wrongToken.next('error')).code, 'invalid-room');
  const large = await client(relay.url); const closed = new Promise(resolve => large.ws.once('close', resolve));
  large.ws.send('x'.repeat(3000)); assert.equal(await closed, 1009);
});
