import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

    const prompt = `You are writing a confirmation email for WAGYU SAMURAI, a premium wagyu dining concierge service in Japan. Generate a professional, warm, and concise confirmation email in English.

Details:
- Customer name: ${customerName}
- Restaurant: ${storeName}
- Address: ${storeAddress || "TBD"}
- Google Maps: ${googleMapsUrl || "N/A"}
- Date: ${reservationDate}
- Time: ${reservationTime || "TBD"}
- Party size: ${partySize} guests
- Plan: ${plan || "Standard"}
- Special requests: ${specialRequests || "None"}

Generate the email with:
1. A warm greeting
2. Reservation details with emoji icons (📍📅👥📌🗺️)
3. "What to expect" section with 2-3 ordering tips appropriate for a premium wagyu restaurant
4. "Good to know" section with 2-3 practical notes (dress code, cancellation policy, arrival time, etc.)
5. A confident closing line
6. Sign off as "— WAGYU SAMURAI"

Keep the tone premium but approachable. Do NOT use markdown formatting — use plain text only.
Also generate a subject line in the format: Your table is booked — [Store Name], [Date]

Return the response in this exact JSON format:
{"subject": "...", "body": "..."}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON from Claude's response
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
