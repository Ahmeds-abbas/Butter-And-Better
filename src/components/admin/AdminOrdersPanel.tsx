import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dataClient } from "../../lib/amplifyClient";
import type { AdminOrder, OrderFilters, ProductMessage } from "../../types/admin";
import {
  fulfilmentStatuses,
  paymentStatuses,
} from "../../types/admin";
import AdminOrderCard from "./AdminOrderCard";
import AdminOrderFilters from "./AdminOrderFilters";

type OrderRecord = Awaited<
  ReturnType<typeof dataClient.models.Order.list>
>["data"][number];

type OrderUpdateInput = Parameters<typeof dataClient.models.Order.update>[0];

const initialFilters: OrderFilters = {
  search: "",
  fulfilmentStatus: "all",
  paymentStatus: "all",
  fulfilmentMethod: "all",
  sortOrder: "newest",
};

const pageSize = 20;

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCurrency(valueInPence: number) {
  return currencyFormatter.format(valueInPence / 100);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return dateTimeFormatter.format(date);
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatFulfilmentMethod(value: string) {
  const labels: Record<string, string> = {
    nationwide: "Nationwide delivery",
    manchester: "Manchester same-day",
    collection: "Collection",
  };

  return labels[value] ?? formatStatus(value);
}

function getOrderTimestamp(order: AdminOrder) {
  const timestamp = order.createdAt ? new Date(order.createdAt).getTime() : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function createOrderUpdateInput(
  order: AdminOrder,
  changes: Pick<AdminOrder, "status" | "paymentStatus">,
) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: changes.status,
    paymentStatus: changes.paymentStatus,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    firstName: order.firstName,
    lastName: order.lastName,
    customerProfileId: order.customerProfileId,
    fulfilmentMethod: order.fulfilmentMethod,
    addressLine1: order.addressLine1,
    addressLine2: order.addressLine2,
    city: order.city,
    postcode: order.postcode,
    customerNotes: order.customerNotes,
    subtotalInPence: order.subtotalInPence,
    deliveryFeeInPence: order.deliveryFeeInPence,
    loyaltySpendInPence: order.loyaltySpendInPence,
    stampsEarned: order.stampsEarned,
    rewardDiscountInPence: order.rewardDiscountInPence,
    totalInPence: order.totalInPence,
    checkoutAccessToken: order.checkoutAccessToken,
    stripeCheckoutSessionId: order.stripeCheckoutSessionId,
    stripePaymentIntentId: order.stripePaymentIntentId,
    paidAt: order.paidAt,
    refundedAt: order.refundedAt,
    loyaltyProcessedAt: order.loyaltyProcessedAt,
    loyaltySettled: order.loyaltySettled,
    customerOrderConfirmationEmailSentAt:
      order.customerOrderConfirmationEmailSentAt,
    adminOrderNotificationEmailSentAt: order.adminOrderNotificationEmailSentAt,
  } as unknown as OrderUpdateInput;
}

async function loadOrderItems(order: OrderRecord) {
  const items = [];
  let nextToken: string | null | undefined;

  do {
    const response = await order.items({
      authMode: "userPool",
      limit: 100,
      nextToken,
    });

    if (response.errors?.length) {
      throw new Error(response.errors.map((error) => error.message).join(", "));
    }

    items.push(...response.data);
    nextToken = response.nextToken;
  } while (nextToken);

  return items
    .map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId ?? null,
      variantId: item.variantId ?? null,
      productName: item.productName,
      variantName: item.variantName,
      unitPriceInPence: item.unitPriceInPence,
      quantity: item.quantity,
      lineTotalInPence: item.lineTotalInPence,
    }))
    .sort((first, second) => first.productName.localeCompare(second.productName));
}

async function mapOrder(order: OrderRecord): Promise<AdminOrder> {
  const items = await loadOrderItems(order);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    firstName: order.firstName,
    lastName: order.lastName,
    customerProfileId: order.customerProfileId ?? null,
    fulfilmentMethod: order.fulfilmentMethod,
    addressLine1: order.addressLine1 ?? null,
    addressLine2: order.addressLine2 ?? null,
    city: order.city ?? null,
    postcode: order.postcode ?? null,
    customerNotes: order.customerNotes ?? null,
    subtotalInPence: order.subtotalInPence,
    deliveryFeeInPence: order.deliveryFeeInPence,
    loyaltySpendInPence: order.loyaltySpendInPence,
    stampsEarned: order.stampsEarned,
    rewardDiscountInPence: order.rewardDiscountInPence,
    totalInPence: order.totalInPence,
    checkoutAccessToken: order.checkoutAccessToken ?? null,
    stripeCheckoutSessionId: order.stripeCheckoutSessionId ?? null,
    stripePaymentIntentId: order.stripePaymentIntentId ?? null,
    paidAt: order.paidAt ?? null,
    refundedAt: order.refundedAt ?? null,
    loyaltyProcessedAt: order.loyaltyProcessedAt ?? null,
    loyaltySettled: order.loyaltySettled ?? null,
    customerOrderConfirmationEmailSentAt:
      order.customerOrderConfirmationEmailSentAt ?? null,
    adminOrderNotificationEmailSentAt:
      order.adminOrderNotificationEmailSentAt ?? null,
    createdAt: order.createdAt ?? null,
    updatedAt: order.updatedAt ?? null,
    items,
  };
}

