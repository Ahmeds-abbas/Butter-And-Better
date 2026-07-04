import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
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

  useEffect(() => {
    let isCancelled = false;

    async function checkAdminAccess() {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.accessToken.payload["cognito:groups"];

        if (!isCancelled) {
          setIsAdmin(isAdminGroup(groups));
        }
      } catch (error) {
        console.error("Failed to check admin access:", error);

        if (!isCancelled) {
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
    return <Navigate to="/account" replace />;
  }

  return children;
}

export default ProtectedAdminRoute;
