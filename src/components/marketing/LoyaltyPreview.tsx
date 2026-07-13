import { formatGBP } from "../../lib/currency";

function LoyaltyPreview() {
  return (
    <section className="loyalty-preview">
      <div>
        <p className="eyebrow">Loyalty stamps</p>
        <h2>1 stamp for every {formatGBP(500)}.</h2>
        <p>
          Sign in before checkout to earn stamps. Collect 8 stamps and redeem a
          {formatGBP(500)} reward on a future order.
        </p>
      </div>

      <div className="loyalty-preview-card" aria-label="Loyalty stamp preview">
        {Array.from({ length: 8 }, (_, index) => (
          <span
            key={index}
            className={`loyalty-preview-stamp ${
              index < 5 ? "loyalty-preview-stamp-filled" : ""
            }`}
          >
            B&B
          </span>
        ))}
        <strong>8 stamps = {formatGBP(500)} off</strong>
      </div>
    </section>
  );
}

export default LoyaltyPreview;
