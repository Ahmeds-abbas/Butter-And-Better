import { ArrowUpRight, ShoppingBag } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router-dom";

import { useBasket } from "../../hooks/useBasket";
import { formatGBPFromPounds } from "../../lib/currency";
import { getProductImageUrl } from "../../lib/productImages";
import type { Product } from "../../types/product";

type FeaturedProductCampaignCardProps = {
  product: Product;
  label: string;
  reverse: boolean;
  index: number;
};

function FeaturedProductCampaignCard({
  product,
  label,
  reverse,
  index,
}: FeaturedProductCampaignCardProps) {
  const { addToBasket } = useBasket();
  const cardRef = useRef<HTMLElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [basketMessage, setBasketMessage] = useState("");
  const defaultVariant = [...product.variants].sort(
    (first, second) => first.price - second.price,
  )[0];

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  function setPointerPosition(x: number, y: number) {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      cardRef.current?.style.setProperty("--campaign-pointer-x", x.toFixed(3));
      cardRef.current?.style.setProperty("--campaign-pointer-y", y.toFixed(3));
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse") {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    setPointerPosition(x, y);
  }

  function handleAddToBasket() {
    if (!defaultVariant) {
      return;
    }

    addToBasket({
      productId: product.id,
      productName: product.name,
      variantId: defaultVariant.id,
      variantName: defaultVariant.name,
      unitPrice: defaultVariant.price,
      quantity: 1,
      imageUrl: product.imageUrl,
    });
    setBasketMessage(`${defaultVariant.name} added to basket.`);
  }

  return (
    <article
      ref={cardRef}
      className={`featured-campaign-card featured-campaign-card-${(index % 4) + 1} ${
        reverse ? "featured-campaign-card-reverse" : ""
      }`}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setPointerPosition(0, 0)}
    >
      <div className="featured-campaign-background" aria-hidden="true">
        <span>{product.name}</span>
        <span>{product.name}</span>
      </div>

      <div className="featured-campaign-copy">
        <span className="featured-campaign-label">{label}</span>
        <p className="featured-campaign-category">{product.category}</p>
        <h3>{product.name}</h3>
        <p className="featured-campaign-description">{product.description}</p>
        {defaultVariant && (
          <p className="featured-campaign-price">
            From {formatGBPFromPounds(defaultVariant.price)}
          </p>
        )}

        <div className="featured-campaign-actions">
          <Link
            to={`/products/${product.id}`}
            className="featured-campaign-link"
          >
            View Product
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="featured-campaign-add"
            disabled={!defaultVariant}
            onClick={handleAddToBasket}
          >
            <ShoppingBag aria-hidden="true" />
            Add to Basket
          </button>
        </div>

        {basketMessage && (
          <p className="featured-campaign-message" aria-live="polite">
            {basketMessage}
          </p>
        )}
      </div>

      <Link
        to={`/products/${product.id}`}
        className="featured-campaign-media"
        aria-label={`View ${product.name}`}
      >
        <span className="featured-campaign-image-halo" aria-hidden="true" />
        <img
          src={getProductImageUrl(product.imageUrl)}
          alt={product.imageAltText}
        />
      </Link>
    </article>
  );
}

export default FeaturedProductCampaignCard;
