import assert from "node:assert/strict";
import test from "node:test";
import type { BasketItem } from "../types/basket";
import { calculateCheckoutTotals } from "./checkoutCalculations";

const basketItem: BasketItem = {
  id: "product-1-variant-1",
  productId: "product-1",
  productName: "Brownie box",
  variantId: "variant-1",
  variantName: "Box of four",
  unitPrice: 7,
  quantity: 1,
  imageUrl: "",
};

test("pickup is free", () => {
  const totals = calculateCheckoutTotals([basketItem], "collection");

  assert.equal(totals.subtotalInPence, 700);
  assert.equal(totals.deliveryFeeInPence, 0);
  assert.equal(totals.totalInPence, 700);
});

test("UK tracked delivery adds exactly 2.99", () => {
  const totals = calculateCheckoutTotals([basketItem], "nationwide");

  assert.equal(totals.deliveryFeeInPence, 299);
  assert.equal(totals.totalInPence, 999);
});

test("a reward discounts at most five pounds", () => {
  const totals = calculateCheckoutTotals([basketItem], "collection", true);

  assert.equal(totals.rewardDiscountInPence, 500);
  assert.equal(totals.loyaltySpendInPence, 200);
  assert.equal(totals.totalInPence, 200);
});

test("invalid basket quantities are rejected", () => {
  assert.throws(
    () =>
      calculateCheckoutTotals(
        [{ ...basketItem, quantity: Number.NaN }],
        "collection",
      ),
    /invalid item quantity or price/i,
  );
});
