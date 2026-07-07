export type FulfilmentMethod =
  | "nationwide"
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

export type CheckoutValidationErrors = Partial<
  Record<
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "addressLine1"
    | "city"
    | "postcode"
    | "fulfilmentMethod",
    string
  >
>;
