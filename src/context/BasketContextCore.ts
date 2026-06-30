import { createContext } from "react";
import type { BasketItem } from "../types/basket";

type AddBasketItem = Omit<BasketItem, "id">;

export type BasketContextValue = {
  basketItems: BasketItem[];
  basketItemCount: number;
  addToBasket: (item: AddBasketItem) => void;
};

export const BasketContext = createContext<BasketContextValue | undefined>(
  undefined,
);
