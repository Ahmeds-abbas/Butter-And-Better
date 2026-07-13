import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import AnnouncementTicker from "../components/marketing/AnnouncementTicker";
import ProductCard from "../components/products/ProductCard";
import { dataClient } from "../lib/amplifyClient";
import {
  getProductImageAltText,
  resolveProductGalleryImages,
  resolveProductImageUrl,
  resolveProductMediaUrl,
} from "../lib/productImages";
import type { Product } from "../types/product";

type ProductReadAuthMode = "userPool" | "iam";

async function getProductReadAuthModes(): Promise<ProductReadAuthMode[]> {
  try {
    const session = await fetchAuthSession();

    if (session.tokens?.accessToken) {
      return ["userPool", "iam"];
    }
  } catch {
    // Guest shoppers should read with IAM through the identity pool.
  }

  return ["iam", "userPool"];
}

async function listProductsWithFallback() {
  const authModes = await getProductReadAuthModes();
  let lastError: unknown;

  for (const authMode of authModes) {
    try {
      const response = await dataClient.models.Product.list({ authMode });

      if (response.errors?.length && response.data.length === 0) {
        throw new Error(
          response.errors.map((error) => error.message).join(", "),
        );
      }

      return { authMode, response };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not load products.");
}

function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadProducts() {
      setIsLoading(true);
      setLoadError("");

      try {
        const { authMode, response: productResponse } =
          await listProductsWithFallback();

        if (productResponse.errors?.length && productResponse.data.length === 0) {
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
              const variantResponse = await product.variants({
                authMode,
              });

              if (
                variantResponse.errors?.length &&
                variantResponse.data.length === 0
              ) {
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

              const [imageUrl, galleryImageUrls, videoUrl] = await Promise.all([
                resolveProductImageUrl(product.imageKey),
                resolveProductGalleryImages(product.galleryImageUrls),
                resolveProductMediaUrl(product.videoUrl),
              ]);

              return {
                id: product.id,
                name: product.name,
                description: product.description ?? "",
                imageUrl,
                imageAltText: getProductImageAltText(
                  product.imageAltText,
                  product.name,
                ),
                galleryImageUrls,
                videoUrl,
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

  useEffect(() => {
    if (!isCategoryMenuOpen) {
      return;
    }

    function closeCategoryMenu(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !categoryMenuRef.current?.contains(event.target)
      ) {
        setIsCategoryMenuOpen(false);
      }
    }

    function closeCategoryMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCategoryMenuOpen(false);
        categoryTriggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeCategoryMenu);
    document.addEventListener("keydown", closeCategoryMenuOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeCategoryMenu);
      document.removeEventListener("keydown", closeCategoryMenuOnEscape);
    };
  }, [isCategoryMenuOpen]);

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
    setIsCategoryMenuOpen(false);
  }

  return (
    <main className="page">
      <section className="page-header shop-page-header">
        <div>
          <p className="eyebrow">Our menu</p>
          <h1>Shop all bakes</h1>
          <p>
            Image-first treats, clear fulfilment labels and quick add for the
            fastest route to a Butter & Better box.
          </p>
        </div>
        <div className="media-placeholder shop-header-media">
          <span>Product photo coming soon</span>
        </div>
      </section>

      <AnnouncementTicker
        messages={[
          "Pickup available",
          "UK tracked delivery on selected products",
          "Secure Stripe Checkout",
          "Earn loyalty stamps",
        ]}
      />

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

            <div className="shop-category-filter" ref={categoryMenuRef}>
              <span id="shop-category-label">Category</span>
              <button
                ref={categoryTriggerRef}
                type="button"
                className="shop-category-trigger"
                aria-labelledby="shop-category-label shop-category-value"
                aria-haspopup="listbox"
                aria-expanded={isCategoryMenuOpen}
                aria-controls="shop-category-menu"
                onClick={() =>
                  setIsCategoryMenuOpen((currentValue) => !currentValue)
                }
              >
                <span className="shop-category-trigger-copy">
                  <Sparkles aria-hidden="true" size={16} strokeWidth={2.2} />
                  <span id="shop-category-value">{selectedCategory}</span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="shop-category-chevron"
                  size={19}
                  strokeWidth={2.3}
                />
              </button>

              {isCategoryMenuOpen && (
                <div
                  id="shop-category-menu"
                  className="shop-category-menu"
                  role="listbox"
                  aria-labelledby="shop-category-label"
                >
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      role="option"
                      aria-selected={selectedCategory === category}
                      className={`shop-category-option ${
                        selectedCategory === category
                          ? "shop-category-option-selected"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedCategory(category);
                        setIsCategoryMenuOpen(false);
                        categoryTriggerRef.current?.focus();
                      }}
                    >
                      <span>{category}</span>
                      {selectedCategory === category && (
                        <Check aria-hidden="true" size={17} strokeWidth={2.5} />
                      )}
                    </button>
                  ))}
                </div>
              )}
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
