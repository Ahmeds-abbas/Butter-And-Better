import EditorialMediaCard from "../components/marketing/EditorialMediaCard";
import LoyaltyPreview from "../components/marketing/LoyaltyPreview";
import customPiecesImage from "../assets/about-custom-pieces.jpg";
import freshlyBakedImage from "../assets/about-freshly-baked.jpg";
import mixingImage from "../assets/about-mixing.jpg";
import preparationImage from "../assets/about-preparation.jpg";

function AboutPage() {
  return (
    <main className="page">
      <section className="page-header story-header">
        <div>
          <p className="eyebrow">About us</p>
          <h1>Butter & Better</h1>
          <p>
            Warm, premium bakes made for gifting, celebrations and everyday
            cravings. The shop experience is simple: choose treats, pick pickup
            or eligible UK tracked delivery, then pay securely.
          </p>
        </div>
        <div className="story-header-media">
          <img
            src={customPiecesImage}
            alt="A custom Butter and Better birthday brownie box"
            className="story-header-image"
            decoding="async"
          />
          <div className="story-header-media-copy">
            <span>Made for your moment</span>
            <strong>We make custom pieces.</strong>
          </div>
        </div>
      </section>

      <section className="editorial-section">
        <div className="section-heading">
          <p className="eyebrow">Made with care</p>
          <h2>Small-batch feel, polished finish.</h2>
        </div>

        <div className="editorial-grid">
          <EditorialMediaCard
            imageSrc={mixingImage}
            imageAlt="Chopped chocolate ready for a Butter and Better bake"
            title="Thoughtful recipes"
            copy="Cookies, brownies, brookies, blondies and banana pudding sit at the heart of the menu."
          />
          <EditorialMediaCard
            imageSrc={preparationImage}
            imageAlt="Cookie dough and chocolate being prepared by hand"
            title="Freshly prepared"
            copy="Orders are handled with a fresh, handmade bakery mindset."
          />
          <EditorialMediaCard
            imageSrc={freshlyBakedImage}
            imageAlt="Freshly baked Butter and Better cinnamon rolls"
            title="Ready to gift"
            copy="The experience is designed to feel beautiful from product page to pickup or delivery."
          />
        </div>
      </section>

      <LoyaltyPreview />
    </main>
  );
}

export default AboutPage;
