import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planClaim, type ClaimLimits } from '../src/lib/claims.ts';

const limits: ClaimLimits = {
  startingBlocks: 200,
  blocksPerHour: 50,
  maxAccruedBlocks: 20_000,
  minWidth: 5,
  minArea: 25,
  blockPrice: 10,
};

test('a claim that fits reports the spare blocks', () => {
  const plan = planClaim(10, 10, 0, limits);
  assert.ok(plan.ok);
  assert.equal(plan.area, 100);
  assert.equal(plan.short, -100);
  assert.equal(plan.hoursToEarn, 0);
  assert.equal(plan.costToBuy, 0);
});

test('a shortfall within the accrual limit quotes hours and a price', () => {
  const plan = planClaim(40, 30, 0, limits);
  assert.ok(plan.ok);
  assert.equal(plan.short, 1000);
  assert.equal(plan.hoursToEarn, 20);
  assert.equal(plan.mustBuy, 0);
  assert.equal(plan.costToBuy, 10_000);
});

test('a shortfall beyond the accrual limit cannot be earned by playing', () => {
  // 250,000 needed; 200 owned; only 20,000 can ever be earned.
  const plan = planClaim(500, 500, 0, limits);
  assert.ok(plan.ok);
  assert.equal(plan.short, 249_800);
  assert.equal(plan.earnable, 20_000);
  assert.equal(plan.hoursToEarn, null);
  assert.equal(plan.mustBuy, 229_800);
});

test('accrual stops at the limit, leaving nothing more to earn', () => {
  const plan = planClaim(200, 200, 1000, limits);
  assert.ok(plan.ok);
  assert.equal(plan.owned, 20_200);
  assert.equal(plan.earnable, 0);
  assert.equal(plan.hoursToEarn, null);
  assert.equal(plan.mustBuy, plan.short);
});

test('a shortfall exactly equal to what is left to earn is still earnable', () => {
  // 395 hours played: 19,750 accrued, 250 left to earn, 19,950 owned.
  const plan = planClaim(101, 200, 395, limits);
  assert.ok(plan.ok);
  assert.equal(plan.short, 250);
  assert.equal(plan.hoursToEarn, 5);
});

test('claims below the minimum width or area are rejected', () => {
  assert.deepEqual(planClaim(1, 1, 0, limits), {
    ok: false,
    reason: 'too-narrow',
    area: 1,
    owned: 200,
  });
  assert.equal(planClaim(4, 100, 0, limits).ok, false);
  // 5 × 5 is the smallest claim Cherry Creek allows.
  assert.equal(planClaim(5, 5, 0, limits).ok, true);

  // A larger minimum area can reject a claim that is wide enough.
  const strict = { ...limits, minArea: 100 };
  const small = planClaim(5, 5, 0, strict);
  assert.equal(small.ok, false);
  assert.equal(!small.ok && small.reason, 'too-small');
  assert.equal(planClaim(5, 20, 0, strict).ok, true);
});

test('blocks tied up in other claims reduce what is free', () => {
  // An existing 9 × 9 claim leaves 119 of the 200 starting blocks.
  const plan = planClaim(10, 12, 0, limits, 81);
  assert.ok(plan.ok);
  assert.equal(plan.owned, 119);
  assert.equal(plan.short, 1);
  assert.equal(plan.hoursToEarn, 1);
  assert.equal(planClaim(10, 10, 0, limits, 81).ok && planClaim(10, 10, 0, limits, 81).owned, 119);
  assert.equal(planClaim(10, 10, 0, limits, 9999).owned, 0);
});

test('a /claimslist figure replaces the estimate', () => {
  // A new player who sold 150 of their 200 blocks has 50 left.
  const plan = planClaim(10, 10, 0, limits, 0, 50);
  assert.ok(plan.ok);
  assert.equal(plan.owned, 50);
  assert.equal(plan.short, 50);
  assert.equal(plan.hoursToEarn, 1);
  assert.equal(plan.costToBuy, 500);

  // Blocks in other claims are already counted in that figure.
  assert.equal(planClaim(10, 10, 0, limits, 81, 50).owned, 50);
  assert.equal(planClaim(10, 10, 0, limits, 0, -5).owned, 0);
});

test('the estimate leaves out the block the first chest uses', () => {
  const plan = planClaim(10, 10, 0, limits, 1);
  assert.ok(plan.ok);
  assert.equal(plan.owned, 199);
  assert.equal(plan.short, -99);
});
