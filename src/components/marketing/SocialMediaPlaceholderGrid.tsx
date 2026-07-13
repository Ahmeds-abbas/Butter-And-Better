type PhotoMoment = {
  id: string;
  title: string;
  imageUrl: string;
  imageAltText: string;
};

type SocialMediaPlaceholderGridProps = {
  moments: PhotoMoment[];
};

const placeholderMoments = ["fresh bakes", "sweet details", "beautifully boxed"];

function SocialMediaPlaceholderGrid({ moments }: SocialMediaPlaceholderGridProps) {
  return (
    <section className="video-moments-section home-content-block" aria-labelledby="photo-moments-title">
      <div className="section-heading">
        <p className="eyebrow">Fresh from the kitchen</p>
        <h2 id="photo-moments-title">In the kitchen</h2>
      </div>

      <div className="video-moments-row">
        {moments.length > 0
          ? moments.map((moment) => (
              <article key={moment.id} className="video-moment-card">
                <img src={moment.imageUrl} alt={moment.imageAltText} />
                <h3>{moment.title}</h3>
              </article>
            ))
          : placeholderMoments.map((title) => (
              <article key={title} className="video-moment-card video-moment-placeholder">
                <div role="img" aria-label={`${title} photo coming soon`}>
                  <span>Photo coming soon</span>
                </div>
                <h3>{title}</h3>
              </article>
            ))}
      </div>
    </section>
  );
}

export default SocialMediaPlaceholderGrid;
