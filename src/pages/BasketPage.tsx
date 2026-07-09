import { Link } from "react-router-dom";
import { useBasket } from "../hooks/useBasket";
import { getProductImageUrl } from "../lib/productImages";

function BasketPage() {
  const {
    basketItems,
    basketSubtotal,
    updateQuantity,
    removeFromBasket,
    clearBasket,
  } = useBasket();

  if (basketItems.length === 0) {
    return (
      <main className="page">
        <section className="empty-basket">
          <p className="eyebrow">Your basket</p>
          <h1>Your basket is empty</h1>
          <p>Add some Butter & Better treats before continuing.</p>

          <Link to="/shop" className="primary-button">
            Browse the menu
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="basket-header">
        <div>
          <p className="eyebrow">Your order</p>
          <h1>Shopping basket</h1>
          <p>
            Review your treats before choosing free pickup or UK tracked
            delivery at checkout.
          </p>
        </div>

        <button
          type="button"
          className="clear-basket-button"
          onClick={clearBasket}
        >
          Clear basket
        </button>
      </section>

      <div className="basket-layout">
        <section className="basket-items" aria-label="Basket items">
          {basketItems.map((item) => (
            <article key={item.id} className="basket-item">
              <img
                src={getProductImageUrl(item.imageUrl)}
                alt={item.productName}
                className="basket-item-image"
              />

              <div className="basket-item-details">
                <h2>{item.productName}</h2>
                <p>{item.variantName}</p>
                <p>GBP {item.unitPrice.toFixed(2)} each</p>

                <button
                  type="button"
                  className="remove-item-button"
                  onClick={() => removeFromBasket(item.id)}
                >
                  Remove
                </button>
              </div>

              <div className="basket-item-controls">
                <div className="quantity-selector">
                  <button
                    type="button"
                    aria-label={`Decrease ${item.variantName} quantity`}
                    onClick={() =>
                      updateQuantity(item.id, item.quantity - 1)
                    }
                  >
                    −
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    type="button"
                    aria-label={`Increase ${item.variantName} quantity`}
                    onClick={() =>
                      updateQuantity(item.id, item.quantity + 1)
                    }
                  >
                    +
                  </button>
                </div>

                <strong>
                  GBP {(item.unitPrice * item.quantity).toFixed(2)}
                </strong>
              </div>
            </article>
          ))}
        </section>

        <aside className="basket-summary">
          <h2>Order summary</h2>

          <div className="summary-row">
            <span>Subtotal</span>
            <strong>GBP {basketSubtotal.toFixed(2)}</strong>
          </div>

          <div className="summary-row">
            <span>Pickup</span>
            <span>Free</span>
          </div>

          <div className="summary-row">
            <span>UK tracked delivery</span>
            <span>GBP 2.99 if eligible</span>
          </div>

          <div className="summary-total">
            <span>Estimated total</span>
            <strong>GBP {basketSubtotal.toFixed(2)}</strong>
          </div>

          <p className="basket-summary-note">
            Delivery availability is checked against every basket item before
            payment.
          </p>

          <Link to="/checkout" className="checkout-button">
            Continue to checkout
          </Link>

          <Link to="/shop" className="continue-shopping-link">
            Continue shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default BasketPage;
