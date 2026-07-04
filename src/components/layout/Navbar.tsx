import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import "../../lib/amplifyConfig";

type NavbarProps = {
  basketItemCount: number;
};

function Navbar({ basketItemCount }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        const session = await fetchAuthSession();
        const groups =
          session.tokens?.accessToken.payload["cognito:groups"];

        setIsAdmin(Array.isArray(groups) && groups.includes("Admin"));
      } catch {
        setIsAdmin(false);
      }
    }

    void checkAdminStatus();

    const stopListening = Hub.listen("auth", () => {
      void checkAdminStatus();
    });

    return stopListening;
  }, []);

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

          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        <div className="nav-actions">
          <Link to="/account" className="account-button">
            Account
          </Link>

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
            onClick={() => setMenuOpen((current) => !current)}
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

        <NavLink to="/account" onClick={closeMenu}>
          Account
        </NavLink>

        {isAdmin && (
          <NavLink to="/admin" onClick={closeMenu}>
            Admin
          </NavLink>
        )}

        <Link to="/basket" onClick={closeMenu}>
          Basket ({basketItemCount})
        </Link>
      </nav>
    </>
  );
}

export default Navbar;