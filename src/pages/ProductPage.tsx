import { Link, useParams } from "react-router-dom";
import { products } from "../data/products";

function ProductPage() {
  const { productId } = useParams<{ productId: string }>();

  const product = products.find((item) => item.id === productId);

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
          <p>{product.description}</p>

          <div className="variant-list">
            {product.variants.map((variant) => (
              <div key={variant.id} className="variant-item">
                <span>{variant.name}</span>
                <strong>£{variant.price.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default ProductPage;