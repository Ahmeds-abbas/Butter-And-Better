import { Link, NavLink } from "react-router-dom";

type NavbarProps = {
  basketItemCount: number;
};

function Navbar({ basketItemCount }: NavbarProps) {
  return (
    <header className="navbar">
      <Link to="/" className="brand">
        Butter & Better
      </Link>

      <nav className="nav-links" aria-label="Main navigation">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/shop">Shop</NavLink>
        <NavLink to="/about">About</NavLink>
        <NavLink to="/contact">Contact</NavLink>
      </nav>

      <div className="nav-actions">
        <button type="button" className="account-button">
          Account
        </button>

        <button type="button" className="basket-button">
          Basket ({basketItemCount})
        </button>
      </div>
    </header>
  );
}

export default Navbar;