import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import Stripe from "stripe";
import { env } from "$amplify/env/stripe-webhook";
import type { Schema } from "../../data/resource";
import { calculateLoyaltySettlement } from "../../../src/lib/loyalty";
import {
  sendAdminOrderNotification,
  sendCustomerOrderConfirmation,
  type OrderEmailData,
  type OrderEmailItem,
} from "./email";

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
type CustomerProfileUpdateInput = Parameters<
  ReturnType<typeof generateClient<Schema>>["models"]["CustomerProfile"]["update"]
>[0];
type OrderItemRecord = Awaited<
  ReturnType<Schema["Order"]["type"]["items"]>
>["data"][number];

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const emailApiKey = (
  env as typeof env & { RESEND_API_KEY: string }
).RESEND_API_KEY;
const emailFromAddress = env.EMAIL_FROM_ADDRESS;
const adminNotificationEmail = env.ADMIN_NOTIFICATION_EMAIL;

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
  const changed = <Key extends keyof Schema["Order"]["type"]>(key: Key) =>
    Object.prototype.hasOwnProperty.call(changes, key)
      ? changes[key]
      : order[key];

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
    loyaltySpendInPence:
      changes.loyaltySpendInPence ?? order.loyaltySpendInPence,
    stampsEarned: changes.stampsEarned ?? order.stampsEarned,
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
      changed("customerOrderConfirmationEmailStatus"),
    customerOrderConfirmationEmailLastAttemptAt:
      changed("customerOrderConfirmationEmailLastAttemptAt"),
    customerOrderConfirmationEmailError:
      changed("customerOrderConfirmationEmailError"),
    customerOrderConfirmationEmailProviderId:
      changed("customerOrderConfirmationEmailProviderId"),
    customerOrderConfirmationEmailSentAt:
      changed("customerOrderConfirmationEmailSentAt"),
    adminOrderNotificationEmailStatus:
      changed("adminOrderNotificationEmailStatus"),
    adminOrderNotificationEmailLastAttemptAt:
      changed("adminOrderNotificationEmailLastAttemptAt"),
    adminOrderNotificationEmailError:
      changed("adminOrderNotificationEmailError"),
    adminOrderNotificationEmailProviderId:
      changed("adminOrderNotificationEmailProviderId"),
    adminOrderNotificationEmailSentAt:
      changed("adminOrderNotificationEmailSentAt"),
  } as unknown as OrderUpdateInput;
}

async function getOrder(orderId: string) {
  const orderResponse = await client.models.Order.get({ id: orderId });

  if (orderResponse.errors?.length || !orderResponse.data) {
    throw new Error(`Order ${orderId} was not found.`);
  }

  return orderResponse.data;
}

function verifyPaidSession(
  session: Stripe.Checkout.Session,
  order: Schema["Order"]["type"],
) {
  if (
    session.id !== order.stripeCheckoutSessionId ||
    session.currency !== "gbp" ||
    session.amount_total !== order.totalInPence ||
    session.payment_status !== "paid"
  ) {
    throw new Error(`Checkout Session ${session.id} failed verification.`);
  }
}

async function hasProcessedCheckoutCompletedEvent(orderId: string) {
  const eventResponse = await client.models.PaymentEvent.list({
    filter: {
      eventType: { eq: "checkout.session.completed" },
      orderId: { eq: orderId },
    },
    limit: 1,
  });

  if (eventResponse.errors?.length) {
    throw new Error(
      `Could not check prior payment events for order ${orderId}.`,
    );
  }

  return eventResponse.data.length > 0;
}

