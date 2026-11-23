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
    /** Price of one extra claim block (GriefPrevention: ClaimBlocksPurchaseCost). */
    claimBlockPrice: 10,
    /** Paid for each claim block sold back (GriefPrevention: ClaimBlocksSellValue). */
    claimBlockSellValue: 10,
    /** Money paid out for reaching each of these levels. */
    levelRewards: [
      { level: 5, reward: 50 },
      { level: 10, reward: 50 },
      { level: 15, reward: 50 },
      { level: 20, reward: 100 },
      { level: 25, reward: 100 },
      { level: 30, reward: 100 },
    ],
    /** Name of the EconomyShopGUI shop, opened with /market. */
    marketName: 'Cherry Market',
  },
  claims: {
    startingBlocks: 200,
    blocksPerHour: 50,
    maxAccruedBlocks: 20_000,
    maxClaims: 8,
    /** GriefPrevention rejects claims narrower or smaller than this. */
    minWidth: 5,
    minArea: 25,
    /**
     * AutomaticNewPlayerClaimsRadius. A new player's first chest is claimed
     * this many blocks out in each direction; 0 claims just the chest.
     */
    autoClaimRadius: 0,
  },
  pvp: {
    /** Seconds after combat during which /home and /tpa are blocked. */
    combatTimeoutSeconds: 15,
  },
  /** Items handed to first-time players, alongside the starting balance. */
  starterKit: ['1 wooden pickaxe', '1 wooden axe', '2 apples'],
} as const;

/** Side length and claim blocks used by the automatic first-chest claim. */
export const autoClaimSide = server.claims.autoClaimRadius * 2 + 1;
export const autoClaimArea = autoClaimSide ** 2;

/** "5, 10 and 15" */
export const listAnd = (items: (string | number)[]) =>
  new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(items.map(String));

/** Level rewards grouped by amount, e.g. { reward: 50, levels: [5, 10, 15] }. */
export const levelRewardGroups = server.economy.levelRewards.reduce<
  { reward: number; levels: number[] }[]
>((groups, { level, reward }) => {
  const group = groups.find((g) => g.reward === reward);
  if (group) group.levels.push(level);
  else groups.push({ reward, levels: [level] });
  return groups;
}, []);

/** Total paid out by the last level reward. */
export const levelRewardTotal = server.economy.levelRewards.reduce((sum, r) => sum + r.reward, 0);

/** Formats an amount of the fictional in-game currency, e.g. "€100". */
export const euros = (amount: number) => `€${amount.toLocaleString('en-GB')}`;

/** Formats a count with thousands separators, e.g. "20,000". */
export const count = (value: number) => value.toLocaleString('en-GB');
