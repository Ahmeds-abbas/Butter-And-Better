# Butter & Better
2
Butter & Better is a deployed full-stack bakery e-commerce website I built for Butter & Better Bakery, a UK-based small-batch bakery owned by Sarah Zain.

The project is live at:

```text
https://www.butterandbetter.co.uk
```

The site allows customers to browse products, manage a basket, choose pickup or UK tracked delivery where eligible, check out securely through Stripe, receive order confirmation emails, and earn loyalty stamps when signed in. The bakery owner also has access to an admin dashboard for managing products and orders.

## Project Status

The project has been deployed and is now in production-ready operation.

Completed features include:

- Public bakery website with responsive design
- Homepage, about, contact, shop, product, basket, checkout, account, and admin pages
- Product catalogue with variants, pricing, active status, media fields, and delivery eligibility
- Guest checkout
- Signed-in customer checkout
- Secure Stripe Checkout integration
- Stripe webhook payment confirmation
- Order records with payment and fulfilment status
- Free pickup
- UK tracked delivery at exactly GBP 2.99 for eligible baskets
- Delivery blocking when any basket item is pickup-only
- Customer loyalty stamp system
- Loyalty carry-over spending
- GBP 5 reward redemption after 8 stamps
- Customer and admin order notification emails through Resend
- Admin product management
- Admin order management
- Protected admin access
- Amplify Gen 2 backend
- Cognito authentication
- AppSync/Data models
- Lambda backend functions
- Secure secret handling through Amplify secrets
- Custom domain deployment
- SPA redirect and caching configuration for Amplify Hosting

## Project Purpose

I built this project to create a real e-commerce platform for a bakery rather than just a static marketing site. The goal was to support the actual customer journey from browsing products to completing payment, while giving the owner the tools needed to manage products and orders.

The project also helped me learn how a production web application is structured end to end: frontend, backend, authentication, database rules, payments, webhook security, deployment, custom domains, and operational debugging.

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- CSS
- Lucide React icons
- React Icons

### Backend and Cloud

- AWS Amplify Gen 2
- AWS AppSync / Amplify Data
- Amazon Cognito
- AWS Lambda functions
- DynamoDB-backed Amplify models
- Amplify Hosting
- Amplify secrets

### Payments and Email

- Stripe Checkout
- Stripe webhooks
- Resend email API

### Tooling

- npm
- ESLint
- TypeScript build checks
- Git and GitHub

## Main Application Structure

```text
src/
  assets/              Brand images, product/about imagery, loyalty stamp artwork
  components/          Reusable UI and layout components
  components/admin/    Admin order and product management UI
  components/layout/   Header, navigation, footer
  components/marketing/Marketing and homepage supporting sections
  hooks/               Shared React hooks such as basket state
  lib/                 Shared logic for Amplify, checkout totals, loyalty, currency
  pages/               Main route pages
  types/               Shared TypeScript types
  App.tsx              Route definitions
  App.css              Global site styling
  main.tsx             React entry point

amplify/
  backend.ts
  data/resource.ts
  functions/
    create-checkout-session/
    stripe-webhook/
    verify-checkout-session/
  seed/
```

## How Checkout Works

Checkout is designed so the browser never becomes the source of truth for payment or order totals.

The flow is:

```text
Customer reviews basket
  -> frontend sends product IDs, variant IDs, quantities, and customer details
  -> backend reloads product and variant data
  -> backend recalculates totals in integer pence
  -> backend validates delivery rules and loyalty redemption
  -> backend creates a pending order
  -> backend creates a Stripe Checkout Session
  -> customer pays through Stripe
  -> Stripe sends a signed webhook
  -> backend verifies the webhook signature
  -> backend marks the order as paid
  -> backend settles loyalty
  -> backend sends customer/admin emails
```

This structure is important because customers can edit browser data. Product prices, delivery fees, loyalty rewards, and payment state must always be confirmed by the backend.

## Payment Security

Stripe secret keys are not stored in the frontend or committed to the repository.

Stripe payment state is controlled by the webhook, not by the checkout success page. The success page can display payment progress, but only the verified Stripe webhook marks an order as paid.