async function markSessionPaid(
  session: Stripe.Checkout.Session,
  sendNotifications: boolean,
) {
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    throw new Error("Checkout Session is missing order metadata.");
  }

  const order = await getOrder(orderId);
  verifyPaidSession(session, order);
  const initializeNotificationState =
    sendNotifications &&
    !(await hasProcessedCheckoutCompletedEvent(order.id));

  if (order.paymentStatus === "paid") {
    let paidOrder = order;

    if (initializeNotificationState) {
      const resetResponse = await client.models.Order.update(
        createOrderUpdateInput(order, {
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
        }),
      );

      if (resetResponse.errors?.length) {
        throw new Error(`Could not initialize email state for order ${order.id}.`);
      }

      paidOrder = resetResponse.data ?? order;
    }

    const settledOrder = await settleLoyaltyForPaidOrder(paidOrder);
    if (sendNotifications) {
      await notifyPaidOrder(order.id, settledOrder);
    }
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
    ...(initializeNotificationState
      ? {
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
        }
      : {}),
  });

  const updateResponse = await client.models.Order.update(updateInput);

  if (updateResponse.errors?.length) {
    throw new Error(`Could not mark order ${order.id} as paid.`);
  }

  const settledOrder = await settleLoyaltyForPaidOrder(
    updateResponse.data ?? order,
  );
  if (sendNotifications) {
    await notifyPaidOrder(order.id, settledOrder);
  }

  return order.id;
}

async function retryPaidOrderNotifications(
  session: Stripe.Checkout.Session,
) {
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    throw new Error("Checkout Session is missing order metadata.");
  }

  const order = await getOrder(orderId);
  verifyPaidSession(session, order);

  if (order.paymentStatus !== "paid") {
    return;
  }

  if (order.customerProfileId && !order.loyaltySettled) {
    return;
  }

  await notifyPaidOrder(order.id, order);
}

async function settleLoyaltyForPaidOrder(order: Schema["Order"]["type"]) {
  if (!order.customerProfileId || order.loyaltySettled) {
    return order;
  }

  const profileResponse = await client.models.CustomerProfile.get({
    id: order.customerProfileId,
  });

  if (profileResponse.errors?.length || !profileResponse.data) {
    throw new Error(
      `Customer profile ${order.customerProfileId} was not found for loyalty settlement.`,
    );
  }

  const productSpendInPence = Math.max(
    0,
    order.subtotalInPence - order.rewardDiscountInPence,
  );
  const redeemedRewards = order.rewardDiscountInPence > 0 ? 1 : 0;

  if (profileResponse.data.availableRewards < redeemedRewards) {
    throw new Error(
      `Customer profile ${profileResponse.data.id} no longer has the redeemed loyalty reward.`,
    );
  }

  const nextLoyalty = calculateLoyaltySettlement(
    {
      loyaltyStamps: profileResponse.data.loyaltyStamps,
      loyaltyRemainderInPence: profileResponse.data.loyaltyRemainderInPence,
      availableRewards: Math.max(
        0,
        profileResponse.data.availableRewards - redeemedRewards,
      ),
    },
    productSpendInPence,
  );
  const profileInput = {
    id: profileResponse.data.id,
    firstName: profileResponse.data.firstName,
    lastName: profileResponse.data.lastName,
    phone: profileResponse.data.phone,
    loyaltyStamps: nextLoyalty.loyaltyStamps,
    loyaltyRemainderInPence: nextLoyalty.loyaltyRemainderInPence,
    availableRewards: nextLoyalty.availableRewards,
  } as unknown as CustomerProfileUpdateInput;
  const profileUpdate = await client.models.CustomerProfile.update(profileInput);

  if (profileUpdate.errors?.length || !profileUpdate.data) {
    throw new Error(
      `Could not update loyalty profile ${profileResponse.data.id}.`,
    );
  }

  const orderInput = createOrderUpdateInput(order, {
    loyaltySpendInPence: productSpendInPence,
    stampsEarned: nextLoyalty.stampsEarned,
    loyaltyProcessedAt: new Date().toISOString(),
    loyaltySettled: true,
  });
  const orderUpdate = await client.models.Order.update(orderInput);

  if (orderUpdate.errors?.length) {
    await client.models.CustomerProfile.update(
      {
        ...profileInput,
        loyaltyStamps: profileResponse.data.loyaltyStamps,
        loyaltyRemainderInPence: profileResponse.data.loyaltyRemainderInPence,
        availableRewards: profileResponse.data.availableRewards,
      } as unknown as CustomerProfileUpdateInput,
    );
    throw new Error(`Could not mark order ${order.id} loyalty as settled.`);
  }

  return orderUpdate.data ?? order;
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
      throw new Error(
        itemResponse.errors.map((error) => error.message).join(", "),
      );
    }

    items.push(...itemResponse.data);
    nextToken = itemResponse.nextToken;
  } while (nextToken);

  return items.sort((first, second) =>
    first.productName.localeCompare(second.productName),
  );
}

