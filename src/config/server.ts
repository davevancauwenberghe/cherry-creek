/**
 * Gameplay figures from the live server configuration.
 *
 * The home page and the player guide both read from here, so a change on the
 * server only needs changing once on the website.
 */
export const server = {
  economy: {
    /** Money every new player starts with (EssentialsX). */
    startingBalance: 100,
    /** Price of one extra claim block (GriefPrevention). */
    claimBlockPrice: 20,
  },
  claims: {
    startingBlocks: 200,
    blocksPerHour: 50,
    maxAccruedBlocks: 20_000,
    maxClaims: 8,
    /** GriefPrevention rejects claims narrower or smaller than this. */
    minWidth: 5,
    minArea: 100,
  },
  /** Items handed to first-time players, alongside the starting balance. */
  starterKit: ['1 wooden pickaxe', '1 wooden axe', '2 apples'],
} as const;

/** Formats an amount of the fictional in-game currency, e.g. "€100". */
export const euros = (amount: number) => `€${amount.toLocaleString('en-GB')}`;

/** Formats a count with thousands separators, e.g. "20,000". */
export const count = (value: number) => value.toLocaleString('en-GB');
