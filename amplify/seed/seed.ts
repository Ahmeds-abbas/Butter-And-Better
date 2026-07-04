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

async function seed() {
  await signInSeedAdmin();

  try {
    for (const product of products) {
      await upsertProduct(product);
    }

    console.log(`Seeded ${products.length} products.`);
  } finally {
    await signOut();
  }
}

await seed();
