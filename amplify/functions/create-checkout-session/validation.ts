export const ukTrackedDeliveryFeeInPence = 299;
export const loyaltyRewardValueInPence = 500;
export const maxCheckoutLineItems = 50;
export const maxCheckoutItemQuantity = 99;

type CheckoutOrderSnapshot = {
  fulfilmentMethod: string;
  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
  subtotalInPence: number;
  deliveryFeeInPence: number;
  loyaltySpendInPence: number;
  stampsEarned: number;
  rewardDiscountInPence: number;
  totalInPence: number;
};

type CheckoutOrderItemSnapshot = {
  productId?: string | null;
  variantId?: string | null;
  productName: string;
  variantName: string;
  unitPriceInPence: number;
  quantity: number;
  lineTotalInPence: number;
};

export type CatalogueItemSnapshot = {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  unitPriceInPence: number;
  productIsActive: boolean;
  variantIsActive: boolean;
  nationwideDelivery: boolean;
  stockQuantity?: number | null;
};

export type ValidatedCheckoutItem = {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  unitPriceInPence: number;
  quantity: number;
  lineTotalInPence: number;
};

type ValidateCheckoutOrderInput = {
  order: CheckoutOrderSnapshot;
  items: readonly CheckoutOrderItemSnapshot[];
  catalogueItems: readonly CatalogueItemSnapshot[];
};

export type CheckoutItemRequest = {
  productId: string;
  variantId: string;
  quantity: number;
};

export function parseCheckoutItems(value: unknown): CheckoutItemRequest[] {
  let parsedValue = value;

  if (typeof parsedValue === "string") {
    try {
      parsedValue = JSON.parse(parsedValue) as unknown;
    } catch {
      throw new Error("Basket items are invalid.");
    }
  }

  if (!Array.isArray(parsedValue)) {
    throw new Error("Basket items are invalid.");
  }

  if (parsedValue.length === 0 || parsedValue.length > maxCheckoutLineItems) {
    throw new Error("Order must contain between 1 and 50 items.");
  }

  return parsedValue.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Basket item is invalid.");
    }

    const candidate = item as Record<string, unknown>;

    if (
      typeof candidate.productId !== "string" ||
      !candidate.productId ||
      typeof candidate.variantId !== "string" ||
      !candidate.variantId ||
      !Number.isInteger(candidate.quantity)
    ) {
      throw new Error("Basket item is invalid.");
    }

    return {
      productId: candidate.productId,
      variantId: candidate.variantId,
      quantity: candidate.quantity as number,
    };
  });
}

type ValidateCheckoutRequestInput = {
  fulfilmentMethod: string;
  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
  redeemReward: boolean;
  items: readonly CheckoutItemRequest[];
  catalogueItems: readonly CatalogueItemSnapshot[];
};

