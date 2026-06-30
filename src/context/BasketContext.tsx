import { useMemo, useState, type ReactNode } from "react";
import { BasketContext, type BasketContextValue } from "./BasketContextCore";
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

  const basketItemCount = useMemo(
    () =>
      basketItems.reduce(
        (total, basketItem) => total + basketItem.quantity,
        0,
      ),
    [basketItems],
  );

  const value: BasketContextValue = {
    basketItems,
    basketItemCount,
    addToBasket,
  };

  return (
    <BasketContext.Provider value={value}>
      {children}
    </BasketContext.Provider>
  );
}
