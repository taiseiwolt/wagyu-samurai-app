import { NextRequest, NextResponse } from "next/server";
import { getFollowupTargets, sendFollowupEmail } from "@/lib/followup-email";

export async function POST(req: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targets = await getFollowupTargets();

  if (targets.length === 0) {
    return NextResponse.json({ success: true, message: "No followup emails to send", sent: 0 });
  }

  const results = await Promise.allSettled(
    targets.map((t) => sendFollowupEmail(t))
  );

  const sent = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;
  const failed = results.length - sent;

  console.log(`[cron/followup] Processed ${results.length} bookings: ${sent} sent, ${failed} failed`);

  return NextResponse.json({
    success: true,
    total: results.length,
    sent,
    failed,
  });
}

// Vercel Cron uses GET by default
export async function GET(req: NextRequest) {
  return POST(req);
}
