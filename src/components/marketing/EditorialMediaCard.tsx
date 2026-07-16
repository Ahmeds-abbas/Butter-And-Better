type EditorialMediaCardProps = {
  imageSrc: string;
  imageAlt: string;
  title: string;
  copy: string;
  imagePosition?: string;
};

function EditorialMediaCard({
  imageSrc,
  imageAlt,
  title,
  copy,
  imagePosition = "center",
}: EditorialMediaCardProps) {
  return (
    <article className="editorial-media-card">
      <div className="editorial-media-card-frame">
        <img
          src={imageSrc}
          alt={imageAlt}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: imagePosition }}
        />
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

export default EditorialMediaCard;
