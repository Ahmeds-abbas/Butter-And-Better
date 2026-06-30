import { useMemo, useState, type ReactNode } from "react";
import {
  BasketContext,
  type BasketContextValue,
} from "./BasketContextState";
import type { BasketItem } from "../types/basket";

type AddBasketItem = Omit<BasketItem, "id">;

type BasketProviderProps = {
  children: ReactNode;
};

export function BasketProvider({ children }: BasketProviderProps) {
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);

  function addToBasket(item: AddBasketItem) {
    const basketItemId = `${item.productId}-${item.variantId}`;

    setBasketItems((currentItems) => {
      const existingItem = currentItems.find(
        (currentItem) => currentItem.id === basketItemId,
      );

      if (existingItem) {
        return currentItems.map((currentItem) =>
          currentItem.id === basketItemId
            ? {
                ...currentItem,
                quantity: currentItem.quantity + item.quantity,
              }
            : currentItem,
        );
      }

      return [
        ...currentItems,
        {
          ...item,
          id: basketItemId,
        },
      ];
    });
  }

  function updateQuantity(itemId: string, quantity: number) {
    if (quantity < 1) {
      removeFromBasket(itemId);
      return;
    }

    setBasketItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, quantity } : item,
      ),
    );
  }

  function removeFromBasket(itemId: string) {
    setBasketItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId),
    );
  }

  function clearBasket() {
    setBasketItems([]);
  }

  const basketItemCount = useMemo(
    () =>
      basketItems.reduce(
        (total, basketItem) => total + basketItem.quantity,
        0,
      ),
    [basketItems],
  );

  const basketSubtotal = useMemo(
    () =>
      basketItems.reduce(
        (total, basketItem) =>
          total + basketItem.unitPrice * basketItem.quantity,
        0,
      ),
    [basketItems],
  );

  const value: BasketContextValue = {
    basketItems,
    basketItemCount,
    basketSubtotal,
    addToBasket,
    updateQuantity,
    removeFromBasket,
    clearBasket,
  };

  return (
    <BasketContext.Provider value={value}>
      {children}
    </BasketContext.Provider>
  );
}
