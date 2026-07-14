import assert from "node:assert/strict";
import test from "node:test";
import { calculateLoyaltySettlement } from "./loyalty";

test("seven pounds earns one stamp and carries two pounds", () => {
  const result = calculateLoyaltySettlement(
    {
      loyaltyStamps: 0,
      loyaltyRemainderInPence: 0,
      availableRewards: 0,
    },
    700,
  );

  assert.equal(result.stampsEarned, 1);
  assert.equal(result.loyaltyStamps, 1);
  assert.equal(result.loyaltyRemainderInPence, 200);
});

test("spending carry-over contributes to the next stamp", () => {
  const result = calculateLoyaltySettlement(
    {
      loyaltyStamps: 1,
      loyaltyRemainderInPence: 200,
      availableRewards: 0,
    },
    300,
  );

  assert.equal(result.stampsEarned, 1);
  assert.equal(result.loyaltyStamps, 2);
  assert.equal(result.loyaltyRemainderInPence, 0);
});

test("eight stamps become one five-pound reward", () => {
  const result = calculateLoyaltySettlement(
    {
      loyaltyStamps: 7,
      loyaltyRemainderInPence: 0,
      availableRewards: 0,
    },
    500,
  );

  assert.equal(result.loyaltyStamps, 0);
  assert.equal(result.rewardsEarned, 1);
  assert.equal(result.availableRewards, 1);
});
