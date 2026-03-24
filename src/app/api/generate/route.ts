import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are WAGYU SAMURAI — a fearless wagyu expert based in Japan who curates the finest beef restaurants for international food lovers.

BRAND VOICE RULES:
- Write in first person "I"
- Tone: Knowledgeable but frank, like a trusted friend who happens to be a meat expert
- Never use scores or rankings
- Include specific details: cuts, origins, aging methods, price ranges
- Never use vague adjectives like "amazing" or "so good"
- Maximum 1-2 emojis per post (📍 and 🔥 only)
- Never use 🤤😍🙏
- Never sound like a corporate review or advertisement
- Naturally mention booking difficulty or exclusivity when relevant
- End Instagram posts with a subtle booking CTA ("DM me — I'll get you in" style)

TAGLINE: Hand-picked. If it's here, it's worth it. Taste over trends.
AREAS: Tokyo, Kyoto, Osaka
BOOKING: Standard ¥1,500/person, Premium ¥2,000/person, VIP ¥3,000/person`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post_id, store_id } = body;

    if (!post_id || !store_id) {
      return NextResponse.json(
        { success: false, error: "post_id and store_id are required" },
        { status: 400 },
      );
    }

    // 1. Fetch store info
    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("*")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { success: false, error: "Store not found" },
        { status: 404 },
      );
    }

    // 2. Fetch post (memo)
    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 },
      );
    }

    // 3. Build user prompt
    const userPrompt = buildUserPrompt(store, post);

    // 4. Call Claude API (with 1 retry)
    let result: GenerateResult;
    try {
      result = await callClaude(userPrompt);
    } catch {
      // Retry once
      result = await callClaude(userPrompt);
    }

    // 5. Update posts table
    const { error: updateError } = await supabaseAdmin
      .from("posts")
      .update({
        ig_caption: result.ig_caption,
        ig_hashtags: result.ig_hashtags,
        ghost_title: result.ghost_title,
        ghost_meta_desc: result.ghost_meta_desc,
        ghost_body: result.ghost_body,
        medium_body: result.medium_body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post_id);

    if (updateError) {
      console.error("Failed to update post:", updateError);
      // Still return the generated content even if save fails
    }

    return NextResponse.json({
      success: true,
      post_id,
      ig_caption: result.ig_caption,
      ig_hashtags: result.ig_hashtags,
      ghost_title: result.ghost_title,
      ghost_meta_desc: result.ghost_meta_desc,
      ghost_body: result.ghost_body,
      medium_body: result.medium_body,
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Generation failed",
      },
      { status: 500 },
    );
  }
}

interface GenerateResult {
  ig_caption: string;
  ig_hashtags: string[];
  ghost_title: string;
  ghost_meta_desc: string;
  ghost_body: string;
  medium_body: string;
}

function buildUserPrompt(
  store: Record<string, unknown>,
  post: Record<string, unknown>,
): string {
  return `Generate 3 types of content for this restaurant review.

STORE INFO:
- Name: ${store.name}${store.name_en ? ` (${store.name_en})` : ""}
- Area: ${store.area || "Tokyo"}
- Genre: ${store.genre || "wagyu"}
- Price range: ${store.price_range || "N/A"}
- Rating: ${store.rating || "N/A"}
- Address: ${store.address || "N/A"}${store.address_en ? ` / ${store.address_en}` : ""}
- Booking difficulty: ${store.booking_difficulty || "moderate"}

MY NOTES (感想メモ):
${post.memo || "No notes provided"}

---

Return your response as valid JSON with this exact structure:
{
  "ig_caption": "(English caption, 150-300 words. End with a subtle booking CTA.)",
  "ig_hashtags": ["#wagyu", "#tokyofood", ... (30 hashtags, English, mix of wagyu/food/travel/city tags)],
  "ghost_title": "(SEO title, max 60 chars, include keywords. e.g. 'The 40-Day Dry-Aged A5 Experience at [Store], [Area]')",
  "ghost_meta_desc": "(Meta description, max 155 chars)",
  "ghost_body": "(Full HTML review, 500-800 words. Sections: intro, recommended cuts/courses, price range, atmosphere/service, access info, booking CTA with link placeholder)",
  "medium_body": "(200-300 word summary. End with 'Read the full review and book your table → [Ghost URL]')"
}

IMPORTANT: Return ONLY the JSON object, no markdown fencing or extra text.`;
}

async function callClaude(userPrompt: string): Promise<GenerateResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse generated content as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate required fields
  const required = [
    "ig_caption",
    "ig_hashtags",
    "ghost_title",
    "ghost_meta_desc",
    "ghost_body",
    "medium_body",
  ];
  for (const field of required) {
    if (!parsed[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return parsed as GenerateResult;
}
