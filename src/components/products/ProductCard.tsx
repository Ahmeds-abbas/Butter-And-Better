import { useState } from "react";
import { Link } from "react-router-dom";
import { useBasket } from "../../hooks/useBasket";
import { formatGBPFromPounds } from "../../lib/currency";
import { getProductImageUrl } from "../../lib/productImages";
import type { Product } from "../../types/product";

type ProductCardProps = {
  product: Product;
};

function ProductCard({ product }: ProductCardProps) {
  const { addToBasket } = useBasket();
  const [message, setMessage] = useState("");
  const lowestPrice = Math.min(
    ...product.variants.map((variant) => variant.price),
  );
  const defaultVariant = product.variants[0];
  const isPickupOnly = !product.deliveryOptions.nationwide;

  function handleQuickAdd() {
    if (!defaultVariant) {
      return;
    }

    addToBasket({
      productId: product.id,
      productName: product.name,
      variantId: defaultVariant.id,
      variantName: defaultVariant.name,
      unitPrice: defaultVariant.price,
      quantity: 1,
      imageUrl: product.imageUrl,
    });
    setMessage(`${defaultVariant.name} added to basket.`);
  }

  return (
    <article className="product-card">
      <div className="product-card-media">
        <img
          src={getProductImageUrl(product.imageUrl)}
          alt={product.imageAltText}
          className="product-card-image"
        />
        {(product.merchandisingLabel || isPickupOnly) && (
          <div className="product-card-badges">
            {product.merchandisingLabel && (
              <span className="product-badge">
                {product.merchandisingLabel}
              </span>
            )}
            {isPickupOnly && (
              <span className="product-badge product-badge-light">
                Pickup only
              </span>
            )}
          </div>
        )}
      </div>

      <div className="product-card-content">
        <p className="product-category">{product.category}</p>

        <h3>{product.name}</h3>

        <p className="product-description">{product.description}</p>

        <div className="product-card-footer">
          <strong>From {formatGBPFromPounds(lowestPrice)}</strong>

          <div className="product-card-actions">
            <button
              type="button"
              disabled={!defaultVariant}
              onClick={handleQuickAdd}
            >
              Add to basket
            </button>
            <Link to={`/products/${product.id}`} className="product-card-link">
              Learn more
            </Link>
          </div>
        </div>

        {message && (
          <p className="product-card-message" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
