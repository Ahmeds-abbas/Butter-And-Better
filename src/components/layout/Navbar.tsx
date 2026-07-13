import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
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
        const groups = session.tokens?.accessToken.payload["cognito:groups"];

        setIsAdmin(Array.isArray(groups) && groups.includes("Admin"));
      } catch {
        setIsAdmin(false);
      }
    }

    void checkAdminStatus();
    return Hub.listen("auth", () => void checkAdminStatus());
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      <header className="navbar">
        <button
          type="button"
          className="nav-icon-button nav-menu-button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <Link to="/" className="brand" aria-label="Butter & Better home">
          <span className="brand-placeholder-mark" aria-hidden="true">B&amp;B</span>
          <span className="brand-placeholder-copy">
            <strong>Butter &amp; Better</strong>
            <small>Final logo coming soon</small>
          </span>
        </Link>

        <div className="nav-actions">
          <Link to="/account" className="nav-icon-button" aria-label="Account">
            <UserRound aria-hidden="true" />
          </Link>

          <Link to="/basket" className="nav-icon-button basket-icon-button" aria-label={`Basket with ${basketItemCount} item${basketItemCount === 1 ? "" : "s"}`}>
            <ShoppingBag aria-hidden="true" />
            {basketItemCount > 0 && (
              <span className="basket-count-badge" aria-hidden="true">
                {basketItemCount > 99 ? "99+" : basketItemCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <nav
        id="mobile-navigation"
        className={`mobile-navigation ${menuOpen ? "mobile-navigation-open" : ""}`}
        aria-label="Main navigation"
        aria-hidden={!menuOpen}
      >
        <NavLink to="/" onClick={closeMenu}>Home</NavLink>
        <NavLink to="/shop" onClick={closeMenu}>Shop</NavLink>
        <NavLink to="/about" onClick={closeMenu}>About</NavLink>
        <NavLink to="/contact" onClick={closeMenu}>Contact</NavLink>
        <NavLink to="/account" onClick={closeMenu}>Account</NavLink>
        {isAdmin && <NavLink to="/admin" onClick={closeMenu}>Admin</NavLink>}
        <Link to="/basket" onClick={closeMenu}>Basket ({basketItemCount})</Link>
      </nav>
    </>
  );
}

export default Navbar;
