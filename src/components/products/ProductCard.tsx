import { Link } from "react-router-dom";
import { getProductImageUrl } from "../../lib/productImages";
import type { Product } from "../../types/product";

type ProductCardProps = {
  product: Product;
};

function ProductCard({ product }: ProductCardProps) {
  const lowestPrice = Math.min(
    ...product.variants.map((variant) => variant.price),
  );

  return (
    <article className="product-card">
      <img
        src={getProductImageUrl(product.imageUrl)}
        alt={product.name}
        className="product-card-image"
      />

      <div className="product-card-content">
        <p className="product-category">{product.category}</p>

        <h3>{product.name}</h3>

        <p className="product-description">{product.description}</p>

        <div className="product-card-footer">
          <strong>From £{lowestPrice.toFixed(2)}</strong>

          <Link
            to={`/products/${product.id}`}
            className="product-card-button"
          >
            View product
          </Link>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
