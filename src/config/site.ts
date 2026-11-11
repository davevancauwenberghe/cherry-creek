/**
 * Single source of truth for names, addresses and links.
 *
 * PUBLIC_* values are read at build time (they end up in static HTML), so
 * changing them means rebuilding. Defaults match production.
 */
function httpsUrl(raw: string | undefined, fallback: string): string {
  try {
    const url = new URL(raw ?? '');
    return url.protocol === 'https:' ? url.href.replace(/\/$/, '') : fallback;
  } catch {
    return fallback;
  }
}

function hostname(raw: string | undefined, fallback: string): string {
  const value = raw?.trim() ?? '';
  return /^[a-z0-9.-]{1,253}$/i.test(value) ? value : fallback;
}

const env = import.meta.env;

export const site = {
  name: 'Cherry Creek',
  tagline: 'Your next adventure begins here.',
  description:
    'Cherry Creek is a small, whitelisted Minecraft Java survival community for building, exploring and trading together.',
  serverAddress: hostname(env.PUBLIC_SERVER_ADDRESS, 'play.cherrycreek.app'),
  mapUrl: httpsUrl(env.PUBLIC_MAP_URL, 'https://map.cherrycreek.app'),
  discordUrl: httpsUrl(env.PUBLIC_DISCORD_URL, 'https://discord.gg/dRxSt8Bt9t'),
  /** Alt text for src/assets/screenshots/hero.* once a real screenshot is supplied. */
  heroScreenshotAlt: 'A view across Cherry Creek',
  /** Alt text for src/assets/screenshots/map.* once a real map capture is supplied. */
  mapScreenshotAlt: 'The Cherry Creek world on the interactive map',
} as const;

export const nav = [
  { label: 'Home', href: '/#top' },
  { label: 'Features', href: '/#features' },
  { label: 'Community', href: '/#community' },
  { label: 'Server information', href: '/#server' },
] as const;
