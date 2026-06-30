import ProductCard from "../components/products/ProductCard";
import { products } from "../data/products";

function ShopPage() {
  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Our menu</p>
        <h1>Shop all bakes</h1>
        <p>
          Browse cookies, brownies, brookies, blondies and banana pudding.
        </p>
      </section>

      <section className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>
    </main>
  );
}

export default ShopPage;