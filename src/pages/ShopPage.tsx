import { useMemo, useState } from "react";
import ProductCard from "../components/products/ProductCard";
import { products } from "../data/products";

function ShopPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category))],
    [],
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
  }, [searchTerm, selectedCategory]);

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
    </main>
  );
}

export default ShopPage;
