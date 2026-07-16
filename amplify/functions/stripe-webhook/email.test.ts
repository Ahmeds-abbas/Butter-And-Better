import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminOrderNotification,
  buildCustomerOrderConfirmation,
  sendAdminOrderNotification,
  sendCustomerOrderConfirmation,
  type OrderEmailData,
  type OrderEmailItem,
} from "./email";

const order: OrderEmailData = {
  id: "order-123",
  orderNumber: "BB-123",
  paymentStatus: "paid",
  customerEmail: "customer@example.com",
  customerPhone: "+447700900123",
  firstName: "Sarah <script>alert('x')</script>",
  lastName: "Zain",
  customerProfileId: "profile-123",
  fulfilmentMethod: "delivery",
  addressLine1: "1 <Bakery> Street",
  addressLine2: null,
  city: "Manchester",
  postcode: "M1 1AA",
  customerNotes: "Please ring & wait <outside>.",
  subtotalInPence: 1200,
  deliveryFeeInPence: 299,
  rewardDiscountInPence: 500,
  totalInPence: 999,
  stampsEarned: 1,
};

const items: OrderEmailItem[] = [
  {
    productName: "Brownie <Box>",
    variantName: "Box of 6 & ribbon",
    unitPriceInPence: 1200,
    quantity: 1,
    lineTotalInPence: 1200,
  },
];

test("customer email contains the paid-order details and escapes HTML", () => {
  const message = buildCustomerOrderConfirmation(order, items);

  assert.match(message.text, /Subtotal:.*12\.00/);
  assert.match(message.text, /Delivery fee:.*2\.99/);
  assert.match(message.text, /Discount:.*5\.00/);
  assert.match(message.text, /Total paid:.*9\.99/);
  assert.match(message.text, /UK tracked delivery/);
  assert.match(message.text, /1 loyalty stamp earned/);
  assert.match(message.html, /Sarah &lt;script&gt;/);
  assert.match(message.html, /Brownie &lt;Box&gt;/);
  assert.doesNotMatch(message.html, /<script>/);
});

test("admin email contains customer, address, notes, and payment details", () => {
  const message = buildAdminOrderNotification(
    order,
    items,
    "butterandbetterbakery@gmail.com",
  );

  assert.equal(message.to, "butterandbetterbakery@gmail.com");
  assert.match(message.text, /customer@example\.com/);
  assert.match(message.text, /\+447700900123/);
  assert.match(message.text, /1 <Bakery> Street/);
  assert.match(message.text, /Payment status: paid/);
  assert.match(message.html, /Please ring &amp; wait &lt;outside&gt;\./);
  assert.doesNotMatch(message.html, /Please ring & wait <outside>/);
});

test("Resend requests use the configured sender and stable idempotency keys", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify({ id: `email-${requests.length}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const config = {
    order,
    items,
    apiKey: "re_test_key",
    fromAddress: "Butter & Better <orders@butterandbetter.co.uk>",
    fetchImpl,
  };

  const customerResult = await sendCustomerOrderConfirmation(config);
  const adminResult = await sendAdminOrderNotification({
    ...config,
    adminNotificationEmail: "butterandbetterbakery@gmail.com",
  });

  assert.equal(customerResult.id, "email-1");
  assert.equal(adminResult.id, "email-2");
  assert.equal(requests[0].url, "https://api.resend.com/emails");
  assert.equal(
    new Headers(requests[0].init.headers).get("Idempotency-Key"),
    "customer-order-confirmation/order-123",
  );
  assert.equal(
    new Headers(requests[1].init.headers).get("Idempotency-Key"),
    "admin-order-notification/order-123",
  );
  const customerBody = JSON.parse(String(requests[0].init.body)) as {
    from: string;
  };
  assert.equal(
    customerBody.from,
    "Butter & Better <orders@butterandbetter.co.uk>",
  );
});
