import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { products } from "../data/products";
import { useBasket } from "../hooks/useBasket";

function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const { addToBasket } = useBasket();

  const product = products.find((item) => item.id === productId);

  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [confirmationMessage, setConfirmationMessage] = useState("");

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

  const selectedVariant = product.variants.find(
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
            disabled={!product.available}
          >
            {product.available ? "Add to basket" : "Currently unavailable"}
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
