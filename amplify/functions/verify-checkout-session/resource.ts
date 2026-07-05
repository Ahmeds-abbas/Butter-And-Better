import { defineFunction, secret } from "@aws-amplify/backend";

export const verifyCheckoutSession = defineFunction({
  name: "verify-checkout-session",
  timeoutSeconds: 15,
  environment: {
    STRIPE_SECRET_KEY: secret("STRIPE_SECRET_KEY"),
  },
});
