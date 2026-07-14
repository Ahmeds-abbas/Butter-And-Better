export type ProductCategory =
  | "Cookies"
  | "Brownies"
  | "Brookies"
  | "Blondies"
  | "Banana Pudding";

export type ProductMerchandisingLabel = "Best Seller" | "New Drop";

export type ProductVariant = {
  id: string;
  name: string;
  price: number;
};

export type DeliveryOptions = {
  nationwide: boolean;
  manchester: boolean;
  collection: boolean;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAltText: string;
  galleryImageUrls: string[];
  videoUrl: string;
  category: ProductCategory;
  merchandisingLabel?: ProductMerchandisingLabel;
  available: boolean;
  variants: ProductVariant[];
  deliveryOptions: DeliveryOptions;
};
