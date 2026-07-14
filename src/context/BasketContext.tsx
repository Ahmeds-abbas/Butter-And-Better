import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BasketContext,
  type BasketContextValue,
} from "./BasketContextState";
import type { BasketItem } from "../types/basket";
import {
  maxBasketItemQuantity,
  normalizeBasketItems,
  normalizeBasketQuantity,
} from "../lib/basketValidation";

type AddBasketItem = Omit<BasketItem, "id">;

type BasketProviderProps = {
  children: ReactNode;
};

const BASKET_STORAGE_KEY = "butter-and-better-basket";

function getStoredBasketItems(): BasketItem[] {
  try {
    const storedBasketItems = localStorage.getItem(BASKET_STORAGE_KEY);

    return storedBasketItems
      ? normalizeBasketItems(JSON.parse(storedBasketItems))
      : [];
  } catch (error) {
    console.warn("Could not restore the saved basket:", error);
    return [];
  }
}

export function BasketProvider({ children }: BasketProviderProps) {
  const [basketItems, setBasketItems] =
    useState<BasketItem[]>(getStoredBasketItems);

  useEffect(() => {
    try {
      localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basketItems));
    } catch (error) {
      console.warn("Could not save the basket:", error);
    }
  }, [basketItems]);

  const addToBasket = useCallback((item: AddBasketItem) => {
    const normalizedItem = normalizeBasketItems([
      {
        ...item,
        id: `${item.productId}-${item.variantId}`,
      },
    ])[0];

    if (!normalizedItem) {
      return;
    }

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
                quantity: Math.min(
                  maxBasketItemQuantity,
                  currentItem.quantity + normalizedItem.quantity,
                ),
              }
            : currentItem,
        );
      }

      return [
        ...currentItems,
        {
          ...normalizedItem,
          id: basketItemId,
        },
      ];
    });
  }, []);

  const removeFromBasket = useCallback((itemId: string) => {
    setBasketItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId),
    );
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    const normalizedQuantity = normalizeBasketQuantity(quantity);

    if (normalizedQuantity === null) {
      return;
    }

    if (normalizedQuantity < 1) {
      removeFromBasket(itemId);
      return;
    }

    setBasketItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, quantity: normalizedQuantity } : item,
      ),
    );
  }, [removeFromBasket]);

  const clearBasket = useCallback(() => {
    setBasketItems([]);
  }, []);

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

  const value = useMemo<BasketContextValue>(
    () => ({
      basketItems,
      basketItemCount,
      basketSubtotal,
      addToBasket,
      updateQuantity,
      removeFromBasket,
      clearBasket,
    }),
    [
      addToBasket,
      basketItemCount,
      basketItems,
      basketSubtotal,
      clearBasket,
      removeFromBasket,
      updateQuantity,
    ],
  );

  return (
    <BasketContext.Provider value={value}>
      {children}
    </BasketContext.Provider>
  );
}
