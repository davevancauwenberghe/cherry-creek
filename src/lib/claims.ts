/**
 * Claim planner maths, kept free of the DOM so it can be unit-tested.
 * The limits come from src/config/server.ts.
 */
export interface ClaimLimits {
  startingBlocks: number;
  blocksPerHour: number;
  maxAccruedBlocks: number;
  /** Shortest side GriefPrevention accepts. */
  minWidth: number;
  /** Smallest total area GriefPrevention accepts. */
  minArea: number;
  /** Price of one extra claim block. */
  blockPrice: number;
}

export type ClaimPlan =
  | { ok: false; reason: 'too-narrow' | 'too-small'; area: number; owned: number }
  | {
      ok: true;
      area: number;
      /** Blocks the player has now: starting blocks plus what play has earned. */
      owned: number;
      /** Blocks still missing; zero or less means the claim fits. */
      short: number;
      /** Blocks that more playtime can still earn before the accrual limit. */
      earnable: number;
      /** Hours of play that would cover the shortfall, or null if play alone cannot. */
      hoursToEarn: number | null;
      /** Blocks that have to be bought even after earning everything possible. */
      mustBuy: number;
      /** Cost of buying the whole shortfall today. */
      costToBuy: number;
    };

export function planClaim(
  width: number,
  length: number,
  hoursPlayed: number,
  limits: ClaimLimits,
): ClaimPlan {
  const area = width * length;
  const accrued = Math.min(
    Math.max(hoursPlayed, 0) * limits.blocksPerHour,
    limits.maxAccruedBlocks,
  );
  const owned = limits.startingBlocks + accrued;

  if (Math.min(width, length) < limits.minWidth)
    return { ok: false, reason: 'too-narrow', area, owned };
  if (area < limits.minArea) return { ok: false, reason: 'too-small', area, owned };

  const short = area - owned;
  const earnable = limits.maxAccruedBlocks - accrued;
  const needed = Math.max(short, 0);
  return {
    ok: true,
    area,
    owned,
    short,
    earnable,
    hoursToEarn: needed <= earnable ? Math.ceil(needed / limits.blocksPerHour) : null,
    mustBuy: Math.max(needed - earnable, 0),
    costToBuy: needed * limits.blockPrice,
  };
}
