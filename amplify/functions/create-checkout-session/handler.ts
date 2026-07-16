import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { env } from "$amplify/env/create-checkout-session";
import type { Schema } from "../../data/resource";
import {
  maxCheckoutLineItems,
  parseCheckoutItems,
  validateCheckoutOrder,
  validateCheckoutRequest,
} from "./validation";

type OrderCreateInput = Parameters<
  ReturnType<typeof generateClient<Schema>>["models"]["Order"]["create"]
>[0];
type OrderItemCreateInput = Parameters<
  ReturnType<typeof generateClient<Schema>>["models"]["OrderItem"]["create"]
>[0];
type CustomerProfileCreateInput = Parameters<
  ReturnType<typeof generateClient<Schema>>["models"]["CustomerProfile"]["create"]
>[0];

type OrderUpdateInput = Parameters<
  ReturnType<typeof generateClient<Schema>>["models"]["Order"]["update"]
>[0];
type OrderItemRecord = Awaited<
  ReturnType<Schema["Order"]["type"]["items"]>
>["data"][number];

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const { resourceConfig, libraryOptions } =
  await getAmplifyDataClientConfig(env);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const allowedCheckoutOrigins = new Set([
  "https://butterandbetter.co.uk",
  "https://www.butterandbetter.co.uk",
  "https://main.d2g7z9bkquno42.amplifyapp.com",
]);

function createOrderUpdateInput(
  order: Schema["Order"]["type"],
  changes: Partial<Schema["Order"]["type"]>,
) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: changes.status ?? order.status,
    paymentStatus: changes.paymentStatus ?? order.paymentStatus,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    firstName: order.firstName,
    lastName: order.lastName,
    customerProfileId: order.customerProfileId,
    fulfilmentMethod: order.fulfilmentMethod,
    addressLine1: order.addressLine1,
    addressLine2: order.addressLine2,
    city: order.city,
    postcode: order.postcode,
    customerNotes: order.customerNotes,
    subtotalInPence: order.subtotalInPence,
    deliveryFeeInPence: order.deliveryFeeInPence,
    loyaltySpendInPence: order.loyaltySpendInPence,
    stampsEarned: order.stampsEarned,
    rewardDiscountInPence: order.rewardDiscountInPence,
    totalInPence: order.totalInPence,
    checkoutAccessToken: order.checkoutAccessToken,
    stripeCheckoutSessionId:
      changes.stripeCheckoutSessionId ?? order.stripeCheckoutSessionId,
    stripePaymentIntentId:
      changes.stripePaymentIntentId ?? order.stripePaymentIntentId,
    paidAt: changes.paidAt ?? order.paidAt,
    refundedAt: changes.refundedAt ?? order.refundedAt,
    loyaltyProcessedAt: changes.loyaltyProcessedAt ?? order.loyaltyProcessedAt,
    loyaltySettled: changes.loyaltySettled ?? order.loyaltySettled,
    customerOrderConfirmationEmailStatus:
      order.customerOrderConfirmationEmailStatus,
    customerOrderConfirmationEmailLastAttemptAt:
      order.customerOrderConfirmationEmailLastAttemptAt,
    customerOrderConfirmationEmailError:
      order.customerOrderConfirmationEmailError,
    customerOrderConfirmationEmailProviderId:
      order.customerOrderConfirmationEmailProviderId,
    customerOrderConfirmationEmailSentAt:
      changes.customerOrderConfirmationEmailSentAt ??
      order.customerOrderConfirmationEmailSentAt,
    adminOrderNotificationEmailStatus:
      order.adminOrderNotificationEmailStatus,
    adminOrderNotificationEmailLastAttemptAt:
      order.adminOrderNotificationEmailLastAttemptAt,
    adminOrderNotificationEmailError:
      order.adminOrderNotificationEmailError,
    adminOrderNotificationEmailProviderId:
      order.adminOrderNotificationEmailProviderId,
    adminOrderNotificationEmailSentAt:
      changes.adminOrderNotificationEmailSentAt ??
      order.adminOrderNotificationEmailSentAt,
  } as unknown as OrderUpdateInput;
}

