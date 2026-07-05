# Butter & Better

Butter & Better is a full-stack e-commerce platform being developed for a UK-based bakery owned by my friend Sarah Zain.

The platform will allow customers to browse bakery products, customise selected items, manage a shopping basket, check out as a guest or registered user, make secure online payments, choose an available delivery or collection option, and earn loyalty rewards.

The bakery owner will have access to a secure admin dashboard for managing products, orders, customers, fulfilment, and loyalty points.

## Project Status

The project is currently in the early frontend development stage.

Completed so far:

- React and TypeScript project setup
- Vite development environment
- ESLint configuration
- Initial homepage layout
- Responsive navigation
- Brand colour system
- Reusable component structure
- Git and GitHub setup

## Planned Features

- Product catalogue
- Product detail pages
- Product customisation options
- Shopping basket
- Guest checkout
- Customer registration and login
- Secure online payments
- UK address and postcode validation
- Nationwide delivery for eligible products
- Manchester same-day delivery
- Free collection option
- Customer order history
- Loyalty points and rewards
- Admin dashboard
- Product management
- Order management
- Order status tracking
- Payment and fulfilment status
- Email order confirmations

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- CSS
- ESLint

### Planned Backend and Services

- AWS
- Amazon Cognito
- Amazon DynamoDB
- AWS Lambda
- Amazon S3
- Stripe

## Project Structure

```text
src/
├── assets/
├── components/
│   └── layout/
├── data/
├── pages/
├── types/
├── App.tsx
├── App.css
├── index.css
└── main.tsx
```

## Stripe Checkout Setup

Stripe secret values must be stored as Amplify secrets. Do not put Stripe secret keys in `src/`, Vite env files, or committed files.

For sandbox development:

```powershell
npx.cmd ampx sandbox secret set STRIPE_SECRET_KEY --profile butter-and-better
npx.cmd ampx sandbox secret set STRIPE_WEBHOOK_SECRET --profile butter-and-better
```

For a deployed Amplify branch, configure the same secret names for that branch in Amplify before deploying:

```powershell
npx.cmd ampx pipeline-deploy --branch <branch-name> --app-id <amplify-app-id>
```

Stripe local test flow:

1. Create or open a Stripe test account.
2. Copy a test secret key such as `sk_test_...` into `STRIPE_SECRET_KEY`.
3. Start the Amplify sandbox:

   ```powershell
   npx.cmd ampx sandbox --profile butter-and-better
   ```

4. Note the `stripeWebhookUrl` custom output from the sandbox deployment.
5. Forward Stripe events to that URL with the Stripe CLI:

   ```powershell
   stripe listen --forward-to <stripeWebhookUrl>
   ```

6. Copy the CLI webhook signing secret `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
7. Restart the sandbox after changing secrets.
8. Start Vite:

   ```powershell
   npm.cmd run dev
   ```

9. Use Stripe test card `4242 4242 4242 4242` for a successful payment.
10. Use a Stripe declined test card to confirm failed-payment handling.

Payment notes:

- The browser creates pending `Order` and `OrderItem` records, then asks the backend to create a Stripe Checkout Session.
- The backend reloads the stored order and items, verifies totals, creates the Checkout Session, and stores the session ID.
- Only the Stripe webhook marks an order `paid`.
- The success page verifies the Checkout Session but does not mark payment as paid.
- Loyalty settlement is intentionally deferred until a safe customer-profile link exists for webhook processing.
