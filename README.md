# InvoiceSentry

Cash-flow intelligence for service businesses — track what's owed, predict who'll pay late, and recover overdue invoices with **AI-written reminders + one-click Stripe payment links**.

Built with Next.js 15 (App Router), React 19, the Anthropic SDK, and the Stripe Node SDK. Deployable to Vercel out of the box.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in keys (see below)
npm run dev                  # http://localhost:3000
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Powers the AI reminder-email generator at `POST /api/reminder`. |
| `STRIPE_SECRET_KEY` | Server-side Stripe API. Required for the API-driven checkout/subscribe flows. |
| `STRIPE_WEBHOOK_SECRET` | Verifies signatures on `POST /api/stripe/webhook`. |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for the **Pro** plan ($29/mo). |
| `STRIPE_BUSINESS_PRICE_ID` | Stripe Price ID for the **Business** plan ($79/mo). |
| `NEXT_PUBLIC_APP_URL` | Public origin used for Stripe success/cancel URLs (e.g. `https://yourdomain.com`). Vercel sets `VERCEL_URL` automatically as a fallback. |

The app degrades gracefully when keys are missing:

- No `ANTHROPIC_API_KEY` → reminder modal returns a 500 with a clear error.
- No `STRIPE_SECRET_KEY` → API-based checkout disabled; the UI falls back to user-pasted Stripe Payment Link URLs (entered in **Settings**).
- No `STRIPE_*_PRICE_ID` → that subscription tier shows the fallback Payment Link button or an "open settings" prompt.

## API routes

| Route | Method | Description |
| --- | --- | --- |
| `/api/reminder` | POST | Generates a tone-graded reminder email via Claude. Body: `{ inv, daysLate, userContext, payLink, senderName }`. |
| `/api/stripe/status` | GET | Reports which Stripe env vars are set (for the client to choose UI mode). |
| `/api/stripe/checkout` | POST | Creates a one-time `payment` Checkout Session for an invoice. Body: `{ invoiceNumber, amount, client, clientEmail }`. Returns `{ url, id }`. |
| `/api/stripe/subscribe` | POST | Creates a `subscription` Checkout Session. Body: `{ plan: "pro" \| "business", email? }`. Returns `{ url, id }`. |
| `/api/stripe/verify` | GET | Confirms a session's `payment_status` after the user returns. Query: `session_id`. |
| `/api/stripe/webhook` | POST | Verifies signatures and logs `checkout.session.completed`, `customer.subscription.*`. |

### Stripe webhook setup

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the printed whsec_... into STRIPE_WEBHOOK_SECRET in .env.local
```

In production, register the webhook endpoint at <https://dashboard.stripe.com/webhooks> for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

## Deploy to Vercel

1. Push this repo to GitHub (already done if you're reading this in a PR).
2. Import the repo in <https://vercel.com/new>.
3. Add the env vars above in **Project Settings → Environment Variables**.
4. Deploy. The default build command (`next build`) and output directory work as-is.

## Architecture notes

- Invoice data lives in `localStorage` only — there's no database. After a successful Stripe checkout, the client returns to `/?paid=INV-2041&session_id=cs_...`, hits `/api/stripe/verify`, and marks the invoice paid in local state.
- The Stripe SDK is lazy-initialized in `lib/stripe.ts` so missing env vars never crash the build — only the routes that need them return 500.
- The `Edge` runtime is **not** used for the webhook because Stripe's signature verification needs Node's crypto + the raw request body; all routes are pinned to `runtime = "nodejs"`.
