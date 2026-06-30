export type DeliveryOptions = {
  nationwide: boolean;
  manchester: boolean;
  collection: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  available: boolean;
  deliveryOptions: DeliveryOptions;
};