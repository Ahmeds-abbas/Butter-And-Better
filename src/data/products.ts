import type { Product } from "../types/product";

export const products: Product[] = [
  {
    id: "classic-brownie-box",
    name: "Classic Brownie Box",
    description: "Rich chocolate brownies baked fresh in Manchester.",
    price: 14.99,
    imageUrl: "/src/assets/hero.png",
    category: "Brownies",
    available: true,
    deliveryOptions: {
      nationwide: true,
      manchester: true,
      collection: true,
    },
  },
  {
    id: "celebration-cake",
    name: "Celebration Cake",
    description: "A handmade cake for birthdays and special occasions.",
    price: 38,
    imageUrl: "/src/assets/hero.png",
    category: "Cakes",
    available: true,
    deliveryOptions: {
      nationwide: false,
      manchester: true,
      collection: true,
    },
  },
  {
    id: "cookie-box",
    name: "Cookie Box",
    description: "A selection of soft-centred handmade cookies.",
    price: 12.5,
    imageUrl: "/src/assets/hero.png",
    category: "Cookies",
    available: true,
    deliveryOptions: {
      nationwide: true,
      manchester: true,
      collection: true,
    },
  },
];