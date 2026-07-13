import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { useBasket } from "../hooks/useBasket";
import {
  calculateCheckoutTotals,
  formatCurrencyFromPence,
} from "../lib/checkoutCalculations";
import { dataClient } from "../lib/amplifyClient";
import { formatGBP } from "../lib/currency";
import {
  createCheckoutOrder,
} from "../lib/orderCreation";
import {
  calculateLoyaltySettlement,
  formatLoyaltyCurrency,
  rewardValueInPence,
  stampSpendInPence,
  stampsPerReward,
} from "../lib/loyalty";
import type {
  CheckoutFormData,
  CheckoutValidationErrors,
  FulfilmentMethod,
} from "../types/checkout";

const initialCheckoutFormData: CheckoutFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  fulfilmentMethod: "",
  redeemReward: false,
  orderNotes: "",
};

const fulfilmentOptions: Array<{
  value: FulfilmentMethod;
  label: string;
  description: string;
}> = [
  {
    value: "nationwide",
    label: "UK tracked delivery",
    description: `Tracked delivery across the UK for eligible bakes. ${formatGBP(299)}.`,
  },
  {
    value: "collection",
    label: "Pickup",
    description: "Collect your order from Butter & Better for free.",
  },
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ukPostcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

type CheckoutFieldName = keyof CheckoutFormData;
type ProductReadAuthMode = "userPool" | "iam";
type CustomerProfileCreateInput = Parameters<
  typeof dataClient.models.CustomerProfile.create
>[0];
type CheckoutLoyaltyProfile = {
  loyaltyStamps: number;
  loyaltyRemainderInPence: number;
  availableRewards: number;
};

async function getProductReadAuthModes(): Promise<ProductReadAuthMode[]> {
  try {
    const session = await fetchAuthSession();

    if (session.tokens?.accessToken) {
      return ["userPool", "iam"];
    }
  } catch {
    // Guest checkout reads product delivery flags through the identity pool.
  }

  return ["iam", "userPool"];
}

async function getProductWithFallback(productId: string) {
  const authModes = await getProductReadAuthModes();
  let lastError: unknown;

  for (const authMode of authModes) {
    try {
      const response = await dataClient.models.Product.get(
        { id: productId },
        { authMode },
      );

      if (response.errors?.length && !response.data) {
        throw new Error(
          response.errors.map((error) => error.message).join(", "),
        );
      }

      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not load product.");
}

async function loadSignedInLoyaltyProfile() {
  const session = await fetchAuthSession();
  const userSub = session.tokens?.idToken?.payload.sub;

  if (!session.tokens?.accessToken || typeof userSub !== "string" || !userSub) {
    return null;
  }

  const existingProfile = await dataClient.models.CustomerProfile.get(
    { id: userSub },
    { authMode: "userPool" },
  );

  if (existingProfile.data) {
    return {
      loyaltyStamps: existingProfile.data.loyaltyStamps,
      loyaltyRemainderInPence: existingProfile.data.loyaltyRemainderInPence,
      availableRewards: existingProfile.data.availableRewards,
    } satisfies CheckoutLoyaltyProfile;
  }

  const profileInput = {
    id: userSub,
    loyaltyStamps: 0,
    loyaltyRemainderInPence: 0,
    availableRewards: 0,
  } as unknown as CustomerProfileCreateInput;
  const createdProfile = await dataClient.models.CustomerProfile.create(
    profileInput,
    { authMode: "userPool" },
  );

  if (createdProfile.errors?.length || !createdProfile.data) {
    throw new Error("Could not prepare your loyalty profile.");
  }

  return {
    loyaltyStamps: createdProfile.data.loyaltyStamps,
    loyaltyRemainderInPence: createdProfile.data.loyaltyRemainderInPence,
    availableRewards: createdProfile.data.availableRewards,
  } satisfies CheckoutLoyaltyProfile;
}

function getFieldErrorId(fieldName: string) {
  return `${fieldName}-error`;
}

function deliveryAddressRequired(
  fulfilmentMethod: CheckoutFormData["fulfilmentMethod"],
) {
  return fulfilmentMethod === "nationwide";
}

function validateCheckoutForm(
  formData: CheckoutFormData,
  ukDeliveryAvailable: boolean,
): CheckoutValidationErrors {
  const errors: CheckoutValidationErrors = {};
  const trimmedFormData = {
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    email: formData.email.trim(),
    phone: formData.phone.trim(),
    addressLine1: formData.addressLine1.trim(),
    city: formData.city.trim(),
    postcode: formData.postcode.trim(),
    fulfilmentMethod: formData.fulfilmentMethod,
  };
  const phoneDigits = trimmedFormData.phone.replace(/\D/g, "");
  const requiresAddress = deliveryAddressRequired(
    trimmedFormData.fulfilmentMethod,
  );

  if (!trimmedFormData.firstName) {
    errors.firstName = "First name is required.";
  }

  if (!trimmedFormData.lastName) {
    errors.lastName = "Last name is required.";
  }

  if (!trimmedFormData.email) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(trimmedFormData.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!trimmedFormData.phone) {
    errors.phone = "Phone number is required.";
  } else if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.phone = "Phone number must contain 10 to 15 digits.";
  }

  if (!trimmedFormData.fulfilmentMethod) {
    errors.fulfilmentMethod = "Choose a fulfilment method.";
  } else if (
    trimmedFormData.fulfilmentMethod === "nationwide" &&
    !ukDeliveryAvailable
  ) {
    errors.fulfilmentMethod =
      "UK tracked delivery is unavailable for this basket. Please choose pickup.";
  }

  if (requiresAddress) {
    if (!trimmedFormData.addressLine1) {
      errors.addressLine1 = "Address line 1 is required.";
    }

    if (!trimmedFormData.city) {
      errors.city = "City is required.";
    }

    if (!trimmedFormData.postcode) {
      errors.postcode = "Postcode is required.";
    } else if (!ukPostcodePattern.test(trimmedFormData.postcode)) {
      errors.postcode = "Enter a valid UK postcode.";
    }
  }

  return errors;
}

function CheckoutPage() {
  const { basketItems, clearBasket } = useBasket();
  const [formData, setFormData] = useState<CheckoutFormData>(
    initialCheckoutFormData,
  );
  const [checkoutStep, setCheckoutStep] = useState<"details" | "review">(
    "details",
  );
  const [errors, setErrors] = useState<CheckoutValidationErrors>({});
  const [orderMessage, setOrderMessage] = useState("");
  const [orderCreationError, setOrderCreationError] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isCheckingDeliveryAvailability, setIsCheckingDeliveryAvailability] =
    useState(true);
  const [deliveryAvailabilityError, setDeliveryAvailabilityError] =
    useState("");
  const [
    deliveryUnavailableProductNames,
    setDeliveryUnavailableProductNames,
  ] = useState<string[]>([]);
  const [loyaltyProfile, setLoyaltyProfile] =
    useState<CheckoutLoyaltyProfile | null>(null);
  const [isCheckingLoyalty, setIsCheckingLoyalty] = useState(true);
  const [loyaltyError, setLoyaltyError] = useState("");
  const ukDeliveryAvailable =
    !isCheckingDeliveryAvailability &&
    !deliveryAvailabilityError &&
    deliveryUnavailableProductNames.length === 0;
  const effectiveFulfilmentMethod =
    formData.fulfilmentMethod === "nationwide" && !ukDeliveryAvailable
      ? ""
      : formData.fulfilmentMethod;
  const showDeliveryAddress = deliveryAddressRequired(
    effectiveFulfilmentMethod,
  );
  const availableFulfilmentOptions = useMemo(
    () =>
      fulfilmentOptions.filter(
        (option) => option.value === "collection" || ukDeliveryAvailable,
      ),
    [ukDeliveryAvailable],
  );
  const selectedFulfilmentOption = availableFulfilmentOptions.find(
    (option) => option.value === effectiveFulfilmentMethod,
  );
  const canRedeemReward = (loyaltyProfile?.availableRewards ?? 0) > 0;
  const effectiveRedeemReward = canRedeemReward && formData.redeemReward;
  const basketSubtotalInPence = useMemo(
    () =>
      basketItems.reduce(
        (total, item) =>
          total + Math.round(item.unitPrice * 100) * item.quantity,
        0,
      ),
    [basketItems],
  );
  const checkoutTotals = useMemo(() => {
    if (!effectiveFulfilmentMethod) {
      return null;
    }

    try {
      return calculateCheckoutTotals(
        basketItems,
        effectiveFulfilmentMethod,
        effectiveRedeemReward,
      );
    } catch {
      return null;
    }
  }, [basketItems, effectiveFulfilmentMethod, effectiveRedeemReward]);
  const estimatedLoyalty = useMemo(() => {
    if (!loyaltyProfile) {
      return null;
    }

    return calculateLoyaltySettlement(
      {
        ...loyaltyProfile,
        availableRewards:
          effectiveRedeemReward
            ? loyaltyProfile.availableRewards - 1
            : loyaltyProfile.availableRewards,
      },
      checkoutTotals?.loyaltySpendInPence ?? basketSubtotalInPence,
    );
  }, [
    basketSubtotalInPence,
    checkoutTotals?.loyaltySpendInPence,
    effectiveRedeemReward,
    loyaltyProfile,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadLoyaltyProfile() {
      try {
        const nextProfile = await loadSignedInLoyaltyProfile();

        if (!isCancelled) {
          setLoyaltyProfile(nextProfile);
        }
      } catch (error) {
        console.error("Failed to load checkout loyalty profile:", error);

        if (!isCancelled) {
          setLoyaltyError("Loyalty is unavailable right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingLoyalty(false);
        }
      }
    }

    void loadLoyaltyProfile();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function checkDeliveryAvailability() {
      setIsCheckingDeliveryAvailability(true);
      setDeliveryAvailabilityError("");

      try {
        const productNamesById = new Map(
          basketItems.map((item) => [item.productId, item.productName]),
        );
        const unavailableProductNames: string[] = [];

        await Promise.all(
          [...productNamesById.keys()].map(async (productId) => {
            const product = await getProductWithFallback(productId);

            if (!product?.nationwideDelivery) {
              unavailableProductNames.push(
                productNamesById.get(productId) ?? "A basket item",
              );
            }
          }),
        );

        if (!isCancelled) {
          setDeliveryUnavailableProductNames(
            [...new Set(unavailableProductNames)].sort(),
          );
        }
      } catch (error) {
        console.error("Failed to check delivery availability:", error);

        if (!isCancelled) {
          setDeliveryAvailabilityError(
            "We could not confirm UK tracked delivery for this basket. Pickup is still available.",
          );
          setDeliveryUnavailableProductNames([]);
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingDeliveryAvailability(false);
        }
      }
    }

    if (basketItems.length === 0) {
      return () => {
        isCancelled = true;
      };
    }

    void checkDeliveryAvailability();

    return () => {
      isCancelled = true;
    };
  }, [basketItems]);

  function clearFieldError(fieldName: CheckoutFieldName) {
    setErrors((currentErrors) => {
      if (!(fieldName in currentErrors)) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName as keyof CheckoutValidationErrors];
      return nextErrors;
    });
  }

  function updateFormData(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    const fieldName = name as CheckoutFieldName;
    const nextValue =
      fieldName === "redeemReward" && event.target instanceof HTMLInputElement
        ? event.target.checked
        : fieldName === "postcode"
          ? value.toUpperCase()
          : value;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [fieldName]: nextValue,
    }));

    setOrderMessage("");
    setOrderCreationError("");
    setCheckoutStep("details");

    if (fieldName === "fulfilmentMethod") {
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors.fulfilmentMethod;

        if (value === "collection") {
          delete nextErrors.addressLine1;
          delete nextErrors.city;
          delete nextErrors.postcode;
        }

        return nextErrors;
      });
      return;
    }

    clearFieldError(fieldName);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateCheckoutForm(
      formData,
      ukDeliveryAvailable,
    );
    const firstInvalidField = Object.keys(
      validationErrors,
    )[0] as keyof CheckoutValidationErrors | undefined;

    setErrors(validationErrors);

    if (firstInvalidField) {
      setOrderMessage("");
      const firstInvalidElement = event.currentTarget.querySelector(
        `[name="${firstInvalidField}"]`,
      );

      if (firstInvalidElement instanceof HTMLElement) {
        firstInvalidElement.focus();
      }

      return;
    }

    setOrderMessage("");
    setOrderCreationError("");
    setCheckoutStep("review");
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingOrder) {
      return;
    }

    const validationErrors = validateCheckoutForm(
      formData,
      ukDeliveryAvailable,
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setCheckoutStep("details");
      return;
    }

    if (basketItems.length === 0) {
      setOrderCreationError("Your basket is empty.");
      return;
    }

    if (!formData.fulfilmentMethod) {
      setOrderCreationError("Choose a fulfilment method.");
      return;
    }

    try {
      calculateCheckoutTotals(
        basketItems,
        formData.fulfilmentMethod,
        effectiveRedeemReward,
      );
    } catch (error) {
      setOrderCreationError(
        error instanceof Error
          ? error.message
          : "Your basket contains an invalid item.",
      );
      return;
    }

    setIsSubmittingOrder(true);
    setOrderCreationError("");
    setOrderMessage("");

    try {
      const nextOrder = await createCheckoutOrder(
        {
          ...formData,
          redeemReward: effectiveRedeemReward,
        },
        basketItems,
      );
      const sessionResponse = await dataClient.mutations.createCheckoutSession(
        {
          orderId: nextOrder.id,
          checkoutAccessToken: nextOrder.checkoutAccessToken,
          origin: window.location.origin,
        },
        {
          authMode: nextOrder.authMode,
        },
      );

      if (sessionResponse.errors?.length || !sessionResponse.data) {
        throw new Error(
          sessionResponse.errors?.map((error) => error.message).join(", ") ??
            "Could not start Stripe Checkout.",
        );
      }

      clearBasket();
      window.location.assign(sessionResponse.data.checkoutUrl);
    } catch (error) {
      console.error("Failed to create checkout order:", error);
      setOrderCreationError(
        error instanceof Error
          ? error.message
          : "We could not place your order. Please try again.",
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  function editCheckoutDetails() {
    setOrderMessage("");
    setOrderCreationError("");
    setCheckoutStep("details");
  }

  if (basketItems.length === 0) {
    return (
      <main className="page">
        <section className="empty-basket">
          <p className="eyebrow">Checkout</p>
          <h1>Your basket is empty</h1>
          <p>Add some Butter & Better treats before checking out.</p>

          <Link to="/shop" className="primary-button">
            Browse the menu
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Checkout</p>
        <h1>
          {checkoutStep === "details"
            ? "Complete your order"
            : "Review your order"}
        </h1>
        <p>
          {checkoutStep === "details"
            ? "Add your details and choose how you would like to receive your bakes."
            : "Check everything looks right before continuing to payment."}
        </p>
      </section>

      <div className="checkout-layout">
        <div className="checkout-main">
          <div className="checkout-steps" aria-label="Checkout progress">
            <span
              className={`checkout-step ${
                checkoutStep === "details" ? "checkout-step-active" : ""
              }`}
            >
              1. Details
            </span>
            <span
              className={`checkout-step ${
                checkoutStep === "review" ? "checkout-step-active" : ""
              }`}
            >
              2. Review
            </span>
          </div>

          {checkoutStep === "details" ? (
            <form className="checkout-form" onSubmit={handleSubmit} noValidate>
              <section className="checkout-section">
                <h2>Contact details</h2>

                <div className="checkout-field-grid">
                  <label
                    className={
                      errors.firstName ? "form-field-error" : undefined
                    }
                  >
                    <span>First name</span>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={updateFormData}
                      aria-invalid={Boolean(errors.firstName)}
                      aria-describedby={
                        errors.firstName
                          ? getFieldErrorId("firstName")
                          : undefined
                      }
                      required
                    />
                    {errors.firstName && (
                      <p
                        id={getFieldErrorId("firstName")}
                        className="form-error"
                        role="alert"
                      >
                        {errors.firstName}
                      </p>
                    )}
                  </label>

                  <label
                    className={
                      errors.lastName ? "form-field-error" : undefined
                    }
                  >
                    <span>Last name</span>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={updateFormData}
                      aria-invalid={Boolean(errors.lastName)}
                      aria-describedby={
                        errors.lastName
                          ? getFieldErrorId("lastName")
                          : undefined
                      }
                      required
                    />
                    {errors.lastName && (
                      <p
                        id={getFieldErrorId("lastName")}
                        className="form-error"
                        role="alert"
                      >
                        {errors.lastName}
                      </p>
                    )}
                  </label>
                </div>

                <label
                  className={errors.email ? "form-field-error" : undefined}
                >
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={updateFormData}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={
                      errors.email ? getFieldErrorId("email") : undefined
                    }
                    required
                  />
                  {errors.email && (
                    <p
                      id={getFieldErrorId("email")}
                      className="form-error"
                      role="alert"
                    >
                      {errors.email}
                    </p>
                  )}
                </label>

                <label
                  className={errors.phone ? "form-field-error" : undefined}
                >
                  <span>Phone</span>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={updateFormData}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={
                      errors.phone ? getFieldErrorId("phone") : undefined
                    }
                    required
                  />
                  {errors.phone && (
                    <p
                      id={getFieldErrorId("phone")}
                      className="form-error"
                      role="alert"
                    >
                      {errors.phone}
                    </p>
                  )}
                </label>
              </section>

              <section className="checkout-section">
                <h2>Fulfilment</h2>

                <fieldset className="fulfilment-options">
                  <legend>Choose an option</legend>

                  {availableFulfilmentOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`fulfilment-option ${
                        formData.fulfilmentMethod === option.value
                          ? "fulfilment-option-selected"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="fulfilmentMethod"
                        value={option.value}
                        checked={formData.fulfilmentMethod === option.value}
                        onChange={updateFormData}
                        aria-invalid={Boolean(errors.fulfilmentMethod)}
                        aria-describedby={
                          errors.fulfilmentMethod
                            ? getFieldErrorId("fulfilmentMethod")
                            : undefined
                        }
                        required
                      />

                      <span>
                        <strong>{option.label}</strong>
                        {option.description}
                      </span>
                    </label>
                  ))}

                  {isCheckingDeliveryAvailability && (
                    <p className="checkout-review-copy" aria-live="polite">
                      Checking whether this basket can use UK tracked delivery.
                    </p>
                  )}

                  {!isCheckingDeliveryAvailability &&
                    deliveryAvailabilityError && (
                      <p className="form-error" role="alert">
                        {deliveryAvailabilityError}
                      </p>
                    )}

                  {!isCheckingDeliveryAvailability &&
                    !deliveryAvailabilityError &&
                    deliveryUnavailableProductNames.length > 0 && (
                      <p className="form-error" role="alert">
                        UK tracked delivery is unavailable because this basket
                        includes{" "}
                        {deliveryUnavailableProductNames.join(", ")}. Please
                        choose pickup for this order.
                      </p>
                    )}

                  {errors.fulfilmentMethod && (
                    <p
                      id={getFieldErrorId("fulfilmentMethod")}
                      className="form-error"
                      role="alert"
                    >
                      {errors.fulfilmentMethod}
                    </p>
                  )}
                </fieldset>
              </section>

              {showDeliveryAddress && (
                <fieldset className="checkout-section checkout-address-fieldset">
                  <legend>Delivery address</legend>

                  <label
                    className={
                      errors.addressLine1 ? "form-field-error" : undefined
                    }
                  >
                    <span>Address line 1</span>
                    <input
                      type="text"
                      name="addressLine1"
                      value={formData.addressLine1}
                      onChange={updateFormData}
                      aria-invalid={Boolean(errors.addressLine1)}
                      aria-describedby={
                        errors.addressLine1
                          ? getFieldErrorId("addressLine1")
                          : undefined
                      }
                      required
                    />
                    {errors.addressLine1 && (
                      <p
                        id={getFieldErrorId("addressLine1")}
                        className="form-error"
                        role="alert"
                      >
                        {errors.addressLine1}
                      </p>
                    )}
                  </label>

                  <label>
                    <span>Address line 2</span>
                    <input
                      type="text"
                      name="addressLine2"
                      value={formData.addressLine2}
                      onChange={updateFormData}
                    />
                  </label>

                  <div className="checkout-field-grid">
                    <label
                      className={
                        errors.city ? "form-field-error" : undefined
                      }
                    >
                      <span>City</span>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={updateFormData}
                        aria-invalid={Boolean(errors.city)}
                        aria-describedby={
                          errors.city ? getFieldErrorId("city") : undefined
                        }
                        required
                      />
                      {errors.city && (
                        <p
                          id={getFieldErrorId("city")}
                          className="form-error"
                          role="alert"
                        >
                          {errors.city}
                        </p>
                      )}
                    </label>

                    <label
                      className={
                        errors.postcode ? "form-field-error" : undefined
                      }
                    >
                      <span>Postcode</span>
                      <input
                        type="text"
                        name="postcode"
                        value={formData.postcode}
                        onChange={updateFormData}
                        aria-invalid={Boolean(errors.postcode)}
                        aria-describedby={
                          errors.postcode
                            ? getFieldErrorId("postcode")
                            : undefined
                        }
                        required
                      />
                      {errors.postcode && (
                        <p
                          id={getFieldErrorId("postcode")}
                          className="form-error"
                          role="alert"
                        >
                          {errors.postcode}
                        </p>
                      )}
                    </label>
                  </div>
                </fieldset>
              )}

              <section className="checkout-section">
                <h2>Order notes</h2>

                <label>
                  <span>Notes</span>
                  <textarea
                    name="orderNotes"
                    value={formData.orderNotes}
                    onChange={updateFormData}
                    rows={4}
                    placeholder="Add allergies, preferred dates or delivery notes."
                  />
                </label>
              </section>

              <button type="submit" className="checkout-submit-button">
                Review order
              </button>
            </form>
          ) : (
            <form
              className="checkout-form"
              onSubmit={handleReviewSubmit}
              noValidate
            >
              <section className="checkout-section checkout-review-section">
                <div className="checkout-review-heading">
                  <h2>Customer details</h2>
                  <button
                    type="button"
                    className="edit-checkout-button"
                    onClick={editCheckoutDetails}
                  >
                    Edit details
                  </button>
                </div>

                <div className="checkout-review-list">
                  <div>
                    <span>Name</span>
                    <strong>
                      {formData.firstName.trim()} {formData.lastName.trim()}
                    </strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{formData.email.trim()}</strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{formData.phone.trim()}</strong>
                  </div>
                  <div>
                    <span>Fulfilment</span>
                    <strong>{selectedFulfilmentOption?.label}</strong>
                  </div>
                </div>
              </section>

              {showDeliveryAddress && (
                <section className="checkout-section checkout-review-section">
                  <h2>Delivery address</h2>

                  <div className="checkout-review-address">
                    <p>{formData.addressLine1.trim()}</p>
                    {formData.addressLine2.trim() && (
                      <p>{formData.addressLine2.trim()}</p>
                    )}
                    <p>{formData.city.trim()}</p>
                    <p>{formData.postcode.trim()}</p>
                  </div>
                </section>
              )}

              {formData.fulfilmentMethod === "collection" && (
                <section className="checkout-section checkout-review-section">
                  <h2>Collection</h2>
                  <p className="checkout-review-copy">
                    No delivery address is needed for collection.
                  </p>
                </section>
              )}

              {formData.orderNotes.trim() && (
                <section className="checkout-section checkout-review-section">
                  <h2>Order notes</h2>
                  <p className="checkout-review-copy">
                    {formData.orderNotes.trim()}
                  </p>
                </section>
              )}

              <section className="checkout-section checkout-review-section">
                <h2>Items</h2>

                <div className="checkout-review-items">
                  {basketItems.map((item) => (
                    <div key={item.id} className="checkout-review-item">
                      <span>
                        {item.quantity} x {item.variantName}
                      </span>
                      <strong>
                        {formatCurrencyFromPence(
                          Math.round(item.unitPrice * 100) * item.quantity,
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>

              {checkoutTotals && (
                <section className="checkout-section checkout-review-section">
                  <h2>Total</h2>
                  <div className="checkout-review-list">
                    <div>
                      <span>Subtotal</span>
                      <strong>
                        {formatCurrencyFromPence(
                          checkoutTotals.subtotalInPence,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Delivery</span>
                      <strong>
                        {formatCurrencyFromPence(
                          checkoutTotals.deliveryFeeInPence,
                        )}
                      </strong>
                    </div>
                    {checkoutTotals.rewardDiscountInPence > 0 && (
                      <div>
                        <span>Loyalty reward</span>
                        <strong>
                          -
                          {formatCurrencyFromPence(
                            checkoutTotals.rewardDiscountInPence,
                          )}
                        </strong>
                      </div>
                    )}
                    <div>
                      <span>Payment status</span>
                      <strong>Pending</strong>
                    </div>
                    <div>
                      <span>Total</span>
                      <strong>
                        {formatCurrencyFromPence(checkoutTotals.totalInPence)}
                      </strong>
                    </div>
                  </div>
                </section>
              )}

              <button
                type="submit"
                className="checkout-submit-button"
                disabled={isSubmittingOrder}
              >
                {isSubmittingOrder ? "Placing order..." : "Place order request"}
              </button>

              {orderMessage && (
                <p className="checkout-message" aria-live="polite">
                  {orderMessage}
                </p>
              )}

              {orderCreationError && (
                <p className="checkout-message checkout-message-error" role="alert">
                  {orderCreationError}
                </p>
              )}
            </form>
          )}
        </div>

        <aside className="checkout-summary">
          <h2>Order summary</h2>

          <div className="checkout-summary-items">
            {basketItems.map((item) => (
              <div key={item.id} className="checkout-summary-item">
                <span>
                  {item.quantity} x {item.variantName}
                </span>
                <strong>
                  {formatCurrencyFromPence(
                    Math.round(item.unitPrice * 100) * item.quantity,
                  )}
                </strong>
              </div>
            ))}
          </div>

          <div className="summary-row">
            <span>Subtotal</span>
            <strong>
              {formatCurrencyFromPence(
                checkoutTotals?.subtotalInPence ?? basketSubtotalInPence,
              )}
            </strong>
          </div>

          <div className="summary-row">
            <span>Delivery</span>
            <span>
              {checkoutTotals
                ? formatCurrencyFromPence(checkoutTotals.deliveryFeeInPence)
                : isCheckingDeliveryAvailability
                  ? "Checking delivery"
                  : ukDeliveryAvailable
                    ? "Choose pickup or delivery"
                    : "Pickup available"}
            </span>
          </div>

          {checkoutTotals && checkoutTotals.rewardDiscountInPence > 0 && (
            <div className="summary-row">
              <span>Loyalty reward</span>
              <span>
                -{formatCurrencyFromPence(checkoutTotals.rewardDiscountInPence)}
              </span>
            </div>
          )}

          <div className="summary-total">
            <span>Estimated total</span>
            <strong>
              {formatCurrencyFromPence(
                checkoutTotals?.totalInPence ?? basketSubtotalInPence,
              )}
            </strong>
          </div>

          <section className="checkout-loyalty-summary">
            <h3>Loyalty</h3>

            {isCheckingLoyalty && (
              <p aria-live="polite">Checking loyalty status...</p>
            )}

            {!isCheckingLoyalty && loyaltyError && (
              <p role="alert">{loyaltyError}</p>
            )}

            {!isCheckingLoyalty && !loyaltyError && !loyaltyProfile && (
              <p>
                Sign in before checkout to earn stamps. Guest orders do not
                earn or redeem loyalty rewards.
              </p>
            )}

            {!isCheckingLoyalty && estimatedLoyalty && (
              <>
                <p>
                  You have {loyaltyProfile?.loyaltyStamps ?? 0} /{" "}
                  {stampsPerReward} stamps and{" "}
                  {loyaltyProfile?.availableRewards ?? 0} available rewards.
                </p>
                {canRedeemReward && (
                  <label>
                    <input
                      type="checkbox"
                      name="redeemReward"
                      checked={effectiveRedeemReward}
                      onChange={updateFormData}
                    />
                    <span>
                      Redeem 1 reward for{" "}
                      {formatCurrencyFromPence(rewardValueInPence)} off this
                      order.
                    </span>
                  </label>
                )}
                <p>
                  This order is estimated to earn{" "}
                  {estimatedLoyalty.stampsEarned} stamp
                  {estimatedLoyalty.stampsEarned === 1 ? "" : "s"} from product
                  spend. Delivery does not count toward stamps.
                </p>
                <p>
                  Progress after payment:{" "}
                  {formatLoyaltyCurrency(
                    estimatedLoyalty.loyaltyRemainderInPence,
                  )}{" "}
                  / {formatLoyaltyCurrency(stampSpendInPence)} toward the next
                  stamp.
                </p>
                <p>
                  Reward discounts are applied at Stripe Checkout and settled
                  only after payment is confirmed.
                </p>
              </>
            )}
          </section>

          <Link to="/basket" className="continue-shopping-link">
            Back to basket
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default CheckoutPage;
