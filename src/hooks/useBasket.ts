import { useContext } from "react";
import { BasketContext } from "../context/BasketContextCore";

export function useBasket() {
  const context = useContext(BasketContext);

  if (!context) {
    throw new Error("useBasket must be used inside BasketProvider");
  }

  return context;
}
