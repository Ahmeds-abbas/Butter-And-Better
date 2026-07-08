import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import Stripe from "stripe";
import { env } from "$amplify/env/create-checkout-session";
import type { Schema } from "../../data/resource";

type OrderUpdateInput = Parameters<
  ReturnType<typeof generateClient<Schema>>["models"]["Order"]["update"]
>[0];

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
    customerOrderConfirmationEmailSentAt:
      changes.customerOrderConfirmationEmailSentAt ??
      order.customerOrderConfirmationEmailSentAt,
    adminOrderNotificationEmailSentAt:
      changes.adminOrderNotificationEmailSentAt ??
      order.adminOrderNotificationEmailSentAt,
  } as unknown as OrderUpdateInput;
}

function requireSafeOrigin(origin: string) {
  const parsedOrigin = new URL(origin);

  if (!["http:", "https:"].includes(parsedOrigin.protocol)) {
    throw new Error("Invalid checkout origin.");
  }

  return parsedOrigin.origin;
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

    if (order.checkoutAccessToken !== checkoutAccessToken) {
      throw new Error("Order payment access was denied.");
    }

    if (order.paymentStatus === "paid") {
      throw new Error("This order is already paid.");
    }

    const itemResponse = await order.items();

    if (itemResponse.errors?.length || itemResponse.data.length === 0) {
      throw new Error("Order items could not be loaded.");
    }

    const subtotalInPence = itemResponse.data.reduce(
      (total, item) => total + item.lineTotalInPence,
      0,
    );
    const calculatedTotal =
      subtotalInPence + order.deliveryFeeInPence - order.rewardDiscountInPence;

    if (
      subtotalInPence !== order.subtotalInPence ||
      calculatedTotal !== order.totalInPence
    ) {
      throw new Error("Order totals do not match stored order items.");
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      itemResponse.data.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "gbp",
          unit_amount: item.unitPriceInPence,
          product_data: {
            name: `${item.productName} - ${item.variantName}`,
          },
        },
      }));

    if (order.deliveryFeeInPence > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: order.deliveryFeeInPence,
          product_data: {
            name: "Delivery",
          },
        },
      });
    }

    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];

    if (order.rewardDiscountInPence > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: order.rewardDiscountInPence,
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
