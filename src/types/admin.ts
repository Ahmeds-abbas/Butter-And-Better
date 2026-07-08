export type AdminSection = "products" | "orders";

export type AdminOrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string;
  unitPriceInPence: number;
  quantity: number;
  lineTotalInPence: number;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customerEmail: string;
  customerPhone: string;
  firstName: string;
  lastName: string;
  customerProfileId: string | null;
  fulfilmentMethod: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  customerNotes: string | null;
  subtotalInPence: number;
  deliveryFeeInPence: number;
  loyaltySpendInPence: number;
  stampsEarned: number;
  rewardDiscountInPence: number;
  totalInPence: number;
  checkoutAccessToken: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  loyaltyProcessedAt: string | null;
  loyaltySettled: boolean | null;
  customerOrderConfirmationEmailSentAt: string | null;
  adminOrderNotificationEmailSentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  items: AdminOrderItem[];
};

export type OrderFilters = {
  search: string;
  fulfilmentStatus: string;
  paymentStatus: string;
  fulfilmentMethod: string;
  sortOrder: "newest" | "oldest" | "total-desc" | "total-asc";
};

export type ProductMessage = {
  type: "success" | "error";
  text: string;
};

export const fulfilmentStatuses = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

export const paymentStatuses = [
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;