function requireSafeOrigin(origin: string) {
  const parsedOrigin = new URL(origin);
  const isLocalDevelopmentHost =
    parsedOrigin.hostname === "localhost" ||
    parsedOrigin.hostname === "127.0.0.1" ||
    parsedOrigin.hostname === "[::1]";

  if (parsedOrigin.username || parsedOrigin.password) {
    throw new Error("Invalid checkout origin.");
  }

  if (isLocalDevelopmentHost && parsedOrigin.protocol === "http:") {
    return parsedOrigin.origin;
  }

  if (
    parsedOrigin.protocol !== "https:" ||
    !allowedCheckoutOrigins.has(parsedOrigin.origin)
  ) {
    throw new Error("Checkout origin is not allowed.");
  }

  return parsedOrigin.origin;
}

function getCallerSub(identity: unknown) {
  if (!identity || typeof identity !== "object") {
    return null;
  }

  const maybeIdentity = identity as {
    claims?: Record<string, unknown>;
    sub?: unknown;
  };
  const claimSub = maybeIdentity.claims?.sub;

  if (typeof claimSub === "string" && claimSub.length > 0) {
    return claimSub;
  }

  return typeof maybeIdentity.sub === "string" && maybeIdentity.sub.length > 0
    ? maybeIdentity.sub
    : null;
}

async function loadOrderItems(order: Schema["Order"]["type"]) {
  const items: OrderItemRecord[] = [];
  let nextToken: string | null | undefined;

  do {
    const itemResponse = await order.items({
      limit: 100,
      nextToken,
    });

    if (itemResponse.errors?.length) {
      throw new Error("Order items could not be loaded.");
    }

    items.push(...itemResponse.data);

    if (items.length > maxCheckoutLineItems) {
      throw new Error("Order contains too many items.");
    }

    nextToken = itemResponse.nextToken;
  } while (nextToken);

  return items;
}

type CatalogueLookupItem = {
  productId?: string | null;
  variantId?: string | null;
  productName?: string;
  variantName?: string;
};

async function loadCatalogueItems(items: readonly CatalogueLookupItem[]) {
  return Promise.all(
    items.map(async (item) => {
      if (!item.productId || !item.variantId) {
        throw new Error("Order item is missing product information.");
      }

      const [productResponse, variantResponse] = await Promise.all([
        client.models.Product.get({ id: item.productId }),
        client.models.ProductVariant.get({ id: item.variantId }),
      ]);

      if (productResponse.errors?.length || !productResponse.data) {
        throw new Error(
          `${item.productName ?? "A basket product"} is no longer available.`,
        );
      }

      if (
        variantResponse.errors?.length ||
        !variantResponse.data ||
        variantResponse.data.productId !== productResponse.data.id
      ) {
        throw new Error(
          `${item.variantName ?? "A basket option"} is no longer available.`,
        );
      }

      return {
        productId: productResponse.data.id,
        variantId: variantResponse.data.id,
        productName: productResponse.data.name,
        variantName: variantResponse.data.name,
        unitPriceInPence: variantResponse.data.priceInPence,
        productIsActive: productResponse.data.isActive,
        variantIsActive: variantResponse.data.isActive,
        nationwideDelivery: productResponse.data.nationwideDelivery,
        stockQuantity: variantResponse.data.stockQuantity,
      };
    }),
  );
}

type CheckoutCustomerInput = {
  firstName: string;
  lastName: string;
  customerEmail: string;
  customerPhone: string;
  fulfilmentMethod: "collection" | "nationwide";
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  customerNotes: string | null;
};

function requireText(value: unknown, fieldName: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > maxLength) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return trimmed;
}