Webhook handling is idempotent. Duplicate Stripe events should not duplicate:

- Paid order processing
- Loyalty stamps
- Customer emails
- Admin emails

## Loyalty System

Signed-in customers earn loyalty stamps after a paid order.

The loyalty rules are:

- GBP 5 product spend earns 1 stamp
- Spending carry-over is saved toward the next stamp
- 8 stamps create 1 GBP 5 reward
- Delivery fees do not count toward loyalty stamps
- Guest orders do not earn or redeem loyalty
- Loyalty is settled only after Stripe confirms payment

Customer loyalty profiles use Cognito ownership so each signed-in customer can read their own stamp balance while public users cannot alter loyalty data.

## Delivery Rules

The site supports:

- Free pickup
- UK tracked delivery at GBP 2.99

UK tracked delivery only appears when every item in the basket is delivery-available. If any item is pickup-only, delivery is blocked and the customer is shown a clear message.

Manchester same-day delivery is not part of the current live rules.

## Email Notifications

Order emails are sent through Resend from the Amplify backend only.

Emails are sent only after Stripe confirms a paid order through a verified webhook.

The system sends:

- Customer order confirmation email
- Admin new-order notification email

Email status is stored on the order as `PENDING`, `SENT`, or `FAILED`. If email sending fails, the order stays paid and the failure can be investigated separately.

## Admin Dashboard

The admin area allows the bakery owner to manage the operational side of the site.

Admin functionality includes:

- Product management
- Product availability
- Product delivery eligibility
- Product labels such as best seller or new drop
- Order viewing
- Order status and fulfilment updates
- Customer/order details
- Payment and email status visibility

Admin actions are protected by backend authorization rules, not only hidden in the UI.

## Deployment

The project is deployed through AWS Amplify Hosting from the GitHub `main` branch.

The production domain is:

```text
https://www.butterandbetter.co.uk
```

The apex domain redirects to the `www` domain.

The app uses an Amplify Hosting SPA rewrite so React routes load correctly on refresh. Static assets must not be rewritten to `index.html`, otherwise JavaScript and CSS files will fail to load.

## Required Amplify Secrets

The following values must be configured in Amplify secrets for the deployed branch:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
EMAIL_FROM_ADDRESS
ADMIN_NOTIFICATION_EMAIL
```

Secret values must not be committed to the repository.

## Stripe Webhook Events

The Stripe webhook destination should listen for:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
payment_intent.payment_failed
charge.refunded
```

## Local Development

Install dependencies:

```powershell
npm.cmd ci --legacy-peer-deps
```

Start the development server:

```powershell
npm.cmd run dev
```

Run checks:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## Deployment Checklist

Before deploying, I check:

1. `npm.cmd ci --legacy-peer-deps` works with the lockfile.
2. `npm.cmd run lint` passes.
3. `npm.cmd test` passes.
4. `npm.cmd run build` passes.
5. Amplify secrets are configured.
6. Stripe webhook secret matches the deployed webhook destination.
7. The custom domain points to Amplify.
8. Checkout works as guest.
9. Checkout works when signed in.
10. Webhook marks orders as paid.
11. Emails are sent after paid confirmation.
12. Admin can view and update orders.

## Important Notes

- `amplify_outputs.json` is environment-specific and should not be committed.
- `.env` files should not be committed.
- Payment and email secrets belong in Amplify secrets.
- Checkout totals are calculated in integer pence.
- The frontend should never directly create `Order`, `OrderItem`, or `CustomerProfile` records.
- The backend validates product prices and delivery rules again before Stripe Checkout.
- The webhook is the payment source of truth.
- Refund loyalty reversal is currently a manual/admin-side process.

## Future Improvements

Future improvements could include:

- More advanced media upload management
- Automated refund loyalty reversal
- Customer order history
- More detailed analytics
- Stock reservation during checkout
- More product customisation options
- Expanded admin reporting

## Credits

Butter & Better Bakery is owned by Sarah Zain.

The website was designed, built, and deployed by me, Ahmed Abbas.
