type EditorialMediaCardProps = {
  label: string;
  title: string;
  copy: string;
};

function EditorialMediaCard({ label, title, copy }: EditorialMediaCardProps) {
  return (
    <article className="editorial-media-card">
      <div className="editorial-media-card-frame">
        <span>{label}</span>
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

export default EditorialMediaCard;
