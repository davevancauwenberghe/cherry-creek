import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planClaim, type ClaimLimits } from '../src/lib/claims.ts';

const limits: ClaimLimits = {
  startingBlocks: 200,
  blocksPerHour: 50,
  maxAccruedBlocks: 20_000,
  minWidth: 5,
  minArea: 100,
  blockPrice: 20,
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
  assert.equal(plan.costToBuy, 20_000);
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
  const small = planClaim(5, 5, 0, limits);
  assert.equal(small.ok, false);
  assert.equal(!small.ok && small.reason, 'too-small');
  assert.equal(planClaim(5, 20, 0, limits).ok, true);
});
