import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "./amplifyClient";
import { calculateCheckoutTotals } from "./checkoutCalculations";
import type { BasketItem } from "../types/basket";
import type { CheckoutFormData, FulfilmentMethod } from "../types/checkout";

type OrderCreateInput = Parameters<typeof dataClient.models.Order.create>[0];
type OrderItemCreateInput = Parameters<
  typeof dataClient.models.OrderItem.create
>[0];
type CustomerProfileCreateInput = Parameters<
  typeof dataClient.models.CustomerProfile.create
>[0];
type OrderDeleteInput = Parameters<typeof dataClient.models.Order.delete>[0];
type OrderItemDeleteInput = Parameters<
  typeof dataClient.models.OrderItem.delete
>[0];

type OrderAuthMode = "userPool" | "iam";

type CheckoutCustomerProfile = {
  id: string;
  availableRewards: number;
};

export type CreatedOrderSummary = {
  id: string;
  orderNumber: string;
  checkoutAccessToken: string;
  firstName: string;
  lastName: string;
  fulfilmentMethod: FulfilmentMethod;
  paymentStatus: "pending";
  totalInPence: number;
  authMode: OrderAuthMode;
};

const fulfilmentLabels: Record<FulfilmentMethod, string> = {
  nationwide: "UK tracked delivery",
  collection: "Pickup",
};

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createOrderNumber(orderId: string) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return `BB-${datePart}-${orderId.slice(0, 8).toUpperCase()}`;
}

