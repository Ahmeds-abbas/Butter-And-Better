import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import ProtectedAdminRoute from "./components/auth/ProtectedAdminRoute";
import Navbar from "./components/layout/Navbar";
import BackToTop from "./components/layout/BackToTop";
import { useBasket } from "./hooks/useBasket";

const AboutPage = lazy(() => import("./pages/AboutPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const BasketPage = lazy(() => import("./pages/BasketPage"));
const CheckoutCancelPage = lazy(() => import("./pages/CheckoutCancelPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CheckoutSuccessPage = lazy(() => import("./pages/CheckoutSuccessPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));

function PageLoadingFallback() {
  return (
    <main className="page">
      <section className="no-products-found" aria-live="polite">
        <p>Loading...</p>
      </section>
    </main>
  );
}

function App() {
  const { basketItemCount } = useBasket();

  return (
    <div className="app">
      <Navbar basketItemCount={basketItemCount} />

      <Suspense fallback={<PageLoadingFallback />}>
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
      </Suspense>
      <BackToTop />
    </div>
  );
}

export default App;
