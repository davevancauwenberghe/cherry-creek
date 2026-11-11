/**
 * Runtime configuration for the live status feature.
 *
 * Read from process.env when the server starts, so values can be changed in
 * Coolify (or any container runtime) without rebuilding the image.
 */
export interface StatusConfig {
  enabled: boolean;
  /** Host the website connects to. May differ from the public address. */
  host: string;
  port: number;
  /** Address sent in the handshake, i.e. the one players use. */
  virtualHost: string;
  cacheMs: number;
  timeoutMs: number;
}

const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

function integer(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function hostname(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  return value && HOSTNAME.test(value) ? value : fallback;
}

export function readStatusConfig(env: Record<string, string | undefined>): StatusConfig {
  const virtualHost = hostname(env.PUBLIC_SERVER_ADDRESS, 'play.cherrycreek.app');
  return {
    enabled: (env.STATUS_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    host: hostname(env.MC_STATUS_HOST, virtualHost),
    port: integer(env.MC_STATUS_PORT, 25565, 1, 65535),
    virtualHost,
    cacheMs: integer(env.STATUS_CACHE_SECONDS, 45, 10, 600) * 1000,
    timeoutMs: integer(env.STATUS_TIMEOUT_MS, 3000, 500, 10000),
  };
}
