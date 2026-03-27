import { Resend } from "resend";
import { supabaseAdmin } from "./supabase";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

interface FollowupTarget {
  id: string;
  customer_name: string;
  customer_email: string;
  store_name: string | null;
}

function buildFollowupHtml(name: string, storeName: string): string {
  return `
<div style="font-family: 'DM Sans', sans-serif; background: #1A1A1A; color: #F5F0EB; padding: 40px; max-width: 600px; margin: 0 auto;">
  <h1 style="font-family: 'Cormorant Garamond', serif; color: #F5F0EB; font-size: 28px;">
    WAGYU SAMURAI
  </h1>

  <p>Hi ${name},</p>

  <p>Hope you enjoyed your meal at <strong>${storeName}</strong> yesterday!</p>

  <p>I'd love to hear how it went. A quick reply with your thoughts would mean a lot — it helps me keep my recommendations sharp.</p>

  <h3 style="color: #C4A35A;">Share the experience</h3>
  <p>If you post any photos on Instagram, tag <strong>@wagyu.samurai</strong> — I'll feature the best ones in my stories!</p>

  <h3 style="color: #C4A35A;">Know someone visiting Japan?</h3>
  <p>Send them my way. Every recommendation I make is hand-picked, and I'll take the same care with their booking.</p>

  <p>Until next time,<br/>
  <strong>— WAGYU SAMURAI</strong></p>

  <hr style="border: 1px solid #333; margin: 30px 0;" />
  <p style="font-size: 12px; color: #666;">
    Hand-picked. If it's here, it's worth it. Taste over trends.<br/>
    Tokyo · Kyoto · Osaka
  </p>
</div>`;
}

export async function sendFollowupEmail(target: FollowupTarget): Promise<{
  success: boolean;
  error?: string;
}> {
  const storeName = target.store_name || "your restaurant";
  const subject = `How was your experience at ${storeName}?`;
  const html = buildFollowupHtml(target.customer_name, storeName);

  try {
    const { error } = await getResend().emails.send({
      from: "WAGYU SAMURAI <noreply@resend.dev>",
      to: target.customer_email,
      subject,
      html,
    });

    if (error) {
      console.error(`[followup] Failed to send to ${target.customer_email}:`, error);
      return { success: false, error: error.message };
    }

    // Mark as sent
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({ followup_email_sent: true })
      .eq("id", target.id);

    if (updateError) {
      console.error(`[followup] Failed to update booking ${target.id}:`, updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`[followup] Sent to ${target.customer_email} for booking ${target.id}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[followup] Exception sending to ${target.customer_email}:`, message);
    return { success: false, error: message };
  }
}

export async function getFollowupTargets(): Promise<FollowupTarget[]> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_name, customer_email, store_id, stores(name_en)")
    .eq("status", "confirmed")
    .eq("followup_email_sent", false)
    .filter("reservation_date", "eq", new Date(Date.now() - 86400000).toISOString().split("T")[0]);

  if (error) {
    console.error("[followup] Query error:", error);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data
    .filter((b: Record<string, unknown>) => b.customer_email)
    .map((b: Record<string, unknown>) => ({
      id: b.id as string,
      customer_name: b.customer_name as string,
      customer_email: b.customer_email as string,
      store_name: (b.stores as { name_en: string | null } | null)?.name_en || null,
    }));
}
