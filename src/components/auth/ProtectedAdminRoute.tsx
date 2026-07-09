import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import "../../lib/amplifyConfig";

type ProtectedAdminRouteProps = {
  children: ReactNode;
};

function isAdminGroup(groups: unknown) {
  return Array.isArray(groups) && groups.includes("Admin");
}

function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function checkAdminAccess() {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.accessToken.payload["cognito:groups"];
        const hasAccessToken = Boolean(session.tokens?.accessToken);

        if (!isCancelled) {
          setIsSignedIn(hasAccessToken);
          setIsAdmin(isAdminGroup(groups));
        }
      } catch (error) {
        console.error("Failed to check admin access:", error);

        if (!isCancelled) {
          setIsSignedIn(false);
          setIsAdmin(false);
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingAuth(false);
        }
      }
    }

    void checkAdminAccess();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isCheckingAuth) {
    return (
      <main className="page">
        <section className="no-products-found" aria-live="polite">
          <p>Checking access...</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="page">
        <section className="no-products-found" role="alert">
          <p className="eyebrow">Admin access</p>
          <h1>Unauthorized</h1>
          <p>
            {isSignedIn
              ? "Your account is signed in, but it does not have Butter & Better admin access."
              : "Sign in with a Butter & Better admin account to manage products and orders."}
          </p>

          <Link to="/account" className="primary-button">
            {isSignedIn ? "Go to account" : "Sign in"}
          </Link>
        </section>
      </main>
    );
  }

  return children;
}

export default ProtectedAdminRoute;
