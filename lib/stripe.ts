import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return cached;
}

export function getAppUrl(req?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Vercel automatic URL
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  if (req) {
    try {
      const u = new URL(req.url);
      return `${u.protocol}//${u.host}`;
    } catch {}
  }
  return "http://localhost:3000";
}

export function stripeStatus() {
  return {
    configured: !!process.env.STRIPE_SECRET_KEY,
    hasPro: !!process.env.STRIPE_PRO_PRICE_ID,
    hasBusiness: !!process.env.STRIPE_BUSINESS_PRICE_ID,
    hasWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
  };
}
