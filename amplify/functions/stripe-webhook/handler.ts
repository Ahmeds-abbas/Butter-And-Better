import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import Stripe from "stripe";
import { env } from "$amplify/env/stripe-webhook";
import type { Schema } from "../../data/resource";

type FunctionUrlEvent = {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
};

type FunctionUrlResponse = {
  statusCode: number;
  body: string;
};

type OrderUpdateInput = Parameters<
  ReturnType<typeof generateClient<Schema>>["models"]["Order"]["update"]
>[0];

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const { resourceConfig, libraryOptions } =
  await getAmplifyDataClientConfig(env);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

function response(statusCode: number, body: string): FunctionUrlResponse {
  return { statusCode, body };
}

function getHeader(headers: FunctionUrlEvent["headers"], name: string) {
  const lowerName = name.toLowerCase();
  const matchingHeader = Object.entries(headers ?? {}).find(
    ([key]) => key.toLowerCase() === lowerName,
  );

  return matchingHeader?.[1];
}

function getRawBody(event: FunctionUrlEvent) {
  if (!event.body) {
    return Buffer.from("");
  }

  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : Buffer.from(event.body, "utf8");
}

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
  } as unknown as OrderUpdateInput;
}

async function getOrder(orderId: string) {
  const orderResponse = await client.models.Order.get({ id: orderId });

  if (orderResponse.errors?.length || !orderResponse.data) {
    throw new Error(`Order ${orderId} was not found.`);
  }

  return orderResponse.data;
}

async function markSessionPaid(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    throw new Error("Checkout Session is missing order metadata.");
  }

  const order = await getOrder(orderId);

  if (
    session.id !== order.stripeCheckoutSessionId ||
    session.currency !== "gbp" ||
    session.amount_total !== order.totalInPence ||
    session.payment_status !== "paid"
  ) {
    throw new Error(`Checkout Session ${session.id} failed verification.`);
  }

  if (order.paymentStatus === "paid") {
    return order.id;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const updateInput = createOrderUpdateInput(order, {
    paymentStatus: "paid",
    stripePaymentIntentId: paymentIntentId ?? order.stripePaymentIntentId,
    paidAt: new Date().toISOString(),
  });

  const updateResponse = await client.models.Order.update(updateInput);

  if (updateResponse.errors?.length) {
    throw new Error(`Could not mark order ${order.id} as paid.`);
  }

  return order.id;
}

async function markSessionFailed(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    return undefined;
  }

  const order = await getOrder(orderId);
  const updateInput = createOrderUpdateInput(order, {
    paymentStatus: "failed",
  });

  await client.models.Order.update(updateInput);

  return order.id;
}

async function markPaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) {
    return undefined;
  }

  const order = await getOrder(orderId);
  const updateInput = createOrderUpdateInput(order, {
    paymentStatus: "failed",
    stripePaymentIntentId: paymentIntent.id,
  });

  await client.models.Order.update(updateInput);

  return order.id;
}

async function markChargeRefunded(charge: Stripe.Charge) {
  if (!charge.refunded || charge.amount_refunded < charge.amount) {
    return undefined;
  }

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    return undefined;
  }

  const orderResponse = await client.models.Order.list({
    filter: {
      stripePaymentIntentId: {
        eq: paymentIntentId,
      },
    },
    limit: 1,
  });

  const order = orderResponse.data[0];

  if (!order) {
    return undefined;
  }

  const updateInput = createOrderUpdateInput(order, {
    paymentStatus: "refunded",
    refundedAt: new Date().toISOString(),
  });

  await client.models.Order.update(updateInput);

  return order.id;
}

async function recordProcessedEvent(
  stripeEvent: Stripe.Event,
  orderId: string | undefined,
) {
  await client.models.PaymentEvent.create({
    eventId: stripeEvent.id,
    eventType: stripeEvent.type,
    orderId,
    processedAt: new Date().toISOString(),
  });
}

export const handler = async (
  event: FunctionUrlEvent,
): Promise<FunctionUrlResponse> => {
  const signature = getHeader(event.headers, "stripe-signature");

  if (!signature) {
    return response(400, "Missing Stripe signature.");
  }

  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      getRawBody(event),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return response(400, "Invalid Stripe signature.");
  }

  const existingEvent = await client.models.PaymentEvent.get({
    eventId: stripeEvent.id,
  });

  if (existingEvent.data) {
    return response(200, "Already processed.");
  }

  try {
    let orderId: string | undefined;

    if (
      stripeEvent.type === "checkout.session.completed" ||
      stripeEvent.type === "checkout.session.async_payment_succeeded"
    ) {
      orderId = await markSessionPaid(
        stripeEvent.data.object as Stripe.Checkout.Session,
      );
    } else if (stripeEvent.type === "checkout.session.async_payment_failed") {
      orderId = await markSessionFailed(
        stripeEvent.data.object as Stripe.Checkout.Session,
      );
    } else if (stripeEvent.type === "payment_intent.payment_failed") {
      orderId = await markPaymentIntentFailed(
        stripeEvent.data.object as Stripe.PaymentIntent,
      );
    } else if (stripeEvent.type === "charge.refunded") {
      orderId = await markChargeRefunded(
        stripeEvent.data.object as Stripe.Charge,
      );
    }

    await recordProcessedEvent(stripeEvent, orderId);
  } catch (error) {
    console.error(`Failed to process Stripe event ${stripeEvent.id}:`, error);
    return response(500, "Webhook processing failed.");
  }

  return response(200, "Processed.");
};
