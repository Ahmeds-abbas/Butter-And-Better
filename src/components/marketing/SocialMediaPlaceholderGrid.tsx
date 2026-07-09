const socialCards = [
  "Mixing clip placeholder",
  "Fresh bake reveal placeholder",
  "Packing orders placeholder",
];

function SocialMediaPlaceholderGrid() {
  return (
    <section className="social-placeholder-section">
      <div className="section-heading">
        <p className="eyebrow">Fresh from the kitchen</p>
        <h2>Video moments coming soon</h2>
      </div>

      <div className="social-placeholder-grid">
        {socialCards.map((label) => (
          <article key={label} className="social-placeholder-card">
            <div className="social-placeholder-frame">
              <span>{label}</span>
            </div>
            <p>Instagram or TikTok style content placeholder.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default SocialMediaPlaceholderGrid;
