import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendFollowupEmail } from "@/lib/followup-email";

export async function POST(req: NextRequest) {
  const { booking_id } = await req.json();

  if (!booking_id) {
    return NextResponse.json({ error: "booking_id is required" }, { status: 400 });
  }

  // Fetch booking with store name
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_name, customer_email, followup_email_sent, stores(name_en)")
    .eq("id", booking_id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!booking.customer_email) {
    return NextResponse.json({ error: "No customer email on this booking" }, { status: 400 });
  }

  if (booking.followup_email_sent) {
    return NextResponse.json({ error: "Followup email already sent" }, { status: 409 });
  }

  const result = await sendFollowupEmail({
    id: booking.id,
    customer_name: booking.customer_name,
    customer_email: booking.customer_email,
    store_name: (booking.stores as unknown as { name_en: string | null } | null)?.name_en || null,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Followup email sent" });
}
