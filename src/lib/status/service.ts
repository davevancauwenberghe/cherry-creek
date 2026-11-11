/**
 * Cached server status.
 *
 * However many visitors ask, the Minecraft server is probed at most once per
 * cache window: results are held in memory and concurrent requests share the
 * same in-flight probe.
 */
import { PingError, pingServer, type PingOptions, type PingResult } from '../minecraft/ping.ts';
import type { StatusConfig } from './config.ts';

export type ServerState = 'online' | 'offline' | 'unavailable' | 'disabled';

/** The only data that ever leaves the server. */
export interface PublicStatus {
  state: ServerState;
  players: { online: number; max: number } | null;
  version: string | null;
  /** ISO time of this check. */
  checkedAt: string;
  /** ISO time of the last check that reached the server, if any. */
  lastSuccessAt: string | null;
  /** How long clients may reuse this answer, in seconds. */
  ttl: number;
}

type Ping = (options: PingOptions) => Promise<PingResult>;

export function createStatusService(config: StatusConfig, ping: Ping = pingServer) {
  let cached: { status: PublicStatus; expires: number } | null = null;
  let inFlight: Promise<PublicStatus> | null = null;
  let lastSuccessAt: string | null = null;

  async function probe(): Promise<PublicStatus> {
    const ttl = Math.round(config.cacheMs / 1000);
    const checkedAt = new Date().toISOString();
    try {
      const result = await ping({
        host: config.host,
        port: config.port,
        virtualHost: config.virtualHost,
        timeoutMs: config.timeoutMs,
      });
      lastSuccessAt = checkedAt;
      return {
        state: 'online',
        players: { online: result.playersOnline, max: result.playersMax },
        version: result.versionName || null,
        checkedAt,
        lastSuccessAt,
        ttl,
      };
    } catch (error) {
      // A refused connection means the machine answered but nothing is
      // listening: the server is down. Anything else (timeout, DNS, garbage)
      // tells us nothing certain, so we say so rather than guess.
      const refused = error instanceof PingError && error.reason === 'refused';
      return {
        state: refused ? 'offline' : 'unavailable',
        players: null,
        version: null,
        checkedAt,
        lastSuccessAt,
        ttl,
      };
    }
  }

  return {
    async get(): Promise<PublicStatus> {
      if (!config.enabled) {
        return {
          state: 'disabled',
          players: null,
          version: null,
          checkedAt: new Date().toISOString(),
          lastSuccessAt: null,
          ttl: 3600,
        };
      }
      if (cached && cached.expires > Date.now()) return cached.status;
      inFlight ??= probe()
        .then((status) => {
          cached = { status, expires: Date.now() + config.cacheMs };
          return status;
        })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
  };
}
