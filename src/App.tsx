import { Route, Routes } from "react-router-dom";
import "./App.css";
import ProtectedAdminRoute from "./components/auth/ProtectedAdminRoute";
import Navbar from "./components/layout/Navbar";
import BackToTop from "./components/layout/BackToTop";
import AboutPage from "./pages/AboutPage";
import AdminPage from "./pages/AdminPage";
import ContactPage from "./pages/ContactPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import ProductPage from "./pages/ProductPage";
import ShopPage from "./pages/ShopPage";
import { useBasket } from "./hooks/useBasket";
import BasketPage from "./pages/BasketPage";
import CheckoutCancelPage from "./pages/CheckoutCancelPage";
import CheckoutPage from "./pages/CheckoutPage";
import CheckoutSuccessPage from "./pages/CheckoutSuccessPage";
import AccountPage from "./pages/AccountPage";

function App() {
  const { basketItemCount } = useBasket();

  return (
    <div className="app">
      <Navbar basketItemCount={basketItemCount} />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/products/:productId" element={<ProductPage />} />
        <Route path="/basket" element={<BasketPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminPage />
            </ProtectedAdminRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <BackToTop />
    </div>
  );
}

export default App;
