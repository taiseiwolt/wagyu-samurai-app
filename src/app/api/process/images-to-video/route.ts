import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  createImageToVideoTask,
  pollTaskUntilDone,
  downloadVideo,
} from "@/lib/runway";

/**
 * POST /api/process/images-to-video
 *
 * When no video is uploaded, generate a 5-second video from a photo
 * using Runway Gen-4 Turbo (image-to-video).
 *
 * Request body:
 *   { post_id, options?: { bgm_track } }
 *
 * Flow:
 *   1. Pick the first photo from media table for this post
 *   2. Send to Runway Gen-4 Turbo → 5s video (720:1280 vertical)
 *   3. Save generated video to Supabase Storage (processed bucket)
 *   4. Create new media record with type='video'
 *   5. Return video URL for client-side FFmpeg processing (crop + watermark + BGM)
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post_id, options } = body;

    if (!post_id) {
      return NextResponse.json(
        { success: false, error: "post_id is required" },
        { status: 400 }
      );
    }

    // 1. Fetch photo media for this post
    const { data: photos, error: photoError } = await supabaseAdmin
      .from("media")
      .select("id, storage_path, store_id")
      .eq("post_id", post_id)
      .eq("type", "photo")
      .limit(1);

    if (photoError) {
      return NextResponse.json(
        { success: false, error: photoError.message },
        { status: 500 }
      );
    }

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { success: false, error: "No photos found for this post" },
        { status: 404 }
      );
    }

    const photo = photos[0];
    const storeId = photo.store_id;

    // 2. Get signed URL for the photo
    const bucket = photo.storage_path.split("/")[0];
    const path = photo.storage_path.replace(`${bucket}/`, "");

    const { data: signedData, error: signedError } =
      await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 600);

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { success: false, error: "Failed to get photo URL" },
        { status: 500 }
      );
    }

    // 3. Create Runway image-to-video task
    let taskId: string;
    try {
      taskId = await createImageToVideoTask({
        imageUrl: signedData.signedUrl,
        promptText:
          "Slow cinematic pan over premium wagyu beef with gentle steam rising, warm lighting, shallow depth of field",
        duration: 5,
        ratio: "720:1280",
      });
    } catch (err) {
      // Retry once
      console.error("Runway task creation failed, retrying...", err);
      taskId = await createImageToVideoTask({
        imageUrl: signedData.signedUrl,
        promptText:
          "Slow cinematic pan over premium wagyu beef, warm lighting",
        duration: 5,
        ratio: "720:1280",
      });
    }

    // 4. Poll until done
    const result = await pollTaskUntilDone(taskId);

    if (!result.output || result.output.length === 0) {
      return NextResponse.json(
        { success: false, error: "Runway did not produce output" },
        { status: 500 }
      );
    }

    // 5. Download generated video and save to Supabase
    const videoBuffer = await downloadVideo(result.output[0]);
    const newMediaId = crypto.randomUUID();
    const storagePath = `${storeId}/${newMediaId}.mp4`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("videos")
      .upload(storagePath, videoBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 6. Create new media record as type='video'
    const { error: insertError } = await supabaseAdmin.from("media").insert({
      id: newMediaId,
      post_id,
      store_id: storeId,
      type: "video",
      storage_path: `videos/${storagePath}`,
      processing_status: "pending",
    });

    if (insertError) {
      console.error("Failed to create media record:", insertError);
    }

    // 7. Get signed URL for client-side FFmpeg processing
    const { data: videoSignedData } = await supabaseAdmin.storage
      .from("videos")
      .createSignedUrl(storagePath, 600);

    return NextResponse.json({
      success: true,
      video: {
        media_id: newMediaId,
        store_id: storeId,
        video_url: videoSignedData?.signedUrl ?? result.output[0],
        source_photo_id: photo.id,
      },
      options: {
        add_bgm: options?.add_bgm ?? true,
        bgm_track: options?.bgm_track ?? "lofi_01",
      },
    });
  } catch (error) {
    console.error("Image-to-video error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Image-to-video generation failed",
      },
      { status: 500 }
    );
  }
}
