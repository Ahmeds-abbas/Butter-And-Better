import type { BasketItem } from "../types/basket";

export const maxBasketItemQuantity = 99;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeBasketItems(value: unknown): BasketItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedItems = new Map<string, BasketItem>();

  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const item = candidate as Partial<BasketItem>;

    if (
      !isNonEmptyString(item.productId) ||
      !isNonEmptyString(item.productName) ||
      !isNonEmptyString(item.variantId) ||
      !isNonEmptyString(item.variantName) ||
      typeof item.unitPrice !== "number" ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice < 0 ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      typeof item.imageUrl !== "string"
    ) {
      continue;
    }

    const id = `${item.productId}-${item.variantId}`;
    const existingItem = normalizedItems.get(id);
    const quantity = Math.min(
      maxBasketItemQuantity,
      (existingItem?.quantity ?? 0) + item.quantity,
    );

    normalizedItems.set(id, {
      id,
      productId: item.productId,
      productName: item.productName,
      variantId: item.variantId,
      variantName: item.variantName,
      unitPrice: item.unitPrice,
      quantity,
      imageUrl: item.imageUrl,
    });
  }

  return [...normalizedItems.values()];
}

export function normalizeBasketQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.min(maxBasketItemQuantity, Math.trunc(value));
}
