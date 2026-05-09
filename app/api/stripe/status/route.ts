import { NextResponse } from "next/server";
import { stripeStatus } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(stripeStatus());
}
