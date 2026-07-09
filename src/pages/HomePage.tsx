import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Link } from "react-router-dom";

import AnnouncementTicker from "../components/marketing/AnnouncementTicker";
import EditorialMediaCard from "../components/marketing/EditorialMediaCard";
import HeroShowcase from "../components/marketing/HeroShowcase";
import LoyaltyPreview from "../components/marketing/LoyaltyPreview";
import SocialMediaPlaceholderGrid from "../components/marketing/SocialMediaPlaceholderGrid";
import ProductCard from "../components/products/ProductCard";
import { dataClient } from "../lib/amplifyClient";
import {
  getProductImageAltText,
  getProductImageUrl,
  parseProductGalleryImages,
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
        const { authMode, response: productResponse } =
          await listProductsWithFallback();

        if (productResponse.errors?.length && productResponse.data.length === 0) {
          throw new Error(
            productResponse.errors.map((error) => error.message).join(", "),
          );
        }

        const activeProducts = productResponse.data.filter(
          (product) => product.isActive,
        );

        const loadedProducts: Product[] = await Promise.all(
          activeProducts.map(async (product) => {
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

            return {
              id: product.id,
              name: product.name,
              description: product.description ?? "",
              imageUrl: getProductImageUrl(product.imageKey),
              imageAltText: getProductImageAltText(
                product.imageAltText,
                product.name,
              ),
              galleryImageUrls: parseProductGalleryImages(
                product.galleryImageUrls,
              ),
              videoUrl: product.videoUrl ?? "",
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

  const spotlightProduct = products[0];
  const galleryProduct = products[1] ?? products[0];

  return (
    <main>
      <HeroShowcase />

      <section className="launch-spotlight">
        {spotlightProduct ? (
          <img
            src={spotlightProduct.imageUrl}
            alt={spotlightProduct.imageAltText}
            className="launch-spotlight-image"
          />
        ) : (
          <div className="launch-spotlight-media">
            <span>Featured product photo coming soon</span>
          </div>
        )}
        <div className="launch-spotlight-copy">
          <p className="eyebrow">Fresh drop</p>
          <h2>{spotlightProduct?.name ?? "Freshly baked treats."}</h2>
          <p>
            {spotlightProduct?.description ??
              "Real product photography will appear here once added in admin."}
          </p>
          <Link to="/shop" className="primary-button">
            Shop the menu
          </Link>
        </div>
      </section>

      <section className="news-gallery-section section-band">
        <div className="section-heading section-heading-centered">
          <p className="eyebrow">News & gallery</p>
          <h2>Fresh from the Butter & Better kitchen</h2>
        </div>
        <div className="news-gallery-feature">
          {galleryProduct ? (
            <img
              src={galleryProduct.galleryImageUrls[0] ?? galleryProduct.imageUrl}
              alt={galleryProduct.imageAltText}
              className="news-gallery-image"
            />
          ) : (
            <div className="news-gallery-media">
              <span>Launch photo coming soon</span>
            </div>
          )}
          <div>
            <span className="product-badge">New drop</span>
            <h3>{galleryProduct?.name ?? "Small-batch boxes, built for gifting."}</h3>
            <p>
              {galleryProduct?.description ??
                "Use this editorial feature for seasonal bakes, limited drops or behind-the-scenes kitchen updates."}
            </p>
          </div>
        </div>
      </section>

      <section className="how-made-section section-band">
        <div className="section-heading">
          <p className="eyebrow">How it's made</p>
          <h2>From batter to beautiful box.</h2>
        </div>

        <div className="how-made-grid">
          <EditorialMediaCard
            label="Mixing video coming soon"
            title="The mix"
            copy="Soft doughs, glossy batters and creamy pudding bases start the process."
          />
          <EditorialMediaCard
            label="Hand prep photo coming soon"
            title="Prepared by hand"
            copy="Each product is portioned, finished and handled with small-batch care."
          />
          <EditorialMediaCard
            label="Packed order photo coming soon"
            title="Ready for pickup or delivery"
            copy="Orders are packed neatly before pickup or UK tracked delivery where available."
          />
        </div>
      </section>

      <section className="featured-products product-lineup-section section-band">
        <div className="section-heading">
          <p className="eyebrow">The treat lineup</p>
          <h2>Pick your box.</h2>
          <p>
            Explore the current Butter & Better menu with quick add, delivery
            badges and detail pages for choosing variants.
          </p>
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

      <section className="how-it-works order-info-section section-band">
        <div className="section-heading">
          <p className="eyebrow">Order confidence</p>
          <h2>Clear fulfilment before payment.</h2>
        </div>

        <div className="process-grid">
          {[
            ["01", "Choose your treats", "Pick cookies, brownies, brookies, blondies or banana pudding."],
            ["02", "Pick fulfilment", "Choose free pickup or UK tracked delivery where the full basket is eligible."],
            ["03", "Pay securely", "Checkout is handled through Stripe so payment is confirmed safely."],
            ["04", "Earn stamps", "Signed-in customers earn loyalty stamps after paid orders."],
          ].map(([step, title, copy]) => (
            <article key={step} className="process-card">
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <LoyaltyPreview />
      <SocialMediaPlaceholderGrid />

      <AnnouncementTicker
        messages={[
          "Cookies",
          "Brownies",
          "Brookies",
          "Blondies",
          "Banana pudding",
          "Freshly baked",
        ]}
      />

      <section className="home-confidence-strip">
        <div>
          <strong>Pickup is always free.</strong>
          <span>UK tracked delivery is GBP 2.99 on eligible baskets.</span>
        </div>
        <Link to="/shop" className="primary-button">
          Start an order
        </Link>
      </section>
    </main>
  );
}

export default HomePage;
