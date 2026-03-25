import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { supabaseAdmin } from "@/lib/supabase";

// --- Types ---

interface MediaRow {
  id: string;
  storage_path: string;
  store_id: string;
}

interface StoreRow {
  id: string;
  name: string;
  name_en?: string;
  area?: string;
}

interface ProcessedMedia {
  media_id: string;
  original_url: string;
  processed_urls: {
    square: string;
    portrait: string;
  };
}

// --- Color grading transformations ---

const COLOR_GRADE_BASE = [
  { effect: "art:warm" },
  { effect: "saturation:-20" },
  { effect: "brightness:-10" },
  { effect: "improve:outdoor:15" }, // contrast boost
  { effect: "sharpen:80" },
];

function buildTransformation(
  width: number,
  height: number,
  storeName: string | null,
  area: string | null,
) {
  const transforms: Record<string, unknown>[] = [
    // 1. Color grading
    ...COLOR_GRADE_BASE,
    // 2. Resize
    { crop: "fill", width, height, gravity: "auto" },
  ];

  // 3. Text overlay (only if store info available)
  if (storeName) {
    const displayText = area ? `${storeName}  ·  ${area}` : storeName;

    // Semi-transparent background bar at bottom
    transforms.push({
      overlay: {
        font_family: "DM Sans",
        font_size: 24,
        font_weight: "bold",
        text: displayText,
      },
      color: "#F5F0EB",
      gravity: "south_west",
      x: 20,
      y: 20,
      background: "#1A1A1A",
      effect: "background_opacity:60",
    });
  }

  return transforms;
}

// --- Main handler ---

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post_id } = body;

    if (!post_id) {
      return NextResponse.json(
        { success: false, error: "post_id is required" },
        { status: 400 },
      );
    }

    // 1. Fetch media records for this post
    const { data: mediaRows, error: mediaError } = await supabaseAdmin
      .from("media")
      .select("id, storage_path, store_id")
      .eq("post_id", post_id)
      .eq("type", "photo");

    if (mediaError) {
      return NextResponse.json(
        { success: false, error: mediaError.message },
        { status: 500 },
      );
    }

    if (!mediaRows || mediaRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No photos found for this post" },
        { status: 404 },
      );
    }

    // 2. Fetch store info for text overlay
    const storeId = (mediaRows as MediaRow[])[0].store_id;
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("id, name, name_en, area")
      .eq("id", storeId)
      .single();

    const storeData = store as StoreRow | null;
    const storeName = storeData?.name_en || storeData?.name || null;
    const storeArea = storeData?.area || null;

    // 3. Process each image
    const processed: ProcessedMedia[] = [];

    for (const row of mediaRows as MediaRow[]) {
      try {
        // Mark as processing
        await supabaseAdmin
          .from("media")
          .update({ processing_status: "processing" })
          .eq("id", row.id);

        // Get signed URL from Supabase Storage
        const bucket = row.storage_path.split("/")[0]; // "photos"
        const path = row.storage_path.replace(`${bucket}/`, "");

        const { data: signedData, error: signedError } =
          await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(path, 600); // 10 min expiry

        if (signedError || !signedData?.signedUrl) {
          console.error(`Failed to get signed URL for ${row.id}:`, signedError);
          await supabaseAdmin
            .from("media")
            .update({ processing_status: "error" })
            .eq("id", row.id);
          continue;
        }

        const originalUrl = signedData.signedUrl;

        // Upload to Cloudinary
        let uploadResult;
        try {
          uploadResult = await cloudinary.uploader.upload(originalUrl, {
            folder: `wagyu-samurai/${post_id}`,
            resource_type: "image",
          });
        } catch (uploadErr) {
          // Retry once
          console.error(`Cloudinary upload failed for ${row.id}, retrying...`);
          try {
            uploadResult = await cloudinary.uploader.upload(originalUrl, {
              folder: `wagyu-samurai/${post_id}`,
              resource_type: "image",
            });
          } catch {
            console.error(`Cloudinary upload retry failed for ${row.id}`);
            await supabaseAdmin
              .from("media")
              .update({ processing_status: "error" })
              .eq("id", row.id);
            continue;
          }
        }

        const publicId = uploadResult.public_id;

        // Generate 1:1 (square) version
        const squareUrl = cloudinary.url(publicId, {
          transformation: buildTransformation(1080, 1080, storeName, storeArea),
          secure: true,
        });

        // Generate 4:5 (portrait) version
        const portraitUrl = cloudinary.url(publicId, {
          transformation: buildTransformation(
            1080,
            1350,
            storeName,
            storeArea,
          ),
          secure: true,
        });

        // Download processed images and save to Supabase Storage 'processed' bucket
        const squareStoragePath = `${storeId}/${row.id}_square.jpg`;
        const portraitStoragePath = `${storeId}/${row.id}_portrait.jpg`;

        const [squareSaved, portraitSaved] = await Promise.all([
          downloadAndStore(squareUrl, "processed", squareStoragePath),
          downloadAndStore(portraitUrl, "processed", portraitStoragePath),
        ]);

        // Build final URLs from Supabase Storage
        const { data: squarePublic } = supabaseAdmin.storage
          .from("processed")
          .getPublicUrl(squareStoragePath);
        const { data: portraitPublic } = supabaseAdmin.storage
          .from("processed")
          .getPublicUrl(portraitStoragePath);

        const finalSquareUrl =
          squareSaved && squarePublic ? squarePublic.publicUrl : squareUrl;
        const finalPortraitUrl =
          portraitSaved && portraitPublic
            ? portraitPublic.publicUrl
            : portraitUrl;

        // Update media record
        await supabaseAdmin
          .from("media")
          .update({
            processed_url: JSON.stringify({
              square: finalSquareUrl,
              portrait: finalPortraitUrl,
            }),
            processing_status: "done",
          })
          .eq("id", row.id);

        processed.push({
          media_id: row.id,
          original_url: originalUrl,
          processed_urls: {
            square: finalSquareUrl,
            portrait: finalPortraitUrl,
          },
        });
      } catch (err) {
        console.error(`Error processing media ${row.id}:`, err);
        await supabaseAdmin
          .from("media")
          .update({ processing_status: "error" })
          .eq("id", row.id);
      }
    }

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    console.error("Image processing error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Image processing failed",
      },
      { status: 500 },
    );
  }
}

// --- Helpers ---

async function downloadAndStore(
  url: string,
  bucket: string,
  path: string,
): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;

    const buffer = Buffer.from(await res.arrayBuffer());

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error(`Storage upload failed for ${path}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Download/store failed for ${path}:`, err);
    return false;
  }
}
