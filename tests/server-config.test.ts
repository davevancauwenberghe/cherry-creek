import assert from 'node:assert/strict';
import { test } from 'node:test';
import { levelRewardGroups, levelRewardTotal, listAnd } from '../src/config/server.ts';

test('level rewards group by amount and add up', () => {
  assert.deepEqual(levelRewardGroups, [
    { reward: 50, levels: [5, 10, 15] },
    { reward: 100, levels: [20, 25, 30] },
  ]);
  assert.equal(levelRewardTotal, 450);
  assert.equal(listAnd([5, 10, 15]), '5, 10 and 15');
});