function optionalText(value: unknown, fieldName: string, maxLength: number) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} is invalid.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} is too long.`);
  }

  return trimmed;
}

function normalizePhoneNumber(value: unknown) {
  const phone = requireText(value, "Phone number", 30);
  const digits = phone.replace(/\D/g, "");
  const normalized = phone.startsWith("+")
    ? `+${digits}`
    : digits.startsWith("0")
      ? `+44${digits.slice(1)}`
      : digits.startsWith("44")
        ? `+${digits}`
        : `+${digits}`;

  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    throw new Error("Phone number is invalid.");
  }

  return normalized;
}

function validateCustomerInput(argumentsValue: Record<string, unknown>) {
  const customerEmail = requireText(
    argumentsValue.customerEmail,
    "Email address",
    254,
  ).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new Error("Email address is invalid.");
  }

  if (
    argumentsValue.fulfilmentMethod !== "collection" &&
    argumentsValue.fulfilmentMethod !== "nationwide"
  ) {
    throw new Error("Fulfilment method is invalid.");
  }

  const fulfilmentMethod = argumentsValue.fulfilmentMethod;
  const addressLine1 = optionalText(
    argumentsValue.addressLine1,
    "Address line 1",
    120,
  );
  const addressLine2 = optionalText(
    argumentsValue.addressLine2,
    "Address line 2",
    120,
  );
  const city = optionalText(argumentsValue.city, "City", 80);
  const rawPostcode = optionalText(argumentsValue.postcode, "Postcode", 12);
  const postcode = rawPostcode?.toUpperCase() ?? null;

  if (
    fulfilmentMethod === "nationwide" &&
    (!addressLine1 ||
      !city ||
      !postcode ||
      !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(postcode))
  ) {
    throw new Error("UK tracked delivery requires a valid UK address.");
  }

  return {
    firstName: requireText(argumentsValue.firstName, "First name", 80),
    lastName: requireText(argumentsValue.lastName, "Last name", 80),
    customerEmail,
    customerPhone: normalizePhoneNumber(argumentsValue.customerPhone),
    fulfilmentMethod,
    addressLine1: fulfilmentMethod === "collection" ? null : addressLine1,
    addressLine2: fulfilmentMethod === "collection" ? null : addressLine2,
    city: fulfilmentMethod === "collection" ? null : city,
    postcode: fulfilmentMethod === "collection" ? null : postcode,
    customerNotes: optionalText(
      argumentsValue.customerNotes,
      "Order notes",
      1000,
    ),
  } satisfies CheckoutCustomerInput;
}

function createOrderNumber(orderId: string) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return `BB-${datePart}-${orderId.slice(0, 8).toUpperCase()}`;
}

async function ensureCustomerProfile(customerProfileId: string) {
  const existingProfile = await client.models.CustomerProfile.get({
    id: customerProfileId,
  });

  if (existingProfile.data) {
    return existingProfile.data;
  }

  const createResponse = await client.models.CustomerProfile.create(
    {
      id: customerProfileId,
      owner: customerProfileId,
      loyaltyStamps: 0,
      loyaltyRemainderInPence: 0,
      availableRewards: 0,
    } as unknown as CustomerProfileCreateInput,
  );

  if (!createResponse.errors?.length && createResponse.data) {
    return createResponse.data;
  }

  const racedProfile = await client.models.CustomerProfile.get({
    id: customerProfileId,
  });

  if (!racedProfile.data) {
    throw new Error("Could not initialize the customer loyalty profile.");
  }

  return racedProfile.data;
}

async function deletePendingOrder(orderId: string, itemIds: string[]) {
  for (const itemId of itemIds) {
    const itemDelete = await client.models.OrderItem.delete({ id: itemId });

    if (itemDelete.errors?.length) {
      console.error(`Could not clean up order item ${itemId}.`);
    }
  }

  const orderDelete = await client.models.Order.delete({ id: orderId });

  if (orderDelete.errors?.length) {
    console.error(`Could not clean up pending order ${orderId}.`);
  }
}

async function createPendingOrder(
  customer: CheckoutCustomerInput,
  customerProfileId: string | null,
  owner: string | null,
  validatedOrder: ReturnType<typeof validateCheckoutRequest>,
) {
  const orderId = randomUUID();
  const checkoutAccessToken = randomUUID();
  const orderInput = {
    id: orderId,
    owner,
    orderNumber: createOrderNumber(orderId),
    status: "pending",
    paymentStatus: "pending",
    customerEmail: customer.customerEmail,
    customerPhone: customer.customerPhone,
    firstName: customer.firstName,
    lastName: customer.lastName,
    customerProfileId,
    fulfilmentMethod: customer.fulfilmentMethod,
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    city: customer.city,
    postcode: customer.postcode,
    customerNotes: customer.customerNotes,
    subtotalInPence: validatedOrder.subtotalInPence,
    deliveryFeeInPence: validatedOrder.deliveryFeeInPence,
    loyaltySpendInPence: validatedOrder.loyaltySpendInPence,
    stampsEarned: 0,
    rewardDiscountInPence: validatedOrder.rewardDiscountInPence,
    totalInPence: validatedOrder.totalInPence,
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
  const orderResponse = await client.models.Order.create(orderInput);

  if (orderResponse.errors?.length || !orderResponse.data) {
    throw new Error("Could not create a secure pending order.");
  }

  const createdItemIds: string[] = [];

  try {
    for (const item of validatedOrder.validatedItems) {
      const itemId = randomUUID();
      const itemResponse = await client.models.OrderItem.create(
        {
          id: itemId,
          owner,
          orderId,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          unitPriceInPence: item.unitPriceInPence,
          quantity: item.quantity,
          lineTotalInPence: item.lineTotalInPence,
        } as unknown as OrderItemCreateInput,
      );

      if (itemResponse.errors?.length || !itemResponse.data) {
        throw new Error("Could not create secure order items.");
      }

      createdItemIds.push(itemId);
    }
  } catch (error) {
    await deletePendingOrder(orderId, createdItemIds);
    throw error;
  }

  return {
    order: orderResponse.data,
    checkoutAccessToken,
    createdItemIds,
  };
}

async function validateReward(
  customerProfileId: string | null,
  rewardDiscountInPence: number,
) {
  if (rewardDiscountInPence === 0) {
    return;
  }

  if (!customerProfileId) {
    throw new Error(
      "Loyalty rewards can only be redeemed by signed-in customers.",
    );
  }

  const profileResponse = await client.models.CustomerProfile.get({
    id: customerProfileId,
  });

  if (
    profileResponse.errors?.length ||
    !profileResponse.data ||
    profileResponse.data.availableRewards < 1
  ) {
    throw new Error("No loyalty reward is available for this order.");
  }
}

async function expirePreviousSession(order: Schema["Order"]["type"]) {
  if (!order.stripeCheckoutSessionId) {
    return;
  }

  const previousSession = await stripe.checkout.sessions.retrieve(
    order.stripeCheckoutSessionId,
  );

  if (previousSession.payment_status === "paid") {
    throw new Error("This order is already paid.");
  }

  if (previousSession.status === "open") {
    await stripe.checkout.sessions.expire(previousSession.id);
  }
}

async function createStripeSession(
  order: Schema["Order"]["type"],
  checkoutAccessToken: string,
  safeOrigin: string,
  validatedOrder: ReturnType<typeof validateCheckoutOrder>,
) {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    validatedOrder.validatedItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "gbp",
        unit_amount: item.unitPriceInPence,
        product_data: {
          name: `${item.productName} - ${item.variantName}`,
        },
      },
    }));

  if (validatedOrder.deliveryFeeInPence > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: validatedOrder.deliveryFeeInPence,
        product_data: { name: "Delivery" },
      },
    });
  }

  const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
  let couponId: string | undefined;

  try {
    if (validatedOrder.rewardDiscountInPence > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: validatedOrder.rewardDiscountInPence,
        currency: "gbp",
        duration: "once",
        name: `Butter & Better reward ${order.orderNumber}`,
      });
      couponId = coupon.id;
      discounts.push({ coupon: coupon.id });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.customerEmail,
      line_items: lineItems,
      discounts,
      metadata: { orderId: order.id },
      payment_intent_data: { metadata: { orderId: order.id } },
      success_url: `${safeOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeOrigin}/checkout/cancel?order_id=${encodeURIComponent(
        order.id,
      )}&access_token=${encodeURIComponent(checkoutAccessToken)}`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return session;
  } catch (error) {
    if (couponId) {
      await stripe.coupons.del(couponId).catch(() => undefined);
    }

    throw error;
  }
}

async function storeCheckoutSession(
  order: Schema["Order"]["type"],
  session: Stripe.Checkout.Session,
) {
  const updateResponse = await client.models.Order.update(
    createOrderUpdateInput(order, { stripeCheckoutSessionId: session.id }),
  );

  if (updateResponse.errors?.length) {
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    }

    throw new Error("Could not store Stripe Checkout Session ID.");
  }
}

type CreateCheckoutEvent = Parameters<
  Schema["createCheckoutSession"]["functionHandler"]
>[0];
type RetryCheckoutEvent = Parameters<
  Schema["retryCheckoutSession"]["functionHandler"]
>[0];

async function startCheckout(event: CreateCheckoutEvent) {
  const argumentsValue = event.arguments as Record<string, unknown>;
  const safeOrigin = requireSafeOrigin(
    requireText(argumentsValue.origin, "Checkout origin", 300),
  );
  const customer = validateCustomerInput(argumentsValue);
  const requestedItems = parseCheckoutItems(argumentsValue.items);

  if (typeof argumentsValue.redeemReward !== "boolean") {
    throw new Error("Loyalty reward selection is invalid.");
  }

  const catalogueItems = await loadCatalogueItems(requestedItems);
  const validatedOrder = validateCheckoutRequest({
    fulfilmentMethod: customer.fulfilmentMethod,
    addressLine1: customer.addressLine1,
    city: customer.city,
    postcode: customer.postcode,
    redeemReward: argumentsValue.redeemReward,
    items: requestedItems,
    catalogueItems,
  });
  const callerSub = getCallerSub(event.identity);
  const customerProfile = callerSub
    ? await ensureCustomerProfile(callerSub)
    : null;

  await validateReward(
    customerProfile?.id ?? null,
    validatedOrder.rewardDiscountInPence,
  );

  const pendingOrder = await createPendingOrder(
    customer,
    customerProfile?.id ?? null,
    callerSub,
    validatedOrder,
  );

  try {
    const session = await createStripeSession(
      pendingOrder.order,
      pendingOrder.checkoutAccessToken,
      safeOrigin,
      validatedOrder,
    );

    await storeCheckoutSession(pendingOrder.order, session);

    return {
      checkoutUrl: session.url!,
      sessionId: session.id,
    };
  } catch (error) {
    await deletePendingOrder(
      pendingOrder.order.id,
      pendingOrder.createdItemIds,
    );
    throw error;
  }
}

async function retryCheckout(event: RetryCheckoutEvent) {
  const { orderId, checkoutAccessToken, origin } = event.arguments;
  const safeOrigin = requireSafeOrigin(origin);
  const orderResponse = await client.models.Order.get({ id: orderId });

  if (orderResponse.errors?.length || !orderResponse.data) {
    throw new Error("Order was not found.");
  }

  const order = orderResponse.data;
  const callerSub = getCallerSub(event.identity);

  if (order.customerProfileId && order.customerProfileId !== callerSub) {
    throw new Error("Order customer profile access was denied.");
  }

  if (order.checkoutAccessToken !== checkoutAccessToken) {
    throw new Error("Order payment access was denied.");
  }

  if (order.paymentStatus === "paid") {
    throw new Error("This order is already paid.");
  }

  if (
    order.status !== "pending" ||
    !["pending", "failed"].includes(order.paymentStatus)
  ) {
    throw new Error("This order cannot be sent to payment.");
  }

  await expirePreviousSession(order);

  const orderItems = await loadOrderItems(order);
  const catalogueItems = await loadCatalogueItems(orderItems);
  const validatedOrder = validateCheckoutOrder({
    order,
    items: orderItems,
    catalogueItems,
  });

  await validateReward(
    order.customerProfileId ?? null,
    validatedOrder.rewardDiscountInPence,
  );

  const session = await createStripeSession(
    order,
    checkoutAccessToken,
    safeOrigin,
    validatedOrder,
  );

  await storeCheckoutSession(order, session);

  return {
    checkoutUrl: session.url!,
    sessionId: session.id,
  };
}

export const handler = async (
  event: CreateCheckoutEvent | RetryCheckoutEvent,
) => {
  if (event.info.fieldName === "retryCheckoutSession") {
    return retryCheckout(event as RetryCheckoutEvent);
  }

  return startCheckout(event as CreateCheckoutEvent);
};
