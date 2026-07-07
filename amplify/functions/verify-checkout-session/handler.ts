import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import Stripe from "stripe";
import { env } from "$amplify/env/verify-checkout-session";
import type { Schema } from "../../data/resource";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const { resourceConfig, libraryOptions } =
  await getAmplifyDataClientConfig(env);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema["verifyCheckoutSession"]["functionHandler"] =
  async (event) => {
    const { sessionId } = event.arguments;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      throw new Error("Checkout Session is missing order metadata.");
    }

    const orderResponse = await client.models.Order.get({ id: orderId });

    if (orderResponse.errors?.length || !orderResponse.data) {
      throw new Error("Order was not found for this Checkout Session.");
    }

    const order = orderResponse.data;

    if (
      order.stripeCheckoutSessionId &&
      order.stripeCheckoutSessionId !== session.id
    ) {
      throw new Error("Checkout Session does not match this order.");
    }

    if (
      session.currency !== "gbp" ||
      session.amount_total !== order.totalInPence
    ) {
      throw new Error("Checkout Session amount does not match the order.");
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      fulfilmentMethod: order.fulfilmentMethod,
      totalInPence: order.totalInPence,
    };
  };
