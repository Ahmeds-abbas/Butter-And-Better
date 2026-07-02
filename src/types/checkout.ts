export type FulfilmentMethod =
  | "nationwide"
  | "manchester"
  | "collection";

export type CheckoutFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  fulfilmentMethod: FulfilmentMethod | "";
  orderNotes: string;
};
