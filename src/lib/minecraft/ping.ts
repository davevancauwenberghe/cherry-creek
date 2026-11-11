/**
 * Minimal Minecraft Java Edition "Server List Ping" client.
 *
 * Speaks the same status protocol the multiplayer screen uses: one TCP
 * connection, a handshake, a status request, one JSON response. No
 * dependencies, no Query (UDP) and no RCON.
 *
 * Protocol reference: https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping
 */
import { Socket } from 'node:net';

export interface PingOptions {
  /** Host to open the TCP connection to. */
  host: string;
  port: number;
  /** Address sent in the handshake (what a player would type). Defaults to `host`. */
  virtualHost?: string;
  /** Overall deadline for connect + response, in milliseconds. */
  timeoutMs: number;
}

export interface PingResult {
  versionName: string;
  playersOnline: number;
  playersMax: number;
}

export type PingFailure = 'refused' | 'timeout' | 'dns' | 'protocol' | 'network';

export class PingError extends Error {
  readonly reason: PingFailure;
  constructor(reason: PingFailure, message: string) {
    super(message);
    this.name = 'PingError';
    this.reason = reason;
  }
}

/** Upper bound on the response we are willing to buffer. */
const MAX_RESPONSE_BYTES = 256 * 1024;

export function encodeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (v !== 0);
  return Buffer.from(bytes);
}

/** Returns the decoded value and bytes consumed, or null if more data is needed. */
export function decodeVarInt(buf: Buffer, offset = 0): { value: number; size: number } | null {
  let value = 0;
  for (let size = 0; size < 5; size++) {
    if (offset + size >= buf.length) return null;
    const byte = buf[offset + size]!;
    value |= (byte & 0x7f) << (7 * size);
    if ((byte & 0x80) === 0) return { value: value >>> 0, size: size + 1 };
  }
  throw new PingError('protocol', 'VarInt is too long');
}

function packet(id: number, ...fields: Buffer[]): Buffer {
  const body = Buffer.concat([encodeVarInt(id), ...fields]);
  return Buffer.concat([encodeVarInt(body.length), body]);
}

function mcString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([encodeVarInt(bytes.length), bytes]);
}

function handshake(host: string, port: number): Buffer {
  const portBytes = Buffer.alloc(2);
  portBytes.writeUInt16BE(port);
  // Protocol version -1 asks the server to answer with whatever it runs.
  return packet(0x00, encodeVarInt(-1), mcString(host), portBytes, encodeVarInt(1));
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), 1_000_000)
    : 0;
}

/** Keeps only the fields we publish, validated and trimmed. */
export function parseStatusJson(json: string): PingResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new PingError('protocol', 'Status response was not valid JSON');
  }
  if (typeof data !== 'object' || data === null) {
    throw new PingError('protocol', 'Status response was not an object');
  }
  const { version, players } = data as {
    version?: { name?: unknown };
    players?: { online?: unknown; max?: unknown };
  };
  const rawName = typeof version?.name === 'string' ? version.name : '';
  return {
    // Strip legacy "§x" colour codes and control characters, then cap the length.
    versionName: rawName
      .replace(/§./g, '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 48),
    playersOnline: toCount(players?.online),
    playersMax: toCount(players?.max),
  };
}

function classify(error: NodeJS.ErrnoException): PingFailure {
  switch (error.code) {
    case 'ECONNREFUSED':
      return 'refused';
    case 'ETIMEDOUT':
      return 'timeout';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'dns';
    default:
      return 'network';
  }
}

export function pingServer(options: PingOptions): Promise<PingResult> {
  const { host, port, timeoutMs } = options;
  const virtualHost = options.virtualHost ?? host;

  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let received = Buffer.alloc(0);
    let settled = false;

    const finish = (error: PingError | null, result?: PingResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      socket.destroy();
      if (error) reject(error);
      else resolve(result!);
    };

    const deadline = setTimeout(
      () => finish(new PingError('timeout', `No status response within ${timeoutMs} ms`)),
      timeoutMs,
    );

    socket.setNoDelay(true);
    socket.once('error', (error: NodeJS.ErrnoException) =>
      finish(new PingError(classify(error), error.message)),
    );
    socket.once('close', () =>
      finish(new PingError('protocol', 'Connection closed before a full response arrived')),
    );

    socket.on('data', (chunk: Buffer) => {
      received = Buffer.concat([received, chunk]);
      if (received.length > MAX_RESPONSE_BYTES) {
        return finish(new PingError('protocol', 'Status response is too large'));
      }
      try {
        const length = decodeVarInt(received);
        if (!length) return;
        if (length.value > MAX_RESPONSE_BYTES) {
          return finish(new PingError('protocol', 'Status response is too large'));
        }
        if (received.length < length.size + length.value) return;

        let offset = length.size;
        const id = decodeVarInt(received, offset);
        if (!id || id.value !== 0x00) {
          return finish(new PingError('protocol', 'Unexpected packet in status response'));
        }
        offset += id.size;
        const jsonLength = decodeVarInt(received, offset);
        if (!jsonLength) return finish(new PingError('protocol', 'Malformed status response'));
        offset += jsonLength.size;
        const json = received.subarray(offset, offset + jsonLength.value).toString('utf8');
        finish(null, parseStatusJson(json));
      } catch (error) {
        finish(
          error instanceof PingError ? error : new PingError('protocol', 'Malformed response'),
        );
      }
    });

    socket.connect({ host, port }, () => {
      socket.write(Buffer.concat([handshake(virtualHost, port), packet(0x00)]));
    });
  });
}
