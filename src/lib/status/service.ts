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
  /** Player counts the website has observed recently, or null if none yet. */
  activity: Activity | null;
}

/**
 * A rolling record of player counts, built only from this site's own status
 * checks. Counts are anonymous totals: no names or identifiers are involved.
 * It lives in memory, so it starts again whenever the website restarts.
 */
export interface Activity {
  /** ISO time of the oldest observation still in the window. */
  since: string;
  /** Highest and lowest player counts seen in the window. */
  peak: number;
  low: number;
  /** Peak count per half hour, oldest first. Null where nothing was observed. */
  buckets: (number | null)[];
}

export const ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ACTIVITY_BUCKET_MS = 30 * 60 * 1000;
/** How often the server checks on its own, so quiet hours are still recorded. */
export const SAMPLE_INTERVAL_MS = 5 * 60 * 1000;

interface Sample {
  at: number;
  online: number;
}

export function summariseActivity(samples: Sample[], now: number): Activity | null {
  const recent = samples.filter((s) => now - s.at < ACTIVITY_WINDOW_MS);
  if (recent.length === 0) return null;
  const buckets: (number | null)[] = new Array(ACTIVITY_WINDOW_MS / ACTIVITY_BUCKET_MS).fill(null);
  for (const sample of recent) {
    const index = buckets.length - 1 - Math.floor((now - sample.at) / ACTIVITY_BUCKET_MS);
    buckets[index] = Math.max(buckets[index] ?? 0, sample.online);
  }
  const counts = recent.map((s) => s.online);
  return {
    since: new Date(Math.min(...recent.map((s) => s.at))).toISOString(),
    peak: Math.max(...counts),
    low: Math.min(...counts),
    buckets,
  };
}

type Ping = (options: PingOptions) => Promise<PingResult>;

export function createStatusService(config: StatusConfig, ping: Ping = pingServer) {
  let cached: { status: PublicStatus; expires: number } | null = null;
  let inFlight: Promise<PublicStatus> | null = null;
  let lastSuccessAt: string | null = null;
  let samples: Sample[] = [];
  let sampler: NodeJS.Timeout | null = null;

  function record(online: number, at: number) {
    samples = samples.filter((s) => at - s.at < ACTIVITY_WINDOW_MS);
    samples.push({ at, online });
  }

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
      const now = Date.parse(checkedAt);
      if (result.players) record(result.players.online, now);
      return {
        state: 'online',
        players: result.players,
        version: result.versionName || null,
        checkedAt,
        lastSuccessAt,
        ttl,
        activity: summariseActivity(samples, now),
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
        activity: summariseActivity(samples, Date.parse(checkedAt)),
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
          activity: null,
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

    /**
     * Checks the server on a timer so the activity record covers hours when
     * nobody is visiting the website. Safe to call repeatedly.
     */
    startSampling(): void {
      if (!config.enabled || sampler) return;
      sampler = setInterval(() => void this.get().catch(() => {}), SAMPLE_INTERVAL_MS);
      // Never keep the process alive just for this.
      sampler.unref();
    },
  };
}