const EMAIL_STATUS_PENDING = "PENDING";
const EMAIL_STATUS_SENT = "SENT";
const EMAIL_STATUS_FAILED = "FAILED";
const requiredEmailFromAddress =
  "Butter & Better <orders@butterandbetter.co.uk>";
const requiredAdminNotificationEmail = "butterandbetterbakery@gmail.com";

function toOrderEmailData(order: Schema["Order"]["type"]): OrderEmailData {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
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
    rewardDiscountInPence: order.rewardDiscountInPence,
    totalInPence: order.totalInPence,
    stampsEarned: order.stampsEarned,
  };
}

function toOrderEmailItems(items: OrderItemRecord[]): OrderEmailItem[] {
  return items.map((item) => ({
    productName: item.productName,
    variantName: item.variantName,
    unitPriceInPence: item.unitPriceInPence,
    quantity: item.quantity,
    lineTotalInPence: item.lineTotalInPence,
  }));
}

function safeErrorMessage(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);

  for (const secretValue of [
    emailApiKey,
    env.STRIPE_SECRET_KEY,
    env.STRIPE_WEBHOOK_SECRET,
  ]) {
    if (secretValue) {
      message = message.split(secretValue).join("[REDACTED]");
    }
  }

  return message.slice(0, 1000);
}

function getEmailConfigurationError(includeAdminEmail: boolean) {
  if (!emailApiKey) {
    return "RESEND_API_KEY is not configured.";
  }

  if (emailFromAddress !== requiredEmailFromAddress) {
    return `EMAIL_FROM_ADDRESS must be ${requiredEmailFromAddress}.`;
  }

  if (
    includeAdminEmail &&
    adminNotificationEmail !== requiredAdminNotificationEmail
  ) {
    return `ADMIN_NOTIFICATION_EMAIL must be ${requiredAdminNotificationEmail}.`;
  }

  return undefined;
}

async function updateOrderEmailState(
  orderId: string,
  changes: Partial<Schema["Order"]["type"]>,
) {
  const latestOrder = await getOrder(orderId);
  const updateResponse = await client.models.Order.update(
    createOrderUpdateInput(latestOrder, changes),
  );

  if (updateResponse.errors?.length) {
    throw new Error(
      updateResponse.errors.map((error) => error.message).join(", "),
    );
  }

  return updateResponse.data ?? latestOrder;
}

function customerEmailWasSent(order: Schema["Order"]["type"]) {
  return (
    order.customerOrderConfirmationEmailStatus === EMAIL_STATUS_SENT ||
    Boolean(order.customerOrderConfirmationEmailSentAt)
  );
}

function adminEmailWasSent(order: Schema["Order"]["type"]) {
  return (
    order.adminOrderNotificationEmailStatus === EMAIL_STATUS_SENT ||
    Boolean(order.adminOrderNotificationEmailSentAt)
  );
}

async function markCustomerEmailFailed(orderId: string, error: unknown) {
  try {
    const latestOrder = await getOrder(orderId);

    if (customerEmailWasSent(latestOrder)) {
      return;
    }

    await updateOrderEmailState(orderId, {
      customerOrderConfirmationEmailStatus: EMAIL_STATUS_FAILED,
      customerOrderConfirmationEmailError: safeErrorMessage(error),
      customerOrderConfirmationEmailLastAttemptAt: new Date().toISOString(),
    });
  } catch (statusError) {
    console.error(
      `Could not store customer email failure for order ${orderId}:`,
      statusError,
    );
  }
}

