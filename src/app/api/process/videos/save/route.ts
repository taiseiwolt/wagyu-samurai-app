import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/process/videos/save
 *
 * Called by the client after ffmpeg.wasm processing is complete.
 * Receives the processed video blob (as FormData) and saves to Supabase Storage.
 *
 * FormData fields:
 *   - media_id: string
 *   - store_id: string
 *   - video: File (processed mp4)
 *   - duration_seconds: string (number)
 *   - resolution: string (e.g. "1080x1920")
 */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const mediaId = formData.get("media_id") as string;
    const storeId = formData.get("store_id") as string;
    const videoFile = formData.get("video") as File;
    const durationSeconds = Number(formData.get("duration_seconds") || 0);
    const resolution = (formData.get("resolution") as string) || "1080x1920";

    if (!mediaId || !storeId || !videoFile) {
      return NextResponse.json(
        { success: false, error: "media_id, store_id, and video are required" },
        { status: 400 }
      );
    }

    // Upload processed video to Supabase Storage
    const storagePath = `${storeId}/${mediaId}_processed.mp4`;
    const buffer = Buffer.from(await videoFile.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("processed")
      .upload(storagePath, buffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload processed video:", uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicData } = supabaseAdmin.storage
      .from("processed")
      .getPublicUrl(storagePath);

    const processedUrl = publicData?.publicUrl ?? "";

    // Update media record
    await supabaseAdmin
      .from("media")
      .update({
        processed_url: processedUrl,
        processing_status: "done",
      })
      .eq("id", mediaId);

    return NextResponse.json({
      success: true,
      processed: {
        media_id: mediaId,
        processed_url: processedUrl,
        duration_seconds: durationSeconds,
        resolution,
      },
    });
  } catch (error) {
    console.error("Video save error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Video save failed",
      },
      { status: 500 }
    );
  }
}
