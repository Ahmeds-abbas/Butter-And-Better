import type { FulfilmentMethod } from "../types/checkout";

export type CreatedOrderSummary = {
  id: string;
  orderNumber: string;
  checkoutAccessToken: string;
  firstName: string;
  lastName: string;
  fulfilmentMethod: FulfilmentMethod;
  paymentStatus: "pending";
  totalInPence: number;
  authMode: "userPool" | "iam";
};
