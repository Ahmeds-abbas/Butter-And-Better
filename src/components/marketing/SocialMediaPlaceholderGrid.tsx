type VideoMoment = {
  id: string;
  title: string;
  videoUrl: string;
  posterUrl: string;
};

type SocialMediaPlaceholderGridProps = {
  moments: VideoMoment[];
};

const placeholderMoments = ["Mixing", "Fresh bake reveal", "Packing orders"];

function SocialMediaPlaceholderGrid({ moments }: SocialMediaPlaceholderGridProps) {
  return (
    <section className="video-moments-section home-content-block" aria-labelledby="video-moments-title">
      <div className="section-heading">
        <p className="eyebrow">Fresh from the kitchen</p>
        <h2 id="video-moments-title">Video moments</h2>
      </div>

      <div className="video-moments-row">
        {moments.length > 0
          ? moments.map((moment) => (
              <article key={moment.id} className="video-moment-card">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster={moment.posterUrl}
                  src={moment.videoUrl}
                >
                  <track kind="captions" />
                </video>
                <h3>{moment.title}</h3>
              </article>
            ))
          : placeholderMoments.map((title) => (
              <article key={title} className="video-moment-card video-moment-placeholder">
                <div role="img" aria-label={`${title} video coming soon`}>
                  <span>Video coming soon</span>
                </div>
                <h3>{title}</h3>
              </article>
            ))}
      </div>
    </section>
  );
}

export default SocialMediaPlaceholderGrid;
