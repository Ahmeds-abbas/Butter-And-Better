import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useBasket } from "../hooks/useBasket";
import type { CheckoutFormData, FulfilmentMethod } from "../types/checkout";

const initialCheckoutFormData: CheckoutFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  fulfilmentMethod: "",
  orderNotes: "",
};

const fulfilmentOptions: Array<{
  value: FulfilmentMethod;
  label: string;
  description: string;
}> = [
  {
    value: "nationwide",
    label: "Nationwide delivery",
    description: "For postal-friendly bakes across the UK.",
  },
  {
    value: "manchester",
    label: "Manchester delivery",
    description: "Local delivery around Manchester.",
  },
  {
    value: "collection",
    label: "Collection",
    description: "Collect your order from Butter & Better.",
  },
];

function CheckoutPage() {
  const { basketItems, basketSubtotal } = useBasket();
  const [formData, setFormData] = useState<CheckoutFormData>(
    initialCheckoutFormData,
  );
  const [orderMessage, setOrderMessage] = useState("");

  function updateFormData(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderMessage(
      "Thanks. Your checkout details are ready for the next payment step.",
    );
  }

  if (basketItems.length === 0) {
    return (
      <main className="page">
        <section className="empty-basket">
          <p className="eyebrow">Checkout</p>
          <h1>Your basket is empty</h1>
          <p>Add some Butter & Better treats before checking out.</p>

          <Link to="/shop" className="primary-button">
            Browse the menu
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Checkout</p>
        <h1>Complete your order</h1>
        <p>
          Add your details and choose how you would like to receive your bakes.
        </p>
      </section>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <section className="checkout-section">
            <h2>Contact details</h2>

            <div className="checkout-field-grid">
              <label>
                <span>First name</span>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={updateFormData}
                  required
                />
              </label>

              <label>
                <span>Last name</span>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={updateFormData}
                  required
                />
              </label>
            </div>

            <label>
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={updateFormData}
                required
              />
            </label>

            <label>
              <span>Phone</span>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={updateFormData}
                required
              />
            </label>
          </section>

          <section className="checkout-section">
            <h2>Fulfilment</h2>

            <fieldset className="fulfilment-options">
              <legend>Choose an option</legend>

              {fulfilmentOptions.map((option) => (
                <label
                  key={option.value}
                  className={`fulfilment-option ${
                    formData.fulfilmentMethod === option.value
                      ? "fulfilment-option-selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfilmentMethod"
                    value={option.value}
                    checked={formData.fulfilmentMethod === option.value}
                    onChange={updateFormData}
                    required
                  />

                  <span>
                    <strong>{option.label}</strong>
                    {option.description}
                  </span>
                </label>
              ))}
            </fieldset>
          </section>

          <section className="checkout-section">
            <h2>Address</h2>

            <label>
              <span>Address line 1</span>
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={updateFormData}
                required
              />
            </label>

            <label>
              <span>Address line 2</span>
              <input
                type="text"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={updateFormData}
              />
            </label>

            <div className="checkout-field-grid">
              <label>
                <span>City</span>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={updateFormData}
                  required
                />
              </label>

              <label>
                <span>Postcode</span>
                <input
                  type="text"
                  name="postcode"
                  value={formData.postcode}
                  onChange={updateFormData}
                  required
                />
              </label>
            </div>
          </section>

          <section className="checkout-section">
            <h2>Order notes</h2>

            <label>
              <span>Notes</span>
              <textarea
                name="orderNotes"
                value={formData.orderNotes}
                onChange={updateFormData}
                rows={4}
                placeholder="Add allergies, preferred dates or delivery notes."
              />
            </label>
          </section>

          <button type="submit" className="checkout-submit-button">
            Continue to payment
          </button>

          {orderMessage && (
            <p className="checkout-message" aria-live="polite">
              {orderMessage}
            </p>
          )}
        </form>

        <aside className="checkout-summary">
          <h2>Order summary</h2>

          <div className="checkout-summary-items">
            {basketItems.map((item) => (
              <div key={item.id} className="checkout-summary-item">
                <span>
                  {item.quantity} x {item.variantName}
                </span>
                <strong>
                  GBP {(item.unitPrice * item.quantity).toFixed(2)}
                </strong>
              </div>
            ))}
          </div>

          <div className="summary-row">
            <span>Subtotal</span>
            <strong>GBP {basketSubtotal.toFixed(2)}</strong>
          </div>

          <div className="summary-row">
            <span>Delivery</span>
            <span>Confirmed after fulfilment review</span>
          </div>

          <div className="summary-total">
            <span>Estimated total</span>
            <strong>GBP {basketSubtotal.toFixed(2)}</strong>
          </div>

          <Link to="/basket" className="continue-shopping-link">
            Back to basket
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default CheckoutPage;
