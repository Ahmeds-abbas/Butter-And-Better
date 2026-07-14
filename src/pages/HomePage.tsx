import { fetchAuthSession } from "aws-amplify/auth";
import { Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import SocialMediaPlaceholderGrid from "../components/marketing/SocialMediaPlaceholderGrid";
import FeaturedProductCampaignCard from "../components/products/FeaturedProductCampaignCard";
import { dataClient } from "../lib/amplifyClient";
import {
  getProductImageAltText,
  getProductImageUrl,
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
    // Guest shoppers read the public catalogue through the identity pool.
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
        throw new Error(response.errors.map((error) => error.message).join(", "));
      }

      return { authMode, response };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not load products.");
}

function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadProducts() {
      try {
        const { authMode, response } = await listProductsWithFallback();
        const activeProducts = response.data.filter((product) => product.isActive);
        const loadedProducts = await Promise.all(
          activeProducts.map(async (product) => {
            const variants = await product.variants({ authMode });
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
              imageAltText: getProductImageAltText(product.imageAltText, product.name),
              galleryImageUrls,
              videoUrl,
              category: product.category as Product["category"],
              available: product.isActive,
              variants: variants.data
                .filter((variant) => variant.isActive)
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
            } satisfies Product;
          }),
        );

        if (!isCancelled) {
          setProducts(loadedProducts);
        }
      } catch (error) {
        console.error("Failed to load home page products:", error);
        if (!isCancelled) {
          setLoadError("Fresh bakes are unavailable right now. Please visit the menu shortly.");
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

  const featuredProducts = [...products]
    .filter((product) => product.variants.length > 0)
    .sort((first, second) => {
      const mediaScore = (product: Product) =>
        (product.imageUrl.startsWith("data:image/svg+xml") ? 0 : 4) +
        Math.min(product.galleryImageUrls.length, 2) +
        (product.videoUrl ? 1 : 0);

      return mediaScore(second) - mediaScore(first);
    })
    .slice(0, 4);
  const featuredProduct = featuredProducts[0] ?? products[0];
  const heroImage = getProductImageUrl(featuredProduct?.imageUrl);
  const hasHeroImage = Boolean(
    featuredProduct && !heroImage.startsWith("data:image/svg+xml"),
  );
  const photoMoments = products
    .slice(0, 3)
    .map((product) => ({
      id: product.id,
      title: product.name,
      imageUrl: product.imageUrl,
      imageAltText: product.imageAltText,
    }));

  return (
    <main className="home-page">
      <section
        className={`home-main-hero ${hasHeroImage ? "" : "home-main-hero-no-image"}`}
        aria-labelledby={isLoading ? undefined : "home-hero-title"}
        aria-label={isLoading ? "Loading featured Butter and Better product" : undefined}
      >
        {hasHeroImage && (
          <img
            src={heroImage}
            alt={featuredProduct?.imageAltText ?? "Butter & Better bakery selection"}
            className="home-main-hero-image"
          />
        )}
        <div className="home-main-hero-shade" />
        {isLoading ? (
          <div className="home-main-hero-loading" role="status">
            <strong>B&amp;B</strong>
            <span>Preparing this week&apos;s flavour</span>
            <span className="home-hero-loading-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : (
          <div className="home-main-hero-content home-main-hero-content-ready">
            {featuredProduct && (
              <p className="hero-pill">
                <span className="hero-pill-sparkles" aria-hidden="true">
                  <Star size={8} strokeWidth={2.2} fill="currentColor" />
                  <Sparkles size={15} strokeWidth={2.4} />
                </span>
                <span>Flavour of the Week</span>
                <span className="hero-pill-sparkles" aria-hidden="true">
                  <Sparkles size={13} strokeWidth={2.4} />
                  <Star size={7} strokeWidth={2.2} fill="currentColor" />
                </span>
              </p>
            )}
            <h1 id="home-hero-title">
              {featuredProduct?.name ?? "Butter & Better"}
            </h1>
            <p>
              {featuredProduct?.description ??
                "The featured menu could not be loaded right now."}
            </p>
            <Link to="/shop" className="hero-carousel-button">
              Explore Our Menu
            </Link>
          </div>
        )}
      </section>

      {loadError && <p className="home-load-error" role="status">{loadError}</p>}

      <section
        className="featured-campaign-section home-content-block"
        aria-labelledby="featured-campaign-heading"
      >
        <div className="featured-campaign-heading">
          <p className="eyebrow">The Butter &amp; Better edit</p>
          <h2 id="featured-campaign-heading">Big flavour. Centre stage.</h2>
          <p>
            A closer look at this week&apos;s standout bakes, selected from the
            live menu.
          </p>
        </div>

        {isLoading && (
          <div className="featured-campaign-loading" aria-live="polite">
            <span>Loading featured bakes...</span>
          </div>
        )}

        {!isLoading && featuredProducts.length > 0 && (
          <div className="featured-campaign-stack">
            {featuredProducts.map((product, index) => (
              <FeaturedProductCampaignCard
                key={product.id}
                product={product}
                index={index}
                reverse={index % 2 === 1}
                label={
                  [
                    "Flavour of the Week",
                    "Best Seller",
                    "New Drop",
                    "Customer Favourite",
                  ][index]
                }
              />
            ))}
          </div>
        )}
      </section>

      <SocialMediaPlaceholderGrid moments={photoMoments} />

      <section className="home-final-cta home-content-block">
        <p className="eyebrow">Butter &amp; Better</p>
        <h2>ready for something better?</h2>
        <p>Browse the latest small-batch menu at butterandbetter.co.uk.</p>
        <Link to="/shop" className="primary-button">Explore Our Menu</Link>
      </section>
    </main>
  );
}

export default HomePage;
