import { NextResponse } from "next/server";
import { getStripe, getAppUrl } from "@/lib/stripe";

export const runtime = "nodejs";

type Body = { plan: "pro" | "business"; email?: string };

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on the server." },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const priceId =
    body.plan === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : body.plan === "business"
        ? process.env.STRIPE_BUSINESS_PRICE_ID
        : null;

  if (!priceId) {
    return NextResponse.json(
      { error: `Price ID for plan "${body.plan}" is not configured on the server.` },
      { status: 400 },
    );
  }

  const appUrl = getAppUrl(req);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: body.email || undefined,
      metadata: { plan: body.plan, kind: "subscription" },
      success_url: `${appUrl}/?subscribed=${body.plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?subscribe_canceled=${body.plan}`,
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
