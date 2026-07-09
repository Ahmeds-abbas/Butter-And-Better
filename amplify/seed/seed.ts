import { readFile } from "node:fs/promises";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { Amplify } from "aws-amplify";
import { signIn, signOut } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { getSecret } from "@aws-amplify/seed";

import { products } from "../../src/data/products";
import type { Schema } from "../data/resource";

const outputsUrl = new URL("../../amplify_outputs.json", import.meta.url);

const outputs = JSON.parse(
  await readFile(outputsUrl, { encoding: "utf8" }),
) as {
  auth: {
    aws_region: string;
    user_pool_id: string;
  };
};

Amplify.configure(outputs);

const client = generateClient<Schema>();
const cognitoClient = new CognitoIdentityProviderClient({
  region: outputs.auth.aws_region,
});

const asPence = (price: number) => Math.round(price * 100);

type SeedOrderItem = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
};

type SeedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customerEmail: string;
  customerPhone: string;
  firstName: string;
  lastName: string;
  fulfilmentMethod: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  customerNotes?: string;
  deliveryFeeInPence: number;
  loyaltySpendInPence: number;
  stampsEarned: number;
  rewardDiscountInPence: number;
  stripePaymentIntentId?: string;
  items: SeedOrderItem[];
};

const testOrders: SeedOrder[] = [
  {
    id: "seed-order-nationwide-paid",
    orderNumber: "BB-TEST-1001",
    status: "confirmed",
    paymentStatus: "paid",
    customerEmail: "nationwide.test@example.com",
    customerPhone: "+442079460101",
    firstName: "Nadia",
    lastName: "Nationwide",
    fulfilmentMethod: "nationwide",
    addressLine1: "10 Baker Street",
    city: "Leeds",
    postcode: "LS1 1AA",
    customerNotes: "Please leave with reception.",
    deliveryFeeInPence: 299,
    loyaltySpendInPence: 1200,
    stampsEarned: 1,
    rewardDiscountInPence: 0,
    stripePaymentIntentId: "pi_test_butter_nationwide",
    items: [
      {
        id: "seed-order-nationwide-paid-item-cookies",
        productId: "cookies",
        variantId: "cookies-flavoured-5",
        quantity: 1,
      },
      {
        id: "seed-order-nationwide-paid-item-brownies",
        productId: "brownies",
        variantId: "brownies-original-3",
        quantity: 2,
      },
    ],
  },
  {
    id: "seed-order-reward-paid",
    orderNumber: "BB-TEST-1002",
    status: "preparing",
    paymentStatus: "paid",
    customerEmail: "reward.test@example.com",
    customerPhone: "+442079460102",
    firstName: "Raya",
    lastName: "Reward",
    fulfilmentMethod: "nationwide",
    addressLine1: "42 Station Road",
    addressLine2: "Flat 4",
    city: "Bristol",
    postcode: "BS1 4ST",
    customerNotes: "Tracked delivery please.",
    deliveryFeeInPence: 299,
    loyaltySpendInPence: 900,
    stampsEarned: 1,
    rewardDiscountInPence: 500,
    stripePaymentIntentId: "pi_test_butter_reward",
    items: [
      {
        id: "seed-order-reward-paid-item-cookies",
        productId: "cookies",
        variantId: "cookies-flavoured-5",
        quantity: 1,
      },
      {
        id: "seed-order-reward-paid-item-brookies",
        productId: "oreo-brookies",
        variantId: "oreo-brookies-3",
        quantity: 1,
      },
    ],
  },
  {
    id: "seed-order-collection-pending",
    orderNumber: "BB-TEST-1003",
    status: "pending",
    paymentStatus: "pending",
    customerEmail: "collection.test@example.com",
    customerPhone: "+442079460103",
    firstName: "Colin",
    lastName: "Collection",
    fulfilmentMethod: "collection",
    customerNotes: "Collecting Saturday morning.",
    deliveryFeeInPence: 0,
    loyaltySpendInPence: 600,
    stampsEarned: 0,
    rewardDiscountInPence: 0,
    items: [
      {
        id: "seed-order-collection-pending-item-blondies",
        productId: "blondies",
        variantId: "blondies-3",
        quantity: 1,
      },
    ],
  },
];

async function ensureSeedAdmin(username: string, password: string) {
  try {
    await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: outputs.auth.user_pool_id,
        Username: username,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: username },
          { Name: "email_verified", Value: "true" },
        ],
      }),
    );
  } catch (error) {
    if ((error as Error).name !== "UsernameExistsException") {
      throw error;
    }
  }

  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: outputs.auth.user_pool_id,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );

  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: outputs.auth.user_pool_id,
      Username: username,
      GroupName: "Admin",
    }),
  );
}

async function signInSeedAdmin() {
  const username = await getSecret("seedUsername");
  const password = await getSecret("seedPassword");

  await ensureSeedAdmin(username, password);
  await signOut().catch(() => undefined);

  const signInResult = await signIn({
    username,
    password,
  });

  if (!signInResult.isSignedIn) {
    throw new Error(`Could not sign in seed admin user ${username}`);
  }
}

