import type { AdminOrder, ProductMessage } from "../../types/admin";
import AdminOrderDetails from "./AdminOrderDetails";

type FormatterHelpers = {
  formatCurrency: (valueInPence: number) => string;
  formatDateTime: (value: string | null) => string;
  formatFulfilmentMethod: (value: string) => string;
  formatStatus: (value: string) => string;
};

type AdminOrderCardProps = {
  order: AdminOrder;
  isExpanded: boolean;
  selectedStatus: string;
  isUpdating: boolean;
  message?: ProductMessage;
  onToggleExpanded: () => void;
  onStatusChange: (status: string) => void;
  onSaveStatus: () => void;
  formatters: FormatterHelpers;
};

function AdminOrderCard({
  order,
  isExpanded,
  selectedStatus,
  isUpdating,
  message,
  onToggleExpanded,
  onStatusChange,
  onSaveStatus,
  formatters,
}: AdminOrderCardProps) {
  const fullName = `${order.firstName} ${order.lastName}`.trim();

  return (
    <article className="admin-order-card">
      <button
        type="button"
        className="admin-order-summary"
        aria-expanded={isExpanded}
        aria-controls={`order-panel-${order.id}`}
        onClick={onToggleExpanded}
      >
        <span>
          <small>Order</small>
          <strong>{order.orderNumber || order.id.slice(0, 8)}</strong>
        </span>

        <span>
          <small>Placed</small>
          <strong>{formatters.formatDateTime(order.createdAt)}</strong>
        </span>

        <span>
          <small>Customer</small>
          <strong>{fullName || "No customer name"}</strong>
          <small>{order.customerEmail}</small>
        </span>

        <span>
          <small>Method</small>
          <strong className="admin-method-badge">
            {formatters.formatFulfilmentMethod(order.fulfilmentMethod)}
          </strong>
        </span>

        <span>
          <small>Payment</small>
          <strong className="admin-status-badge admin-status-neutral">
            {formatters.formatStatus(order.paymentStatus)}
          </strong>
        </span>

        <span>
          <small>Fulfilment</small>
          <strong className="admin-status-badge admin-status-neutral">
            {formatters.formatStatus(order.status)}
          </strong>
        </span>

        <span>
          <small>Total</small>
          <strong>{formatters.formatCurrency(order.totalInPence)}</strong>
          <small>
            {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </small>
        </span>
      </button>

      {isExpanded && (
        <AdminOrderDetails
          order={order}
          selectedStatus={selectedStatus}
          isUpdating={isUpdating}
          message={message}
          onStatusChange={onStatusChange}
          onSaveStatus={onSaveStatus}
          formatters={formatters}
        />
      )}
    </article>
  );
}

export default AdminOrderCard;
