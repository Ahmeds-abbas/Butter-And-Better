export type OrderEmailItem = {
  productName: string;
  variantName: string;
  unitPriceInPence: number;
  quantity: number;
  lineTotalInPence: number;
};

export type OrderEmailData = {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  customerEmail: string;
  customerPhone: string;
  firstName: string;
  lastName: string;
  customerProfileId?: string | null;
  fulfilmentMethod: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
  customerNotes?: string | null;
  subtotalInPence: number;
  deliveryFeeInPence: number;
  rewardDiscountInPence: number;
  totalInPence: number;
  stampsEarned: number;
};

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type EmailSendConfig = {
  apiKey: string;
  fromAddress: string;
  fetchImpl?: typeof fetch;
};

type CustomerEmailParams = EmailSendConfig & {
  order: OrderEmailData;
  items: OrderEmailItem[];
};

type AdminEmailParams = CustomerEmailParams & {
  adminNotificationEmail: string;
};

export type EmailSendResult = {
  id: string;
};

const emailApiUrl = "https://api.resend.com/emails";

function assertPence(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer in pence.`);
  }
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatCurrency(valueInPence: number) {
  assertPence(valueInPence, "Currency value");

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(valueInPence / 100);
}

function formatFulfilmentMethod(value: string) {
  return value === "collection" ? "Pickup" : "UK tracked delivery";
}

function formatAddress(order: OrderEmailData) {
  return [
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.postcode,
  ].filter((line): line is string => Boolean(line));
}

function validateMoney(order: OrderEmailData, items: OrderEmailItem[]) {
  assertPence(order.subtotalInPence, "Subtotal");
  assertPence(order.deliveryFeeInPence, "Delivery fee");
  assertPence(order.rewardDiscountInPence, "Discount");
  assertPence(order.totalInPence, "Total");

  for (const item of items) {
    assertPence(item.unitPriceInPence, "Item unit price");
    assertPence(item.lineTotalInPence, "Item line total");

    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Item quantity must be a positive integer.");
    }
  }
}

function buildItemsText(items: OrderEmailItem[]) {
  return items
    .map(
      (item) =>
        `- ${item.quantity} x ${item.productName} (${item.variantName}) - ${formatCurrency(
          item.lineTotalInPence,
        )}`,
    )
    .join("\n");
}

function buildItemsHtml(items: OrderEmailItem[]) {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #ebe6df;">
            <strong>${item.quantity} x ${escapeHtml(item.productName)}</strong><br />
            <span style="color:#76634f;">${escapeHtml(item.variantName)}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #ebe6df;text-align:right;white-space:nowrap;">
            ${formatCurrency(item.lineTotalInPence)}
          </td>
        </tr>`,
    )
    .join("");
}