function normalizePhoneNumber(phone: string) {
  const trimmedPhone = phone.trim();

  if (trimmedPhone.startsWith("+")) {
    return `+${trimmedPhone.slice(1).replace(/\D/g, "")}`;
  }

  const digits = trimmedPhone.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return `+44${digits.slice(1)}`;
  }

  if (digits.startsWith("44")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

async function getOrderAuthMode(): Promise<OrderAuthMode> {
  try {
    const session = await fetchAuthSession();

    if (session.tokens?.accessToken) {
      return "userPool";
    }
  } catch {
    // Guest checkout is supported by the current Order and OrderItem schema.
  }

  return "iam";
}

async function getSignedInCustomerProfile(
  authMode: OrderAuthMode,
): Promise<CheckoutCustomerProfile | null> {
  if (authMode !== "userPool") {
    return null;
  }

  const session = await fetchAuthSession();
  const userSub = session.tokens?.idToken?.payload.sub;

  if (typeof userSub !== "string" || !userSub) {
    return null;
  }

  const existingProfile = await dataClient.models.CustomerProfile.get(
    { id: userSub },
    { authMode: "userPool" },
  );

  if (existingProfile.data) {
    return {
      id: userSub,
      availableRewards: existingProfile.data.availableRewards,
    };
  }

  if (existingProfile.errors?.length) {
    console.warn(
      "Could not read customer loyalty profile before checkout:",
      existingProfile.errors,
    );
  }

  const profileInput = {
    id: userSub,
    loyaltyStamps: 0,
    loyaltyRemainderInPence: 0,
    availableRewards: 0,
  } as unknown as CustomerProfileCreateInput;
  const createProfile = await dataClient.models.CustomerProfile.create(
    profileInput,
    { authMode: "userPool" },
  );

  if (createProfile.errors?.length || !createProfile.data) {
    throw new Error("Could not prepare your loyalty profile for checkout.");
  }

  return {
    id: userSub,
    availableRewards: createProfile.data.availableRewards,
  };
}

async function verifyBasketEligibility(
  basketItems: BasketItem[],
  fulfilmentMethod: FulfilmentMethod,
  authMode: OrderAuthMode,
) {
  for (const basketItem of basketItems) {
    const productResponse = await dataClient.models.Product.get(
      { id: basketItem.productId },
      { authMode },
    );

    if (productResponse.errors?.length || !productResponse.data) {
      throw new Error(`${basketItem.productName} is no longer available.`);
    }

    const product = productResponse.data;

    if (!product.isActive) {
      throw new Error(`${basketItem.productName} is no longer available.`);
    }

    if (fulfilmentMethod === "nationwide" && !product.nationwideDelivery) {
      throw new Error(
        `${basketItem.productName} is not eligible for ${fulfilmentLabels[fulfilmentMethod]}.`,
      );
    }

    const variantResponse = await product.variants({ authMode });

    if (variantResponse.errors?.length) {
      throw new Error(
        `Could not confirm availability for ${basketItem.variantName}.`,
      );
    }

    const variant = variantResponse.data.find(
      (currentVariant) => currentVariant.id === basketItem.variantId,
    );

    if (!variant?.isActive) {
      throw new Error(`${basketItem.variantName} is no longer available.`);
    }
  }
}

async function cleanupFailedOrder(
  orderId: string,
  createdOrderItemIds: string[],
  authMode: OrderAuthMode,
) {
  for (const orderItemId of createdOrderItemIds) {
    try {
      const deleteItemInput = {
        id: orderItemId,
      } as unknown as OrderItemDeleteInput;

      await dataClient.models.OrderItem.delete(deleteItemInput, { authMode });
    } catch (error) {
      console.error(`Failed to clean up order item ${orderItemId}:`, error);
    }
  }

  try {
    const deleteOrderInput = {
      id: orderId,
    } as unknown as OrderDeleteInput;

    await dataClient.models.Order.delete(deleteOrderInput, { authMode });
  } catch (error) {
    console.error(`Failed to clean up order ${orderId}:`, error);
  }
}

export async function createCheckoutOrder(
  formData: CheckoutFormData,
  basketItems: BasketItem[],
) {
  if (!formData.fulfilmentMethod) {
    throw new Error("Choose a fulfilment method.");
  }

  const authMode = await getOrderAuthMode();
  const customerProfile = await getSignedInCustomerProfile(authMode);
  const redeemReward = Boolean(formData.redeemReward);

  if (redeemReward && !customerProfile) {
    throw new Error("Sign in to redeem loyalty rewards.");
  }

  if (redeemReward && customerProfile.availableRewards < 1) {
    throw new Error("You do not have a loyalty reward available.");
  }

  const customerProfileId = customerProfile?.id ?? null;
  const fulfilmentMethod = formData.fulfilmentMethod;
  const totals = calculateCheckoutTotals(
    basketItems,
    fulfilmentMethod,
    redeemReward,
  );

  if (basketItems.length === 0 || totals.totalInPence < 0) {
    throw new Error("Your basket could not be checked out.");
  }

  await verifyBasketEligibility(basketItems, fulfilmentMethod, authMode);

  const orderId = createId();
  const orderNumber = createOrderNumber(orderId);
  const checkoutAccessToken = createId();
  const createdOrderItemIds: string[] = [];

  const orderInput = {
    id: orderId,
    orderNumber,
    status: "pending",
    paymentStatus: "pending",
    customerEmail: formData.email.trim(),
    customerPhone: normalizePhoneNumber(formData.phone),
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    customerProfileId,
    fulfilmentMethod,
    addressLine1:
      fulfilmentMethod === "collection" ? null : formData.addressLine1.trim(),
    addressLine2:
      fulfilmentMethod === "collection"
        ? null
        : formData.addressLine2.trim() || null,
    city: fulfilmentMethod === "collection" ? null : formData.city.trim(),
    postcode:
      fulfilmentMethod === "collection" ? null : formData.postcode.trim(),
    customerNotes: formData.orderNotes.trim() || null,
    subtotalInPence: totals.subtotalInPence,
    deliveryFeeInPence: totals.deliveryFeeInPence,
    loyaltySpendInPence: totals.loyaltySpendInPence,
    stampsEarned: totals.stampsEarned,
    rewardDiscountInPence: totals.rewardDiscountInPence,
    totalInPence: totals.totalInPence,
    checkoutAccessToken,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    paidAt: null,
    refundedAt: null,
    loyaltyProcessedAt: null,
    loyaltySettled: false,
    customerOrderConfirmationEmailStatus: "PENDING",
    customerOrderConfirmationEmailLastAttemptAt: null,
    customerOrderConfirmationEmailError: null,
    customerOrderConfirmationEmailProviderId: null,
    customerOrderConfirmationEmailSentAt: null,
    adminOrderNotificationEmailStatus: "PENDING",
    adminOrderNotificationEmailLastAttemptAt: null,
    adminOrderNotificationEmailError: null,
    adminOrderNotificationEmailProviderId: null,
    adminOrderNotificationEmailSentAt: null,
  } as unknown as OrderCreateInput;

  const orderResponse = await dataClient.models.Order.create(orderInput, {
    authMode,
  });

  if (orderResponse.errors?.length || !orderResponse.data) {
    throw new Error(
      orderResponse.errors?.map((error) => error.message).join(", ") ??
        "Could not create the order.",
    );
  }

  try {
    for (const item of totals.lineItems) {
      const orderItemId = createId();
      const orderItemInput = {
        id: orderItemId,
        orderId,
        productId: item.basketItem.productId,
        variantId: item.basketItem.variantId,
        productName: item.basketItem.productName,
        variantName: item.basketItem.variantName,
        unitPriceInPence: item.unitPriceInPence,
        quantity: item.basketItem.quantity,
        lineTotalInPence: item.lineTotalInPence,
      } as unknown as OrderItemCreateInput;

      const itemResponse = await dataClient.models.OrderItem.create(
        orderItemInput,
        { authMode },
      );

      if (itemResponse.errors?.length || !itemResponse.data) {
        throw new Error(
          itemResponse.errors?.map((error) => error.message).join(", ") ??
            `Could not create ${item.basketItem.variantName}.`,
        );
      }

      createdOrderItemIds.push(orderItemId);
    }
  } catch (error) {
    await cleanupFailedOrder(orderId, createdOrderItemIds, authMode);
    throw error;
  }

  // Loyalty settlement must happen only after Stripe confirms payment.
  return {
    id: orderId,
    orderNumber,
    checkoutAccessToken,
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    fulfilmentMethod,
    paymentStatus: "pending",
    totalInPence: totals.totalInPence,
    authMode,
  } satisfies CreatedOrderSummary;
}
