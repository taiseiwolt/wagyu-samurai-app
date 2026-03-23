import { NextRequest } from "next/server";
import * as cheerio from "cheerio";
import { supabaseAdmin } from "@/lib/supabase";

const TABELOG_URL_PATTERN =
  /^https?:\/\/(www\.)?tabelog\.com\/([a-z]+)\/A\d{4}\/A\d{6}\/\d+\/?$/;

const AREA_MAP: Record<string, string> = {
  tokyo: "tokyo",
  kyoto: "kyoto",
  osaka: "osaka",
};

const GENRE_MAP: Record<string, string> = {
  焼肉: "yakiniku",
  焼き肉: "yakiniku",
  ステーキ: "wagyu_steak",
  鉄板焼き: "wagyu_steak",
  すき焼き: "sukiyaki",
  しゃぶしゃぶ: "sukiyaki",
};

function detectArea(url: string): string | null {
  const match = url.match(/tabelog\.com\/([a-z]+)\//);
  if (!match) return null;
  return AREA_MAP[match[1]] ?? null;
}

function detectGenre(genreText: string): string {
  for (const [keyword, genre] of Object.entries(GENRE_MAP)) {
    if (genreText.includes(keyword)) return genre;
  }
  return "other";
}

function parseHours(
  hoursText: string
): { lunch?: string; dinner?: string } | null {
  if (!hoursText) return null;

  const result: { lunch?: string; dinner?: string } = {};

  // Match time ranges like 11:30～14:00 or 17:00～23:00
  const timeRanges = hoursText.match(
    /(\d{1,2}:\d{2})\s*[～〜\-–—]\s*(\d{1,2}:\d{2})/g
  );
  if (!timeRanges) return null;

  for (const range of timeRanges) {
    const parts = range.match(
      /(\d{1,2}:\d{2})\s*[～〜\-–—]\s*(\d{1,2}:\d{2})/
    );
    if (!parts) continue;

    const startHour = parseInt(parts[1].split(":")[0], 10);
    if (startHour < 15) {
      result.lunch = `${parts[1]}-${parts[2]}`;
    } else {
      result.dinner = `${parts[1]}-${parts[2]}`;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function getInfoTableValue(
  $: cheerio.CheerioAPI,
  label: string
): string | null {
  let value: string | null = null;
  $(".rstinfo-table__table th").each((_, el) => {
    if (value) return;
    if ($(el).text().trim().startsWith(label)) {
      value = $(el).closest("tr").find("td").first().text().trim() || null;
    }
  });
  return value;
}

async function scrapeTabelog(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch page: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Store name
  const name =
    $("h2.display-name span").first().text().trim() ||
    $("h2.display-name").first().text().trim() ||
    $(".rd-header__rst-name-main").first().text().trim() ||
    $("title").text().replace(/\s*[-–—].*$/, "").trim() ||
    null;

  // Genre from info table or breadcrumbs
  const genreText =
    getInfoTableValue($, "ジャンル") ||
    $(".c-breadcrumbs__item a, .breadcrumb-item a")
      .map((_, el) => $(el).text())
      .get()
      .join(" ") ||
    "";
  const genre = detectGenre(genreText);

  // Area from URL
  const area = detectArea(url);

  // Rating
  const ratingText =
    $(".rdheader-rating__score-val-dtl").first().text().trim() ||
    $(".rdheader-rating__score-val").first().text().trim() ||
    $("span.c-rating__val").first().text().trim() ||
    "";
  const rating = ratingText ? parseFloat(ratingText) || null : null;

  // Price range (dinner budget)
  // Find the c-rating-v3 element that contains a dinner time icon, then get its val
  let priceRange: string | null = null;
  $(".c-rating-v3").each((_, el) => {
    if (priceRange) return;
    const hasDinner = $(el).find(".c-rating-v3__time--dinner").length > 0;
    if (hasDinner) {
      const val = $(el).find(".c-rating-v3__val").first().text().trim();
      if (val) priceRange = val;
    }
  });
  if (!priceRange) {
    // Fallback: first budget price target
    priceRange =
      $(".rdheader-budget__price-target").first().text().trim() || null;
  }
  // Normalize empty/dash values to null
  if (priceRange === "-" || priceRange === "−" || priceRange === "") {
    priceRange = null;
  }

  // Address
  const address =
    $(".rstinfo-table__address").first().text().trim() ||
    $("p.rstinfo-table__address").first().text().trim() ||
    $("th:contains('住所')")
      .closest("tr")
      .find("td")
      .first()
      .text()
      .trim() ||
    null;

  // Phone
  let phone =
    $(".rstinfo-table__tel-num-wrap .rstinfo-table__tel-num")
      .first()
      .text()
      .trim() || null;
  if (!phone) {
    // Fallback: extract phone from "予約・お問い合わせ" info table row
    const contactText = getInfoTableValue($, "予約");
    if (contactText) {
      const phoneMatch = contactText.match(
        /(\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4})/
      );
      if (phoneMatch) phone = phoneMatch[1];
    }
  }

  // Business hours from info table
  const hoursText = getInfoTableValue($, "営業時間") || "";
  const hours = parseHours(hoursText);

  return {
    name,
    name_en: null,
    tabelog_url: url,
    area,
    genre,
    price_range: priceRange,
    rating,
    address,
    address_en: null,
    phone,
    hours,
    google_maps_url: null,
    booking_difficulty: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return Response.json(
        { success: false, error: "url is required" },
        { status: 400 }
      );
    }

    if (!TABELOG_URL_PATTERN.test(url)) {
      return Response.json(
        {
          success: false,
          error:
            "Invalid URL. Must be a Tabelog restaurant page (e.g. https://tabelog.com/tokyo/A1301/A130101/13012345/)",
        },
        { status: 400 }
      );
    }

    const storeData = await scrapeTabelog(url);

    // Upsert: update if tabelog_url exists, insert otherwise
    const { data, error } = await supabaseAdmin
      .from("stores")
      .upsert(storeData, { onConflict: "tabelog_url" })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return Response.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return Response.json({ success: true, store: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Scrape error:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
