import { Link } from "react-router-dom";
import { formatCurrencyFromPence } from "../../lib/checkoutCalculations";
import type { CreatedOrderSummary } from "../../lib/orderCreation";

type OrderConfirmationProps = {
  order: CreatedOrderSummary;
  fulfilmentLabel: string;
};

function OrderConfirmation({ order, fulfilmentLabel }: OrderConfirmationProps) {
  return (
    <main className="page">
      <section className="order-confirmation">
        <p className="eyebrow">Order received</p>
        <h1>Thanks, {order.firstName}</h1>
        <p>
          Your order request has been received. Payment integration is not yet
          active, so this order is not paid or confirmed by the bakery yet.
        </p>

        <dl className="order-confirmation-details">
          <div>
            <dt>Order number</dt>
            <dd>{order.orderNumber}</dd>
          </div>

          <div>
            <dt>Name</dt>
            <dd>
              {order.firstName} {order.lastName}
            </dd>
          </div>

          <div>
            <dt>Fulfilment</dt>
            <dd>{fulfilmentLabel}</dd>
          </div>

          <div>
            <dt>Total</dt>
            <dd>{formatCurrencyFromPence(order.totalInPence)}</dd>
          </div>

          <div>
            <dt>Payment status</dt>
            <dd>Pending</dd>
          </div>
        </dl>

        <p>
          Next step: Stripe payment will be connected later. For now, the order
          appears in the admin dashboard as pending payment.
        </p>

        <Link to="/shop" className="primary-button">
          Back to shop
        </Link>
      </section>
    </main>
  );
}

export default OrderConfirmation;
