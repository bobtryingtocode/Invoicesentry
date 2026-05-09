import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on the server." },
      { status: 500 },
    );
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured on the server." },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  // Stripe needs the raw body for signature verification.
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  // Handle events. With no database wired up, we just log.
  // In production, persist payments here and reconcile against invoices.
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as { client_reference_id?: string | null; metadata?: Record<string, string> };
      console.log(
        "[stripe webhook] checkout completed:",
        session.client_reference_id,
        session.metadata,
      );
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      console.log(`[stripe webhook] ${event.type}:`, event.data.object);
      break;
    }
    default:
      // Acknowledge unhandled events with 200 so Stripe stops retrying.
      console.log(`[stripe webhook] unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
