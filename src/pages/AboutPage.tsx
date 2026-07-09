import EditorialMediaCard from "../components/marketing/EditorialMediaCard";
import LoyaltyPreview from "../components/marketing/LoyaltyPreview";

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
        <div className="media-placeholder story-header-media">
          <span>Bakery story photo coming soon</span>
        </div>
      </section>

      <section className="editorial-section">
        <div className="section-heading">
          <p className="eyebrow">Made with care</p>
          <h2>Small-batch feel, polished finish.</h2>
        </div>

        <div className="editorial-grid">
          <EditorialMediaCard
            label="Ingredients photo coming soon"
            title="Thoughtful recipes"
            copy="Cookies, brownies, brookies, blondies and banana pudding sit at the heart of the menu."
          />
          <EditorialMediaCard
            label="Oven photo coming soon"
            title="Freshly prepared"
            copy="Orders are handled with a fresh, handmade bakery mindset."
          />
          <EditorialMediaCard
            label="Boxing photo coming soon"
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
