import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { dataClient } from "../lib/amplifyClient";
import { formatCurrencyFromPence } from "../lib/checkoutCalculations";

type CheckoutSessionStatus = {
  orderId?: string | null;
  orderNumber?: string | null;
  paymentStatus?: string | null;
  fulfilmentMethod?: string | null;
  totalInPence?: number | null;
  customerProfileId?: string | null;
  loyaltySettled?: boolean | null;
  stampsEarned?: number | null;
};

const fulfilmentLabels: Record<string, string> = {
  nationwide: "Nationwide delivery",
  manchester: "Manchester same-day",
  collection: "Collection",
};

function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [sessionStatus, setSessionStatus] =
    useState<CheckoutSessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function verifySession() {
      if (!sessionId) {
        setLoadError("Stripe Checkout did not return a session ID.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await dataClient.queries.verifyCheckoutSession(
          { sessionId },
          { authMode: "apiKey" },
        );

        if (response.errors?.length || !response.data) {
          throw new Error(
            response.errors?.map((error) => error.message).join(", ") ??
              "Could not verify the Checkout Session.",
          );
        }

        if (!isCancelled) {
          setSessionStatus(response.data);
        }
      } catch (error) {
        console.error("Failed to verify checkout session:", error);

        if (!isCancelled) {
          setLoadError(
            "We could not verify this payment yet. Please refresh in a moment.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void Promise.resolve().then(verifySession);

    return () => {
      isCancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="page">
      <section className="order-confirmation">
        <p className="eyebrow">Checkout</p>
        <h1>Payment status</h1>

        {isLoading && <p>Checking Stripe payment status...</p>}

        {!isLoading && loadError && (
          <p className="checkout-message checkout-message-error" role="alert">
            {loadError}
          </p>
        )}

        {!isLoading && sessionStatus && (
          <>
            <p>
              Stripe returned your payment flow. Final payment status comes from
              Stripe webhook processing, not this page alone.
            </p>

            <dl className="order-confirmation-details">
              <div>
                <dt>Order number</dt>
                <dd>{sessionStatus.orderNumber ?? "Not available"}</dd>
              </div>

              <div>
                <dt>Payment status</dt>
                <dd>
                  {sessionStatus.paymentStatus === "paid"
                    ? "Paid"
                    : "Processing"}
                </dd>
              </div>

              <div>
                <dt>Fulfilment</dt>
                <dd>
                  {sessionStatus.fulfilmentMethod
                    ? fulfilmentLabels[sessionStatus.fulfilmentMethod] ??
                      sessionStatus.fulfilmentMethod
                    : "Not available"}
                </dd>
              </div>

              <div>
                <dt>Total</dt>
                <dd>
                  {typeof sessionStatus.totalInPence === "number"
                    ? formatCurrencyFromPence(sessionStatus.totalInPence)
                    : "Not available"}
                </dd>
              </div>

              <div>
                <dt>Loyalty</dt>
                <dd>
                  {sessionStatus.paymentStatus !== "paid"
                    ? "Loyalty will update after payment confirmation."
                    : !sessionStatus.customerProfileId
                      ? "Guest orders do not earn loyalty stamps."
                    : sessionStatus.loyaltySettled
                      ? `${sessionStatus.stampsEarned ?? 0} stamp${
                          sessionStatus.stampsEarned === 1 ? "" : "s"
                        } earned`
                      : "Loyalty is still being settled."}
                </dd>
              </div>
            </dl>
          </>
        )}

        <Link to="/shop" className="primary-button">
          Back to shop
        </Link>
      </section>
    </main>
  );
}

export default CheckoutSuccessPage;
