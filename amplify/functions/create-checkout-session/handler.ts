import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import Stripe from "stripe";
import { env } from "$amplify/env/create-checkout-session";
import type { Schema } from "../../data/resource";
import {
  maxCheckoutLineItems,
  validateCheckoutOrder,
} from "./validation";

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

  if (!["http:", "https:"].includes(parsedOrigin.protocol)) {
    throw new Error("Invalid checkout origin.");
  }

  if (parsedOrigin.protocol === "http:" && !isLocalDevelopmentHost) {
    throw new Error("Checkout origin must use HTTPS.");
  }

  if (parsedOrigin.username || parsedOrigin.password) {
    throw new Error("Invalid checkout origin.");
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

async function loadCatalogueItems(items: readonly OrderItemRecord[]) {
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
        throw new Error(`${item.productName} is no longer available.`);
      }

      if (
        variantResponse.errors?.length ||
        !variantResponse.data ||
        variantResponse.data.productId !== productResponse.data.id
      ) {
        throw new Error(`${item.variantName} is no longer available.`);
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

export const handler: Schema["createCheckoutSession"]["functionHandler"] =
  async (event) => {
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

    const orderItems = await loadOrderItems(order);
    const catalogueItems = await loadCatalogueItems(orderItems);
    const validatedOrder = validateCheckoutOrder({
      order,
      items: orderItems,
      catalogueItems,
    });

    if (validatedOrder.rewardDiscountInPence > 0) {
      if (!order.customerProfileId) {
        throw new Error(
          "Loyalty rewards can only be redeemed by signed-in customers.",
        );
      }

      const profileResponse = await client.models.CustomerProfile.get({
        id: order.customerProfileId,
      });

      if (
        profileResponse.errors?.length ||
        !profileResponse.data ||
        profileResponse.data.availableRewards < 1
      ) {
        throw new Error("No loyalty reward is available for this order.");
      }
    }

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
          product_data: {
            name: "Delivery",
          },
        },
      });
    }

    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];

    if (validatedOrder.rewardDiscountInPence > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: validatedOrder.rewardDiscountInPence,
        currency: "gbp",
        duration: "once",
        name: `Butter & Better reward ${order.orderNumber}`,
      });

      discounts.push({ coupon: coupon.id });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.customerEmail,
      line_items: lineItems,
      discounts,
      metadata: {
        orderId: order.id,
      },
      payment_intent_data: {
        metadata: {
          orderId: order.id,
        },
      },
      success_url: `${safeOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeOrigin}/checkout/cancel?order_id=${encodeURIComponent(
        order.id,
      )}&access_token=${encodeURIComponent(checkoutAccessToken)}`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    const updateInput = createOrderUpdateInput(order, {
      stripeCheckoutSessionId: session.id,
    });

    const updateResponse = await client.models.Order.update(updateInput);

    if (updateResponse.errors?.length) {
      throw new Error("Could not store Stripe Checkout Session ID.");
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  };
