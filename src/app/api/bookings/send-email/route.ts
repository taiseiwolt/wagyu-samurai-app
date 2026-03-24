import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, to, subject, body: emailBody } = body;

    if (!bookingId || !to || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // For now, log the email (actual sending via Resend/SES can be added later)
    // In production, integrate with an email service like Resend, SendGrid, or SES
    console.log("=== CONFIRMATION EMAIL ===");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${emailBody}`);
    console.log("=== END EMAIL ===");

    // Update booking record
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ confirmation_email_sent: true })
      .eq("id", bookingId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email logged and booking updated (email service integration pending)",
    });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
