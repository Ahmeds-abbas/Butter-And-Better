import assert from "node:assert/strict";
import test from "node:test";
import {
  maxBasketItemQuantity,
  normalizeBasketItems,
  normalizeBasketQuantity,
} from "./basketValidation";

const validItem = {
  id: "untrusted-id",
  productId: "product-1",
  productName: "Cookie box",
  variantId: "variant-1",
  variantName: "Box of six",
  unitPrice: 12,
  quantity: 2,
  imageUrl: "image.jpg",
};

test("stored basket IDs are rebuilt from product and variant IDs", () => {
  const [item] = normalizeBasketItems([validItem]);

  assert.equal(item.id, "product-1-variant-1");
});

test("malformed stored basket entries are discarded", () => {
  const result = normalizeBasketItems([
    validItem,
    { ...validItem, productId: "" },
    { ...validItem, quantity: -2 },
    "invalid",
  ]);

  assert.equal(result.length, 1);
});

test("duplicate and edited quantities are capped", () => {
  const [item] = normalizeBasketItems([
    { ...validItem, quantity: 80 },
    { ...validItem, quantity: 80 },
  ]);

  assert.equal(item.quantity, maxBasketItemQuantity);
  assert.equal(normalizeBasketQuantity(120), maxBasketItemQuantity);
  assert.equal(normalizeBasketQuantity(Number.NaN), null);
});
