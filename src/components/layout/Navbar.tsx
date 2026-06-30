import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

type NavbarProps = {
  basketItemCount: number;
};

function Navbar({ basketItemCount }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
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

          <Link to="/basket" className="basket-button">
            Basket ({basketItemCount})
          </Link>

          <button
            type="button"
            className="mobile-menu-button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={() => setMenuOpen((currentMenuOpen) => !currentMenuOpen)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      <nav
        id="mobile-navigation"
        className={
          menuOpen
            ? "mobile-navigation mobile-navigation-open"
            : "mobile-navigation"
        }
        aria-label="Mobile navigation"
      >
        <NavLink to="/" onClick={closeMenu}>
          Home
        </NavLink>
        <NavLink to="/shop" onClick={closeMenu}>
          Shop
        </NavLink>
        <NavLink to="/about" onClick={closeMenu}>
          About
        </NavLink>
        <NavLink to="/contact" onClick={closeMenu}>
          Contact
        </NavLink>
        <Link to="/basket" onClick={closeMenu}>
          Basket ({basketItemCount})
        </Link>
      </nav>
    </>
  );
}

export default Navbar;
