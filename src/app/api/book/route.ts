import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      arrival_date,
      departure_date,
      preferred_area,
      cuisine_type,
      party_size,
      budget_per_person,
      special_requests,
      preferred_restaurant,
    } = body;

    // Validate required fields
    if (
      !name ||
      !email ||
      !arrival_date ||
      !departure_date ||
      !preferred_area ||
      !cuisine_type ||
      !party_size ||
      !budget_per_person
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (departure_date <= arrival_date) {
      return NextResponse.json(
        { success: false, error: "Departure date must be after arrival date" },
        { status: 400 }
      );
    }

    // Insert into bookings table
    const { data: booking, error: dbError } = await supabaseAdmin
      .from("bookings")
      .insert({
        customer_name: name,
        customer_email: email,
        travel_dates: `[${arrival_date},${departure_date}]`,
        preferred_area,
        preferred_genre: cuisine_type,
        party_size,
        budget: budget_per_person,
        special_requests: special_requests || null,
        preferred_store: preferred_restaurant || null,
        status: "new",
        source: "form",
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB insert error:", dbError);
      return NextResponse.json(
        { success: false, error: "Failed to save reservation" },
        { status: 500 }
      );
    }

    // Send confirmation email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const emailBody = buildConfirmationEmail({
        name,
        arrival_date,
        departure_date,
        preferred_area,
        cuisine_type,
        party_size,
        budget_per_person,
        special_requests,
      });

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || "WAGYU SAMURAI <onboarding@resend.dev>",
            to: [email],
            subject:
              "Your WAGYU SAMURAI reservation request has been received",
            text: emailBody,
          }),
        });
      } catch (emailErr) {
        // Log but don't fail the booking if email fails
        console.error("Email send error:", emailErr);
      }
    }

    return NextResponse.json({ success: true, data: booking });
  } catch (err) {
    console.error("Book API error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildConfirmationEmail(params: {
  name: string;
  arrival_date: string;
  departure_date: string;
  preferred_area: string;
  cuisine_type: string;
  party_size: number;
  budget_per_person: string;
  special_requests: string;
}) {
  const {
    name,
    arrival_date,
    departure_date,
    preferred_area,
    cuisine_type,
    party_size,
    budget_per_person,
    special_requests,
  } = params;

  return `Hi ${name},

Thank you for your reservation request!

Here's what I received:
- Travel dates: ${arrival_date} to ${departure_date}
- Area: ${preferred_area}
- Cuisine: ${cuisine_type}
- Party size: ${party_size}
- Budget: ${budget_per_person}
- Special requests: ${special_requests || "None"}

I'll personally review your request and find the perfect spot.

Expect to hear back within 24 hours.

— WAGYU SAMURAI`;
}
