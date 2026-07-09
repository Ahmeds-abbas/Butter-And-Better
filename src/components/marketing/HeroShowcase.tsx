import { Link } from "react-router-dom";

const heroSlides = [
  {
    label: "Freshly baked",
    title: "Beautifully boxed bakes",
    copy: "Cookies, brownies, brookies, blondies and banana pudding made for sweet gifting and proper treat moments.",
    mediaLabel: "Full-bleed hero photo or video coming soon",
  },
  {
    label: "Best seller",
    title: "Cookies, boxed your way",
    copy: "Pick your flavour, add to basket, then choose free pickup or UK tracked delivery where available.",
    mediaLabel: "Product close-up hero coming soon",
  },
  {
    label: "Loyalty stamps",
    title: "Treats that give back",
    copy: "Signed-in customers earn 1 stamp per GBP 5 spent on products. Eight stamps unlock GBP 5 off.",
    mediaLabel: "Loyalty and packing video coming soon",
  },
];

function HeroShowcase() {
  return (
    <section className="hero-carousel" aria-label="Butter & Better highlights">
      {heroSlides.map((slide, index) => (
        <article
          key={slide.title}
          className={`hero-carousel-slide hero-carousel-slide-${index + 1}`}
        >
          <div className="hero-carousel-media">
            <span>{slide.mediaLabel}</span>
          </div>
          <div className="hero-carousel-overlay">
            <span className="hero-pill">{slide.label}</span>
            <h1>{slide.title}</h1>
            <p>{slide.copy}</p>
            <Link to="/shop" className="hero-carousel-button">
              Shop treats
            </Link>
          </div>
        </article>
      ))}

      <button
        type="button"
        className="hero-carousel-arrow hero-carousel-arrow-left"
        aria-label="Previous highlight"
      >
        ‹
      </button>
      <button
        type="button"
        className="hero-carousel-arrow hero-carousel-arrow-right"
        aria-label="Next highlight"
      >
        ›
      </button>

      <div className="hero-carousel-dots" aria-label="Hero slide indicators">
        {heroSlides.map((slide, index) => (
          <span
            key={slide.title}
            className={index === 0 ? "hero-carousel-dot-active" : undefined}
          />
        ))}
      </div>
    </section>
  );
}

export default HeroShowcase;