async function upsertProduct(product: (typeof products)[number]) {
  const input = {
    id: product.id,
    name: product.name,
    slug: product.id,
    description: product.description,
    category: product.category,
    imageKey: product.imageUrl,
    imageAltText: product.imageAltText,
    galleryImageUrls: product.galleryImageUrls.join("\n"),
    videoUrl: product.videoUrl,
    isActive: product.available,
    nationwideDelivery: product.deliveryOptions.nationwide,
    manchesterDelivery: product.deliveryOptions.manchester,
    collectionAvailable: product.deliveryOptions.collection,
  };

  const existing = await client.models.Product.get(
    { id: product.id },
    { authMode: "userPool" },
  );

  const result = existing.data
    ? await client.models.Product.update(input, {
        authMode: "userPool",
      })
    : await client.models.Product.create(input, {
        authMode: "userPool",
      });

  if (result.errors?.length || !result.data) {
    throw new Error(
      `Failed to seed product ${product.id}: ${JSON.stringify(result.errors)}`,
    );
  }

  for (const [index, variant] of product.variants.entries()) {
    const variantInput = {
      id: variant.id,
      productId: product.id,
      name: variant.name,
      priceInPence: asPence(variant.price),
      isActive: true,
      sortOrder: index + 1,
    };

    const existingVariant = await client.models.ProductVariant.get(
      { id: variant.id },
      { authMode: "userPool" },
    );

    const variantResult = existingVariant.data
      ? await client.models.ProductVariant.update(variantInput, {
          authMode: "userPool",
        })
      : await client.models.ProductVariant.create(variantInput, {
          authMode: "userPool",
        });

    if (variantResult.errors?.length) {
      throw new Error(
        `Failed to seed variant ${variant.id}: ${JSON.stringify(
          variantResult.errors,
        )}`,
      );
    }
  }
}

function getSeedOrderItemSnapshot(seedItem: SeedOrderItem) {
  const product = products.find(
    (currentProduct) => currentProduct.id === seedItem.productId,
  );
  const variant = product?.variants.find(
    (currentVariant) => currentVariant.id === seedItem.variantId,
  );

  if (!product || !variant) {
    throw new Error(
      `Could not find product snapshot for ${seedItem.productId}/${seedItem.variantId}`,
    );
  }

  const unitPriceInPence = asPence(variant.price);

  return {
    productName: product.name,
    variantName: variant.name,
    unitPriceInPence,
    lineTotalInPence: unitPriceInPence * seedItem.quantity,
  };
}

async function upsertOrder(order: SeedOrder) {
  const orderItems = order.items.map((item) => ({
    ...item,
    ...getSeedOrderItemSnapshot(item),
  }));
  const subtotalInPence = orderItems.reduce(
    (total, item) => total + item.lineTotalInPence,
    0,
  );
  const totalInPence =
    subtotalInPence + order.deliveryFeeInPence - order.rewardDiscountInPence;

  const orderInput = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
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
    subtotalInPence,
    deliveryFeeInPence: order.deliveryFeeInPence,
    loyaltySpendInPence: order.loyaltySpendInPence,
    stampsEarned: order.stampsEarned,
    rewardDiscountInPence: order.rewardDiscountInPence,
    totalInPence,
    stripePaymentIntentId: order.stripePaymentIntentId,
  };

  const existing = await client.models.Order.get(
    { id: order.id },
    { authMode: "userPool" },
  );

  const result = existing.data
    ? await client.models.Order.update(orderInput, {
        authMode: "userPool",
      })
    : await client.models.Order.create(orderInput, {
        authMode: "userPool",
      });

  if (result.errors?.length || !result.data) {
    throw new Error(
      `Failed to seed order ${order.id}: ${JSON.stringify(result.errors)}`,
    );
  }

  for (const item of orderItems) {
    const itemInput = {
      id: item.id,
      orderId: order.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      unitPriceInPence: item.unitPriceInPence,
      quantity: item.quantity,
      lineTotalInPence: item.lineTotalInPence,
    };

    const existingItem = await client.models.OrderItem.get(
      { id: item.id },
      { authMode: "userPool" },
    );

    const itemResult = existingItem.data
      ? await client.models.OrderItem.update(itemInput, {
          authMode: "userPool",
        })
      : await client.models.OrderItem.create(itemInput, {
          authMode: "userPool",
        });

    if (itemResult.errors?.length) {
      throw new Error(
        `Failed to seed order item ${item.id}: ${JSON.stringify(
          itemResult.errors,
        )}`,
      );
    }
  }
}

async function seed() {
  await signInSeedAdmin();

  try {
    for (const product of products) {
      await upsertProduct(product);
    }

    for (const order of testOrders) {
      await upsertOrder(order);
    }

    console.log(`Seeded ${products.length} products.`);
    console.log(`Seeded ${testOrders.length} test orders.`);
  } finally {
    await signOut();
  }
}

await seed();
