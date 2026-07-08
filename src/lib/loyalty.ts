export const stampSpendInPence = 500;
export const stampsPerReward = 8;
export const rewardValueInPence = 500;

export type LoyaltyState = {
  loyaltyStamps: number;
  loyaltyRemainderInPence: number;
  availableRewards: number;
};

export type LoyaltySettlement = LoyaltyState & {
  stampsEarned: number;
  rewardsEarned: number;
};

function normalizeNonNegativeInteger(value: number) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function calculateLoyaltySettlement(
  current: LoyaltyState,
  productSubtotalInPence: number,
): LoyaltySettlement {
  const currentStamps = normalizeNonNegativeInteger(current.loyaltyStamps);
  const currentRemainder = normalizeNonNegativeInteger(
    current.loyaltyRemainderInPence,
  );
  const currentRewards = normalizeNonNegativeInteger(current.availableRewards);
  const orderSpend = normalizeNonNegativeInteger(productSubtotalInPence);
  const totalStampSpend = currentRemainder + orderSpend;
  const stampsEarned = Math.floor(totalStampSpend / stampSpendInPence);
  const nextRemainder = totalStampSpend % stampSpendInPence;
  const totalStamps = currentStamps + stampsEarned;
  const rewardsEarned = Math.floor(totalStamps / stampsPerReward);
  const nextStamps = totalStamps % stampsPerReward;

  return {
    loyaltyStamps: nextStamps,
    loyaltyRemainderInPence: nextRemainder,
    availableRewards: currentRewards + rewardsEarned,
    stampsEarned,
    rewardsEarned,
  };
}

export function formatLoyaltyCurrency(valueInPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(valueInPence / 100);
}
