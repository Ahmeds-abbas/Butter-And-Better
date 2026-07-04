import { useEffect, useMemo, useState } from "react";
import ProductCard from "../components/products/ProductCard";
import { dataClient } from "../lib/amplifyClient";
import type { Product } from "../types/product";

function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    let isCancelled = false;

    async function loadProducts() {
      setIsLoading(true);
      setLoadError("");

      try {
        const productResponse = await dataClient.models.Product.list();

        if (productResponse.errors?.length) {
          throw new Error(
            productResponse.errors
              .map((error) => error.message)
              .join(", "),
          );
        }

        const loadedProducts: Product[] = await Promise.all(
          productResponse.data
            .filter((product) => product.isActive)
            .map(async (product) => {
            const variantResponse = await product.variants();

            if (variantResponse.errors?.length) {
              throw new Error(
                variantResponse.errors
                  .map((error) => error.message)
                  .join(", "),
              );
            }

            const variants = variantResponse.data
              .filter((variant) => variant.isActive)
              .sort(
                (first, second) =>
                  (first.sortOrder ?? 0) - (second.sortOrder ?? 0),
              )
              .map((variant) => ({
                id: variant.id,
                name: variant.name,
                price: variant.priceInPence / 100,
              }));

            return {
              id: product.id,
              name: product.name,
              description: product.description ?? "",
              imageUrl: product.imageKey ?? "/src/assets/hero.png",
              category: product.category as Product["category"],
              available: product.isActive,
              variants,
              deliveryOptions: {
                nationwide: product.nationwideDelivery,
                manchester: product.manchesterDelivery,
                collection: product.collectionAvailable,
              },
            } satisfies Product;
            }),
        );

        if (!isCancelled) {
          setProducts(loadedProducts);
        }
      } catch (error) {
        console.error("Failed to load products:", error);

        if (!isCancelled) {
          setLoadError(
            "We could not load the menu. Please refresh the page and try again.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category))],
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "All" || product.category === selectedCategory;

      const searchableText = [
        product.name,
        product.description,
        product.category,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        normalizedSearchTerm === "" ||
        searchableText.includes(normalizedSearchTerm);

      return matchesCategory && matchesSearch;
    });
  }, [products, searchTerm, selectedCategory]);

  function clearFilters() {
    setSearchTerm("");
    setSelectedCategory("All");
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Our menu</p>
        <h1>Shop all bakes</h1>
        <p>
          Browse cookies, brownies, brookies, blondies and banana pudding.
        </p>
      </section>

      {isLoading && (
        <section className="no-products-found" aria-live="polite">
          <p>Loading the menu...</p>
        </section>
      )}

      {!isLoading && loadError && (
        <section className="no-products-found" role="alert">
          <h2>Menu unavailable</h2>
          <p>{loadError}</p>
        </section>
      )}

      {!isLoading && !loadError && (
        <>
          <section className="shop-controls" aria-label="Shop filters">
            <label className="shop-search">
              <span>Search products</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, description or category"
              />
            </label>

            <div className="shop-category-filter">
              <span>Category</span>

              <div className="category-filter-buttons">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`category-filter-button ${
                      selectedCategory === category
                        ? "category-filter-button-active"
                        : ""
                    }`}
                    aria-pressed={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <p className="shop-results-count" aria-live="polite">
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "product" : "products"} found
            </p>
          </section>

          <section className="product-grid">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </section>

          {filteredProducts.length === 0 && (
            <section className="no-products-found">
              <h2>No bakes found</h2>
              <p>Try another search or clear your filters.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default ShopPage;
