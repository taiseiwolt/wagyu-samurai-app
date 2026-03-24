import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { area, genre, priceRange, partySize, excludeStoreId } = body;

    // Fetch candidate stores from the same area
    let query = supabaseAdmin.from("stores").select("*");

    if (area) {
      query = query.eq("area", area);
    }
    if (excludeStoreId) {
      query = query.neq("id", excludeStoreId);
    }

    const { data: stores, error } = await query.limit(20);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    if (!stores || stores.length === 0) {
      return NextResponse.json({
        success: true,
        alternatives: [],
        message: "No alternative stores found in this area",
      });
    }

    const storeList = stores
      .map(
        (s) =>
          `- ${s.name} (${s.name_en || "N/A"}) | Genre: ${s.genre || "N/A"} | Area: ${s.area || "N/A"} | Price: ${s.price_range || "N/A"} | Rating: ${s.rating || "N/A"} | ID: ${s.id}`,
      )
      .join("\n");

    const prompt = `You are a premium wagyu dining concierge. A customer's preferred restaurant is unavailable. Suggest 2-3 alternative restaurants from the list below.

Customer preferences:
- Area: ${area || "Any"}
- Genre preference: ${genre || "Any wagyu"}
- Budget range: ${priceRange || "Any"}
- Party size: ${partySize || "N/A"}

Available restaurants:
${storeList}

Select 2-3 best alternatives and explain why each is a good fit. Return as JSON array:
[{"store_id": "uuid", "name": "...", "reason": "1-2 sentence explanation of why this is a great alternative"}]

Return ONLY the JSON array, no other text.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: "Failed to parse suggestions" },
        { status: 500 },
      );
    }

    const suggestions = JSON.parse(jsonMatch[0]);

    // Enrich with full store data
    const enriched = suggestions.map(
      (s: { store_id: string; name: string; reason: string }) => {
        const storeData = stores.find((st) => st.id === s.store_id);
        return {
          ...s,
          store: storeData || null,
        };
      },
    );

    return NextResponse.json({
      success: true,
      alternatives: enriched,
    });
  } catch (error) {
    console.error("Alternatives suggestion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