function requireNonNegativeInteger(value: number, message: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(message);
  }
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function validateCheckoutOrder({
  order,
  items,
  catalogueItems,
}: ValidateCheckoutOrderInput) {
  if (items.length === 0 || items.length > maxCheckoutLineItems) {
    throw new Error("Order must contain between 1 and 50 items.");
  }

  if (catalogueItems.length !== items.length) {
    throw new Error("Order catalogue data is incomplete.");
  }

  if (
    order.fulfilmentMethod !== "collection" &&
    order.fulfilmentMethod !== "nationwide"
  ) {
    throw new Error("Unsupported fulfilment method.");
  }

  if (
    order.fulfilmentMethod === "nationwide" &&
    (!hasText(order.addressLine1) ||
      !hasText(order.city) ||
      !hasText(order.postcode))
  ) {
    throw new Error("UK tracked delivery requires a delivery address.");
  }

  const validatedItems = items.map((item, index): ValidatedCheckoutItem => {
    const catalogueItem = catalogueItems[index];

    if (!item.productId || !item.variantId) {
      throw new Error("Order item is missing product information.");
    }

    if (
      item.productId !== catalogueItem.productId ||
      item.variantId !== catalogueItem.variantId
    ) {
      throw new Error("Order item does not match the product catalogue.");
    }

    if (!catalogueItem.productIsActive || !catalogueItem.variantIsActive) {
      throw new Error(`${catalogueItem.productName} is no longer available.`);
    }

    if (
      order.fulfilmentMethod === "nationwide" &&
      !catalogueItem.nationwideDelivery
    ) {
      throw new Error(
        `${catalogueItem.productName} is not eligible for UK tracked delivery.`,
      );
    }

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > maxCheckoutItemQuantity
    ) {
      throw new Error("Order item quantity is invalid.");
    }

    if (
      catalogueItem.stockQuantity != null &&
      item.quantity > catalogueItem.stockQuantity
    ) {
      throw new Error(`${catalogueItem.variantName} does not have enough stock.`);
    }

    requireNonNegativeInteger(
      catalogueItem.unitPriceInPence,
      "Catalogue price is invalid.",
    );

    const expectedLineTotal =
      catalogueItem.unitPriceInPence * item.quantity;

    if (
      item.productName !== catalogueItem.productName ||
      item.variantName !== catalogueItem.variantName ||
      item.unitPriceInPence !== catalogueItem.unitPriceInPence ||
      item.lineTotalInPence !== expectedLineTotal
    ) {
      throw new Error(
        `${catalogueItem.productName} changed since it was added to the basket.`,
      );
    }

    return {
      productId: catalogueItem.productId,
      variantId: catalogueItem.variantId,
      productName: catalogueItem.productName,
      variantName: catalogueItem.variantName,
      unitPriceInPence: catalogueItem.unitPriceInPence,
      quantity: item.quantity,
      lineTotalInPence: expectedLineTotal,
    };
  });

  const subtotalInPence = validatedItems.reduce(
    (total, item) => total + item.lineTotalInPence,
    0,
  );
  const deliveryFeeInPence =
    order.fulfilmentMethod === "nationwide"
      ? ukTrackedDeliveryFeeInPence
      : 0;
  const rewardDiscountInPence =
    order.rewardDiscountInPence > 0
      ? Math.min(
          loyaltyRewardValueInPence,
          subtotalInPence + deliveryFeeInPence,
        )
      : 0;
  const loyaltySpendInPence = Math.max(
    0,
    subtotalInPence - rewardDiscountInPence,
  );
  const totalInPence = Math.max(
    0,
    subtotalInPence + deliveryFeeInPence - rewardDiscountInPence,
  );

  if (
    order.subtotalInPence !== subtotalInPence ||
    order.deliveryFeeInPence !== deliveryFeeInPence ||
    order.rewardDiscountInPence !== rewardDiscountInPence ||
    order.loyaltySpendInPence !== loyaltySpendInPence ||
    order.stampsEarned !== 0 ||
    order.totalInPence !== totalInPence
  ) {
    throw new Error("Order totals do not match the current product catalogue.");
  }

  return {
    validatedItems,
    subtotalInPence,
    deliveryFeeInPence,
    rewardDiscountInPence,
    loyaltySpendInPence,
    totalInPence,
  };
}

export function validateCheckoutRequest({
  fulfilmentMethod,
  addressLine1,
  city,
  postcode,
  redeemReward,
  items,
  catalogueItems,
}: ValidateCheckoutRequestInput) {
  if (items.length === 0 || items.length > maxCheckoutLineItems) {
    throw new Error("Order must contain between 1 and 50 items.");
  }

  if (catalogueItems.length !== items.length) {
    throw new Error("Order catalogue data is incomplete.");
  }

  const seenVariants = new Set<string>();
  const orderItems = items.map((item, index) => {
    const catalogueItem = catalogueItems[index];

    if (seenVariants.has(item.variantId)) {
      throw new Error("Duplicate basket variants are not allowed.");
    }

    seenVariants.add(item.variantId);

    return {
      productId: item.productId,
      variantId: item.variantId,
      productName: catalogueItem.productName,
      variantName: catalogueItem.variantName,
      unitPriceInPence: catalogueItem.unitPriceInPence,
      quantity: item.quantity,
      lineTotalInPence: catalogueItem.unitPriceInPence * item.quantity,
    };
  });
  const subtotalInPence = orderItems.reduce(
    (total, item) => total + item.lineTotalInPence,
    0,
  );
  const deliveryFeeInPence =
    fulfilmentMethod === "nationwide" ? ukTrackedDeliveryFeeInPence : 0;
  const rewardDiscountInPence = redeemReward
    ? Math.min(
        loyaltyRewardValueInPence,
        subtotalInPence + deliveryFeeInPence,
      )
    : 0;
  const loyaltySpendInPence = Math.max(
    0,
    subtotalInPence - rewardDiscountInPence,
  );
  const totalInPence = Math.max(
    0,
    subtotalInPence + deliveryFeeInPence - rewardDiscountInPence,
  );

  return validateCheckoutOrder({
    order: {
      fulfilmentMethod,
      addressLine1,
      city,
      postcode,
      subtotalInPence,
      deliveryFeeInPence,
      loyaltySpendInPence,
      stampsEarned: 0,
      rewardDiscountInPence,
      totalInPence,
    },
    items: orderItems,
    catalogueItems,
  });
}
