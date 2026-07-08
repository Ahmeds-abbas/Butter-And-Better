import type { AdminOrder } from "../../types/admin";
import { fulfilmentStatuses } from "../../types/admin";

type FormatterHelpers = {
  formatCurrency: (valueInPence: number) => string;
  formatDateTime: (value: string | null) => string;
  formatFulfilmentMethod: (value: string) => string;
  formatStatus: (value: string) => string;
};

type AdminOrderDetailsProps = {
  order: AdminOrder;
  selectedStatus: string;
  isUpdating: boolean;
  message?: {
    type: "success" | "error";
    text: string;
  };
  onStatusChange: (status: string) => void;
  onSaveStatus: () => void;
  formatters: FormatterHelpers;
};

function AdminOrderDetails({
  order,
  selectedStatus,
  isUpdating,
  message,
  onStatusChange,
  onSaveStatus,
  formatters,
}: AdminOrderDetailsProps) {
  const fullName = `${order.firstName} ${order.lastName}`.trim();
  const hasAddress = Boolean(
    order.addressLine1 || order.addressLine2 || order.city || order.postcode,
  );

  return (
    <section
      id={`order-panel-${order.id}`}
      className="admin-order-details"
      aria-labelledby={`order-details-${order.id}`}
    >
      <div className="admin-order-details-heading">
        <div>
          <p className="eyebrow">Order details</p>
          <h4 id={`order-details-${order.id}`}>
            {order.orderNumber || order.id.slice(0, 8)}
          </h4>
        </div>

        <span>{formatters.formatDateTime(order.createdAt)}</span>
      </div>

      {message && (
        <div
          className={`admin-product-message admin-product-message-${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      <div className="admin-order-detail-grid">
        <section>
          <h5>Customer</h5>
          <p>{fullName || "No customer name"}</p>
          <p>{order.customerEmail}</p>
          <p>{order.customerPhone}</p>
        </section>

        <section>
          <h5>Fulfilment</h5>
          <p>{formatters.formatFulfilmentMethod(order.fulfilmentMethod)}</p>
          {hasAddress ? (
            <address>
              {order.addressLine1 && <span>{order.addressLine1}</span>}
              {order.addressLine2 && <span>{order.addressLine2}</span>}
              {order.city && <span>{order.city}</span>}
              {order.postcode && <span>{order.postcode}</span>}
            </address>
          ) : (
            <p>Collection order. No delivery address needed.</p>
          )}
          {order.customerNotes && <p>Notes: {order.customerNotes}</p>}
        </section>

        <section>
          <h5>Payment</h5>
          <p>Payment status: {formatters.formatStatus(order.paymentStatus)}</p>
          <p className="admin-payment-note">
            Payment status is controlled by Stripe webhook events.
          </p>
          {order.stripePaymentIntentId && (
            <p>Stripe reference: {order.stripePaymentIntentId}</p>
          )}
          <dl className="admin-order-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatters.formatCurrency(order.subtotalInPence)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{formatters.formatCurrency(order.deliveryFeeInPence)}</dd>
            </div>
            <div>
              <dt>Rewards</dt>
              <dd>
                -{formatters.formatCurrency(order.rewardDiscountInPence)}
              </dd>
            </div>
            <div>
              <dt>Loyalty settled</dt>
              <dd>{order.loyaltySettled ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatters.formatCurrency(order.totalInPence)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h5>Status</h5>
          <label className="admin-order-status-control">
            <span>Fulfilment status</span>
            <select
              value={selectedStatus}
              disabled={isUpdating}
              onChange={(event) => onStatusChange(event.target.value)}
            >
              {fulfilmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatters.formatStatus(status)}
                </option>
              ))}
              {!fulfilmentStatuses.includes(
                selectedStatus as (typeof fulfilmentStatuses)[number],
              ) && (
                <option value={selectedStatus}>
                  {formatters.formatStatus(selectedStatus)}
                </option>
              )}
            </select>
          </label>

          <button
            type="button"
            className="primary-button"
            disabled={isUpdating || selectedStatus === order.status}
            onClick={onSaveStatus}
          >
            {isUpdating ? "Updating..." : "Save status"}
          </button>
        </section>
      </div>

      <section className="admin-order-items">
        <h5>Items</h5>

        {order.items.map((item) => (
          <div key={item.id} className="admin-order-item-row">
            <div>
              <strong>{item.productName}</strong>
              <span>{item.variantName}</span>
            </div>
            <span>Qty {item.quantity}</span>
            <span>{formatters.formatCurrency(item.unitPriceInPence)}</span>
            <strong>{formatters.formatCurrency(item.lineTotalInPence)}</strong>
          </div>
        ))}
      </section>

      <section className="admin-order-metadata">
        <h5>Metadata</h5>
        <p>Order ID: {order.id}</p>
        <p>Created: {formatters.formatDateTime(order.createdAt)}</p>
        <p>Updated: {formatters.formatDateTime(order.updatedAt)}</p>
        <p>
          Customer profile: {order.customerProfileId ?? "Guest checkout"}
        </p>
        <p>Loyalty spend: {formatters.formatCurrency(order.loyaltySpendInPence)}</p>
        <p>Stamps earned: {order.stampsEarned}</p>
        <p>Loyalty settled: {order.loyaltySettled ? "Yes" : "No"}</p>
        <p>
          Loyalty processed: {formatters.formatDateTime(order.loyaltyProcessedAt)}
        </p>
        <p>
          Customer email sent:{" "}
          {formatters.formatDateTime(order.customerOrderConfirmationEmailSentAt)}
        </p>
        <p>
          Admin email sent:{" "}
          {formatters.formatDateTime(order.adminOrderNotificationEmailSentAt)}
        </p>
      </section>
    </section>
  );
}

export default AdminOrderDetails;
