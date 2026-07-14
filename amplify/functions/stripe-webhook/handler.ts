import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import Stripe from "stripe";
import { env } from "$amplify/env/stripe-webhook";
import type { Schema } from "../../data/resource";
import { calculateLoyaltySettlement } from "../../../src/lib/loyalty";

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

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const emailApiUrl = "https://api.resend.com/emails";
const emailApiKey = env.EMAIL_API_KEY;
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
    customerOrderConfirmationEmailSentAt:
      changes.customerOrderConfirmationEmailSentAt ??
      order.customerOrderConfirmationEmailSentAt,
    adminOrderNotificationEmailSentAt:
      changes.adminOrderNotificationEmailSentAt ??
      order.adminOrderNotificationEmailSentAt,
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
    const settledOrder = await settleLoyaltyForPaidOrder(order);
    await notifyPaidOrder(order.id, settledOrder);
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

  const settledOrder = await settleLoyaltyForPaidOrder(
    updateResponse.data ?? order,
  );
  await notifyPaidOrder(order.id, settledOrder);

  return order.id;
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

function formatCurrency(valueInPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(valueInPence / 100);
}

function formatFulfilmentMethod(value: string) {
  return value === "collection" ? "Pickup" : "UK tracked delivery";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAddress(order: Schema["Order"]["type"]) {
  return [
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.postcode,
  ].filter(Boolean);
}

function buildItemsText(items: OrderItemRecord[]) {
  return items
    .map(
      (item) =>
        `- ${item.quantity} x ${item.productName} (${item.variantName}) - ${formatCurrency(
          item.lineTotalInPence,
        )}`,
    )
    .join("\n");
}

function buildItemsHtml(items: OrderItemRecord[]) {
  return items
    .map(
      (item) =>
        `<li><strong>${item.quantity} x ${escapeHtml(
          item.productName,
        )}</strong><br /><span>${escapeHtml(
          item.variantName,
        )} - ${formatCurrency(item.lineTotalInPence)}</span></li>`,
    )
    .join("");
}

function buildEmailHtml(title: string, body: string) {
  return `
    <div style="margin:0;padding:24px;background:#F2F0EC;color:#573615;font-family:Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid rgba(87,54,21,0.12);">
        <p style="margin:0 0 8px;color:#738561;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Butter &amp; Better</p>
        <h1 style="margin:0 0 18px;color:#573615;">${escapeHtml(title)}</h1>
        ${body}
      </div>
    </div>
  `;
}

function buildCustomerEmail(
  order: Schema["Order"]["type"],
  items: OrderItemRecord[],
): EmailMessage {
  const fulfilmentMethod = formatFulfilmentMethod(order.fulfilmentMethod);
  const pickupNote =
    order.fulfilmentMethod === "collection"
      ? "Pickup details will be shared after your order is confirmed by Butter & Better."
      : "";
  const loyaltyNote = order.customerProfileId
    ? `Loyalty: ${order.stampsEarned} stamp${
        order.stampsEarned === 1 ? "" : "s"
      } earned from this paid order.`
    : "Loyalty: guest orders do not earn stamps.";
  const text = [
    `Thanks for your Butter & Better order ${order.orderNumber}.`,
    "",
    "Items:",
    buildItemsText(items),
    "",
    `Fulfilment: ${fulfilmentMethod}`,
    `Delivery fee: ${formatCurrency(order.deliveryFeeInPence)}`,
    `Total paid: ${formatCurrency(order.totalInPence)}`,
    loyaltyNote,
    pickupNote,
  ]
    .filter(Boolean)
    .join("\n");
  const html = buildEmailHtml(
    `Order ${order.orderNumber} confirmed`,
    `
      <p>Thanks for your order. Payment has been confirmed.</p>
      <h2 style="color:#573615;">Items</h2>
      <ul>${buildItemsHtml(items)}</ul>
      <p><strong>Fulfilment:</strong> ${escapeHtml(fulfilmentMethod)}</p>
      <p><strong>Delivery fee:</strong> ${formatCurrency(
        order.deliveryFeeInPence,
      )}</p>
      <p><strong>Total paid:</strong> ${formatCurrency(order.totalInPence)}</p>
      <p>${escapeHtml(loyaltyNote)}</p>
      ${
        pickupNote
          ? `<p style="color:#738561;"><strong>${escapeHtml(pickupNote)}</strong></p>`
          : ""
      }
    `,
  );

  return {
    to: order.customerEmail,
    subject: `Butter & Better order ${order.orderNumber} confirmed`,
    text,
    html,
  };
}

function buildAdminEmail(
  order: Schema["Order"]["type"],
  items: OrderItemRecord[],
): EmailMessage {
  const fulfilmentMethod = formatFulfilmentMethod(order.fulfilmentMethod);
  const addressLines = formatAddress(order);
  const fulfilmentDetails =
    order.fulfilmentMethod === "collection"
      ? "Pickup order. No delivery address needed."
      : `Delivery address:\n${addressLines.join("\n")}`;
  const text = [
    `Paid order received: ${order.orderNumber}`,
    "",
    `Customer: ${order.firstName} ${order.lastName}`,
    `Email: ${order.customerEmail}`,
    `Phone: ${order.customerPhone}`,
    "",
    "Items:",
    buildItemsText(items),
    "",
    `Fulfilment: ${fulfilmentMethod}`,
    fulfilmentDetails,
    `Payment status: ${order.paymentStatus}`,
    `Total paid: ${formatCurrency(order.totalInPence)}`,
  ].join("\n");
  const html = buildEmailHtml(
    `Paid order ${order.orderNumber}`,
    `
      <p><strong>Customer:</strong> ${escapeHtml(order.firstName)} ${escapeHtml(
        order.lastName,
      )}</p>
      <p><strong>Email:</strong> ${escapeHtml(order.customerEmail)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(order.customerPhone)}</p>
      <h2 style="color:#573615;">Items</h2>
      <ul>${buildItemsHtml(items)}</ul>
      <p><strong>Fulfilment:</strong> ${escapeHtml(fulfilmentMethod)}</p>
      ${
        order.fulfilmentMethod === "collection"
          ? "<p>Pickup order. No delivery address needed.</p>"
          : `<p><strong>Delivery address:</strong><br />${addressLines
              .map((line) => escapeHtml(String(line)))
              .join("<br />")}</p>`
      }
      <p><strong>Payment status:</strong> ${escapeHtml(order.paymentStatus)}</p>
      <p><strong>Total paid:</strong> ${formatCurrency(order.totalInPence)}</p>
    `,
  );

  return {
    to: adminNotificationEmail,
    subject: `Paid Butter & Better order ${order.orderNumber}`,
    text,
    html,
  };
}

async function sendEmail(message: EmailMessage) {
  const response = await fetch(emailApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${emailApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFromAddress,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Email API returned ${response.status}: ${responseText.slice(0, 500)}`,
    );
  }
}

async function notifyPaidOrder(
  orderId: string,
  fallbackOrder: Schema["Order"]["type"],
) {
  if (!emailApiKey || !emailFromAddress || !adminNotificationEmail) {
    console.warn(
      "Order notification email secrets are not configured; skipping email send.",
    );
    return;
  }

  try {
    const latestOrder = await getOrder(orderId);
    const items = await loadOrderItems(latestOrder);

    if (!latestOrder.customerOrderConfirmationEmailSentAt) {
      try {
        await sendEmail(buildCustomerEmail(latestOrder, items));
        const customerEmailUpdate = createOrderUpdateInput(latestOrder, {
          customerOrderConfirmationEmailSentAt: new Date().toISOString(),
        });

        const customerEmailUpdateResponse =
          await client.models.Order.update(customerEmailUpdate);

        if (customerEmailUpdateResponse.errors?.length) {
          throw new Error("Could not record the customer email notification.");
        }
      } catch (error) {
        console.error(
          `Failed to send customer confirmation email for ${latestOrder.orderNumber}:`,
          error,
        );
      }
    }

    const orderForAdminEmail = await getOrder(orderId);

    if (!orderForAdminEmail.adminOrderNotificationEmailSentAt) {
      try {
        await sendEmail(buildAdminEmail(orderForAdminEmail, items));
        const adminEmailUpdate = createOrderUpdateInput(orderForAdminEmail, {
          adminOrderNotificationEmailSentAt: new Date().toISOString(),
        });

        const adminEmailUpdateResponse =
          await client.models.Order.update(adminEmailUpdate);

        if (adminEmailUpdateResponse.errors?.length) {
          throw new Error("Could not record the admin email notification.");
        }
      } catch (error) {
        console.error(
          `Failed to send admin notification email for ${orderForAdminEmail.orderNumber}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error(
      `Failed to prepare paid order notification emails for ${fallbackOrder.orderNumber}:`,
      error,
    );
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
      return response(200, "Already processed.");
    }

    let orderId: string | undefined;

    if (stripeEvent.type === "checkout.session.completed") {
      const checkoutSession =
        stripeEvent.data.object as Stripe.Checkout.Session;

      orderId =
        checkoutSession.payment_status === "paid"
          ? await markSessionPaid(checkoutSession)
          : checkoutSession.metadata?.orderId;
    } else if (
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
