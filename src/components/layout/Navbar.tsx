type NavbarProps = {
  basketItemCount: number;
};

function Navbar({ basketItemCount }: NavbarProps) {
  return (
    <header className="navbar">
      <a href="/" className="brand">
        Butter & Better
      </a>

      <nav className="nav-links" aria-label="Main navigation">
        <a href="/">Home</a>
        <a href="/shop">Shop</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
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