async function markAdminEmailFailed(orderId: string, error: unknown) {
  try {
    const latestOrder = await getOrder(orderId);

    if (adminEmailWasSent(latestOrder)) {
      return;
    }

    await updateOrderEmailState(orderId, {
      adminOrderNotificationEmailStatus: EMAIL_STATUS_FAILED,
      adminOrderNotificationEmailError: safeErrorMessage(error),
      adminOrderNotificationEmailLastAttemptAt: new Date().toISOString(),
    });
  } catch (statusError) {
    console.error(
      `Could not store admin email failure for order ${orderId}:`,
      statusError,
    );
  }
}

async function attemptCustomerOrderEmail(
  orderId: string,
  items: OrderEmailItem[],
) {
  let order = await getOrder(orderId);

  if (customerEmailWasSent(order)) {
    return;
  }

  const attemptedAt = new Date().toISOString();
  order = await updateOrderEmailState(orderId, {
    customerOrderConfirmationEmailStatus: EMAIL_STATUS_PENDING,
    customerOrderConfirmationEmailError: null,
    customerOrderConfirmationEmailLastAttemptAt: attemptedAt,
  });

  try {
    const configurationError = getEmailConfigurationError(false);

    if (configurationError) {
      throw new Error(configurationError);
    }

    const sendResult = await sendCustomerOrderConfirmation({
      order: toOrderEmailData(order),
      items,
      apiKey: emailApiKey,
      fromAddress: emailFromAddress,
    });
    const latestOrder = await getOrder(orderId);

    if (customerEmailWasSent(latestOrder)) {
      return;
    }

    await updateOrderEmailState(orderId, {
      customerOrderConfirmationEmailStatus: EMAIL_STATUS_SENT,
      customerOrderConfirmationEmailError: null,
      customerOrderConfirmationEmailProviderId: sendResult.id,
      customerOrderConfirmationEmailSentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      `Failed to send customer confirmation email for ${order.orderNumber}:`,
      error,
    );
    await markCustomerEmailFailed(orderId, error);
  }
}

async function attemptAdminOrderEmail(
  orderId: string,
  items: OrderEmailItem[],
) {
  let order = await getOrder(orderId);

  if (adminEmailWasSent(order)) {
    return;
  }

  const attemptedAt = new Date().toISOString();
  order = await updateOrderEmailState(orderId, {
    adminOrderNotificationEmailStatus: EMAIL_STATUS_PENDING,
    adminOrderNotificationEmailError: null,
    adminOrderNotificationEmailLastAttemptAt: attemptedAt,
  });

  try {
    const configurationError = getEmailConfigurationError(true);

    if (configurationError) {
      throw new Error(configurationError);
    }

    const sendResult = await sendAdminOrderNotification({
      order: toOrderEmailData(order),
      items,
      apiKey: emailApiKey,
      fromAddress: emailFromAddress,
      adminNotificationEmail,
    });
    const latestOrder = await getOrder(orderId);

    if (adminEmailWasSent(latestOrder)) {
      return;
    }

    await updateOrderEmailState(orderId, {
      adminOrderNotificationEmailStatus: EMAIL_STATUS_SENT,
      adminOrderNotificationEmailError: null,
      adminOrderNotificationEmailProviderId: sendResult.id,
      adminOrderNotificationEmailSentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      `Failed to send admin notification email for ${order.orderNumber}:`,
      error,
    );
    await markAdminEmailFailed(orderId, error);
  }
}

async function notifyPaidOrder(
  orderId: string,
  fallbackOrder: Schema["Order"]["type"],
) {
  try {
    const latestOrder = await getOrder(orderId);

    if (latestOrder.paymentStatus !== "paid") {
      throw new Error("Order must be paid before notification emails are sent.");
    }

    if (latestOrder.customerProfileId && !latestOrder.loyaltySettled) {
      throw new Error(
        "Signed-in order loyalty must be settled before notification emails are sent.",
      );
    }

    const items = toOrderEmailItems(await loadOrderItems(latestOrder));

    await attemptCustomerOrderEmail(orderId, items);
    await attemptAdminOrderEmail(orderId, items);
  } catch (error) {
    console.error(
      `Failed to prepare paid order notification emails for ${fallbackOrder.orderNumber}:`,
      error,
    );
    await markCustomerEmailFailed(orderId, error);
    await markAdminEmailFailed(orderId, error);
  }
}

async function markSessionFailed(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    return undefined;
  }

  const order = await getOrder(orderId);

  if (order.paymentStatus === "paid") {
    return order.id;
  }

  const updateInput = createOrderUpdateInput(order, {
    paymentStatus: "failed",
  });

  const updateResponse = await client.models.Order.update(updateInput);

  if (updateResponse.errors?.length) {
    throw new Error(`Could not mark order ${order.id} as failed.`);
  }

  return order.id;
}

async function markPaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) {
    return undefined;
  }

  const order = await getOrder(orderId);

  if (order.paymentStatus === "paid") {
    return order.id;
  }

  const updateInput = createOrderUpdateInput(order, {
    paymentStatus: "failed",
    stripePaymentIntentId: paymentIntent.id,
  });

  const updateResponse = await client.models.Order.update(updateInput);

  if (updateResponse.errors?.length) {
    throw new Error(`Could not mark order ${order.id} as failed.`);
  }

  return order.id;
}

