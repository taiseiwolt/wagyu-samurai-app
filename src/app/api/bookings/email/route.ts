import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PAYMENT_LINKS: Record<string, string | undefined> = {
  standard: process.env.STRIPE_PAYMENT_LINK_STANDARD,
  premium: process.env.STRIPE_PAYMENT_LINK_PREMIUM,
  vip: process.env.STRIPE_PAYMENT_LINK_VIP,
};

const PLAN_LABELS: Record<string, string> = {
  standard: "Standard",
  premium: "Premium",
  vip: "VIP",
};

const PLAN_FEES: Record<string, string> = {
  standard: "$15/person",
  premium: "$20/person",
  vip: "$30/person",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName,
      storeName,
      storeAddress,
      googleMapsUrl,
      reservationDate,
      reservationTime,
      partySize,
      plan,
      specialRequests,
    } = body;

    if (!customerName || !storeName || !reservationDate || !partySize) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const planKey = (plan || "standard").toLowerCase();
    const paymentLink = PAYMENT_LINKS[planKey];
    const planLabel = PLAN_LABELS[planKey] || "Standard";
    const planFee = PLAN_FEES[planKey] || "$15/person";

    const paymentSection = paymentLink
      ? `
8. A "Pay Reservation Fee" section at the end of the email, just before the sign-off:
   - A brief line: "To confirm your reservation, please complete the service fee payment:"
   - A clear call-to-action on its own line: "→ Pay Reservation Fee (${planLabel} Plan — ${planFee}): ${paymentLink}"
   - A note: "Payment is required to finalize your booking."
`
      : `
8. A note that the reservation fee payment link will be sent separately.
`;

    const prompt = `You are writing a confirmation email for WAGYU SAMURAI, a premium wagyu dining concierge service in Japan. Generate a professional, warm, and concise confirmation email in English.

Details:
- Customer name: ${customerName}
- Restaurant: ${storeName}
- Address: ${storeAddress || "TBD"}
- Google Maps: ${googleMapsUrl || "N/A"}
- Date: ${reservationDate}
- Time: ${reservationTime || "TBD"}
- Party size: ${partySize} guests
- Plan: ${planLabel}
- Special requests: ${specialRequests || "None"}

Generate the email with:
1. A warm greeting
2. Reservation details with emoji icons (📍📅👥📌🗺️)
3. "What to expect" section with 2-3 ordering tips appropriate for a premium wagyu restaurant
4. "Good to know" section with 2-3 practical notes (dress code, cancellation policy, arrival time, etc.)
5. A confident closing line
6. Sign off as "— WAGYU SAMURAI"
7. Do NOT use markdown formatting — use plain text only.
${paymentSection}

Return the response in this exact JSON format:
{"subject": "...", "body": "..."}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: "Failed to parse email content" },
        { status: 500 },
      );
    }

    const emailData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      email: {
        subject: emailData.subject,
        body: emailData.body,
      },
    });
  } catch (error) {
    console.error("Email generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
