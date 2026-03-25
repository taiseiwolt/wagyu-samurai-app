import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  createImageToVideoTask,
  pollTaskUntilDone,
  downloadVideo,
} from "@/lib/runway";

/**
 * POST /api/process/videos
 *
 * Two-phase pipeline:
 *   Phase 1 (server): Runway ML slow-motion / color grading → download result
 *   Phase 2 (client): ffmpeg.wasm crops to 9:16, adds watermark + BGM
 *
 * If Runway processing is skipped (slow_motion=false), the client handles
 * everything and calls POST /api/process/videos/save to persist the result.
 *
 * Request body:
 *   { post_id, options?: { slow_motion, slow_motion_factor, add_bgm, bgm_track } }
 */

interface MediaRow {
  id: string;
  storage_path: string;
  store_id: string;
}

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

    const slowMotion = options?.slow_motion ?? true;

    // 1. Fetch video media records for this post
    const { data: mediaRows, error: mediaError } = await supabaseAdmin
      .from("media")
      .select("id, storage_path, store_id")
      .eq("post_id", post_id)
      .eq("type", "video");

    if (mediaError) {
      return NextResponse.json(
        { success: false, error: mediaError.message },
        { status: 500 }
      );
    }

    if (!mediaRows || mediaRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No videos found for this post" },
        { status: 404 }
      );
    }

    const results: {
      media_id: string;
      runway_video_url: string | null;
      original_signed_url: string;
    }[] = [];

    for (const row of mediaRows as MediaRow[]) {
      try {
        // Mark as processing
        await supabaseAdmin
          .from("media")
          .update({ processing_status: "processing" })
          .eq("id", row.id);

        // Get signed URL from Supabase Storage
        const bucket = row.storage_path.split("/")[0];
        const path = row.storage_path.replace(`${bucket}/`, "");

        const { data: signedData, error: signedError } =
          await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 600);

        if (signedError || !signedData?.signedUrl) {
          console.error(
            `Failed to get signed URL for ${row.id}:`,
            signedError
          );
          await supabaseAdmin
            .from("media")
            .update({ processing_status: "error" })
            .eq("id", row.id);
          continue;
        }

        const originalUrl = signedData.signedUrl;
        let runwayVideoUrl: string | null = null;

        // Phase 1: Runway ML processing (if slow_motion enabled)
        if (slowMotion) {
          try {
            const taskId = await createImageToVideoTask({
              imageUrl: originalUrl,
              promptText: `Smooth slow motion of this video at ${options?.slow_motion_factor ?? 0.5}x speed with warm, desaturated color grading`,
              duration: 5,
              ratio: "720:1280",
            });

            const result = await pollTaskUntilDone(taskId);

            if (result.output && result.output.length > 0) {
              runwayVideoUrl = result.output[0];

              // Download and store Runway result in Supabase
              const videoBuffer = await downloadVideo(runwayVideoUrl);
              const runwayPath = `${row.store_id}/${row.id}_runway.mp4`;

              await supabaseAdmin.storage
                .from("processed")
                .upload(runwayPath, videoBuffer, {
                  contentType: "video/mp4",
                  upsert: true,
                });

              const { data: publicData } = supabaseAdmin.storage
                .from("processed")
                .getPublicUrl(runwayPath);

              runwayVideoUrl = publicData?.publicUrl ?? runwayVideoUrl;
            }
          } catch (runwayErr) {
            console.error(
              `Runway processing failed for ${row.id}, retrying...`,
              runwayErr
            );

            // Retry once
            try {
              const taskId = await createImageToVideoTask({
                imageUrl: originalUrl,
                promptText: `Smooth slow motion with warm color grading`,
                duration: 5,
                ratio: "720:1280",
              });
              const result = await pollTaskUntilDone(taskId);
              if (result.output && result.output.length > 0) {
                runwayVideoUrl = result.output[0];
              }
            } catch {
              console.error(
                `Runway retry also failed for ${row.id}, skipping AI processing`
              );
            }
          }
        }

        results.push({
          media_id: row.id,
          runway_video_url: runwayVideoUrl,
          original_signed_url: originalUrl,
        });
      } catch (err) {
        console.error(`Error processing video ${row.id}:`, err);
        await supabaseAdmin
          .from("media")
          .update({ processing_status: "error" })
          .eq("id", row.id);
      }
    }

    // Return URLs for client-side FFmpeg processing
    return NextResponse.json({
      success: true,
      videos: results,
      options: {
        add_bgm: options?.add_bgm ?? true,
        bgm_track: options?.bgm_track ?? "lofi_01",
      },
    });
  } catch (error) {
    console.error("Video processing error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Video processing failed",
      },
      { status: 500 }
    );
  }
}
