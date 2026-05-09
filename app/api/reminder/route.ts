import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Invoice = {
  client: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
};

type Body = {
  inv: Invoice;
  daysLate: number;
  userContext?: string;
  payLink?: string | null;
  senderName?: string;
};

const fmtDate = (s: string) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { inv, daysLate, userContext, payLink, senderName } = body;
  if (!inv || typeof daysLate !== "number") {
    return NextResponse.json({ error: "Missing invoice or daysLate." }, { status: 400 });
  }

  const tone =
    daysLate <= 7
      ? "friendly nudge — assume honest oversight"
      : daysLate <= 30
        ? "clear, direct, request immediate action"
        : daysLate <= 60
          ? "firm, mention late fees and account hold"
          : "final notice — mention referral to collections";

  const linkInstruction = payLink
    ? `\n\nIMPORTANT: Include this Stripe payment link in the email body as a clear, prominent call to action so the client can pay in one click:\n${payLink}\n\nFormat it as an obvious CTA on its own line, e.g.: "Pay now → ${payLink}"`
    : "";

  const signOff = senderName
    ? `Sign off as: ${senderName}`
    : "Use a generic professional sign-off (e.g. 'Best,').";

  const prompt = `You are writing a professional payment reminder email for a small service business chasing an overdue invoice.

Invoice details:
- Client: ${inv.client}
- Invoice number: ${inv.invoiceNumber}
- Amount: $${inv.amount.toLocaleString()}
- Due date: ${fmtDate(inv.dueDate)}
- Days overdue: ${daysLate}

Tone required: ${tone}
Additional context from sender: ${userContext || "(none — use standard professional tone)"}
${signOff}${linkInstruction}

Write a complete reminder email. It should:
- Match the firmness level requested
- Be concise (subject under 10 words; body under 150 words)
- Sound like a real person, not a template
- Include a clear call to action

Return ONLY in this exact format, nothing else:
SUBJECT: <subject line>
BODY:
<email body>`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { type: string; text?: string }) => b.text || "")
      .join("\n");

    const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
    const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);

    return NextResponse.json({
      subject: subjectMatch ? subjectMatch[1].trim() : "Reminder: Invoice payment outstanding",
      body: bodyMatch ? bodyMatch[1].trim() : text.trim(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AI service error: ${message}` },
      { status: 502 },
    );
  }
}
