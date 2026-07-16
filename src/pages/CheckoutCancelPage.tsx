import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Link, useSearchParams } from "react-router-dom";
import { dataClient } from "../lib/amplifyClient";

type CheckoutAuthMode = "userPool" | "iam";

async function getCheckoutAuthMode(): Promise<CheckoutAuthMode> {
  try {
    const session = await fetchAuthSession();

    if (session.tokens?.accessToken) {
      return "userPool";
    }
  } catch {
    // Guest retries use IAM through the identity pool.
  }

  return "iam";
}

function CheckoutCancelPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const checkoutAccessToken = searchParams.get("access_token");
  const [retryError, setRetryError] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  async function retryPayment() {
    if (!orderId || !checkoutAccessToken || isRetrying) {
      return;
    }

    setIsRetrying(true);
    setRetryError("");

    try {
      const authMode = await getCheckoutAuthMode();
      const response = await dataClient.mutations.retryCheckoutSession(
        {
          orderId,
          checkoutAccessToken,
          origin: window.location.origin,
        },
        {
          authMode,
        },
      );

      if (response.errors?.length || !response.data) {
        throw new Error(
          response.errors?.map((error) => error.message).join(", ") ??
            "Could not restart Stripe Checkout.",
        );
      }

      window.location.assign(response.data.checkoutUrl);
    } catch (error) {
      console.error("Failed to retry Stripe Checkout:", error);
      setRetryError("We could not restart payment. Please try checkout again.");
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <main className="page">
      <section className="order-confirmation">
        <p className="eyebrow">Checkout cancelled</p>
        <h1>Payment was cancelled</h1>
        <p>
          Your order has not been marked as paid. You can retry payment for the
          same pending order, or return to your basket.
        </p>

        {orderId && checkoutAccessToken && (
          <button
            type="button"
            className="primary-button"
            disabled={isRetrying}
            onClick={() => void retryPayment()}
          >
            {isRetrying ? "Restarting..." : "Retry payment"}
          </button>
        )}

        {retryError && (
          <p className="checkout-message checkout-message-error" role="alert">
            {retryError}
          </p>
        )}

        <Link to="/basket" className="secondary-button">
          Back to basket
        </Link>
      </section>
    </main>
  );
}

export default CheckoutCancelPage;
