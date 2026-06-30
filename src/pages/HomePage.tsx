import ProductCard from "../components/products/ProductCard";
import { products } from "../data/products";

function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Handmade in Manchester</p>

          <h1>Bakes made to make every moment better.</h1>

          <p className="hero-description">
            Freshly made cakes, brownies and treats for celebrations, gifting
            and everyday cravings.
          </p>

          <div className="hero-actions">
            <button type="button" className="primary-button">
              Shop our bakes
            </button>

            <button type="button" className="secondary-button">
              Custom orders
            </button>
          </div>
        </div>

        <div className="hero-image-placeholder">
          <span>Bakery image</span>
        </div>
      </section>

      <section className="featured-products">
        <div className="section-heading">
          <p className="eyebrow">Customer favourites</p>
          <h2>Featured bakes</h2>
        </div>

        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}

export default HomePage;