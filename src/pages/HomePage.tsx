import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import ProductCard from "../components/products/ProductCard";
import { dataClient } from "../lib/amplifyClient";
import type { Product } from "../types/product";

function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadFeaturedProducts() {
      setIsLoading(true);
      setLoadError("");

      try {
        const productResponse = await dataClient.models.Product.list();

        if (productResponse.errors?.length) {
          throw new Error(
            productResponse.errors.map((error) => error.message).join(", "),
          );
        }

        const activeProducts = productResponse.data.filter(
          (product) => product.isActive,
        );

        const loadedProducts: Product[] = await Promise.all(
          activeProducts.map(async (product) => {
            const variantResponse = await product.variants();

            if (variantResponse.errors?.length) {
              throw new Error(
                variantResponse.errors
                  .map((error) => error.message)
                  .join(", "),
              );
            }

            return {
              id: product.id,
              name: product.name,
              description: product.description ?? "",
              imageUrl: product.imageKey ?? "/src/assets/hero.png",
              category: product.category as Product["category"],
              available: product.isActive,
              variants: variantResponse.data
                .filter((variant) => variant.isActive)
                .sort(
                  (first, second) =>
                    (first.sortOrder ?? 0) - (second.sortOrder ?? 0),
                )
                .map((variant) => ({
                  id: variant.id,
                  name: variant.name,
                  price: variant.priceInPence / 100,
                })),
              deliveryOptions: {
                nationwide: product.nationwideDelivery,
                manchester: product.manchesterDelivery,
                collection: product.collectionAvailable,
              },
            };
          }),
        );

        if (!isCancelled) {
          setProducts(loadedProducts);
        }
      } catch (error) {
        console.error("Failed to load featured products:", error);

        if (!isCancelled) {
          setLoadError("Featured products are unavailable right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFeaturedProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

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
            <Link to="/shop" className="primary-button">
              Shop our bakes
            </Link>

            <Link to="/contact" className="secondary-button">
              Custom orders
            </Link>
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

        {isLoading && <p aria-live="polite">Loading featured bakes...</p>}

        {!isLoading && loadError && <p role="alert">{loadError}</p>}

        {!isLoading && !loadError && (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default HomePage;