function buildSummaryHtml(order: OrderEmailData) {
  const discount =
    order.rewardDiscountInPence > 0
      ? `-${formatCurrency(order.rewardDiscountInPence)}`
      : formatCurrency(0);

  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px;">
      <tr><td style="padding:5px 0;">Subtotal</td><td style="padding:5px 0;text-align:right;">${formatCurrency(order.subtotalInPence)}</td></tr>
      <tr><td style="padding:5px 0;">Delivery fee</td><td style="padding:5px 0;text-align:right;">${formatCurrency(order.deliveryFeeInPence)}</td></tr>
      <tr><td style="padding:5px 0;">Discount</td><td style="padding:5px 0;text-align:right;">${discount}</td></tr>
      <tr><td style="padding:10px 0 0;font-size:18px;font-weight:700;">Total paid</td><td style="padding:10px 0 0;text-align:right;font-size:18px;font-weight:700;">${formatCurrency(order.totalInPence)}</td></tr>
    </table>`;
}

function buildEmailHtml(title: string, body: string) {
  return `<!doctype html>
  <html lang="en">
    <body style="margin:0;padding:0;background:#F2F0EC;color:#573615;font-family:Arial,sans-serif;">
      <div style="padding:28px 16px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #ddd4ca;border-radius:8px;overflow:hidden;">
          <div style="padding:18px 24px;background:#738561;color:#ffffff;">
            <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Butter &amp; Better</p>
          </div>
          <div style="padding:24px;">
            <h1 style="margin:0 0 18px;color:#573615;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1>
            ${body}
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

export function buildCustomerOrderConfirmation(
  order: OrderEmailData,
  items: OrderEmailItem[],
): EmailMessage {
  validateMoney(order, items);
  const fulfilmentMethod = formatFulfilmentMethod(order.fulfilmentMethod);
  const addressLines = formatAddress(order);
  const pickupNote =
    order.fulfilmentMethod === "collection"
      ? "Pickup details will be confirmed by Butter & Better after payment confirmation."
      : "";
  const loyaltyNote = order.customerProfileId
    ? `${order.stampsEarned} loyalty stamp${order.stampsEarned === 1 ? "" : "s"} earned.`
    : "Guest orders do not earn loyalty stamps.";
  const text = [
    `Hi ${order.firstName},`,
    "",
    `Payment for order ${order.orderNumber} is confirmed.`,
    "",
    "Items:",
    buildItemsText(items),
    "",
    `Subtotal: ${formatCurrency(order.subtotalInPence)}`,
    `Delivery fee: ${formatCurrency(order.deliveryFeeInPence)}`,
    `Discount: ${formatCurrency(order.rewardDiscountInPence)}`,
    `Total paid: ${formatCurrency(order.totalInPence)}`,
    `Fulfilment: ${fulfilmentMethod}`,
    ...(addressLines.length ? ["Address:", ...addressLines] : []),
    loyaltyNote,
    pickupNote,
  ]
    .filter(Boolean)
    .join("\n");
  const html = buildEmailHtml(
    `Order ${order.orderNumber} confirmed`,
    `
      <p>Hi ${escapeHtml(order.firstName)},</p>
      <p>Thank you. Your payment has been confirmed.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px;">${buildItemsHtml(items)}</table>
      ${buildSummaryHtml(order)}
      <div style="margin-top:22px;padding:16px;background:#F2F0EC;border-radius:6px;">
        <p style="margin:0 0 8px;"><strong>Fulfilment:</strong> ${escapeHtml(fulfilmentMethod)}</p>
        ${
          addressLines.length
            ? `<p style="margin:0;"><strong>Address:</strong><br />${addressLines
                .map((line) => escapeHtml(line))
                .join("<br />")}</p>`
            : ""
        }
        ${pickupNote ? `<p style="margin:8px 0 0;">${escapeHtml(pickupNote)}</p>` : ""}
      </div>
      <p style="margin:18px 0 0;color:#738561;font-weight:700;">${escapeHtml(loyaltyNote)}</p>
    `,
  );

  return {
    to: order.customerEmail,
    subject: sanitizeHeaderValue(
      `Butter & Better order ${order.orderNumber} confirmed`,
    ),
    text,
    html,
  };
}

export function buildAdminOrderNotification(
  order: OrderEmailData,
  items: OrderEmailItem[],
  adminNotificationEmail: string,
): EmailMessage {
  validateMoney(order, items);
  const fulfilmentMethod = formatFulfilmentMethod(order.fulfilmentMethod);
  const addressLines = formatAddress(order);
  const notes = order.customerNotes?.trim();
  const text = [
    `Paid order received: ${order.orderNumber}`,
    "",
    `Customer: ${order.firstName} ${order.lastName}`,
    `Email: ${order.customerEmail}`,
    `Phone: ${order.customerPhone}`,
    `Account: ${order.customerProfileId ? "Signed in" : "Guest"}`,
    "",
    "Items:",
    buildItemsText(items),
    "",
    `Subtotal: ${formatCurrency(order.subtotalInPence)}`,
    `Delivery fee: ${formatCurrency(order.deliveryFeeInPence)}`,
    `Discount: ${formatCurrency(order.rewardDiscountInPence)}`,
    `Total paid: ${formatCurrency(order.totalInPence)}`,
    `Fulfilment: ${fulfilmentMethod}`,
    ...(order.fulfilmentMethod === "collection"
      ? ["Pickup order. No delivery address required."]
      : ["Delivery address:", ...addressLines]),
    `Payment status: ${order.paymentStatus}`,
    `Loyalty stamps earned: ${order.stampsEarned}`,
    ...(notes ? [`Customer notes: ${notes}`] : []),
  ].join("\n");
  const html = buildEmailHtml(
    `New paid order ${order.orderNumber}`,
    `
      <p><strong>Customer:</strong> ${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(order.customerEmail)}<br />
      <strong>Phone:</strong> ${escapeHtml(order.customerPhone)}<br />
      <strong>Account:</strong> ${order.customerProfileId ? "Signed in" : "Guest"}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px;">${buildItemsHtml(items)}</table>
      ${buildSummaryHtml(order)}
      <div style="margin-top:22px;padding:16px;background:#F2F0EC;border-radius:6px;">
        <p style="margin:0 0 8px;"><strong>Fulfilment:</strong> ${escapeHtml(fulfilmentMethod)}</p>
        ${
          order.fulfilmentMethod === "collection"
            ? "<p style=\"margin:0;\">Pickup order. No delivery address required.</p>"
            : `<p style="margin:0;"><strong>Delivery address:</strong><br />${addressLines
                .map((line) => escapeHtml(line))
                .join("<br />")}</p>`
        }
      </div>
      <p><strong>Payment status:</strong> ${escapeHtml(order.paymentStatus)}<br />
      <strong>Loyalty stamps earned:</strong> ${order.stampsEarned}</p>
      ${notes ? `<p><strong>Customer notes:</strong><br />${escapeHtml(notes)}</p>` : ""}
    `,
  );

  return {
    to: adminNotificationEmail,
    subject: sanitizeHeaderValue(
      `Paid Butter & Better order ${order.orderNumber}`,
    ),
    text,
    html,
  };
}

async function sendEmail(
  message: EmailMessage,
  config: EmailSendConfig,
  idempotencyKey: string,
): Promise<EmailSendResult> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(emailApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: config.fromAddress,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Resend returned ${response.status}: ${responseText.slice(0, 500)}`,
    );
  }

  const result = (await response.json()) as { id?: unknown };

  if (typeof result.id !== "string" || !result.id) {
    throw new Error("Resend did not return an email ID.");
  }

  return { id: result.id };
}

export async function sendCustomerOrderConfirmation({
  order,
  items,
  apiKey,
  fromAddress,
  fetchImpl,
}: CustomerEmailParams) {
  return sendEmail(
    buildCustomerOrderConfirmation(order, items),
    { apiKey, fromAddress, fetchImpl },
    `customer-order-confirmation/${order.id}`,
  );
}

export async function sendAdminOrderNotification({
  order,
  items,
  apiKey,
  fromAddress,
  adminNotificationEmail,
  fetchImpl,
}: AdminEmailParams) {
  return sendEmail(
    buildAdminOrderNotification(order, items, adminNotificationEmail),
    { apiKey, fromAddress, fetchImpl },
    `admin-order-notification/${order.id}`,
  );
}
