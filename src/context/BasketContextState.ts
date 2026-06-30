import { createContext } from "react";
import type { BasketItem } from "../types/basket";

type AddBasketItem = Omit<BasketItem, "id">;

export type BasketContextValue = {
  basketItems: BasketItem[];
  basketItemCount: number;
  basketSubtotal: number;
  addToBasket: (item: AddBasketItem) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeFromBasket: (itemId: string) => void;
  clearBasket: () => void;
};

export const BasketContext = createContext<BasketContextValue | undefined>(
  undefined,
);
