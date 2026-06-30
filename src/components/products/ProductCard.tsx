import type { Product } from "../../types/product";

type ProductCardProps = {
  product: Product;
};

function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="product-card">
      <img
        src={product.imageUrl}
        alt={product.name}
        className="product-card-image"
      />

      <div className="product-card-content">
        <p className="product-category">{product.category}</p>

        <h3>{product.name}</h3>

        <p className="product-description">{product.description}</p>

        <div className="product-card-footer">
          <strong>£{product.price.toFixed(2)}</strong>

          <button type="button" disabled={!product.available}>
            {product.available ? "View product" : "Unavailable"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;