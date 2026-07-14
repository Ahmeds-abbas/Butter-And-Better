import { useEffect, useState, type CSSProperties } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { LogOut } from "lucide-react";
import "@aws-amplify/ui-react/styles.css";
import loyaltyStampArtwork from "../assets/LoyaltyStamp.png";
import { dataClient } from "../lib/amplifyClient";
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
          <p className="eyebrow">Your balance</p>
          <h2 id="loyalty-heading">Your stamps</h2>
        </div>
        <strong>{profile.availableRewards} x £5 reward</strong>
      </div>

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
              <span className="loyalty-stamp-mark" aria-hidden="true" />
            </span>
          );
        })}
      </div>

      <dl className="loyalty-summary">
        <div>
          <dt>Stamps collected</dt>
          <dd>
            {profile.loyaltyStamps} / {stampsPerReward}
          </dd>
        </div>
        <div>
          <dt>Next stamp</dt>
          <dd>
            {formatLoyaltyCurrency(profile.loyaltyRemainderInPence)} /{" "}
            {formatLoyaltyCurrency(stampSpendInPence)}
          </dd>
        </div>
        <div>
          <dt>£5 rewards</dt>
          <dd>{profile.availableRewards}</dd>
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
    return <p className="account-status" aria-live="polite">Loading your stamps...</p>;
  }

  if (loadError) {
    return <p className="account-status account-status-error" role="alert">{loadError}</p>;
  }

  return profile ? <LoyaltyStampCard profile={profile} /> : null;
}

function AccountPage() {
  return (
    <main className="page account-page">
      <section className="account-hero account-loyalty-hero">
        <div className="account-loyalty-copy">
          <p className="eyebrow">Butter &amp; Better loyalty</p>
          <h1>Your loyalty.</h1>

          <div className="account-loyalty-rules" aria-label="Loyalty rules">
            <div>
              <strong>£5 spent</strong>
              <span>1 stamp</span>
            </div>
            <div>
              <strong>8 stamps</strong>
              <span>£5 off</span>
            </div>
          </div>
        </div>

        <figure className="account-stamp-artwork">
          <img
            src={loyaltyStampArtwork}
            alt="Eight Butter and Better whisk loyalty stamps"
          />
        </figure>
      </section>

      <section className="account-auth-section">
        <Authenticator loginMechanisms={["email"]}>
          {({ signOut, user }) => (
            <section className="account-dashboard">
              <div className="account-dashboard-heading">
                <div>
                  <span>Signed in as</span>
                  <strong>{user?.signInDetails?.loginId}</strong>
                </div>

                <button
                  type="button"
                  className="account-sign-out"
                  onClick={signOut}
                >
                  <LogOut aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>

              <AccountLoyaltySection />
            </section>
          )}
        </Authenticator>
      </section>
    </main>
  );
}

export default AccountPage;
