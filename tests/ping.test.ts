import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:net';
import { after, test } from 'node:test';
import {
  PingError,
  decodeVarInt,
  encodeVarInt,
  parseStatusJson,
  pingServer,
} from '../src/lib/minecraft/ping.ts';
import { readStatusConfig } from '../src/lib/status/config.ts';
import { createStatusService, summariseActivity } from '../src/lib/status/service.ts';

const servers: Server[] = [];
after(() => servers.forEach((s) => s.close()));

/** Starts a fake Minecraft server that answers any status request with `payload`. */
function fakeServer(payload: string | null, chunked = false): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer((socket) => {
      socket.on('error', () => {});
      socket.once('data', () => {
        if (payload === null) return; // stay silent: simulates a hang
        const json = Buffer.from(payload, 'utf8');
        const body = Buffer.concat([encodeVarInt(0), encodeVarInt(json.length), json]);
        const packet = Buffer.concat([encodeVarInt(body.length), body]);
        if (!chunked) return socket.end(packet);
        socket.write(packet.subarray(0, 5));
        setTimeout(() => socket.end(packet.subarray(5)), 20);
      });
    });
    servers.push(server);
    server.listen(0, '127.0.0.1', () => resolve((server.address() as { port: number }).port));
  });
}

const sample = JSON.stringify({
  version: { name: 'Paper 26.3', protocol: 999 },
  players: { online: 3, max: 10, sample: [{ name: 'someone', id: 'x' }] },
  description: 'hello',
});

test('VarInt round-trips, including negatives', () => {
  for (const n of [0, 1, 127, 128, 255, 25565, 2097151, 2147483647]) {
    assert.equal(decodeVarInt(encodeVarInt(n))?.value, n);
  }
  assert.equal(encodeVarInt(-1).length, 5);
  assert.equal(decodeVarInt(Buffer.from([0x80])), null);
});

test('pings a server and returns only public fields', async () => {
  const port = await fakeServer(sample);
  const result = await pingServer({ host: '127.0.0.1', port, timeoutMs: 1000 });
  assert.deepEqual(result, { versionName: 'Paper 26.3', players: { online: 3, max: 10 } });
});

test('handles a response split across TCP chunks', async () => {
  const port = await fakeServer(sample, true);
  const result = await pingServer({ host: '127.0.0.1', port, timeoutMs: 1000 });
  assert.equal(result.players?.online, 3);
});

test('times out against a silent server', async () => {
  const port = await fakeServer(null);
  await assert.rejects(
    pingServer({ host: '127.0.0.1', port, timeoutMs: 150 }),
    (e: unknown) => e instanceof PingError && e.reason === 'timeout',
  );
});

test('reports a refused connection', async () => {
  const port = await fakeServer(sample);
  servers.pop()!.close();
  await assert.rejects(
    pingServer({ host: '127.0.0.1', port, timeoutMs: 500 }),
    (e: unknown) => e instanceof PingError && e.reason === 'refused',
  );
});

test('rejects malformed JSON and sanitises odd values', () => {
  assert.throws(() => parseStatusJson('nope'), PingError);
  assert.deepEqual(
    parseStatusJson('{"version":{"name":"§aPaper\\u0007 1"},"players":{"online":-4,"max":"x"}}'),
    { versionName: 'Paper 1', players: null },
  );
});

test('missing or partial player counts are unknown, not zero', () => {
  assert.equal(parseStatusJson('{"version":{"name":"Paper 26.3"}}').players, null);
  assert.equal(parseStatusJson('{"version":{"name":"x"},"players":{"online":2}}').players, null);
  assert.deepEqual(parseStatusJson('{"players":{"online":0,"max":10}}').players, {
    online: 0,
    max: 10,
  });
});

test('config validates and clamps environment values', () => {
  const config = readStatusConfig({
    MC_STATUS_HOST: 'bad host!',
    MC_STATUS_PORT: '99999',
    STATUS_CACHE_SECONDS: '1',
    STATUS_ENABLED: 'FALSE',
  });
  assert.equal(config.host, 'play.cherrycreek.app');
  assert.equal(config.port, 65535);
  assert.equal(config.cacheMs, 10_000);
  assert.equal(config.enabled, false);
});

test('service caches, de-duplicates and maps failures to neutral states', async () => {
  let calls = 0;
  const config = { ...readStatusConfig({}), cacheMs: 60_000 };
  const online = createStatusService(config, async () => {
    calls++;
    return { versionName: 'Paper 26.3', players: { online: 2, max: 10 } };
  });
  const [a, b] = await Promise.all([online.get(), online.get()]);
  await online.get();
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(a.state, 'online');
  assert.deepEqual(a.players, { online: 2, max: 10 });

  const refused = createStatusService(config, async () => {
    throw new PingError('refused', 'x');
  });
  assert.equal((await refused.get()).state, 'offline');

  const slow = createStatusService(config, async () => {
    throw new PingError('timeout', 'x');
  });
  const unavailable = await slow.get();
  assert.equal(unavailable.state, 'unavailable');
  assert.equal(unavailable.players, null);

  const noCounts = createStatusService(config, async () => ({
    versionName: 'Paper 26.3',
    players: null,
  }));
  const partial = await noCounts.get();
  assert.equal(partial.state, 'online');
  assert.equal(partial.players, null);

  const off = createStatusService({ ...config, enabled: false }, async () => {
    throw new Error('must not be called');
  });
  assert.equal((await off.get()).state, 'disabled');
});

test('activity summarises anonymous player counts over the last 24 hours', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const minute = 60_000;
  assert.equal(summariseActivity([], now), null);

  const activity = summariseActivity(
    [
      { at: now - 25 * 60 * minute, online: 9 }, // older than the window: ignored
      { at: now - 23 * 60 * minute, online: 1 },
      { at: now - 40 * minute, online: 4 },
      { at: now - 35 * minute, online: 2 },
      { at: now - 5 * minute, online: 0 },
    ],
    now,
  )!;
  assert.equal(activity.peak, 4);
  assert.equal(activity.low, 0);
  assert.equal(activity.buckets.length, 48);
  assert.equal(activity.buckets.at(-1), 0);
  assert.equal(activity.buckets.at(-2), 4); // the highest count in that half hour
  assert.equal(activity.buckets.at(-3), null);
  assert.equal(activity.buckets[1], 1);
  assert.equal(activity.since, new Date(now - 23 * 60 * minute).toISOString());
});

test('service records activity from its own checks only when counts are known', async () => {
  const config = { ...readStatusConfig({}), cacheMs: 0 };
  const answers = [{ online: 2, max: 10 }, null, { online: 5, max: 10 }];
  const service = createStatusService(config, async () => ({
    versionName: 'Paper 26.3',
    players: answers.shift() ?? null,
  }));
  await service.get();
  await service.get();
  const last = await service.get();
  assert.equal(last.activity?.peak, 5);
  assert.equal(last.activity?.low, 2);
});
