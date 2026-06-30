import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <Link to="/" className="primary-button">
          Return home
        </Link>
      </section>
    </main>
  );
}

export default NotFoundPage;