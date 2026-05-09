import { NextResponse } from "next/server";
import { getStripe, getAppUrl } from "@/lib/stripe";

export const runtime = "nodejs";

type Body = {
  invoiceNumber: string;
  amount: number;
  client: string;
  clientEmail?: string;
  description?: string;
};

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on the server. Set STRIPE_SECRET_KEY." },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { invoiceNumber, amount, client, clientEmail, description } = body;
  if (!invoiceNumber || !client || !amount || amount <= 0) {
    return NextResponse.json(
      { error: "invoiceNumber, client, and a positive amount are required." },
      { status: 400 },
    );
  }

  const appUrl = getAppUrl(req);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: invoiceNumber,
      customer_email: clientEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Invoice ${invoiceNumber} — ${client}`,
              description: description || `Payment for invoice ${invoiceNumber}`,
            },
          },
        },
      ],
      metadata: {
        invoiceNumber,
        client,
        kind: "invoice_payment",
      },
      success_url: `${appUrl}/?paid=${encodeURIComponent(invoiceNumber)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?canceled=${encodeURIComponent(invoiceNumber)}`,
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