function AdminOrdersPanel() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderMessages, setOrderMessages] = useState<Record<string, ProductMessage>>({});
  const [filters, setFilters] = useState<OrderFilters>(initialFilters);
  const hasLoadedOrdersRef = useRef(false);

  const loadOrders = useCallback(
    async (mode: "reset" | "more" = "reset") => {
      const loadingMore = mode === "more";

      if (loadingMore && !nextToken) {
        return;
      }

      if (loadingMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setNextToken(null);
      }

      setLoadError("");

      try {
        const response = await dataClient.models.Order.list({
          authMode: "userPool",
          limit: pageSize,
          nextToken: loadingMore ? nextToken : undefined,
        });

        if (response.errors?.length) {
          throw new Error(
            response.errors.map((error) => error.message).join(", "),
          );
        }

        const loadedOrders = await Promise.all(response.data.map(mapOrder));
        const sortedOrders = [...loadedOrders].sort(
          (first, second) => getOrderTimestamp(second) - getOrderTimestamp(first),
        );

        setOrders((currentOrders) => {
          const nextOrders = loadingMore
            ? [...currentOrders, ...sortedOrders]
            : sortedOrders;
          const uniqueOrders = new Map(
            nextOrders.map((order) => [order.id, order]),
          );

          return [...uniqueOrders.values()].sort(
            (first, second) =>
              getOrderTimestamp(second) - getOrderTimestamp(first),
          );
        });
        setStatusDrafts((currentDrafts) => {
          const nextDrafts = { ...currentDrafts };

          for (const order of loadedOrders) {
            nextDrafts[order.id] = nextDrafts[order.id] ?? order.status;
          }

          return nextDrafts;
        });
        setNextToken(response.nextToken ?? null);
      } catch (error) {
        console.error("Failed to load orders:", error);
        setLoadError("Could not load orders. Product management is unaffected.");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [nextToken],
  );

  useEffect(() => {
    if (hasLoadedOrdersRef.current) {
      return;
    }

    hasLoadedOrdersRef.current = true;
    void Promise.resolve().then(() => loadOrders("reset"));
  }, [loadOrders]);

  const fulfilmentStatusOptions = useMemo(() => {
    return [
      ...new Set([...fulfilmentStatuses, ...orders.map((order) => order.status)]),
    ].map((status) => ({
      value: status,
      label: formatStatus(status),
    }));
  }, [orders]);

  const paymentStatusOptions = useMemo(() => {
    return [
      ...new Set([
        ...paymentStatuses,
        ...orders.map((order) => order.paymentStatus),
      ]),
    ].map((status) => ({
      value: status,
      label: formatStatus(status),
    }));
  }, [orders]);

  const fulfilmentMethodOptions = useMemo(() => {
    return [...new Set(orders.map((order) => order.fulfilmentMethod))].map(
      (method) => ({
        value: method,
        label: formatFulfilmentMethod(method),
      }),
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    return orders
      .filter((order) => {
        const searchableValues = [
          order.id,
          order.orderNumber,
          `${order.firstName} ${order.lastName}`,
          order.customerEmail,
        ]
          .join(" ")
          .toLowerCase();

        return searchTerm === "" || searchableValues.includes(searchTerm);
      })
      .filter(
        (order) =>
          filters.fulfilmentStatus === "all" ||
          order.status === filters.fulfilmentStatus,
      )
      .filter(
        (order) =>
          filters.paymentStatus === "all" ||
          order.paymentStatus === filters.paymentStatus,
      )
      .filter(
        (order) =>
          filters.fulfilmentMethod === "all" ||
          order.fulfilmentMethod === filters.fulfilmentMethod,
      )
      .sort((first, second) => {
        if (filters.sortOrder === "oldest") {
          return getOrderTimestamp(first) - getOrderTimestamp(second);
        }

        if (filters.sortOrder === "total-desc") {
          return second.totalInPence - first.totalInPence;
        }

        if (filters.sortOrder === "total-asc") {
          return first.totalInPence - second.totalInPence;
        }

        return getOrderTimestamp(second) - getOrderTimestamp(first);
      });
  }, [filters, orders]);

  const orderStats = useMemo(() => {
    return {
      totalOrders: orders.length,
      awaitingWork: orders.filter((order) =>
        ["pending", "confirmed", "preparing"].includes(order.status),
      ).length,
      activeFulfilment: orders.filter((order) =>
        ["ready", "out_for_delivery"].includes(order.status),
      ).length,
      completed: orders.filter((order) => order.status === "completed").length,
    };
  }, [orders]);

  async function updateOrderStatus(order: AdminOrder) {
    const nextStatus = statusDrafts[order.id] ?? order.status;

    if (nextStatus === order.status) {
      return;
    }

    setUpdatingOrderId(order.id);
    setOrderMessages((currentMessages) => {
      const nextMessages = { ...currentMessages };
      delete nextMessages[order.id];
      return nextMessages;
    });

    try {
      const updateInput = createOrderUpdateInput(order, {
        status: nextStatus,
        paymentStatus: order.paymentStatus,
      });

      const response = await dataClient.models.Order.update(updateInput, {
        authMode: "userPool",
      });

      if (response.errors?.length || !response.data) {
        throw new Error(
          response.errors?.map((error) => error.message).join(", ") ??
            "No order returned after update.",
        );
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id
            ? {
                ...currentOrder,
                status: response.data?.status ?? nextStatus,
                updatedAt: response.data?.updatedAt ?? currentOrder.updatedAt,
              }
            : currentOrder,
        ),
      );
      setOrderMessages((currentMessages) => ({
        ...currentMessages,
        [order.id]: {
          type: "success",
          text: `Order ${order.orderNumber} status was updated.`,
        },
      }));
    } catch (error) {
      console.error(`Failed to update order ${order.id}:`, error);
      setOrderMessages((currentMessages) => ({
        ...currentMessages,
        [order.id]: {
          type: "error",
          text: `Could not update order ${order.orderNumber}.`,
        },
      }));
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const formatters = {
    formatCurrency,
    formatDateTime,
    formatFulfilmentMethod,
    formatStatus,
  };

  return (
    <section className="admin-orders">
      <div className="section-heading admin-products-heading">
        <div>
          <p className="eyebrow">Orders</p>
          <h2>Order management</h2>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={() => void loadOrders("reset")}
        >
          {isLoading ? "Refreshing..." : "Refresh orders"}
        </button>
      </div>

      {!isLoading && !loadError && (
        <section className="admin-stats" aria-label="Order summary">
          <article className="admin-stat-card">
            <span>Loaded orders</span>
            <strong>{orderStats.totalOrders}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Awaiting prep</span>
            <strong>{orderStats.awaitingWork}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Active fulfilment</span>
            <strong>{orderStats.activeFulfilment}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Completed</span>
            <strong>{orderStats.completed}</strong>
          </article>
        </section>
      )}

      {isLoading && (
        <section className="admin-state-message" aria-live="polite">
          <p>Loading orders...</p>
        </section>
      )}

      {!isLoading && loadError && (
        <section className="admin-state-message" role="alert">
          <h2>Orders unavailable</h2>
          <p>{loadError}</p>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadOrders("reset")}
          >
            Try again
          </button>
        </section>
      )}

      {!isLoading && !loadError && (
        <>
          <AdminOrderFilters
            filters={filters}
            fulfilmentStatusOptions={fulfilmentStatusOptions}
            paymentStatusOptions={paymentStatusOptions}
            fulfilmentMethodOptions={fulfilmentMethodOptions}
            onFiltersChange={setFilters}
            onClearFilters={() => setFilters(initialFilters)}
          />

          {orders.length === 0 ? (
            <section className="admin-state-message">
              <h2>No orders yet</h2>
              <p>Orders will appear here after checkout creates them.</p>
            </section>
          ) : filteredOrders.length === 0 ? (
            <section className="admin-state-message">
              <h2>No matching orders</h2>
              <p>Try clearing filters or changing your search.</p>
            </section>
          ) : (
            <div className="admin-order-list">
              {filteredOrders.map((order) => (
                <AdminOrderCard
                  key={order.id}
                  order={order}
                  isExpanded={expandedOrderId === order.id}
                  selectedStatus={statusDrafts[order.id] ?? order.status}
                  isUpdating={updatingOrderId === order.id}
                  message={orderMessages[order.id]}
                  onToggleExpanded={() =>
                    setExpandedOrderId((currentOrderId) =>
                      currentOrderId === order.id ? null : order.id,
                    )
                  }
                  onStatusChange={(status) =>
                    setStatusDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [order.id]: status,
                    }))
                  }
                  onSaveStatus={() => void updateOrderStatus(order)}
                  formatters={formatters}
                />
              ))}
            </div>
          )}

          {nextToken && (
            <button
              type="button"
              className="secondary-button admin-load-more-button"
              disabled={isLoadingMore}
              onClick={() => void loadOrders("more")}
            >
              {isLoadingMore ? "Loading more..." : "Load more orders"}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default AdminOrdersPanel;
