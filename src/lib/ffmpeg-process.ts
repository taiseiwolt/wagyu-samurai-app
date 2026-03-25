/**
 * Browser-side FFmpeg processing using ffmpeg.wasm
 * Handles: 9:16 crop, watermark overlay, BGM mixing
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  // Load ffmpeg.wasm from CDN
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

export interface FFmpegProcessOptions {
  /** Input video as Blob or URL */
  inputVideo: Blob | string;
  /** Whether to add watermark */
  addWatermark?: boolean;
  /** BGM track key (e.g. "lofi_01") */
  bgmTrack?: string | null;
  /** Progress callback (0-100) */
  onProgress?: (pct: number) => void;
}

export interface FFmpegProcessResult {
  /** Processed video as Blob */
  videoBlob: Blob;
  /** Duration in seconds */
  durationSeconds: number;
  /** Resolution string */
  resolution: string;
}

export async function processVideoWithFFmpeg(
  opts: FFmpegProcessOptions
): Promise<FFmpegProcessResult> {
  const ff = await getFFmpeg();
  const { inputVideo, addWatermark = true, bgmTrack, onProgress } = opts;

  // Track progress
  ff.on("progress", ({ progress }) => {
    onProgress?.(Math.round(progress * 100));
  });

  // Write input video
  if (typeof inputVideo === "string") {
    const data = await fetchFile(inputVideo);
    await ff.writeFile("input.mp4", data);
  } else {
    const data = new Uint8Array(await inputVideo.arrayBuffer());
    await ff.writeFile("input.mp4", data);
  }

  // -----------------------------------------------------------------------
  // Step 1: Crop to 9:16 (center crop)
  // -----------------------------------------------------------------------
  await ff.exec([
    "-i", "input.mp4",
    "-vf", "crop=ih*9/16:ih",
    "-c:a", "copy",
    "-y", "cropped.mp4",
  ]);

  let currentInput = "cropped.mp4";

  // -----------------------------------------------------------------------
  // Step 2: Add watermark (if requested)
  // -----------------------------------------------------------------------
  if (addWatermark) {
    // Fetch watermark SVG and write it
    const wmData = await fetchFile("/assets/watermark.svg");
    await ff.writeFile("watermark.svg", wmData);

    await ff.exec([
      "-i", currentInput,
      "-i", "watermark.svg",
      "-filter_complex",
      "overlay=W-w-20:H-h-20",
      "-c:a", "copy",
      "-y", "watermarked.mp4",
    ]);
    currentInput = "watermarked.mp4";
  }

  // -----------------------------------------------------------------------
  // Step 3: Mix BGM (if requested)
  // -----------------------------------------------------------------------
  if (bgmTrack) {
    const bgmUrl = `/assets/bgm/${bgmTrack}.mp3`;
    try {
      const bgmData = await fetchFile(bgmUrl);
      await ff.writeFile("bgm.mp3", bgmData);

      await ff.exec([
        "-i", currentInput,
        "-i", "bgm.mp3",
        "-filter_complex",
        "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]",
        "-map", "0:v",
        "-map", "[a]",
        "-shortest",
        "-y", "final.mp4",
      ]);
      currentInput = "final.mp4";
    } catch {
      // BGM not available — skip silently
      console.warn(`BGM track ${bgmTrack} not available, skipping`);
    }
  }

  // -----------------------------------------------------------------------
  // Read output
  // -----------------------------------------------------------------------
  const outputData = await ff.readFile(currentInput);
  const videoBlob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: "video/mp4" });

  // Get duration and resolution via probe (approximate from file)
  // ffmpeg.wasm doesn't have full probe, so we extract from a quick pass
  let durationSeconds = 0;
  let resolution = "1080x1920";

  try {
    // Create a video element to get metadata
    const url = URL.createObjectURL(videoBlob);
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";

    await new Promise<void>((resolve) => {
      videoEl.onloadedmetadata = () => {
        durationSeconds = Math.round(videoEl.duration);
        resolution = `${videoEl.videoWidth}x${videoEl.videoHeight}`;
        resolve();
      };
      videoEl.onerror = () => resolve();
      videoEl.src = url;
    });

    URL.revokeObjectURL(url);
  } catch {
    // Fallback — metadata extraction failed
  }

  // Cleanup temp files
  const filesToClean = ["input.mp4", "cropped.mp4", "watermarked.mp4", "final.mp4", "watermark.svg", "bgm.mp3"];
  for (const f of filesToClean) {
    try { await ff.deleteFile(f); } catch { /* ignore */ }
  }

  return { videoBlob, durationSeconds, resolution };
}
