import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { createCheckoutSession } from "../functions/create-checkout-session/resource";
import { verifyCheckoutSession } from "../functions/verify-checkout-session/resource";
import { stripeWebhook } from "../functions/stripe-webhook/resource";

const schema = a.schema({
  CheckoutSessionResponse: a.customType({
    checkoutUrl: a.url().required(),
    sessionId: a.string().required(),
  }),

  CheckoutSessionStatus: a.customType({
    orderId: a.id(),
    orderNumber: a.string(),
    paymentStatus: a.string().required(),
    fulfilmentMethod: a.string(),
    totalInPence: a.integer(),
    customerProfileId: a.id(),
    loyaltySettled: a.boolean(),
    stampsEarned: a.integer(),
  }),

  createCheckoutSession: a
    .mutation()
    .arguments({
      items: a.json().required(),
      firstName: a.string().required(),
      lastName: a.string().required(),
      customerEmail: a.string().required(),
      customerPhone: a.string().required(),
      fulfilmentMethod: a.string().required(),
      addressLine1: a.string(),
      addressLine2: a.string(),
      city: a.string(),
      postcode: a.string(),
      customerNotes: a.string(),
      redeemReward: a.boolean().required(),
      origin: a.string().required(),
    })
    .returns(a.ref("CheckoutSessionResponse"))
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(createCheckoutSession)),

  retryCheckoutSession: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      checkoutAccessToken: a.string().required(),
      origin: a.string().required(),
    })
    .returns(a.ref("CheckoutSessionResponse"))
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(createCheckoutSession)),

  verifyCheckoutSession: a
    .query()
    .arguments({
      sessionId: a.string().required(),
    })
    .returns(a.ref("CheckoutSessionStatus"))
    .authorization((allow) => [
      allow.publicApiKey(),
      allow.guest(),
      allow.authenticated(),
    ])
    .handler(a.handler.function(verifyCheckoutSession)),

  Product: a
    .model({
      name: a.string().required(),
      slug: a.string().required(),
      description: a.string(),
      category: a.string().required(),
      merchandisingLabel: a.string(),
      imageKey: a.string(),
      imageAltText: a.string(),
      galleryImageUrls: a.string(),
      videoUrl: a.string(),
      isActive: a.boolean().required(),
      nationwideDelivery: a.boolean().required(),
      manchesterDelivery: a.boolean().required(),
      collectionAvailable: a.boolean().required(),

      variants: a.hasMany("ProductVariant", "productId"),
    })
    .authorization((allow) => [
      allow.guest().to(["read"]),
      allow.authenticated().to(["read"]),
      allow.group("Admin"),
    ]),

  ProductVariant: a
    .model({
      productId: a.id().required(),
      product: a.belongsTo("Product", "productId"),

      name: a.string().required(),
      priceInPence: a.integer().required(),
      isActive: a.boolean().required(),
      stockQuantity: a.integer(),
      sortOrder: a.integer(),
    })
    .authorization((allow) => [
      allow.guest().to(["read"]),
      allow.authenticated().to(["read"]),
      allow.group("Admin"),
    ]),

  Order: a
    .model({
      orderNumber: a.string().required(),
      status: a.string().required(),
      paymentStatus: a.string().required(),

      customerEmail: a.email().required(),
      customerPhone: a.phone().required(),
      firstName: a.string().required(),
      lastName: a.string().required(),
      customerProfileId: a.id(),

      fulfilmentMethod: a.string().required(),
      addressLine1: a.string(),
      addressLine2: a.string(),
      city: a.string(),
      postcode: a.string(),

      customerNotes: a.string(),

      subtotalInPence: a.integer().required(),
      deliveryFeeInPence: a.integer().required(),
      loyaltySpendInPence: a.integer().required(),
      stampsEarned: a.integer().required(),
      rewardDiscountInPence: a.integer().required(),
      totalInPence: a.integer().required(),

      checkoutAccessToken: a.string(),
      stripeCheckoutSessionId: a.string(),
      stripePaymentIntentId: a.string(),
      paidAt: a.datetime(),
      refundedAt: a.datetime(),
      loyaltyProcessedAt: a.datetime(),
      loyaltySettled: a.boolean(),
      customerOrderConfirmationEmailStatus: a.string(),
      customerOrderConfirmationEmailLastAttemptAt: a.datetime(),
      customerOrderConfirmationEmailError: a.string(),
      customerOrderConfirmationEmailProviderId: a.string(),
      customerOrderConfirmationEmailSentAt: a.datetime(),
      adminOrderNotificationEmailStatus: a.string(),
      adminOrderNotificationEmailLastAttemptAt: a.datetime(),
      adminOrderNotificationEmailError: a.string(),
      adminOrderNotificationEmailProviderId: a.string(),
      adminOrderNotificationEmailSentAt: a.datetime(),

      items: a.hasMany("OrderItem", "orderId"),
    })
    .authorization((allow) => [
      allow.owner().to(["read"]),
      allow.group("Admin"),
    ]),

  OrderItem: a
    .model({
      orderId: a.id().required(),
      order: a.belongsTo("Order", "orderId"),

      productId: a.id(),
      variantId: a.id(),

      productName: a.string().required(),
      variantName: a.string().required(),
      unitPriceInPence: a.integer().required(),
      quantity: a.integer().required(),
      lineTotalInPence: a.integer().required(),
    })
    .authorization((allow) => [
      allow.owner().to(["read"]),
      allow.group("Admin"),
    ]),

  PaymentEvent: a
    .model({
      eventId: a.string().required(),
      eventType: a.string().required(),
      orderId: a.id(),
      processedAt: a.datetime().required(),
    })
    .identifier(["eventId"])
    .authorization((allow) => [
      allow.group("Admin").to(["read"]),
    ]),

  CustomerProfile: a
    .model({
      firstName: a.string(),
      lastName: a.string(),
      phone: a.phone(),

      loyaltyStamps: a.integer().required(),
      loyaltyRemainderInPence: a.integer().required(),
      availableRewards: a.integer().required(),
    })
    .authorization((allow) => [
      allow.owner().to(["read"]),
      allow.group("Admin"),
    ]),
}).authorization((allow) => [
  allow.resource(createCheckoutSession).to(["query", "mutate"]),
  allow.resource(verifyCheckoutSession).to(["query"]),
  allow.resource(stripeWebhook).to(["query", "mutate"]),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "identityPool",
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
