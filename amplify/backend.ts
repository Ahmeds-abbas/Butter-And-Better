import { defineBackend } from "@aws-amplify/backend";
import { FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { createCheckoutSession } from "./functions/create-checkout-session/resource";
import { stripeWebhook } from "./functions/stripe-webhook/resource";
import { verifyCheckoutSession } from "./functions/verify-checkout-session/resource";
import { storage } from "./storage/resource";

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  createCheckoutSession,
  data,
  stripeWebhook,
  storage,
  verifyCheckoutSession,
});

const stripeWebhookUrl = backend.stripeWebhook.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

backend.addOutput({
  custom: {
    stripeWebhookUrl: stripeWebhookUrl.url,
  },
});
