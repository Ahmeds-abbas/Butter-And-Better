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
npx.cmd ampx sandbox secret set RESEND_API_KEY --profile butter-and-better
npx.cmd ampx sandbox secret set EMAIL_FROM_ADDRESS --profile butter-and-better
npx.cmd ampx sandbox secret set ADMIN_NOTIFICATION_EMAIL --profile butter-and-better
```

For a deployed Amplify branch, configure the same secret names for that branch in Amplify before deploying:

```powershell
npx.cmd ampx pipeline-deploy --branch <branch-name> --app-id <amplify-app-id>
```

## Staging Deployment

Stripe staging should continue to use test mode. The Resend domain `butterandbetter.co.uk` must be verified before the configured order sender can deliver email.

Required Amplify secrets for the staging branch:

- `STRIPE_SECRET_KEY`: Stripe test secret key, for example `sk_test_...`
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret for the staging webhook destination
- `RESEND_API_KEY`: Resend API key
- `EMAIL_FROM_ADDRESS`: `Butter & Better <orders@butterandbetter.co.uk>`
- `ADMIN_NOTIFICATION_EMAIL`: `butterandbetterbakery@gmail.com`

Deployment checklist:

1. Create or select the Amplify staging branch.
2. Configure the required secrets for that branch in Amplify.
3. Deploy the backend and frontend:

   ```powershell
   npx.cmd ampx pipeline-deploy --branch staging --app-id <amplify-app-id>
   ```

4. After deploy, get the `stripeWebhookUrl` custom output from Amplify.
5. In Stripe test mode, add a webhook destination pointing to that `stripeWebhookUrl`.
6. Select the checkout/payment events used by the app, including:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `payment_intent.payment_failed`
   - `charge.refunded`
7. Copy the Stripe webhook signing secret into the staging `STRIPE_WEBHOOK_SECRET`.
8. Redeploy/restart the staging backend after changing secrets.
9. Run a Stripe test checkout from the deployed staging URL.

Checkout redirect URLs are environment-aware. The browser sends its current `window.location.origin` to the backend, so local development redirects back to `localhost`, while staging redirects back to the deployed staging domain. Do not hardcode localhost or production domains in the checkout flow.

## Custom domain

The public production domain is `butterandbetter.co.uk`. Canonical browser metadata is already configured for `https://butterandbetter.co.uk/`; DNS remains a manual deployment step.

In Amplify Hosting, open the app, choose **Hosting > Custom domains**, add `butterandbetter.co.uk`, and follow the displayed DNS verification instructions at the domain registrar. Add the `www` subdomain if required and redirect one hostname to the other so there is a single canonical URL. Do not change the checkout redirect code: it uses the browser origin and will automatically use the custom domain after DNS and the Amplify certificate are active.

`amplify_outputs.json` is generated per environment and is intentionally ignored by git. Local sandbox output should not be committed; Amplify Hosting/pipeline deployment provides environment-specific outputs for the deployed branch.

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
- Loyalty settlement runs only from the Stripe webhook after a verified paid payment.
- Order notification emails are sent only after the Stripe webhook verifies a successful paid payment.
- Email sending uses Amplify secrets. Each customer/admin delivery is stored as `PENDING`, `SENT`, or `FAILED`; a failed send never changes the paid state.
- Resending the same verified `checkout.session.completed` event retries only unsent emails. Database sent markers and Resend idempotency keys prevent repeat delivery.
- Loyalty reversal on refunds is deferred and must be handled manually/admin-side until implemented.
