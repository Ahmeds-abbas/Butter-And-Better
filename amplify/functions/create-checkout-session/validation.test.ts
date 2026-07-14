import assert from "node:assert/strict";
import test from "node:test";
import { validateCheckoutOrder } from "./validation";

function createValidInput() {
  return {
    order: {
      fulfilmentMethod: "nationwide",
      addressLine1: "1 Bakery Street" as string | null,
      city: "Manchester" as string | null,
      postcode: "M1 1AA" as string | null,
      subtotalInPence: 800,
      deliveryFeeInPence: 299,
      loyaltySpendInPence: 800,
      stampsEarned: 0,
      rewardDiscountInPence: 0,
      totalInPence: 1099,
    },
    items: [
      {
        productId: "product-1",
        variantId: "variant-1",
        productName: "Brownie box",
        variantName: "Box of four",
        unitPriceInPence: 800,
        quantity: 1,
        lineTotalInPence: 800,
      },
    ],
    catalogueItems: [
      {
        productId: "product-1",
        variantId: "variant-1",
        productName: "Brownie box",
        variantName: "Box of four",
        unitPriceInPence: 800,
        productIsActive: true,
        variantIsActive: true,
        nationwideDelivery: true,
        stockQuantity: 10,
      },
    ],
  };
}

test("validates catalogue pricing and the tracked delivery fee", () => {
  const result = validateCheckoutOrder(createValidInput());

  assert.equal(result.subtotalInPence, 800);
  assert.equal(result.deliveryFeeInPence, 299);
  assert.equal(result.totalInPence, 1099);
});

test("blocks a client-supplied lower price", () => {
  const input = createValidInput();
  input.items[0].unitPriceInPence = 1;
  input.items[0].lineTotalInPence = 1;
  input.order.subtotalInPence = 1;
  input.order.loyaltySpendInPence = 1;
  input.order.totalInPence = 300;

  assert.throws(() => validateCheckoutOrder(input), /changed since/i);
});

test("blocks delivery when any product is pickup-only", () => {
  const input = createValidInput();
  input.catalogueItems[0].nationwideDelivery = false;

  assert.throws(() => validateCheckoutOrder(input), /not eligible/i);
});

test("requires the exact delivery fee", () => {
  const input = createValidInput();
  input.order.deliveryFeeInPence = 0;
  input.order.totalInPence = 800;

  assert.throws(() => validateCheckoutOrder(input), /totals do not match/i);
});

test("pickup remains available and free", () => {
  const input = createValidInput();
  input.order.fulfilmentMethod = "collection";
  input.order.addressLine1 = null;
  input.order.city = null;
  input.order.postcode = null;
  input.order.deliveryFeeInPence = 0;
  input.order.totalInPence = 800;
  input.catalogueItems[0].nationwideDelivery = false;

  const result = validateCheckoutOrder(input);

  assert.equal(result.deliveryFeeInPence, 0);
  assert.equal(result.totalInPence, 800);
});
