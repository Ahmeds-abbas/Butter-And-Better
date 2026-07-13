import { useEffect, useState, type CSSProperties } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { fetchAuthSession } from "aws-amplify/auth";
import "@aws-amplify/ui-react/styles.css";
import { dataClient } from "../lib/amplifyClient";
import { formatGBP } from "../lib/currency";
import {
  formatLoyaltyCurrency,
  stampSpendInPence,
  stampsPerReward,
} from "../lib/loyalty";

type CustomerProfileCreateInput = Parameters<
  typeof dataClient.models.CustomerProfile.create
>[0];

type LoyaltyProfile = {
  loyaltyStamps: number;
  loyaltyRemainderInPence: number;
  availableRewards: number;
};

async function getSignedInProfileId() {
  const session = await fetchAuthSession();
  const userSub = session.tokens?.idToken?.payload.sub;

  if (typeof userSub !== "string" || !userSub) {
    throw new Error("Could not identify signed-in customer.");
  }

  return userSub;
}

async function loadOrCreateLoyaltyProfile() {
  const profileId = await getSignedInProfileId();
  const existingProfile = await dataClient.models.CustomerProfile.get(
    { id: profileId },
    { authMode: "userPool" },
  );

  if (existingProfile.data) {
    return {
      loyaltyStamps: existingProfile.data.loyaltyStamps,
      loyaltyRemainderInPence: existingProfile.data.loyaltyRemainderInPence,
      availableRewards: existingProfile.data.availableRewards,
    } satisfies LoyaltyProfile;
  }

  const profileInput = {
    id: profileId,
    loyaltyStamps: 0,
    loyaltyRemainderInPence: 0,
    availableRewards: 0,
  } as unknown as CustomerProfileCreateInput;
  const createdProfile = await dataClient.models.CustomerProfile.create(
    profileInput,
    { authMode: "userPool" },
  );

  if (createdProfile.errors?.length || !createdProfile.data) {
    throw new Error("Could not create your loyalty profile.");
  }

  return {
    loyaltyStamps: createdProfile.data.loyaltyStamps,
    loyaltyRemainderInPence: createdProfile.data.loyaltyRemainderInPence,
    availableRewards: createdProfile.data.availableRewards,
  } satisfies LoyaltyProfile;
}

function LoyaltyStampCard({ profile }: { profile: LoyaltyProfile }) {
  const partialProgress = Math.min(
    100,
    Math.max(
      0,
      Math.round((profile.loyaltyRemainderInPence / stampSpendInPence) * 100),
    ),
  );

  return (
    <section className="loyalty-card" aria-labelledby="loyalty-heading">
      <div className="loyalty-card-heading">
        <div>
          <p className="eyebrow">Loyalty</p>
          <h2 id="loyalty-heading">Butter & Better stamp card</h2>
        </div>
        <strong>{profile.availableRewards} rewards</strong>
      </div>

      <p>
        Earn 1 stamp for every {formatGBP(500)} spent. Collect 8 stamps for a{" "}
        {formatGBP(500)} reward.
      </p>

      <div className="loyalty-stamp-grid" aria-label="Loyalty stamps">
        {Array.from({ length: stampsPerReward }, (_, index) => {
          const isFilled = index < profile.loyaltyStamps;
          const isPartial = index === profile.loyaltyStamps && partialProgress > 0;

          return (
            <span
              key={index}
              className={`loyalty-stamp ${
                isFilled ? "loyalty-stamp-filled" : ""
              } ${isPartial ? "loyalty-stamp-partial" : ""}`}
              style={
                isPartial
                  ? ({
                      "--stamp-progress": `${partialProgress}%`,
                    } as CSSProperties)
                  : undefined
              }
              aria-label={`Stamp ${index + 1} of ${stampsPerReward}: ${
                isFilled
                  ? "filled"
                  : isPartial
                    ? `${partialProgress}% progress`
                    : "empty"
              }`}
            >
              B&B
            </span>
          );
        })}
      </div>

      <dl className="loyalty-summary">
        <div>
          <dt>Stamps</dt>
          <dd>
            {profile.loyaltyStamps} / {stampsPerReward}
          </dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>
            {formatLoyaltyCurrency(profile.loyaltyRemainderInPence)} /{" "}
            {formatLoyaltyCurrency(stampSpendInPence)} toward next stamp
          </dd>
        </div>
        <div>
          <dt>Available rewards</dt>
          <dd>{profile.availableRewards} x {formatGBP(500)}</dd>
        </div>
      </dl>
    </section>
  );
}

function AccountLoyaltySection() {
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadProfile() {
      try {
        const nextProfile = await loadOrCreateLoyaltyProfile();

        if (!isCancelled) {
          setProfile(nextProfile);
        }
      } catch (error) {
        console.error("Failed to load loyalty profile:", error);

        if (!isCancelled) {
          setLoadError("Could not load your loyalty stamp card.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isLoading) {
    return <p aria-live="polite">Loading your loyalty stamp card...</p>;
  }

  if (loadError) {
    return <p role="alert">{loadError}</p>;
  }

  return profile ? <LoyaltyStampCard profile={profile} /> : null;
}

function AccountPage() {
  return (
    <main className="page">
      <section className="page-header account-hero">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>Sign in, earn stamps, redeem rewards.</h1>
          <p>
            Earn 1 stamp per {formatGBP(500)} spent, keep leftover spend toward
            the next stamp, and redeem 8 stamps for {formatGBP(500)} off.
          </p>
        </div>
        <div className="loyalty-preview-card account-stamp-preview">
          {Array.from({ length: 8 }, (_, index) => (
            <span
              key={index}
              className={`loyalty-preview-stamp ${
                index < 4 ? "loyalty-preview-stamp-filled" : ""
              }`}
            >
              B&B
            </span>
          ))}
          <strong>Your stamp card lives here</strong>
        </div>
      </section>

      <Authenticator loginMechanisms={["email"]}>
        {({ signOut, user }) => (
          <section className="account-dashboard">
            <div className="page-header">
              <h2>Welcome</h2>
              <p>{user?.signInDetails?.loginId}</p>

              <button
                type="button"
                className="secondary-button"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>

            <AccountLoyaltySection />
          </section>
        )}
      </Authenticator>
    </main>
  );
}

export default AccountPage;
