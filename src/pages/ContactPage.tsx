import { formatGBP } from "../lib/currency";

function ContactPage() {
  return (
    <main className="page">
      <section className="page-header contact-header">
        <div>
          <p className="eyebrow">Get in touch</p>
          <h1>Contact us</h1>
          <p>
            Contact details and enquiry options will be added once confirmed by
            the bakery owner. For now, the shop flow is ready for menu browsing,
            basket building and secure checkout.
          </p>
        </div>
        <div className="media-placeholder contact-header-media">
          <span>Contact photo coming soon</span>
        </div>
      </section>

      <section className="contact-info-grid">
        <article>
          <span className="product-badge">Pickup</span>
          <h2>Pickup available</h2>
          <p>
            Pickup is always free and final pickup details are shown only after
            order confirmation/payment.
          </p>
        </article>
        <article>
          <span className="product-badge product-badge-light">Delivery</span>
          <h2>UK tracked delivery</h2>
          <p>
            UK tracked delivery is {formatGBP(299)} when every product in the basket is
            delivery-available.
          </p>
        </article>
        <article>
          <span className="product-badge">Loyalty</span>
          <h2>Earn stamps</h2>
          <p>
            Signed-in customers earn 1 stamp per {formatGBP(500)} spent on products after
            payment is confirmed.
          </p>
        </article>
      </section>
    </main>
  );
}

export default ContactPage;
