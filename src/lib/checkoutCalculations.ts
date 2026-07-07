import type { BasketItem } from "../types/basket";
import type { FulfilmentMethod } from "../types/checkout";

export type CheckoutTotals = {
  subtotalInPence: number;
  deliveryFeeInPence: number;
  rewardDiscountInPence: number;
  loyaltySpendInPence: number;
  stampsEarned: number;
  totalInPence: number;
  lineItems: Array<{
    basketItem: BasketItem;
    unitPriceInPence: number;
    lineTotalInPence: number;
  }>;
};

export const deliveryFeesInPence: Record<FulfilmentMethod, number> = {
  nationwide: 299,
  collection: 0,
};

function poundsToPence(value: number) {
  return Math.round(value * 100);
}

export function calculateCheckoutTotals(
  basketItems: BasketItem[],
  fulfilmentMethod: FulfilmentMethod,
): CheckoutTotals {
  const lineItems = basketItems.map((basketItem) => {
    const unitPriceInPence = poundsToPence(basketItem.unitPrice);

    if (
      !Number.isFinite(unitPriceInPence) ||
      unitPriceInPence < 0 ||
      !Number.isInteger(basketItem.quantity) ||
      basketItem.quantity < 1
    ) {
      throw new Error("Basket contains an invalid item quantity or price.");
    }

    return {
      basketItem,
      unitPriceInPence,
      lineTotalInPence: unitPriceInPence * basketItem.quantity,
    };
  });
  const subtotalInPence = lineItems.reduce(
    (total, item) => total + item.lineTotalInPence,
    0,
  );
  const rewardDiscountInPence = 0;
  const deliveryFeeInPence = deliveryFeesInPence[fulfilmentMethod];
  const totalInPence = Math.max(
    0,
    subtotalInPence + deliveryFeeInPence - rewardDiscountInPence,
  );

  return {
    subtotalInPence,
    deliveryFeeInPence,
    rewardDiscountInPence,
    loyaltySpendInPence: subtotalInPence,
    stampsEarned: 0,
    totalInPence,
    lineItems,
  };
}

export function formatCurrencyFromPence(valueInPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(valueInPence / 100);
}
