import { FaGithub, FaInstagram, FaRegEnvelope } from "react-icons/fa6";

const instagramUrl = "https://www.instagram.com/butterandbetterbakery/";
const contactEmail = "butterandbetterbakery@gmail.com";

function ContactPage() {
  return (
    <main className="page contact-page">
      <section className="page-header contact-header">
        <div>
          <p className="eyebrow">Get in touch</p>
          <h1>Contact us</h1>
        </div>
      </section>

      <section className="contact-links" aria-label="Contact Butter and Better">
        <a href={`mailto:${contactEmail}`} className="contact-link-card">
          <FaRegEnvelope aria-hidden="true" />
          <span>
            <small>Email</small>
            <strong>{contactEmail}</strong>
          </span>
        </a>
        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          className="contact-link-card"
        >
          <FaInstagram aria-hidden="true" />
          <span>
            <small>Instagram</small>
            <strong>@butterandbetterbakery</strong>
          </span>
        </a>
      </section>

      <section className="contact-credits" aria-label="Site credits">
        <p>Owned by <strong>Sarah Zein</strong></p>
        <a
          href="https://github.com/Ahmeds-abbas"
          target="_blank"
          rel="noreferrer"
        >
          <FaGithub aria-hidden="true" />
          <span>Powered by <strong>Ahmed Abbas</strong></span>
        </a>
      </section>
    </main>
  );
}

export default ContactPage;
