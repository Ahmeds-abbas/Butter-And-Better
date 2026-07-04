import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

function AccountPage() {
  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Your account</p>
        <h1>Sign in or create an account</h1>
      </section>

      <Authenticator loginMechanisms={["email"]}>
        {({ signOut, user }) => (
          <section className="page-header">
            <h2>Welcome</h2>
            <p>{user?.signInDetails?.loginId}</p>

            <button
              type="button"
              className="secondary-button"
              onClick={signOut}
            >
              Sign out
            </button>
          </section>
        )}
      </Authenticator>
    </main>
  );
}

export default AccountPage;