async function markChargeRefunded(charge: Stripe.Charge) {
  // Loyalty reversal on refunds is deferred and must be handled manually/admin-side until implemented.
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

  const updateResponse = await client.models.Order.update(updateInput);

  if (updateResponse.errors?.length) {
    throw new Error(`Could not mark order ${order.id} as refunded.`);
  }

  return order.id;
}

async function claimEvent(stripeEvent: Stripe.Event) {
  const claimResponse = await client.models.PaymentEvent.create({
    eventId: stripeEvent.id,
    eventType: stripeEvent.type,
    processedAt: new Date().toISOString(),
  });

  if (!claimResponse.errors?.length && claimResponse.data) {
    return true;
  }

  const existingEvent = await client.models.PaymentEvent.get({
    eventId: stripeEvent.id,
  });

  if (existingEvent.data) {
    return false;
  }

  throw new Error(`Could not claim Stripe event ${stripeEvent.id}.`);
}

async function markEventProcessed(
  stripeEvent: Stripe.Event,
  orderId: string | undefined,
) {
  const updateResponse = await client.models.PaymentEvent.update({
    eventId: stripeEvent.id,
    eventType: stripeEvent.type,
    orderId,
    processedAt: new Date().toISOString(),
  });

  if (updateResponse.errors?.length) {
    throw new Error(`Could not record Stripe event ${stripeEvent.id}.`);
  }
}

async function releaseEventClaim(stripeEvent: Stripe.Event) {
  const deleteResponse = await client.models.PaymentEvent.delete({
    eventId: stripeEvent.id,
  });

  if (deleteResponse.errors?.length) {
    console.error(
      `Could not release failed Stripe event ${stripeEvent.id}:`,
      deleteResponse.errors,
    );
  }
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

  let eventClaimed = false;

  try {
    eventClaimed = await claimEvent(stripeEvent);

    if (!eventClaimed) {
      if (stripeEvent.type === "checkout.session.completed") {
        const checkoutSession =
          stripeEvent.data.object as Stripe.Checkout.Session;

        if (checkoutSession.payment_status === "paid") {
          await retryPaidOrderNotifications(checkoutSession);
        }
      }

      return response(200, "Already processed.");
    }

    let orderId: string | undefined;

    if (stripeEvent.type === "checkout.session.completed") {
      const checkoutSession =
        stripeEvent.data.object as Stripe.Checkout.Session;

      orderId =
        checkoutSession.payment_status === "paid"
          ? await markSessionPaid(checkoutSession, true)
          : checkoutSession.metadata?.orderId;
    } else if (
      stripeEvent.type === "checkout.session.async_payment_succeeded"
    ) {
      orderId = await markSessionPaid(
        stripeEvent.data.object as Stripe.Checkout.Session,
        false,
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

    await markEventProcessed(stripeEvent, orderId);
  } catch (error) {
    console.error(`Failed to process Stripe event ${stripeEvent.id}:`, error);

    if (eventClaimed) {
      await releaseEventClaim(stripeEvent);
    }

    return response(500, "Webhook processing failed.");
  }

  return response(200, "Processed.");
};
