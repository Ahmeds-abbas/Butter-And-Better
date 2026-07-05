import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Link, useParams } from "react-router-dom";

import { useBasket } from "../hooks/useBasket";
import { dataClient } from "../lib/amplifyClient";
import type { Product } from "../types/product";

type ProductReadAuthMode = "userPool" | "iam";

async function getProductReadAuthModes(): Promise<ProductReadAuthMode[]> {
  try {
    const session = await fetchAuthSession();

    if (session.tokens?.accessToken) {
      return ["userPool", "iam"];
    }
  } catch {
    // Guest shoppers should read with IAM through the identity pool.
  }

  return ["iam", "userPool"];
}

async function getProductWithFallback(productId: string) {
  const authModes = await getProductReadAuthModes();
  let lastError: unknown;

  for (const authMode of authModes) {
    try {
      const response = await dataClient.models.Product.get(
        { id: productId },
        { authMode },
      );

      if (response.errors?.length && !response.data) {
        throw new Error(
          response.errors.map((error) => error.message).join(", "),
        );
      }

      return { authMode, response };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not load product.");
}

function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const { addToBasket } = useBasket();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadProduct() {
      if (!productId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");

      try {
        const { authMode, response: productResponse } =
          await getProductWithFallback(productId);

        if (productResponse.errors?.length && !productResponse.data) {
          throw new Error(
            productResponse.errors.map((error) => error.message).join(", "),
          );
        }

        const backendProduct = productResponse.data;

        if (!backendProduct || !backendProduct.isActive) {
          if (!isCancelled) {
            setProduct(null);
          }

          return;
        }

        const variantResponse = await backendProduct.variants({ authMode });

        if (variantResponse.errors?.length && variantResponse.data.length === 0) {
          throw new Error(
            variantResponse.errors.map((error) => error.message).join(", "),
          );
        }

        const loadedProduct: Product = {
          id: backendProduct.id,
          name: backendProduct.name,
          description: backendProduct.description ?? "",
          imageUrl: backendProduct.imageKey ?? "/src/assets/hero.png",
          category: backendProduct.category as Product["category"],
          available: backendProduct.isActive,
          variants: variantResponse.data
            .filter((variant) => variant.isActive)
            .sort(
              (first, second) =>
                (first.sortOrder ?? 0) - (second.sortOrder ?? 0),
            )
            .map((variant) => ({
              id: variant.id,
              name: variant.name,
              price: variant.priceInPence / 100,
            })),
          deliveryOptions: {
            nationwide: backendProduct.nationwideDelivery,
            manchester: backendProduct.manchesterDelivery,
            collection: backendProduct.collectionAvailable,
          },
        };

        if (!isCancelled) {
          setProduct(loadedProduct);
          setSelectedVariantId("");
          setQuantity(1);
          setConfirmationMessage("");
        }
      } catch (error) {
        console.error("Failed to load product:", error);

        if (!isCancelled) {
          setLoadError(
            "We could not load this product. Please refresh and try again.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      isCancelled = true;
    };
  }, [productId]);

  const selectedVariant = product?.variants.find(
    (variant) => variant.id === selectedVariantId,
  );

  function handleAddToBasket() {
    if (!product) {
      return;
    }

    if (!selectedVariant) {
      setConfirmationMessage("Please select an option first.");
      return;
    }

    addToBasket({
      productId: product.id,
      productName: product.name,
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      unitPrice: selectedVariant.price,
      quantity,
      imageUrl: product.imageUrl,
    });

    setConfirmationMessage(
      `${quantity} × ${selectedVariant.name} added to your basket.`,
    );
  }

  function decreaseQuantity() {
    setQuantity((currentQuantity) => Math.max(1, currentQuantity - 1));
  }

  function increaseQuantity() {
    setQuantity((currentQuantity) => currentQuantity + 1);
  }

  if (isLoading) {
    return (
      <main className="page">
        <section className="page-header" aria-live="polite">
          <p>Loading product...</p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="page">
        <section className="page-header" role="alert">
          <h1>Product unavailable</h1>
          <p>{loadError}</p>

          <Link to="/shop" className="primary-button">
            Return to shop
          </Link>
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="page">
        <section className="page-header">
          <h1>Product not found</h1>

          <Link to="/shop" className="primary-button">
            Return to shop
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="product-detail">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="product-detail-image"
        />

        <div className="product-detail-content">
          <p className="eyebrow">{product.category}</p>

          <h1>{product.name}</h1>

          <p className="product-detail-description">{product.description}</p>

          <fieldset className="variant-selector">
            <legend>Choose an option</legend>

            {product.variants.map((variant) => (
              <label
                key={variant.id}
                className={`variant-option ${
                  selectedVariantId === variant.id
                    ? "variant-option-selected"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="product-variant"
                  value={variant.id}
                  checked={selectedVariantId === variant.id}
                  onChange={() => {
                    setSelectedVariantId(variant.id);
                    setConfirmationMessage("");
                  }}
                />

                <span>{variant.name}</span>

                <strong>£{variant.price.toFixed(2)}</strong>
              </label>
            ))}
          </fieldset>

          <div className="quantity-section">
            <span className="quantity-label">Quantity</span>

            <div className="quantity-selector">
              <button
                type="button"
                onClick={decreaseQuantity}
                aria-label="Decrease quantity"
              >
                −
              </button>

              <span aria-live="polite">{quantity}</span>

              <button
                type="button"
                onClick={increaseQuantity}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            className="add-to-basket-button"
            onClick={handleAddToBasket}
            disabled={!product.available || product.variants.length === 0}
          >
            {product.available && product.variants.length > 0
              ? "Add to basket"
              : "Currently unavailable"}
          </button>

          {selectedVariant && (
            <p className="selected-total">
              Total: £{(selectedVariant.price * quantity).toFixed(2)}
            </p>
          )}

          {confirmationMessage && (
            <p className="basket-message" aria-live="polite">
              {confirmationMessage}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default ProductPage;
