import { ShieldCheck } from "lucide-react";
import { FaInstagram, FaRegEnvelope, FaTiktok } from "react-icons/fa6";
import { Link } from "react-router-dom";

const footerLinks = [
  { to: "/about", label: "About us" },
  { to: "/contact", label: "Delivery & pickup" },
  { to: "/contact", label: "Contact" },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <nav className="site-footer-links" aria-label="Footer navigation">
          {footerLinks.map((link) => (
            <Link key={`${link.to}-${link.label}`} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>

        <Link to="/" className="site-footer-brand" aria-label="Butter and Better home">
          <span className="site-footer-brand-name">Butter &amp; Better</span>
          <span className="site-footer-brand-subtitle">Small-batch bakery</span>
        </Link>

        <div className="site-footer-social">
          <p>Follow us on social media.</p>
          <div className="site-footer-social-icons">
            <span
              role="img"
              title="Instagram profile coming soon"
              aria-label="Instagram profile coming soon"
            >
              <FaInstagram aria-hidden="true" />
            </span>
            <span
              role="img"
              title="TikTok profile coming soon"
              aria-label="TikTok profile coming soon"
            >
              <FaTiktok aria-hidden="true" />
            </span>
            <Link to="/contact" aria-label="Contact Butter and Better">
              <FaRegEnvelope aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>{"\u00A9"} {new Date().getFullYear()}, Butter &amp; Better.</p>
        <div className="site-footer-payments" aria-label="Secure payment information">
          <span className="site-footer-secure-payment">
            <ShieldCheck aria-hidden="true" />
            Secure checkout by Stripe
          </span>
          <span>Visa</span>
          <span>Mastercard</span>
          <span>Amex</span>
        </div>
      </div>
    </footer>
  );
}
