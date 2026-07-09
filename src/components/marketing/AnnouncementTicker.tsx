type AnnouncementTickerProps = {
  messages: string[];
};

function AnnouncementTicker({ messages }: AnnouncementTickerProps) {
  const repeatedMessages = [...messages, ...messages];

  return (
    <section className="announcement-ticker" aria-label="Shop announcements">
      <div className="announcement-ticker-track">
        {repeatedMessages.map((message, index) => (
          <span key={`${message}-${index}`}>{message}</span>
        ))}
      </div>
    </section>
  );
}

export default AnnouncementTicker;
