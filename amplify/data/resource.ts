import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Product: a
    .model({
      name: a.string().required(),
      slug: a.string().required(),
      description: a.string(),
      category: a.string().required(),
      imageKey: a.string(),
      isActive: a.boolean().required(),
      nationwideDelivery: a.boolean().required(),
      manchesterDelivery: a.boolean().required(),
      collectionAvailable: a.boolean().required(),

      variants: a.hasMany('ProductVariant', 'productId'),
    })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
      allow.group('Admin'),
    ]),

  ProductVariant: a
    .model({
      productId: a.id().required(),
      product: a.belongsTo('Product', 'productId'),

      name: a.string().required(),
      priceInPence: a.integer().required(),
      isActive: a.boolean().required(),
      stockQuantity: a.integer(),
      sortOrder: a.integer(),
    })
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
      allow.group('Admin'),
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

      fulfilmentMethod: a.string().required(),
      addressLine1: a.string(),
      addressLine2: a.string(),
      city: a.string(),
      postcode: a.string(),

      customerNotes: a.string(),

      subtotalInPence: a.integer().required(),
      deliveryFeeInPence: a.integer().required(),
      totalInPence: a.integer().required(),

      stripePaymentIntentId: a.string(),

      items: a.hasMany('OrderItem', 'orderId'),
    })
    .authorization((allow) => [
      allow.guest().to(['create']),
      allow.owner().to(['create', 'read']),
      allow.group('Admin'),
    ]),

  OrderItem: a
    .model({
      orderId: a.id().required(),
      order: a.belongsTo('Order', 'orderId'),

      productId: a.id(),
      variantId: a.id(),

      productName: a.string().required(),
      variantName: a.string().required(),
      unitPriceInPence: a.integer().required(),
      quantity: a.integer().required(),
      lineTotalInPence: a.integer().required(),
    })
    .authorization((allow) => [
      allow.guest().to(['create']),
      allow.owner().to(['create', 'read']),
      allow.group('Admin'),
    ]),

  CustomerProfile: a
    .model({
      firstName: a.string(),
      lastName: a.string(),
      phone: a.phone(),
      loyaltyPoints: a.integer().required(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.group('Admin'),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
});