import type { Product } from "../types/product";

export const products: Product[] = [
  {
    id: "cookies",
    name: "Cookies",
    description:
      "Freshly baked cookies available in original and flavoured varieties.",
    imageUrl: "/src/assets/hero.png",
    category: "Cookies",
    available: true,
    variants: [
      {
        id: "cookies-original-3",
        name: "Box of 3 Original Cookies",
        price: 5,
      },
      {
        id: "cookies-original-5",
        name: "Box of 5 Original Cookies",
        price: 7,
      },
      {
        id: "cookies-flavoured-3",
        name: "Box of 3 Flavoured Cookies",
        price: 6,
      },
      {
        id: "cookies-flavoured-5",
        name: "Box of 5 Flavoured Cookies",
        price: 8,
      },
    ],
    deliveryOptions: {
      nationwide: true,
      manchester: true,
      collection: true,
    },
  },
  {
    id: "brownies",
    name: "Brownies",
    description:
      "Rich handmade brownies available in original and flavoured varieties.",
    imageUrl: "/src/assets/hero.png",
    category: "Brownies",
    available: true,
    variants: [
      {
        id: "brownies-original-3",
        name: "Box of 3 Original Brownies",
        price: 5,
      },
      {
        id: "brownies-original-5",
        name: "Box of 5 Original Brownies",
        price: 7,
      },
      {
        id: "brownies-flavoured-3",
        name: "Box of 3 Flavoured Brownies",
        price: 6,
      },
      {
        id: "brownies-flavoured-5",
        name: "Box of 5 Flavoured Brownies",
        price: 8,
      },
    ],
    deliveryOptions: {
      nationwide: true,
      manchester: true,
      collection: true,
    },
  },
  {
    id: "oreo-brookies",
    name: "Oreo Brookies",
    description:
      "A soft brownie-cookie hybrid finished with Oreo pieces.",
    imageUrl: "/src/assets/hero.png",
    category: "Brookies",
    available: true,
    variants: [
      {
        id: "oreo-brookies-3",
        name: "Box of 3 Oreo Brookies",
        price: 6,
      },
    ],
    deliveryOptions: {
      nationwide: true,
      manchester: true,
      collection: true,
    },
  },
  {
    id: "blondies",
    name: "Blondies",
    description:
      "Soft, rich blondies with a sweet buttery flavour.",
    imageUrl: "/src/assets/hero.png",
    category: "Blondies",
    available: true,
    variants: [
      {
        id: "blondies-3",
        name: "Box of 3 Blondies",
        price: 6,
      },
    ],
    deliveryOptions: {
      nationwide: true,
      manchester: true,
      collection: true,
    },
  },
  {
    id: "banana-pudding",
    name: "Banana Pudding",
    description:
      "Creamy banana pudding available in classic and flavoured options.",
    imageUrl: "/src/assets/hero.png",
    category: "Banana Pudding",
    available: true,
    variants: [
      {
        id: "banana-pudding-classic",
        name: "Classic Banana Pudding",
        price: 5,
      },
      {
        id: "banana-pudding-flavoured",
        name: "Flavoured Banana Pudding",
        price: 6,
      },
    ],
    deliveryOptions: {
      nationwide: false,
      manchester: true,
      collection: true,
    },
  },
];