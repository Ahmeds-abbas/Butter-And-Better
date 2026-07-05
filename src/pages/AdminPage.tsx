import { useCallback, useEffect, useMemo, useState } from "react";
import { dataClient } from "../lib/amplifyClient";

type AdminVariant = {
  id: string;
  name: string;
  priceInPence: number;
  isActive: boolean;
  sortOrder: number | null;
};

type AdminProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  isActive: boolean;
  nationwideDelivery: boolean;
  manchesterDelivery: boolean;
  collectionAvailable: boolean;
  variants: AdminVariant[];
};

type ProductUpdateInput = Parameters<
  typeof dataClient.models.Product.update
>[0];

function AdminPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(
    null,
  );

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const productResponse = await dataClient.models.Product.list({
        authMode: "userPool",
      });

      if (productResponse.errors?.length) {
        throw new Error(
          productResponse.errors.map((error) => error.message).join(", "),
        );
      }

      const loadedProducts: AdminProduct[] = await Promise.all(
        productResponse.data.map(async (product) => {
          const variantResponse = await product.variants({
            authMode: "userPool",
          });

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
            category: product.category,
            description: product.description ?? "",
            isActive: product.isActive,
            nationwideDelivery: product.nationwideDelivery,
            manchesterDelivery: product.manchesterDelivery,
            collectionAvailable: product.collectionAvailable,
            variants: variantResponse.data
              .map((variant) => ({
                id: variant.id,
                name: variant.name,
                priceInPence: variant.priceInPence,
                isActive: variant.isActive,
                sortOrder: variant.sortOrder ?? null,
              }))
              .sort(
                (first, second) =>
                  (first.sortOrder ?? 0) - (second.sortOrder ?? 0),
              ),
          };
        }),
      );

      loadedProducts.sort((first, second) =>
        first.name.localeCompare(second.name),
      );

      setProducts(loadedProducts);
    } catch (error) {
      console.error("Failed to load admin products:", error);
      setLoadError("Could not load the product catalogue.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  const catalogueStats = useMemo(() => {
    const activeProducts = products.filter((product) => product.isActive);
    const totalVariants = products.reduce(
      (total, product) => total + product.variants.length,
      0,
    );

    return {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      inactiveProducts: products.length - activeProducts.length,
      totalVariants,
    };
  }, [products]);

  async function toggleProductAvailability(product: AdminProduct) {
    const nextIsActive = !product.isActive;

    setUpdatingProductId(product.id);
    setActionError("");

    try {
      const updateInput = {
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.description,
        isActive: nextIsActive,
        nationwideDelivery: product.nationwideDelivery,
        manchesterDelivery: product.manchesterDelivery,
        collectionAvailable: product.collectionAvailable,
      } as unknown as ProductUpdateInput;

      const response = await dataClient.models.Product.update(updateInput, {
        authMode: "userPool",
      });

      if (response.errors?.length || !response.data) {
        throw new Error(
          response.errors?.map((error) => error.message).join(", ") ??
            "No product returned after update.",
        );
      }

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === product.id
            ? {
                ...currentProduct,
                isActive: response.data?.isActive ?? nextIsActive,
              }
            : currentProduct,
        ),
      );
    } catch (error) {
      console.error("Failed to update product:", error);
      setActionError(
        `Could not update ${product.name}. The other products are unchanged.`,
      );
    } finally {
      setUpdatingProductId(null);
    }
  }

  return (
    <main className="page admin-dashboard">
      <section className="page-header admin-dashboard-header">
        <div>
          <p className="eyebrow">Admin dashboard</p>
          <h1>Manage Butter & Better</h1>
          <p>Manage products, availability, prices and delivery options.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadProducts()}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh catalogue"}
        </button>
      </section>

      {!isLoading && !loadError && (
        <section className="admin-stats" aria-label="Catalogue summary">
          <article className="admin-stat-card">
            <span>Total products</span>
            <strong>{catalogueStats.totalProducts}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Available</span>
            <strong>{catalogueStats.activeProducts}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Unavailable</span>
            <strong>{catalogueStats.inactiveProducts}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Total variants</span>
            <strong>{catalogueStats.totalVariants}</strong>
          </article>
        </section>
      )}

      {isLoading && (
        <section className="admin-state-message" aria-live="polite">
          <p>Loading products...</p>
        </section>
      )}

      {!isLoading && loadError && (
        <section className="admin-state-message" role="alert">
          <h2>Something went wrong</h2>
          <p>{loadError}</p>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadProducts()}
          >
            Try again
          </button>
        </section>
      )}

      {!isLoading && !loadError && actionError && (
        <div className="admin-action-error" role="alert">
          <span>{actionError}</span>

          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setActionError("")}
          >
            ×
          </button>
        </div>
      )}

      {!isLoading && !loadError && (
        <section className="admin-products">
          <div className="section-heading">
            <p className="eyebrow">Catalogue</p>
            <h2>Products</h2>
          </div>

          <div className="admin-product-grid">
            {products.map((product) => (
              <article
                key={product.id}
                className={`admin-product-card ${
                  product.isActive ? "" : "admin-product-card-inactive"
                }`}
              >
                <div className="admin-product-top">
                  <div>
                    <p className="eyebrow">{product.category}</p>
                    <h3>{product.name}</h3>
                  </div>

                  <span
                    className={`admin-status-badge ${
                      product.isActive
                        ? "admin-status-active"
                        : "admin-status-inactive"
                    }`}
                  >
                    {product.isActive ? "Available" : "Unavailable"}
                  </span>
                </div>

                <p className="admin-product-description">
                  {product.description}
                </p>

                <div className="admin-delivery-options">
                  <span
                    className={
                      product.nationwideDelivery
                        ? "admin-option-enabled"
                        : "admin-option-disabled"
                    }
                  >
                    Nationwide
                  </span>

                  <span
                    className={
                      product.manchesterDelivery
                        ? "admin-option-enabled"
                        : "admin-option-disabled"
                    }
                  >
                    Manchester
                  </span>

                  <span
                    className={
                      product.collectionAvailable
                        ? "admin-option-enabled"
                        : "admin-option-disabled"
                    }
                  >
                    Collection
                  </span>
                </div>

                <div className="admin-variant-list">
                  <div className="admin-variant-heading">
                    <h4>Variants</h4>
                    <span>{product.variants.length}</span>
                  </div>

                  {product.variants.length === 0 ? (
                    <p>No variants added.</p>
                  ) : (
                    product.variants.map((variant) => (
                      <div key={variant.id} className="admin-variant-row">
                        <div>
                          <span>{variant.name}</span>
                          <small>
                            {variant.isActive ? "Active" : "Inactive"}
                          </small>
                        </div>

                        <strong>
                          £{(variant.priceInPence / 100).toFixed(2)}
                        </strong>
                      </div>
                    ))
                  )}
                </div>

                <div className="admin-product-actions">
                  <button
                    type="button"
                    className={
                      product.isActive
                        ? "secondary-button"
                        : "primary-button"
                    }
                    disabled={updatingProductId === product.id}
                    onClick={() => void toggleProductAvailability(product)}
                  >
                    {updatingProductId === product.id
                      ? "Updating..."
                      : product.isActive
                        ? "Disable product"
                        : "Enable product"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default AdminPage;
